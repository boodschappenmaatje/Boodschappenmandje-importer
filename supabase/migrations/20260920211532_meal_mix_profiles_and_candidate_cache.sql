-- Additive storage: preserve the full candidate set for quantity-aware choices.
alter table public.ingredient_product_matches
  add column if not exists candidate_product_ids uuid[] not null default '{}';
create index if not exists ingredient_product_matches_candidates_idx
  on public.ingredient_product_matches using gin(candidate_product_ids);

create table if not exists public.meal_mix_profiles (
  product_id uuid primary key references public.products(id) on delete cascade,
  recipe_id uuid unique references public.recipes(id),
  product_name text not null,
  brand text not null check (brand in ('Honig', 'Knorr')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'needs_review')),
  cache_status text not null default 'pending' check (cache_status in ('pending', 'current')),
  profile jsonb,
  reason text,
  source_url text,
  source_fingerprint text,
  source_evidence text,
  source_product_updated_at timestamptz,
  parser_version integer not null default 1,
  checked_at timestamptz,
  updated_at timestamptz not null default now(),
  check (status <> 'verified' or (
    recipe_id is not null and profile is not null and jsonb_typeof(profile) = 'object'
    and profile->>'verificationStatus' = 'verified'
    and profile->>'productId' = product_id::text
    and (profile->>'servingsPerPackage')::numeric between 1 and 12
    and jsonb_typeof(profile->'supplements') = 'array'
    and jsonb_array_length(profile->'supplements') > 0
  ))
);
create index if not exists meal_mix_profiles_pending_idx on public.meal_mix_profiles(updated_at)
  where status = 'pending';
alter table public.meal_mix_profiles enable row level security;
revoke all on public.meal_mix_profiles from anon, authenticated;
grant select on public.meal_mix_profiles to anon, authenticated;
grant select, insert, update, delete on public.meal_mix_profiles to service_role;
create policy meal_mix_profiles_public_read on public.meal_mix_profiles
  for select to anon, authenticated using (true);

create or replace function public.queue_meal_mix_profile()
returns trigger language plpgsql security invoker set search_path = public as $$
declare supported boolean;
begin
  -- Price-only or import timestamp updates do not refetch unchanged profiles.
  if tg_op = 'UPDATE' and
    (old.name, old.brand, old.package_text, old.source_url, old.category, old.is_available)
    is not distinct from
    (new.name, new.brand, new.package_text, new.source_url, new.category, new.is_available)
  then return new; end if;
  supported := new.name ~* '^(honig|knorr)\y' and
    (coalesce(new.category, '') ~* '(maaltijdmixen|maaltijdpakketten)' or
     new.name ~* '\y(bakplaat mix|basis voor|mix voor|maaltijdmix|wereldgerecht|wereldgerechten|familiegerecht|maaltijdsoep|risotto|spaghetteria)\y')
    and new.name !~* '\y(kippensoep|tomatensoep)\y';
  if supported then
    insert into public.meal_mix_profiles(product_id, product_name, brand, status, source_url)
    values(new.id, new.name, case when new.name ~* '^honig' then 'Honig' else 'Knorr' end, 'pending', new.source_url)
    on conflict (product_id) do update set product_name = excluded.product_name,
      brand = excluded.brand, status = 'pending', reason = 'catalog_product_changed',
      cache_status = 'pending',
      source_url = excluded.source_url, updated_at = now();
  else
    update public.meal_mix_profiles set status = 'needs_review', reason = 'no_longer_supported', updated_at = now()
    where product_id = new.id;
  end if;
  update public.recipe_readiness_cache set refresh_status = 'pending', invalidated_at = now(),
    invalidation_reason = 'meal_mix_profile_changed'
  where recipe_id in (select recipe_id from public.meal_mix_profiles where product_id = new.id);
  return new;
end;
$$;
create trigger products_queue_meal_mix_profile after insert or update on public.products
  for each row execute function public.queue_meal_mix_profile();
revoke all on function public.queue_meal_mix_profile() from public, anon, authenticated;
grant execute on function public.queue_meal_mix_profile() to service_role;

create or replace function public.invalidate_mix_profile_readiness()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if (old.status, old.profile, old.recipe_id) is distinct from (new.status, new.profile, new.recipe_id) then
    update public.recipe_readiness_cache set refresh_status = 'pending', invalidated_at = now(),
      invalidation_reason = 'meal_mix_profile_changed'
    where recipe_id in (old.recipe_id, new.recipe_id);
  end if;
  return new;
end;
$$;
create trigger meal_mix_profiles_invalidate_readiness after update on public.meal_mix_profiles
  for each row execute function public.invalidate_mix_profile_readiness();
revoke all on function public.invalidate_mix_profile_readiness() from public, anon, authenticated;
grant execute on function public.invalidate_mix_profile_readiness() to service_role;

create or replace function public.invalidate_candidate_matches()
returns trigger language plpgsql security invoker set search_path = public as $$
declare affected uuid;
begin
  if tg_table_name = 'products' then
    affected := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    affected := case when tg_op = 'DELETE' then old.product_id else new.product_id end;
  end if;
  update public.ingredient_product_matches set refresh_status = 'pending',
    invalidated_at = now(), invalidation_reason = 'candidate_product_or_price_changed'
  where candidate_product_ids @> array[affected];
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger products_invalidate_candidate_matches after update or delete on public.products
  for each row execute function public.invalidate_candidate_matches();
create trigger prices_invalidate_candidate_matches after insert or update or delete on public.product_prices
  for each row execute function public.invalidate_candidate_matches();
revoke all on function public.invalidate_candidate_matches() from public, anon, authenticated;
grant execute on function public.invalidate_candidate_matches() to service_role;

-- Queue existing catalog candidates; this does not import or modify products.
insert into public.meal_mix_profiles(product_id, product_name, brand, source_url)
select id, name, case when name ~* '^honig' then 'Honig' else 'Knorr' end, source_url
from public.products
where name ~* '^(honig|knorr)\y' and
  (coalesce(category, '') ~* '(maaltijdmixen|maaltijdpakketten)' or
   name ~* '\y(bakplaat mix|basis voor|mix voor|maaltijdmix|wereldgerecht|wereldgerechten|familiegerecht|maaltijdsoep|risotto|spaghetteria)\y')
  and name !~* '\y(kippensoep|tomatensoep)\y'
on conflict (product_id) do nothing;
