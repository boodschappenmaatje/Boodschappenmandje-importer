begin;

-- PWA 8.1: compacte, idempotente catalogusgroei zonder bestaande records te
-- vervangen. Productidentiteit en actuele prijsconstraints blijven leidend.
alter table public.products
  add column if not exists last_seen_at timestamptz,
  add column if not exists missing_checks integer not null default 0
    check (missing_checks >= 0);

create table if not exists public.catalog_import_runs (
  id uuid primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'partial', 'failed')),
  trigger text not null check (trigger in ('schedule', 'manual', 'test')),
  processed_count integer not null default 0 check (processed_count >= 0),
  new_count integer not null default 0 check (new_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  unchanged_count integer not null default 0 check (unchanged_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  total_unique_products_before integer not null default 0
    check (total_unique_products_before >= 0),
  total_unique_products_after integer
    check (total_unique_products_after is null or total_unique_products_after >= 0),
  duration_seconds numeric(12, 3)
    check (duration_seconds is null or duration_seconds >= 0),
  error_summary text,
  constraint catalog_import_runs_finished_state check (
    (status = 'running' and finished_at is null)
    or (status <> 'running' and finished_at is not null)
  )
);

-- Ook handmatige en automatische runs delen één server-side lock. Een stale
-- run wordt door de importer eerst gecontroleerd en gecontroleerd afgesloten.
create unique index if not exists catalog_import_runs_single_running_idx
  on public.catalog_import_runs ((true))
  where status = 'running';

create index if not exists catalog_import_runs_started_at_idx
  on public.catalog_import_runs (started_at desc);

create table if not exists public.catalog_discovery_state (
  state_key text primary key,
  term_cursor integer not null default 0 check (term_cursor >= 0),
  page_cursor integer not null default 0 check (page_cursor >= 0),
  last_batch text,
  updated_at timestamptz not null default now()
);

-- ILIKE-zoekpatronen uit PWA 8 bevatten doelbewust woordstarts met een
-- voorloop-wildcard. Trigramindexen houden dit schaalbaar richting 10.000+.
create extension if not exists pg_trgm;
create index if not exists products_name_trgm_idx
  on public.products using gin (name gin_trgm_ops);
create index if not exists products_brand_trgm_idx
  on public.products using gin (brand gin_trgm_ops);
create index if not exists products_category_trgm_idx
  on public.products using gin (category gin_trgm_ops);
create index if not exists products_product_type_trgm_idx
  on public.products using gin (product_type gin_trgm_ops);

alter table public.catalog_import_runs enable row level security;
alter table public.catalog_discovery_state enable row level security;

revoke insert, update, delete on public.catalog_import_runs from anon, authenticated;
revoke all on public.catalog_discovery_state from anon, authenticated;
grant select on public.catalog_import_runs to anon, authenticated;

-- RLS-bypass alleen is niet voldoende: nieuw aangemaakte tabellen moeten de
-- server-side importer ook expliciete tabelprivileges geven. Beperk dit tot de
-- handelingen die de runregistratie en discovery-cursor daadwerkelijk nodig
-- hebben; browserrollen krijgen hierdoor geen extra rechten.
grant select, insert, update on public.catalog_import_runs to service_role;
grant select, insert, update on public.catalog_discovery_state to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'catalog_import_runs'
      and policyname = 'catalog_import_runs_read_only'
  ) then
    create policy catalog_import_runs_read_only
      on public.catalog_import_runs
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

comment on table public.catalog_import_runs is
  'Compacte samenvatting per Hoogvliet-catalogusrun; geen productpayloads.';
comment on table public.catalog_discovery_state is
  'Server-side cursor voor gespreide Hoogvliet-productontdekking.';
comment on policy catalog_import_runs_read_only on public.catalog_import_runs is
  'PWA-catalogusstatus: publiek read-only; writes blijven importer/service-role.';

commit;
