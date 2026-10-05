begin;

-- A terminal daily job is never reopened and its history is never deleted.
-- This migration permits exactly one explicit maintenance successor for the
-- same state key and Europe/Amsterdam calendar day.
alter table public.catalog_daily_jobs
  drop constraint if exists catalog_daily_jobs_unique_day;

alter table public.catalog_daily_jobs
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by_job_id uuid references public.catalog_daily_jobs(id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'catalog_daily_jobs_supersede_link_check'
      and conrelid = 'public.catalog_daily_jobs'::regclass
  ) then
    alter table public.catalog_daily_jobs
      add constraint catalog_daily_jobs_supersede_link_check
      check (
        superseded_by_job_id is null or superseded_at is not null
      );
  end if;
end $$;

-- There is one current row per logical state key/day. Historical superseded
-- rows remain queryable and retain their original status and counters.
create unique index if not exists catalog_daily_jobs_current_day_idx
  on public.catalog_daily_jobs (state_key, job_date)
  where superseded_at is null;

create index if not exists catalog_daily_jobs_superseded_by_idx
  on public.catalog_daily_jobs (superseded_by_job_id)
  where superseded_by_job_id is not null;

create table if not exists public.catalog_daily_supersedes (
  id uuid primary key default gen_random_uuid(),
  previous_daily_job_id uuid not null references public.catalog_daily_jobs(id),
  new_daily_job_id uuid not null references public.catalog_daily_jobs(id),
  state_key text not null,
  job_date date not null,
  superseded_at timestamptz not null,
  original_status text not null check (original_status = 'failed_requires_attention'),
  original_new_products_collected integer not null check (original_new_products_collected >= 0),
  original_target_new_products integer not null check (original_target_new_products = 400),
  original_remaining_target integer not null check (original_remaining_target > 0),
  original_failure_reason text not null check (btrim(original_failure_reason) <> ''),
  original_failure_summary text,
  supersede_reason text not null check (supersede_reason in ('software_fix_verified', 'importer_updated')),
  actor_context text not null check (btrim(actor_context) <> '' and length(actor_context) <= 240),
  expected_updated_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Both indexes are intentional: a failed row can be superseded only once,
-- and a calendar day can have only one maintenance successor even if a later
-- caller tries to supersede the successor again.
create unique index if not exists catalog_daily_supersedes_previous_once_idx
  on public.catalog_daily_supersedes (previous_daily_job_id);
create unique index if not exists catalog_daily_supersedes_new_once_idx
  on public.catalog_daily_supersedes (new_daily_job_id);
create unique index if not exists catalog_daily_supersedes_day_once_idx
  on public.catalog_daily_supersedes (state_key, job_date);
create index if not exists catalog_daily_supersedes_time_idx
  on public.catalog_daily_supersedes (superseded_at desc);

alter table public.catalog_daily_supersedes enable row level security;
revoke all on public.catalog_daily_supersedes from anon, authenticated;
grant select on public.catalog_daily_supersedes to service_role;

-- The old ensure function used ON CONFLICT against the removed all-history
-- uniqueness constraint. Keep normal scheduler/claim behavior unchanged while
-- making it select the one current row and serialize first-row creation.
create or replace function public.ensure_catalog_daily_job(
  p_state_key text,
  p_job_date date,
  p_target_new_products integer,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.catalog_daily_jobs;
begin
  if p_state_key is null or btrim(p_state_key) = '' then
    raise exception 'state_key ontbreekt';
  end if;
  if p_target_new_products < 1 or p_target_new_products > 400 then
    raise exception 'target_new_products moet tussen 1 en 400 liggen';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_state_key || ':' || p_job_date::text, 0));

  select * into v_job
  from public.catalog_daily_jobs
  where state_key = p_state_key
    and job_date = p_job_date
    and superseded_at is null
  order by created_at desc, id desc
  limit 1
  for update;

  if not found then
    insert into public.catalog_daily_jobs (
      state_key, job_date, target_new_products, started_at, created_at, updated_at
    ) values (
      p_state_key, p_job_date, p_target_new_products, p_now, p_now, p_now
    )
    returning * into v_job;
  end if;

  return to_jsonb(v_job);
end;
$$;

-- The normal claim must never accidentally select the historical row after a
-- same-day maintenance successor has become current.
create or replace function public.claim_catalog_daily_attempt(
  p_state_key text,
  p_job_date date,
  p_target_new_products integer,
  p_now timestamptz default now(),
  p_lock_ttl_minutes integer default 130
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.catalog_daily_jobs;
  v_attempt_id uuid := gen_random_uuid();
  v_lock_token uuid := gen_random_uuid();
  v_local_date date := (p_now at time zone 'Europe/Amsterdam')::date;
  v_local_time time := (p_now at time zone 'Europe/Amsterdam')::time;
begin
  perform public.ensure_catalog_daily_job(
    p_state_key, p_job_date, p_target_new_products, p_now
  );

  select * into strict v_job
  from public.catalog_daily_jobs
  where state_key = p_state_key
    and job_date = p_job_date
    and superseded_at is null
  for update;

  if v_job.new_products_collected >= v_job.target_new_products then
    update public.catalog_daily_jobs
      set status = 'target_reached', completed_at = coalesce(completed_at, p_now),
          next_retry_at = null, lock_token = null, lock_expires_at = null,
          updated_at = p_now
      where id = v_job.id
      returning * into v_job;
    return jsonb_build_object('claimed', false, 'reason', 'target_reached', 'job', to_jsonb(v_job));
  end if;

  if v_local_date <> p_job_date or v_local_time >= time '23:00' then
    update public.catalog_daily_jobs
      set status = 'daily_target_partial', completed_at = coalesce(completed_at, p_now),
          next_retry_at = null, lock_token = null, lock_expires_at = null,
          last_public_message = 'Dagupdate gedeeltelijk voltooid. De bestaande catalogus blijft beschikbaar.',
          updated_at = p_now
      where id = v_job.id and status <> 'target_reached'
      returning * into v_job;
    return jsonb_build_object('claimed', false, 'reason', 'daily_window_closed', 'job', to_jsonb(v_job));
  end if;

  if v_job.status = 'running' and v_job.lock_expires_at > p_now then
    return jsonb_build_object('claimed', false, 'reason', 'attempt_running', 'job', to_jsonb(v_job));
  end if;

  if v_job.status = 'running' then
    update public.catalog_daily_attempts
      set status = 'retryable_failure', completed_at = p_now,
          retry_reason = 'stale_attempt_lock', error_code = 'stale_attempt_lock',
          error_summary = 'Attempt-lock verliep na de workflow-timeout.'
      where daily_job_id = v_job.id and status = 'running';
  end if;

  if v_job.status in ('target_reached', 'daily_target_partial', 'failed_requires_attention') then
    return jsonb_build_object('claimed', false, 'reason', v_job.status, 'job', to_jsonb(v_job));
  end if;

  if v_job.status = 'retry_scheduled'
     and v_job.next_retry_at is not null
     and v_job.next_retry_at > p_now then
    return jsonb_build_object('claimed', false, 'reason', 'retry_not_due', 'job', to_jsonb(v_job));
  end if;

  update public.catalog_daily_jobs
    set status = 'running', attempt_count = attempt_count + 1,
        last_attempt_at = p_now, next_retry_at = null,
        lock_token = v_lock_token,
        lock_expires_at = p_now + make_interval(mins => greatest(1, p_lock_ttl_minutes)),
        updated_at = p_now
    where id = v_job.id
    returning * into v_job;

  insert into public.catalog_daily_attempts (
    id, daily_job_id, attempt_number, started_at, status,
    cumulative_new_after, remaining_target_after
  ) values (
    v_attempt_id, v_job.id, v_job.attempt_count, p_now, 'running',
    v_job.new_products_collected,
    greatest(0, v_job.target_new_products - v_job.new_products_collected)
  );

  return jsonb_build_object(
    'claimed', true,
    'reason', 'claimed',
    'attemptId', v_attempt_id,
    'lockToken', v_lock_token,
    'job', to_jsonb(v_job)
  );
end;
$$;

create or replace function public.supersede_failed_catalog_daily_job(
  p_job_id uuid,
  p_state_key text,
  p_job_date date,
  p_expected_status text,
  p_expected_updated_at timestamptz,
  p_expected_attempt_count integer,
  p_expected_new_products_collected integer,
  p_expected_remaining_target integer,
  p_expected_recovery_count integer,
  p_supersede_reason text,
  p_actor_context text,
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
  v_new_job public.catalog_daily_jobs;
  v_new_attempt_id uuid := gen_random_uuid();
  v_new_lock_token uuid := gen_random_uuid();
  v_supersede_id uuid := gen_random_uuid();
  v_running_attempts integer;
  v_local_date date := (p_now at time zone 'Europe/Amsterdam')::date;
  v_local_time time := (p_now at time zone 'Europe/Amsterdam')::time;
begin
  if p_expected_status <> 'failed_requires_attention' then
    raise exception 'daily supersede vereist failed_requires_attention';
  end if;
  if p_supersede_reason is null
     or p_supersede_reason not in ('software_fix_verified', 'importer_updated') then
    raise exception 'daily supersede reason ontbreekt of is ongeldig';
  end if;
  if p_actor_context is null or btrim(p_actor_context) = '' or length(p_actor_context) > 240 then
    raise exception 'daily supersede actor context ontbreekt of is te lang';
  end if;
  if p_expected_updated_at is null or p_expected_attempt_count < 1
     or p_expected_new_products_collected < 0 or p_expected_remaining_target <= 0 then
    raise exception 'daily supersede expected state is ongeldig';
  end if;
  if p_expected_recovery_count <> 1 then
    raise exception 'daily supersede vereist verbruikte recovery';
  end if;
  if p_lock_ttl_minutes < 1 or p_lock_ttl_minutes > 130 then
    raise exception 'daily supersede lockduur is ongeldig';
  end if;
  if v_local_date <> p_job_date or v_local_time < time '06:00' or v_local_time >= time '23:00' then
    raise exception 'daily supersede valt buiten het dagelijkse venster';
  end if;

  -- This transaction-level advisory lock also covers the no-current-row case
  -- and makes concurrent maintenance requests deterministic.
  perform pg_advisory_xact_lock(hashtextextended(p_state_key || ':' || p_job_date::text, 0));

  select * into v_job
  from public.catalog_daily_jobs
  where id = p_job_id
    and state_key = p_state_key
    and job_date = p_job_date
    and superseded_at is null
  for update;
  if not found then
    raise exception 'daily supersede current job ontbreekt of is al opgevolgd';
  end if;

  if v_job.status <> 'failed_requires_attention'
     or v_job.status <> p_expected_status then
    raise exception 'daily supersede status conflict';
  end if;
  if v_job.updated_at is distinct from p_expected_updated_at
     or v_job.attempt_count <> p_expected_attempt_count
     or v_job.new_products_collected <> p_expected_new_products_collected
     or greatest(0, v_job.target_new_products - v_job.new_products_collected)
          <> p_expected_remaining_target
     or v_job.recovery_count <> p_expected_recovery_count then
    raise exception 'daily supersede revision conflict';
  end if;
  if v_job.target_new_products <> 400
     or v_job.new_products_collected >= v_job.target_new_products
     or v_job.recovery_count <> 1 then
    raise exception 'daily supersede vereist verbruikte recovery en resterend doel';
  end if;
  if v_job.lock_token is not null or v_job.lock_expires_at is not null then
    raise exception 'daily supersede heeft een actieve lock';
  end if;
  if v_job.next_retry_at is not null then
    raise exception 'daily supersede heeft nog een geplande retry';
  end if;

  if exists (
    select 1 from public.catalog_daily_supersedes s
    where s.state_key = v_job.state_key and s.job_date = v_job.job_date
  ) then
    raise exception 'daily supersede opvolger bestaat al voor deze kalenderdag';
  end if;

  select count(*) into v_running_attempts
  from public.catalog_daily_attempts
  where daily_job_id = v_job.id and status = 'running';
  if v_running_attempts <> 0 then
    raise exception 'daily supersede heeft een actieve attempt';
  end if;

  select * into v_previous_attempt
  from public.catalog_daily_attempts
  where daily_job_id = v_job.id
  order by attempt_number desc
  limit 1;
  if not found or v_previous_attempt.status <> 'non_retryable_failure'
     or v_previous_attempt.completed_at is null then
    raise exception 'daily supersede normale retry of vorige attempt is nog mogelijk';
  end if;

  -- Close the old row only as historical metadata. Its status, progress,
  -- attempts and failure details remain untouched; the following insert and
  -- audit are in the same transaction.
  update public.catalog_daily_jobs
    set superseded_at = p_now,
        updated_at = p_now
    where id = v_job.id and superseded_at is null;

  insert into public.catalog_daily_jobs (
    state_key, job_date, timezone, target_new_products,
    new_products_collected, status, attempt_count, started_at,
    last_attempt_at, next_retry_at, completed_at, lock_token,
    lock_expires_at, recovery_count, created_at, updated_at
  ) values (
    v_job.state_key, v_job.job_date, v_job.timezone, 400,
    0, 'running', 1, p_now, p_now, null, null, v_new_lock_token,
    p_now + make_interval(mins => p_lock_ttl_minutes), 0, p_now, p_now
  ) returning * into v_new_job;

  update public.catalog_daily_jobs
    set superseded_by_job_id = v_new_job.id
    where id = v_job.id;

  insert into public.catalog_daily_attempts (
    id, daily_job_id, attempt_number, started_at, status,
    cumulative_new_after, remaining_target_after
  ) values (
    v_new_attempt_id, v_new_job.id, 1, p_now, 'running', 0, 400
  );

  insert into public.catalog_daily_supersedes (
    id, previous_daily_job_id, new_daily_job_id, state_key, job_date,
    superseded_at, original_status, original_new_products_collected,
    original_target_new_products, original_remaining_target,
    original_failure_reason, original_failure_summary, supersede_reason,
    actor_context, expected_updated_at
  ) values (
    v_supersede_id, v_job.id, v_new_job.id, v_job.state_key, v_job.job_date,
    p_now, v_job.status, v_job.new_products_collected, v_job.target_new_products,
    greatest(0, v_job.target_new_products - v_job.new_products_collected),
    coalesce(nullif(btrim(v_previous_attempt.error_code), ''), 'unknown_failure'),
    v_previous_attempt.error_summary, btrim(p_supersede_reason),
    btrim(p_actor_context), p_expected_updated_at
  );

  return jsonb_build_object(
    'claimed', true,
    'superseded', true,
    'reason', 'superseded_and_claimed',
    'supersedeId', v_supersede_id,
    'previousDailyImportId', v_job.id,
    'attemptId', v_new_attempt_id,
    'lockToken', v_new_lock_token,
    'job', to_jsonb(v_new_job)
  );
end;
$$;

revoke all on function public.ensure_catalog_daily_job(text, date, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.claim_catalog_daily_attempt(text, date, integer, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.supersede_failed_catalog_daily_job(
  uuid, text, date, text, timestamptz, integer, integer, integer, integer,
  text, text, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.ensure_catalog_daily_job(text, date, integer, timestamptz)
  to service_role;
grant execute on function public.claim_catalog_daily_attempt(text, date, integer, timestamptz, integer)
  to service_role;
grant execute on function public.supersede_failed_catalog_daily_job(
  uuid, text, date, text, timestamptz, integer, integer, integer, integer,
  text, text, timestamptz, integer
) to service_role;

comment on table public.catalog_daily_supersedes is
  'Append-only audit van exact één maintenance-opvolger voor een definitief mislukte daily job per state key/kalenderdag.';

commit;
