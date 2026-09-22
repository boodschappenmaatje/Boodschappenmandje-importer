create or replace function public.invalidate_recipe_readiness_after_match_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.invalidate_recipe_readiness_for_match_key(old.match_key, 'product_match_deleted');
    return old;
  end if;
  if tg_op = 'INSERT'
     or new.product_id is distinct from old.product_id
     or new.candidate_product_ids is distinct from old.candidate_product_ids
     or new.match_status is distinct from old.match_status
     or new.failure_reason is distinct from old.failure_reason
     or new.matcher_version is distinct from old.matcher_version
     or new.refresh_status is distinct from old.refresh_status
     or new.invalidated_at is distinct from old.invalidated_at then
    perform public.invalidate_recipe_readiness_for_match_key(new.match_key, 'product_match_changed');
  end if;
  return new;
end;
$$;
