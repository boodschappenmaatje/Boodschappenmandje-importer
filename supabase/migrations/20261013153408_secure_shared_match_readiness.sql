begin;

create or replace function public.bounded_readiness_plan(
  p_recipe_ids uuid[], p_match_keys text[], p_dependency_keys text[]
)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare state jsonb;
begin
  -- Keep the transaction bounded at 20 recipes × 10 supported people counts
  -- (200 readiness rows). Small existing requests remain inside this cap.
  if coalesce(cardinality(p_recipe_ids), 0) not between 1 and 20
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
  -- The caller's recipe list must be exactly the DB-derived subscriber set.
  -- Requiring all ten distinct people rows also fails closed on partial cache
  -- state instead of letting a refresh publish only part of a recipe's scope.
  if exists (select 1 from unnest(p_recipe_ids) id where not exists (
       select 1 from public.recipe_readiness_cache r
       where r.recipe_id = id and r.dependency_match_keys && p_match_keys))
     or (select count(*) from public.recipe_readiness_cache where dependency_match_keys && p_match_keys)
       <> cardinality(p_recipe_ids) * 10
     or exists (select 1 from unnest(p_recipe_ids) id where (
       select count(*) from public.recipe_readiness_cache r
       where r.recipe_id = id and r.dependency_match_keys && p_match_keys
         and r.people_count between 1 and 10) <> 10) then
    raise exception using errcode = 'P0001', message = 'bounded_subscriber_set_mismatch';
  end if;
  state := public.bounded_readiness_state(p_recipe_ids, p_match_keys, p_dependency_keys);
  return jsonb_build_object('planToken', encode(sha256(convert_to(state::text, 'UTF8')), 'hex'),
    'sourceRevision', state->'sourceRevision', 'validatedScope', state - 'resources', 'state', state);
end;
$$;

commit;
