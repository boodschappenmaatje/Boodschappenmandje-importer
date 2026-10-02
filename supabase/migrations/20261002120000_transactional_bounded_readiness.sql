begin;

-- Monotonic CAS counters, including absent match rows and subscriber phantoms.
-- No existing cache/source row is rewritten by installing this migration.
create table public.planner_write_revisions (
  resource text primary key,
  revision bigint not null default 0,
  bounded_only boolean not null default false
);
insert into public.planner_write_revisions(resource) values ('catalog');
alter table public.planner_write_revisions enable row level security;
revoke all on public.planner_write_revisions from public, anon, authenticated, service_role;

create function public.planner_lock_resources(resources text[])
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare resource_name text;
begin
  -- Try-locks also cover legacy row triggers: PostgreSQL may already hold a
  -- tuple lock there. Never wait with an inverted tuple/advisory lock order.
  -- A collision/deadlock risk becomes a retryable, fully rolled-back conflict.
  for resource_name in select distinct unnest(resources) order by 1 loop
    if not pg_try_advisory_xact_lock(hashtextextended('planner:' || resource_name, 0)) then
      raise exception using errcode = '55P03', message = 'bounded_scope_busy';
    end if;
  end loop;
end;
$$;

create function public.planner_catalog_write_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  -- Product search can discover previously unseen candidates; row locks on
  -- known product IDs cannot fence that phantom. Only catalog writers need
  -- this exclusive fence. Bounded commits share it and remain parallel.
  -- This BEFORE STATEMENT fence precedes source tuple locks. Wait here so
  -- existing import/profile writers can continue unchanged after a commit.
  perform pg_advisory_xact_lock(hashtextextended('planner:catalog', 0));
  update public.planner_write_revisions set revision = revision + 1 where resource = 'catalog';
  return null;
end;
$$;

do $$
declare source_table text;
begin
  foreach source_table in array array['products', 'product_prices', 'recipes',
      'ingredients', 'ingredient_aliases', 'recipe_ingredients', 'meal_mix_profiles'] loop
    execute format('create trigger planner_catalog_write_guard before insert or update or delete or truncate on public.%I for each statement execute function public.planner_catalog_write_guard()', source_table);
  end loop;
end;
$$;

create function public.planner_cache_write_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare
  keys text[] := '{}';
  resources text[] := '{}';
  scope jsonb := nullif(current_setting('planner.bounded_scope', true), '')::jsonb;
  resource_name text;
begin
  if tg_table_name = 'ingredient_product_matches' then
    if tg_op <> 'INSERT' then keys := array_append(keys, old.match_key); end if;
    if tg_op <> 'DELETE' then keys := array_append(keys, new.match_key); end if;
    if scope is not null and exists (
      select 1 from unnest(keys) k where not (scope->'matchKeys' ? k)
    ) then
      raise exception using errcode = 'P0001', message = 'bounded_outside_match_scope';
    end if;
  else
    if tg_op <> 'INSERT' then
      keys := keys || old.dependency_match_keys;
      resources := array_append(resources, 'r:' || old.recipe_id::text);
      if scope is not null and (not (scope->'recipeIds' ? old.recipe_id::text) or old.people_count not between 1 and 10) then
        raise exception using errcode = 'P0001', message = 'bounded_outside_readiness_scope';
      end if;
    end if;
    if tg_op <> 'DELETE' then
      keys := keys || new.dependency_match_keys;
      resources := array_append(resources, 'r:' || new.recipe_id::text);
      if scope is not null and (not (scope->'recipeIds' ? new.recipe_id::text) or new.people_count not between 1 and 10) then
        raise exception using errcode = 'P0001', message = 'bounded_outside_readiness_scope';
      end if;
    end if;
  end if;
  resources := resources || array(select 'k:' || k from unnest(keys) k);
  perform public.planner_lock_resources(resources);
  -- Older two-request writers cannot supply CAS. After a key has been
  -- transactionally maintained, their readiness payload must stay pending,
  -- even if evaluated before our commit and submitted after it. Fallback
  -- evaluation remains usable; only this RPC may publish current again.
  if tg_table_name = 'recipe_readiness_cache' and tg_op <> 'DELETE' and scope is null and new.refresh_status = 'current'
     and exists (select 1 from public.planner_write_revisions where resource = any(resources) and bounded_only) then
    new.refresh_status := 'pending';
    new.invalidated_at := clock_timestamp();
    new.invalidation_reason := 'transactional_refresh_required';
  end if;
  for resource_name in select distinct unnest(resources) order by 1 loop
    insert into public.planner_write_revisions(resource, revision) values(resource_name, 1)
    on conflict (resource) do update set revision = public.planner_write_revisions.revision + 1;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger aa_planner_cache_write_guard before insert or update or delete on public.ingredient_product_matches
for each row execute function public.planner_cache_write_guard();
create trigger aa_planner_cache_write_guard before insert or update or delete on public.recipe_readiness_cache
for each row execute function public.planner_cache_write_guard();

create function public.bounded_readiness_source_revision()
returns text language sql stable security definer set search_path = pg_catalog as $$
  select revision::text from public.planner_write_revisions where resource = 'catalog';
$$;

create function public.bounded_readiness_state(p_recipe_ids uuid[], p_match_keys text[], p_dependency_keys text[])
returns jsonb language sql stable security definer set search_path = pg_catalog as $$
  with resources as (
    select 'r:' || unnest(p_recipe_ids)::text as resource
    union select 'k:' || unnest(p_match_keys || p_dependency_keys)
    union select 'k:' || unnest(dependency_match_keys) from public.recipe_readiness_cache where recipe_id = any(p_recipe_ids)
  )
  select jsonb_build_object(
    'recipeIds', (select jsonb_agg(id order by id) from unnest(p_recipe_ids) id),
    'matchKeys', (select jsonb_agg(k order by k) from unnest(p_match_keys) k),
    'dependencyKeys', (select jsonb_agg(k order by k) from (select distinct unnest(p_dependency_keys) k) d),
    'sourceRevision', public.bounded_readiness_source_revision(),
    'resources', (select jsonb_agg(jsonb_build_array(r.resource, coalesce(v.revision, 0)::text) order by r.resource)
      from resources r left join public.planner_write_revisions v using(resource)),
    'subscribers', coalesce((select jsonb_agg(jsonb_build_array(recipe_id, people_count) order by recipe_id, people_count)
      from public.recipe_readiness_cache where dependency_match_keys && p_match_keys), '[]'::jsonb)
  );
$$;

create function public.bounded_readiness_plan(p_recipe_ids uuid[], p_match_keys text[], p_dependency_keys text[])
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare state jsonb;
begin
  if coalesce(cardinality(p_recipe_ids), 0) not between 1 and 10
     or coalesce(cardinality(p_match_keys), 0) not between 1 and 10
     or coalesce(cardinality(p_dependency_keys), 0) not between 1 and 1000
     or exists (select 1 from unnest(p_recipe_ids) id where id is null)
     or exists (select 1 from unnest(p_match_keys || p_dependency_keys) k where k is null or length(k) not between 1 and 200)
     or cardinality(p_recipe_ids) <> (select count(distinct id) from unnest(p_recipe_ids) id)
     or cardinality(p_match_keys) <> (select count(distinct k) from unnest(p_match_keys) k)
     or not p_match_keys <@ p_dependency_keys then
    raise exception using errcode = 'P0001', message = 'bounded_invalid_scope';
  end if;
  if (select count(*) from public.recipes where id = any(p_recipe_ids)) <> cardinality(p_recipe_ids) then
    raise exception using errcode = 'P0001', message = 'bounded_unknown_recipe';
  end if;
  if exists (select 1 from public.recipe_readiness_cache where dependency_match_keys && p_match_keys
    and (not recipe_id = any(p_recipe_ids) or people_count not between 1 and 10)) then
    raise exception using errcode = 'P0001', message = 'bounded_outside_subscriber';
  end if;
  state := public.bounded_readiness_state(p_recipe_ids, p_match_keys, p_dependency_keys);
  return jsonb_build_object('planToken', encode(sha256(convert_to(state::text, 'UTF8')), 'hex'),
    'sourceRevision', state->'sourceRevision', 'validatedScope', state - 'resources', 'state', state);
end;
$$;

create function public.commit_bounded_readiness(
  p_recipe_ids uuid[], p_match_keys text[], p_dependency_keys text[],
  p_expected_plan_token text, p_match_rows jsonb, p_readiness_rows jsonb
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  plan jsonb;
  final_plan jsonb;
  resources text[];
  match_count integer;
  readiness_count integer;
begin
  -- Fresh statement snapshots after locks are required for the CAS. PostgREST
  -- uses READ COMMITTED; fail closed if another caller changes isolation.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = 'P0001', message = 'bounded_requires_read_committed';
  end if;
  if not pg_try_advisory_xact_lock_shared(hashtextextended('planner:catalog', 0)) then
    raise exception using errcode = '55P03', message = 'bounded_catalog_busy';
  end if;
  plan := public.bounded_readiness_plan(p_recipe_ids, p_match_keys, p_dependency_keys);
  select array_agg(item->>0 order by item->>0) into resources from jsonb_array_elements(plan->'state'->'resources') item;
  perform public.planner_lock_resources(resources);
  plan := public.bounded_readiness_plan(p_recipe_ids, p_match_keys, p_dependency_keys);
  if p_expected_plan_token is null or plan->>'planToken' <> p_expected_plan_token then
    raise exception using errcode = 'P0001', message = 'bounded_stale_plan';
  end if;
  if jsonb_typeof(p_match_rows) is distinct from 'array' or jsonb_typeof(p_readiness_rows) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'bounded_invalid_payload';
  end if;
  if jsonb_array_length(p_match_rows) <> cardinality(p_match_keys)
     or jsonb_array_length(p_readiness_rows) <> cardinality(p_recipe_ids) * 10
     or (select count(distinct match_key) from jsonb_populate_recordset(null::public.ingredient_product_matches, p_match_rows)) <> cardinality(p_match_keys)
     or exists (select 1 from jsonb_populate_recordset(null::public.ingredient_product_matches, p_match_rows) m
       where m.match_key is null or not m.match_key = any(p_match_keys) or m.refresh_status is distinct from 'current'
         or m.invalidated_at is not null or m.invalidation_reason is not null)
     or (select count(distinct (recipe_id, people_count)) from jsonb_populate_recordset(null::public.recipe_readiness_cache, p_readiness_rows)) <> cardinality(p_recipe_ids) * 10
     or exists (select 1 from jsonb_populate_recordset(null::public.recipe_readiness_cache, p_readiness_rows) r
       where r.recipe_id is null or not r.recipe_id = any(p_recipe_ids) or r.people_count is null or r.people_count not between 1 and 10
         or r.dependency_match_keys is null or not r.dependency_match_keys <@ p_dependency_keys
         or not r.dependency_match_keys && p_match_keys or r.refresh_status is distinct from 'current'
         or r.invalidated_at is not null or r.invalidation_reason is not null)
     or exists (select 1 from unnest(p_match_keys) k where not exists (
       select 1 from jsonb_populate_recordset(null::public.recipe_readiness_cache, p_readiness_rows) r where k = any(r.dependency_match_keys))) then
    raise exception using errcode = 'P0001', message = 'bounded_payload_scope_mismatch';
  end if;
  perform set_config('planner.bounded_scope', jsonb_build_object('recipeIds', p_recipe_ids, 'matchKeys', p_match_keys)::text, true);
  -- Protect recipe identity too: a late legacy delete/reinsert with an old
  -- dependency set must not evade protection by omitting the maintained key.
  insert into public.planner_write_revisions(resource, bounded_only)
    select resource, true from (
      select 'k:' || k as resource from unnest(p_match_keys) k
      union select 'r:' || id::text from unnest(p_recipe_ids) id
    ) protected order by resource
    on conflict (resource) do update set bounded_only = true;

  insert into public.ingredient_product_matches (
    match_key, ingredient_id, ingredient_source_key, requirement_unit, requirement_kind, brand_constraint,
    product_id, candidate_product_ids, match_status, failure_reason, matcher_version, refresh_status,
    invalidated_at, invalidation_reason, product_updated_at, price_updated_at, matched_at, checked_at
  ) select match_key, ingredient_id, ingredient_source_key, requirement_unit, requirement_kind, brand_constraint,
    product_id, candidate_product_ids, match_status, failure_reason, matcher_version, refresh_status,
    invalidated_at, invalidation_reason, product_updated_at, price_updated_at, matched_at, checked_at
    from jsonb_populate_recordset(null::public.ingredient_product_matches, p_match_rows) order by match_key
  on conflict (match_key) do update set
    ingredient_id = excluded.ingredient_id, ingredient_source_key = excluded.ingredient_source_key,
    requirement_unit = excluded.requirement_unit, requirement_kind = excluded.requirement_kind,
    brand_constraint = excluded.brand_constraint, product_id = excluded.product_id,
    candidate_product_ids = excluded.candidate_product_ids, match_status = excluded.match_status,
    failure_reason = excluded.failure_reason, matcher_version = excluded.matcher_version,
    refresh_status = excluded.refresh_status, invalidated_at = excluded.invalidated_at,
    invalidation_reason = excluded.invalidation_reason, product_updated_at = excluded.product_updated_at,
    price_updated_at = excluded.price_updated_at, matched_at = excluded.matched_at, checked_at = excluded.checked_at;
  get diagnostics match_count = row_count;

  -- Existing AFTER match invalidation stays enabled. Every affected readiness
  -- row passed the guard above; an outside trigger effect raises and rolls
  -- back the match write, invalidations, revisions and protection flag too.
  perform public.bounded_readiness_plan(p_recipe_ids, p_match_keys, p_dependency_keys);
  insert into public.recipe_readiness_cache (
    recipe_id, people_count, readiness_status, required_ingredient_count, ready_required_ingredient_count,
    problem_count, readiness_payload, dependency_match_keys, evaluator_version, refresh_status,
    invalidated_at, invalidation_reason, evaluated_at, expires_at
  ) select recipe_id, people_count, readiness_status, required_ingredient_count, ready_required_ingredient_count,
    problem_count, readiness_payload, dependency_match_keys, evaluator_version, refresh_status,
    invalidated_at, invalidation_reason, evaluated_at, expires_at
    from jsonb_populate_recordset(null::public.recipe_readiness_cache, p_readiness_rows) order by recipe_id, people_count
  on conflict (recipe_id, people_count) do update set
    readiness_status = excluded.readiness_status, required_ingredient_count = excluded.required_ingredient_count,
    ready_required_ingredient_count = excluded.ready_required_ingredient_count, problem_count = excluded.problem_count,
    readiness_payload = excluded.readiness_payload, dependency_match_keys = excluded.dependency_match_keys,
    evaluator_version = excluded.evaluator_version, refresh_status = excluded.refresh_status,
    invalidated_at = excluded.invalidated_at, invalidation_reason = excluded.invalidation_reason,
    evaluated_at = excluded.evaluated_at, expires_at = excluded.expires_at;
  get diagnostics readiness_count = row_count;
  final_plan := public.bounded_readiness_plan(p_recipe_ids, p_match_keys, p_dependency_keys);
  perform set_config('planner.bounded_scope', '', true);
  return jsonb_build_object('blocked', false, 'reason', null, 'matchWrites', match_count,
    'readinessWrites', readiness_count, 'validatedScope', final_plan->'validatedScope',
    'finalPlanToken', final_plan->'planToken', 'outsideScopeEffects', 0);
end;
$$;

revoke all on function public.planner_lock_resources(text[]) from public, anon, authenticated, service_role;
revoke all on function public.planner_catalog_write_guard() from public, anon, authenticated, service_role;
revoke all on function public.planner_cache_write_guard() from public, anon, authenticated, service_role;
revoke all on function public.bounded_readiness_state(uuid[], text[], text[]) from public, anon, authenticated, service_role;
revoke all on function public.bounded_readiness_source_revision() from public, anon, authenticated;
revoke all on function public.bounded_readiness_plan(uuid[], text[], text[]) from public, anon, authenticated;
revoke all on function public.commit_bounded_readiness(uuid[], text[], text[], text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.bounded_readiness_source_revision() to service_role;
grant execute on function public.bounded_readiness_plan(uuid[], text[], text[]) to service_role;
grant execute on function public.commit_bounded_readiness(uuid[], text[], text[], text, jsonb, jsonb) to service_role;

commit;
