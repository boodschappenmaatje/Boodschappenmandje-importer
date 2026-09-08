create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  name text not null,
  normalized_name text not null,
  symbol text not null,
  preparation_minutes integer not null,
  vegetarian boolean not null default false,
  contains_pork boolean not null default false,
  kid_friendly boolean not null default false,
  healthy boolean not null default false,
  budget_tier text not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_source_key_key unique (source_key),
  constraint recipes_normalized_name_key unique (normalized_name),
  constraint recipes_source_key_format check (source_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint recipes_name_not_blank check (length(btrim(name)) > 0),
  constraint recipes_normalized_name_not_blank check (length(btrim(normalized_name)) > 0),
  constraint recipes_symbol_not_blank check (length(btrim(symbol)) > 0),
  constraint recipes_preparation_minutes_check check (preparation_minutes > 0),
  constraint recipes_budget_tier_check check (
    budget_tier in ('economical', 'standard', 'premium')
  )
);

create index if not exists recipes_weekmenu_filters_idx
  on public.recipes (vegetarian, contains_pork, preparation_minutes);

create or replace function public.set_recipes_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
before update on public.recipes
for each row execute function public.set_recipes_updated_at();

alter table public.recipes enable row level security;

revoke insert, update, delete on public.recipes from anon, authenticated;
grant select on public.recipes to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipes'
      and policyname = 'recipes_read_only'
  ) then
    create policy recipes_read_only
      on public.recipes for select
      to anon, authenticated
      using (true);
  end if;
end $$;

comment on table public.recipes is
  'Centrale receptrecords van BoodschappenMaatje; ingrediëntrelaties en tags worden afzonderlijk gemodelleerd.';

comment on column public.recipes.source_key is
  'Stabiele bestaande Swift Recipe-ID, voor latere relationele migraties.';

