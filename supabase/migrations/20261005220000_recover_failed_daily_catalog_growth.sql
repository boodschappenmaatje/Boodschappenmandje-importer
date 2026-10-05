begin;

-- A failed_requires_attention job can be reopened only once, through the
-- service-role recovery RPC below. The normal scheduler and claim RPC remain
-- unable to reopen this terminal state.
alter table public.catalog_daily_jobs
  add column if not exists recovery_count integer not null default 0;

alter table public.catalog_daily_jobs
  add constraint catalog_daily_jobs_recovery_count_check
  check (recovery_count between 0 and 1);

create table if not exists public.catalog_daily_recoveries (
  id uuid primary key default gen_random_uuid(),
  daily_job_id uuid not null references public.catalog_daily_jobs(id),
  previous_attempt_id uuid references public.catalog_daily_attempts(id),
  new_attempt_id uuid not null references public.catalog_daily_attempts(id),
  recovered_at timestamptz not null,
  original_failure_status text not null check (original_failure_status = 'failed_requires_attention'),
  original_failure_reason text,
  recovery_reason text not null check (btrim(recovery_reason) <> '' and length(recovery_reason) <= 240),
  new_products_before integer not null check (new_products_before >= 0),
  remaining_target_before integer not null check (remaining_target_before > 0),
  expected_updated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists catalog_daily_recoveries_job_once_idx
  on public.catalog_daily_recoveries (daily_job_id);
create index if not exists catalog_daily_recoveries_attempt_idx
  on public.catalog_daily_recoveries (new_attempt_id);

alter table public.catalog_daily_recoveries enable row level security;
revoke all on public.catalog_daily_recoveries from anon, authenticated;
grant select on public.catalog_daily_recoveries to service_role;

create or replace function public.recover_catalog_daily_attempt(
  p_job_id uuid,
  p_state_key text,
  p_job_date date,
  p_expected_status text,
  p_expected_updated_at timestamptz,
  p_expected_attempt_count integer,
  p_expected_new_products_collected integer,
  p_expected_remaining_target integer,
  p_recovery_reason text,
  p_now timestamptz default now(),
  p_lock_ttl_minutes integer default 130
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.catalog_daily_jobs;
  v_previous_attempt public.catalog_daily_attempts;
  v_attempt_id uuid := gen_random_uuid();
  v_lock_token uuid := gen_random_uuid();
  v_recovery_id uuid := gen_random_uuid();
  v_running_attempts integer;
  v_remaining integer;
begin
  if p_expected_status <> 'failed_requires_attention' then
    raise exception 'daily recovery vereist failed_requires_attention';
  end if;
  if p_recovery_reason is null or btrim(p_recovery_reason) = ''
     or length(p_recovery_reason) > 240
     or btrim(p_recovery_reason) not in ('software_fix_verified', 'infrastructure_fix_verified') then
    raise exception 'daily recovery reason ontbreekt of is te lang';
  end if;
  if p_expected_updated_at is null or p_expected_attempt_count < 1
     or p_expected_new_products_collected < 0 or p_expected_remaining_target <= 0 then
    raise exception 'daily recovery expected state is ongeldig';
  end if;
  if p_lock_ttl_minutes < 1 or p_lock_ttl_minutes > 130 then
    raise exception 'daily recovery lockduur is ongeldig';
  end if;

  select * into strict v_job
  from public.catalog_daily_jobs
  where id = p_job_id and state_key = p_state_key and job_date = p_job_date
  for update;

  if v_job.status <> 'failed_requires_attention'
     or v_job.status <> p_expected_status then
    raise exception 'daily recovery status conflict';
  end if;
  if v_job.updated_at is distinct from p_expected_updated_at
     or v_job.attempt_count <> p_expected_attempt_count
     or v_job.new_products_collected <> p_expected_new_products_collected
     or greatest(0, v_job.target_new_products - v_job.new_products_collected)
          <> p_expected_remaining_target then
    raise exception 'daily recovery revision conflict';
  end if;
  if v_job.target_new_products <> 400
     or v_job.new_products_collected >= v_job.target_new_products
     or v_job.recovery_count <> 0 then
    raise exception 'daily recovery is niet toegestaan voor deze dagjob';
  end if;
  if v_job.lock_token is not null or v_job.lock_expires_at is not null then
    raise exception 'daily recovery heeft een actieve lock';
  end if;

  select count(*) into v_running_attempts
  from public.catalog_daily_attempts
  where daily_job_id = v_job.id and status = 'running';
  if v_running_attempts <> 0 then
    raise exception 'daily recovery heeft een actieve attempt';
  end if;

  select * into v_previous_attempt
  from public.catalog_daily_attempts
  where daily_job_id = v_job.id
  order by attempt_number desc
  limit 1;
  if not found or v_previous_attempt.status <> 'non_retryable_failure'
     or v_previous_attempt.completed_at is null then
    raise exception 'daily recovery vorige attempt is niet definitief beëindigd';
  end if;

  v_remaining := v_job.target_new_products - v_job.new_products_collected;

  update public.catalog_daily_jobs
    set status = 'running',
        attempt_count = attempt_count + 1,
        last_attempt_at = p_now,
        next_retry_at = null,
        completed_at = null,
        lock_token = v_lock_token,
        lock_expires_at = p_now + make_interval(mins => p_lock_ttl_minutes),
        recovery_count = recovery_count + 1,
        updated_at = p_now
    where id = v_job.id
    returning * into v_job;

  insert into public.catalog_daily_attempts (
    id, daily_job_id, attempt_number, started_at, status,
    cumulative_new_after, remaining_target_after
  ) values (
    v_attempt_id, v_job.id, v_job.attempt_count, p_now, 'running',
    v_job.new_products_collected, v_remaining
  );

  insert into public.catalog_daily_recoveries (
    id, daily_job_id, previous_attempt_id, new_attempt_id, recovered_at,
    original_failure_status, original_failure_reason, recovery_reason,
    new_products_before, remaining_target_before, expected_updated_at
  ) values (
    v_recovery_id, v_job.id, v_previous_attempt.id, v_attempt_id, p_now,
    'failed_requires_attention', v_previous_attempt.error_code,
    btrim(p_recovery_reason), v_job.new_products_collected, v_remaining,
    p_expected_updated_at
  );

  return jsonb_build_object(
    'claimed', true,
    'recovered', true,
    'reason', 'recovered_and_claimed',
    'recoveryId', v_recovery_id,
    'attemptId', v_attempt_id,
    'lockToken', v_lock_token,
    'job', to_jsonb(v_job)
  );
end;
$$;

revoke all on function public.recover_catalog_daily_attempt(
  uuid, text, date, text, timestamptz, integer, integer, integer, text, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.recover_catalog_daily_attempt(
  uuid, text, date, text, timestamptz, integer, integer, integer, text, timestamptz, integer
) to service_role;

comment on table public.catalog_daily_recoveries is
  'Append-only audit van de ene expliciete software/infrastructuurherstelpoging per daily job.';

commit;
