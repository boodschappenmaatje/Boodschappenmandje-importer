begin;

-- Afgeleide plannerdata. Deze tabellen bevatten geen nieuwe recept- of
-- catalogusbrondata en mogen altijd opnieuw worden opgebouwd.
create table if not exists public.ingredient_product_matches (
  match_key text primary key,
  ingredient_id uuid references public.ingredients(id) on delete cascade,
  ingredient_source_key text not null,
  requirement_unit text not null,
  requirement_kind text not null,
  brand_constraint text not null default '',
  product_id uuid references public.products(id) on delete set null,
  match_status text not null,
  failure_reason text,
  matcher_version integer not null,
  refresh_status text not null default 'current',
  invalidated_at timestamptz,
  invalidation_reason text,
  product_updated_at timestamptz,
  price_updated_at timestamptz,
  matched_at timestamptz not null default now(),
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingredient_product_matches_key_not_blank
    check (length(btrim(match_key)) > 0),
  constraint ingredient_product_matches_source_key_not_blank
    check (length(btrim(ingredient_source_key)) > 0),
  constraint ingredient_product_matches_unit_check
    check (requirement_unit in ('g', 'kg', 'ml', 'l', 'piece', 'loaf')),
  constraint ingredient_product_matches_kind_check
    check (requirement_kind in ('ingredient', 'mealMix')),
  constraint ingredient_product_matches_status_check
    check (match_status in ('valid', 'invalid')),
  constraint ingredient_product_matches_refresh_check
    check (refresh_status in ('current', 'pending', 'failed')),
  constraint ingredient_product_matches_product_check
    check (
      (match_status = 'valid' and product_id is not null and failure_reason is null)
      or
      (match_status = 'invalid' and product_id is null and failure_reason is not null)
    )
);

create index if not exists ingredient_product_matches_ingredient_idx
  on public.ingredient_product_matches (ingredient_id);

create index if not exists ingredient_product_matches_source_key_idx
  on public.ingredient_product_matches (ingredient_source_key);

create index if not exists ingredient_product_matches_product_idx
  on public.ingredient_product_matches (product_id)
  where product_id is not null;

create index if not exists ingredient_product_matches_refresh_idx
  on public.ingredient_product_matches (refresh_status, invalidated_at);

create table if not exists public.recipe_readiness_cache (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  people_count integer not null,
  readiness_status text not null,
  required_ingredient_count integer not null,
  ready_required_ingredient_count integer not null,
  problem_count integer not null,
  readiness_payload jsonb not null,
  dependency_match_keys text[] not null default '{}',
  evaluator_version integer not null,
  refresh_status text not null default 'current',
  invalidated_at timestamptz,
  invalidation_reason text,
  evaluated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (recipe_id, people_count),
  constraint recipe_readiness_cache_people_check
    check (people_count between 1 and 12),
  constraint recipe_readiness_cache_status_check
    check (readiness_status in ('READY', 'NOT_READY')),
  constraint recipe_readiness_cache_refresh_check
    check (refresh_status in ('current', 'pending', 'failed')),
  constraint recipe_readiness_cache_counts_check
    check (
      required_ingredient_count >= 0
      and ready_required_ingredient_count >= 0
      and ready_required_ingredient_count <= required_ingredient_count
      and problem_count >= 0
    ),
  constraint recipe_readiness_cache_payload_check
    check (jsonb_typeof(readiness_payload) = 'object')
);

create index if not exists recipe_readiness_cache_refresh_idx
  on public.recipe_readiness_cache
    (people_count, refresh_status, invalidated_at, expires_at);

create index if not exists recipe_readiness_cache_dependency_keys_idx
  on public.recipe_readiness_cache using gin (dependency_match_keys);

create or replace function public.set_planner_cache_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ingredient_product_matches_set_updated_at
  on public.ingredient_product_matches;
create trigger ingredient_product_matches_set_updated_at
before update on public.ingredient_product_matches
for each row execute function public.set_planner_cache_updated_at();

drop trigger if exists recipe_readiness_cache_set_updated_at
  on public.recipe_readiness_cache;
create trigger recipe_readiness_cache_set_updated_at
before update on public.recipe_readiness_cache
for each row execute function public.set_planner_cache_updated_at();

create or replace function public.invalidate_recipe_readiness_for_match_key(
  affected_match_key text,
  reason text
)
returns void
language sql
set search_path = public
as $$
  update public.recipe_readiness_cache
  set
    refresh_status = 'pending',
    invalidated_at = coalesce(invalidated_at, now()),
    invalidation_reason = reason
  where dependency_match_keys @> array[affected_match_key]::text[];
$$;

create or replace function public.invalidate_recipe_readiness_after_match_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.invalidate_recipe_readiness_for_match_key(
      old.match_key,
      'product_match_deleted'
    );
    return old;
  end if;

  if tg_op = 'INSERT'
     or new.product_id is distinct from old.product_id
     or new.match_status is distinct from old.match_status
     or new.failure_reason is distinct from old.failure_reason
     or new.matcher_version is distinct from old.matcher_version
     or new.refresh_status is distinct from old.refresh_status
     or new.invalidated_at is distinct from old.invalidated_at then
    perform public.invalidate_recipe_readiness_for_match_key(
      new.match_key,
      'product_match_changed'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists ingredient_product_matches_invalidate_readiness
  on public.ingredient_product_matches;
create trigger ingredient_product_matches_invalidate_readiness
after insert or update or delete on public.ingredient_product_matches
for each row execute function public.invalidate_recipe_readiness_after_match_change();

create or replace function public.invalidate_recipe_readiness_for_recipe_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  affected_recipe_id uuid;
begin
  affected_recipe_id := new.id;
  update public.recipe_readiness_cache
  set
    refresh_status = 'pending',
    invalidated_at = coalesce(invalidated_at, now()),
    invalidation_reason = 'recipe_changed'
  where recipe_id = affected_recipe_id;
  return new;
end;
$$;

drop trigger if exists recipes_invalidate_readiness on public.recipes;
create trigger recipes_invalidate_readiness
after update on public.recipes
for each row execute function public.invalidate_recipe_readiness_for_recipe_change();

create or replace function public.invalidate_recipe_readiness_for_relation_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.recipe_readiness_cache
    set
      refresh_status = 'pending',
      invalidated_at = coalesce(invalidated_at, now()),
      invalidation_reason = 'recipe_ingredient_changed'
    where recipe_id = old.recipe_id;
    return old;
  end if;

  update public.recipe_readiness_cache
  set
    refresh_status = 'pending',
    invalidated_at = coalesce(invalidated_at, now()),
    invalidation_reason = 'recipe_ingredient_changed'
  where recipe_id = new.recipe_id
     or (tg_op = 'UPDATE' and recipe_id = old.recipe_id);
  return new;
end;
$$;

drop trigger if exists recipe_ingredients_invalidate_readiness
  on public.recipe_ingredients;
create trigger recipe_ingredients_invalidate_readiness
after insert or update or delete on public.recipe_ingredients
for each row execute function public.invalidate_recipe_readiness_for_relation_change();

create or replace function public.invalidate_matches_for_ingredient_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  affected_ingredient_id uuid;
begin
  affected_ingredient_id := new.id;
  update public.ingredient_product_matches
  set
    refresh_status = 'pending',
    invalidated_at = coalesce(invalidated_at, now()),
    invalidation_reason = 'ingredient_changed'
  where ingredient_id = affected_ingredient_id;
  return new;
end;
$$;

drop trigger if exists ingredients_invalidate_matches on public.ingredients;
create trigger ingredients_invalidate_matches
after update on public.ingredients
for each row execute function public.invalidate_matches_for_ingredient_change();

create or replace function public.invalidate_matches_for_alias_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  affected_ingredient_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_ingredient_id := old.ingredient_id;
  else
    affected_ingredient_id := new.ingredient_id;
  end if;
  update public.ingredient_product_matches
  set
    refresh_status = 'pending',
    invalidated_at = coalesce(invalidated_at, now()),
    invalidation_reason = 'ingredient_alias_changed'
  where ingredient_id = affected_ingredient_id;
  if tg_op = 'UPDATE' and old.ingredient_id is distinct from new.ingredient_id then
    update public.ingredient_product_matches
    set
      refresh_status = 'pending',
      invalidated_at = coalesce(invalidated_at, now()),
      invalidation_reason = 'ingredient_alias_changed'
    where ingredient_id = old.ingredient_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists ingredient_aliases_invalidate_matches
  on public.ingredient_aliases;
create trigger ingredient_aliases_invalidate_matches
after insert or update or delete on public.ingredient_aliases
for each row execute function public.invalidate_matches_for_alias_change();

create or replace function public.invalidate_matches_for_product_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  affected_product_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_product_id := old.id;
  else
    affected_product_id := new.id;
  end if;
  update public.ingredient_product_matches
  set
    refresh_status = 'pending',
    invalidated_at = coalesce(invalidated_at, now()),
    invalidation_reason = 'catalog_product_changed'
  where product_id = affected_product_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists products_invalidate_matches on public.products;
create trigger products_invalidate_matches
after update or delete on public.products
for each row execute function public.invalidate_matches_for_product_change();

create or replace function public.invalidate_readiness_for_price_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  affected_product_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_product_id := old.product_id;
  else
    affected_product_id := new.product_id;
  end if;
  update public.recipe_readiness_cache
  set
    refresh_status = 'pending',
    invalidated_at = coalesce(invalidated_at, now()),
    invalidation_reason = 'product_price_changed'
  where dependency_match_keys && array(
    select match_key
    from public.ingredient_product_matches
    where product_id = affected_product_id
  );
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    update public.recipe_readiness_cache
    set
      refresh_status = 'pending',
      invalidated_at = coalesce(invalidated_at, now()),
      invalidation_reason = 'product_price_changed'
    where dependency_match_keys && array(
      select match_key
      from public.ingredient_product_matches
      where product_id = old.product_id
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists product_prices_invalidate_readiness
  on public.product_prices;
create trigger product_prices_invalidate_readiness
after insert or update or delete on public.product_prices
for each row execute function public.invalidate_readiness_for_price_change();

alter table public.ingredient_product_matches enable row level security;
alter table public.recipe_readiness_cache enable row level security;

revoke all on public.ingredient_product_matches from anon, authenticated;
revoke all on public.recipe_readiness_cache from anon, authenticated;
grant select on public.ingredient_product_matches to anon, authenticated;
grant select on public.recipe_readiness_cache to anon, authenticated;
grant select, insert, update, delete on public.ingredient_product_matches to service_role;
grant select, insert, update, delete on public.recipe_readiness_cache to service_role;

drop policy if exists ingredient_product_matches_read_only
  on public.ingredient_product_matches;
create policy ingredient_product_matches_read_only
  on public.ingredient_product_matches
  for select
  to anon, authenticated
  using (true);

drop policy if exists recipe_readiness_cache_read_only
  on public.recipe_readiness_cache;
create policy recipe_readiness_cache_read_only
  on public.recipe_readiness_cache
  for select
  to anon, authenticated
  using (true);

revoke all on function public.invalidate_recipe_readiness_for_match_key(text, text)
  from public, anon, authenticated;
revoke all on function public.set_planner_cache_updated_at()
  from public, anon, authenticated;
revoke all on function public.invalidate_recipe_readiness_after_match_change()
  from public, anon, authenticated;
revoke all on function public.invalidate_recipe_readiness_for_recipe_change()
  from public, anon, authenticated;
revoke all on function public.invalidate_recipe_readiness_for_relation_change()
  from public, anon, authenticated;
revoke all on function public.invalidate_matches_for_ingredient_change()
  from public, anon, authenticated;
revoke all on function public.invalidate_matches_for_alias_change()
  from public, anon, authenticated;
revoke all on function public.invalidate_matches_for_product_change()
  from public, anon, authenticated;
revoke all on function public.invalidate_readiness_for_price_change()
  from public, anon, authenticated;
grant execute on function public.invalidate_recipe_readiness_for_match_key(text, text)
  to service_role;

comment on table public.ingredient_product_matches is
  'Afgeleide, opnieuw opbouwbare centrale matchcache voor planner en Data Health.';
comment on table public.recipe_readiness_cache is
  'Afgeleide, opnieuw opbouwbare READY/NOT READY-bron voor planner en Data Health.';

commit;
