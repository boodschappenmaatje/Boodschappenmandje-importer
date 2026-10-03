begin;

-- Eén logische, hervatbare catalogusgroeitaak per Nederlandse kalenderdag.
-- De productcatalogus en de bestaande discovery-state blijven afzonderlijke
-- bronnen van waarheid; deze tabellen bewaren alleen job- en attemptmetadata.
create table if not exists public.catalog_daily_jobs (
  id uuid primary key default gen_random_uuid(),
  state_key text not null,
  job_date date not null,
  timezone text not null default 'Europe/Amsterdam'
    check (timezone = 'Europe/Amsterdam'),
  target_new_products integer not null default 400
    check (target_new_products between 1 and 400),
  new_products_collected integer not null default 0
    check (new_products_collected >= 0),
  status text not null default 'pending' check (status in (
    'pending',
    'running',
    'retry_scheduled',
    'target_reached',
    'daily_target_partial',
    'failed_requires_attention'
  )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  started_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  completed_at timestamptz,
  lock_token uuid,
  lock_expires_at timestamptz,
  last_public_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_daily_jobs_unique_day unique (state_key, job_date),
  constraint catalog_daily_jobs_progress check (
    new_products_collected <= target_new_products
  ),
  constraint catalog_daily_jobs_lock_state check (
    (status = 'running' and lock_token is not null and lock_expires_at is not null)
    or (status <> 'running' and lock_token is null and lock_expires_at is null)
  )
);

create table if not exists public.catalog_daily_attempts (
  id uuid primary key,
  daily_job_id uuid not null references public.catalog_daily_jobs(id),
  attempt_number integer not null check (attempt_number > 0),
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null check (status in (
    'running',
    'succeeded',
    'retryable_failure',
    'non_retryable_failure',
    'daily_target_partial'
  )),
  candidates_scanned integer not null default 0 check (candidates_scanned >= 0),
  new_count integer not null default 0 check (new_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  unchanged_count integer not null default 0 check (unchanged_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  invalid_count integer not null default 0 check (invalid_count >= 0),
  source_errors integer not null default 0 check (source_errors >= 0),
  retry_reason text,
  next_retry_at timestamptz,
  error_code text,
  error_summary text,
  cumulative_new_after integer not null default 0 check (cumulative_new_after >= 0),
  remaining_target_after integer not null default 0 check (remaining_target_after >= 0),
  created_at timestamptz not null default now(),
  constraint catalog_daily_attempts_unique_number
    unique (daily_job_id, attempt_number),
  constraint catalog_daily_attempts_finished_state check (
    (status = 'running' and completed_at is null)
    or (status <> 'running' and completed_at is not null)
  )
);

create index if not exists catalog_daily_jobs_date_idx
  on public.catalog_daily_jobs (job_date desc, state_key);
create index if not exists catalog_daily_jobs_retry_idx
  on public.catalog_daily_jobs (next_retry_at)
  where status = 'retry_scheduled';
create unique index if not exists catalog_daily_jobs_single_running_idx
  on public.catalog_daily_jobs (state_key)
  where status = 'running';
create index if not exists catalog_daily_attempts_job_idx
  on public.catalog_daily_attempts (daily_job_id, attempt_number desc);

alter table public.catalog_daily_jobs enable row level security;
alter table public.catalog_daily_attempts enable row level security;

revoke insert, update, delete on public.catalog_daily_jobs from anon, authenticated;
revoke all on public.catalog_daily_attempts from anon, authenticated;
grant select on public.catalog_daily_jobs to anon, authenticated;
grant select, insert, update on public.catalog_daily_jobs to service_role;
grant select, insert, update on public.catalog_daily_attempts to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'catalog_daily_jobs'
      and policyname = 'catalog_daily_jobs_read_only'
  ) then
    create policy catalog_daily_jobs_read_only
      on public.catalog_daily_jobs
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

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

  insert into public.catalog_daily_jobs (
    state_key, job_date, target_new_products, started_at, created_at, updated_at
  ) values (
    p_state_key, p_job_date, p_target_new_products, p_now, p_now, p_now
  )
  on conflict (state_key, job_date) do nothing;

  select * into strict v_job
  from public.catalog_daily_jobs
  where state_key = p_state_key and job_date = p_job_date;

  return to_jsonb(v_job);
end;
$$;

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
  where state_key = p_state_key and job_date = p_job_date
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

  -- Een attempt kan pas na de 120-minuten Actions-timeout worden vrijgegeven.
  -- Zo kan een tweede proces nooit tegelijk met een geldige attempt starten.
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

create or replace function public.finish_catalog_daily_attempt(
  p_job_id uuid,
  p_attempt_id uuid,
  p_lock_token uuid,
  p_outcome text,
  p_counts jsonb,
  p_retry_reason text default null,
  p_next_retry_at timestamptz default null,
  p_error_code text default null,
  p_error_summary text default null,
  p_public_message text default null,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.catalog_daily_jobs;
  v_new integer := greatest(0, coalesce((p_counts->>'new')::integer, 0));
  v_cumulative integer;
  v_status text;
  v_attempt_status text;
begin
  if p_outcome not in ('succeeded', 'retryable_failure', 'non_retryable_failure', 'daily_target_partial') then
    raise exception 'ongeldige attempt-uitkomst';
  end if;

  select * into strict v_job
  from public.catalog_daily_jobs
  where id = p_job_id
  for update;

  if v_job.status <> 'running' or v_job.lock_token is distinct from p_lock_token then
    raise exception 'daily import lock komt niet overeen';
  end if;

  v_cumulative := least(v_job.target_new_products, v_job.new_products_collected + v_new);
  if v_cumulative >= v_job.target_new_products then
    v_status := 'target_reached';
    v_attempt_status := 'succeeded';
  elsif p_outcome = 'non_retryable_failure' then
    v_status := 'failed_requires_attention';
    v_attempt_status := 'non_retryable_failure';
  elsif p_outcome = 'daily_target_partial'
        or (p_now at time zone 'Europe/Amsterdam')::time >= time '23:00' then
    v_status := 'daily_target_partial';
    v_attempt_status := 'daily_target_partial';
  else
    v_status := 'retry_scheduled';
    v_attempt_status := case
      when p_outcome = 'succeeded' then 'succeeded'
      else 'retryable_failure'
    end;
  end if;

  update public.catalog_daily_attempts
    set completed_at = p_now,
        status = v_attempt_status,
        candidates_scanned = greatest(0, coalesce((p_counts->>'candidates')::integer, 0)),
        new_count = v_new,
        updated_count = greatest(0, coalesce((p_counts->>'updated')::integer, 0)),
        unchanged_count = greatest(0, coalesce((p_counts->>'unchanged')::integer, 0)),
        skipped_count = greatest(0, coalesce((p_counts->>'skipped')::integer, 0)),
        invalid_count = greatest(0, coalesce((p_counts->>'invalid')::integer, 0)),
        source_errors = greatest(0, coalesce((p_counts->>'sourceErrors')::integer, 0)),
        retry_reason = left(p_retry_reason, 240),
        next_retry_at = case when v_status = 'retry_scheduled' then p_next_retry_at else null end,
        error_code = left(p_error_code, 120),
        error_summary = left(p_error_summary, 1200),
        cumulative_new_after = v_cumulative,
        remaining_target_after = greatest(0, v_job.target_new_products - v_cumulative)
    where id = p_attempt_id and daily_job_id = v_job.id and status = 'running';

  if not found then
    raise exception 'lopende daily attempt niet gevonden';
  end if;

  update public.catalog_daily_jobs
    set new_products_collected = v_cumulative,
        status = v_status,
        next_retry_at = case when v_status = 'retry_scheduled' then p_next_retry_at else null end,
        completed_at = case
          when v_status in ('target_reached', 'daily_target_partial', 'failed_requires_attention') then p_now
          else null
        end,
        lock_token = null,
        lock_expires_at = null,
        last_public_message = left(p_public_message, 500),
        updated_at = p_now
    where id = v_job.id
    returning * into v_job;

  return to_jsonb(v_job);
end;
$$;

revoke all on function public.ensure_catalog_daily_job(text, date, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.claim_catalog_daily_attempt(text, date, integer, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.finish_catalog_daily_attempt(uuid, uuid, uuid, text, jsonb, text, timestamptz, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.ensure_catalog_daily_job(text, date, integer, timestamptz)
  to service_role;
grant execute on function public.claim_catalog_daily_attempt(text, date, integer, timestamptz, integer)
  to service_role;
grant execute on function public.finish_catalog_daily_attempt(uuid, uuid, uuid, text, jsonb, text, timestamptz, text, text, text, timestamptz)
  to service_role;

comment on table public.catalog_daily_jobs is
  'Cumulatieve, hervatbare Hoogvliet-groeitaak per Europe/Amsterdam-kalenderdag.';
comment on table public.catalog_daily_attempts is
  'Technische attemptlog voor de dagelijkse catalogusgroeitaak; niet browserleesbaar.';

commit;
