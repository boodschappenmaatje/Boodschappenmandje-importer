create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  name text not null,
  normalized_name text not null,
  default_unit text not null,
  category text not null default 'Overig',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingredients_source_key_key unique (source_key),
  constraint ingredients_normalized_name_key unique (normalized_name),
  constraint ingredients_source_key_format check (source_key ~ '^[A-Za-z][A-Za-z0-9]*$'),
  constraint ingredients_name_not_blank check (length(btrim(name)) > 0),
  constraint ingredients_normalized_name_not_blank check (length(btrim(normalized_name)) > 0),
  constraint ingredients_default_unit_check check (
    default_unit in ('grams', 'millilitres', 'pieces', 'litres', 'loaves')
  )
);

create table if not exists public.ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingredient_aliases_alias_not_blank check (length(btrim(alias)) > 0),
  constraint ingredient_aliases_normalized_alias_not_blank check (length(btrim(normalized_alias)) > 0),
  constraint ingredient_aliases_normalized_alias_key unique (normalized_alias)
);

create index if not exists ingredients_category_idx
  on public.ingredients (category);

create index if not exists ingredient_aliases_ingredient_id_idx
  on public.ingredient_aliases (ingredient_id);

create or replace function public.set_ingredient_library_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ingredients_set_updated_at on public.ingredients;
create trigger ingredients_set_updated_at
before update on public.ingredients
for each row execute function public.set_ingredient_library_updated_at();

drop trigger if exists ingredient_aliases_set_updated_at on public.ingredient_aliases;
create trigger ingredient_aliases_set_updated_at
before update on public.ingredient_aliases
for each row execute function public.set_ingredient_library_updated_at();

alter table public.ingredients enable row level security;
alter table public.ingredient_aliases enable row level security;

revoke insert, update, delete on public.ingredients from anon, authenticated;
revoke insert, update, delete on public.ingredient_aliases from anon, authenticated;
grant select on public.ingredients to anon, authenticated;
grant select on public.ingredient_aliases to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ingredients'
      and policyname = 'ingredients_read_only'
  ) then
    create policy ingredients_read_only
      on public.ingredients for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ingredient_aliases'
      and policyname = 'ingredient_aliases_read_only'
  ) then
    create policy ingredient_aliases_read_only
      on public.ingredient_aliases for select
      to anon, authenticated
      using (true);
  end if;
end $$;

comment on table public.ingredients is
  'Centrale semantische ingrediëntenbibliotheek van BoodschappenMaatje.';

comment on column public.ingredients.source_key is
  'Stabiel Ingredient-ID uit de bestaande Swift Ingredient Library, voor latere receptmigratie.';

comment on table public.ingredient_aliases is
  'Expliciete, veilige schrijfwijzen/synoniemen die naar één centraal ingrediënt verwijzen.';
