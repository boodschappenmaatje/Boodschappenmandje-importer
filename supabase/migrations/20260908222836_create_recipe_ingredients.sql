create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  amount_per_person numeric not null,
  unit text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_ingredients_recipe_position_key unique (recipe_id, position),
  constraint recipe_ingredients_amount_check check (amount_per_person > 0),
  constraint recipe_ingredients_position_check check (position >= 0),
  constraint recipe_ingredients_unit_check check (
    unit in ('g', 'kg', 'ml', 'l', 'piece', 'loaf')
  )
);

create index if not exists recipe_ingredients_recipe_id_idx
  on public.recipe_ingredients (recipe_id);

create index if not exists recipe_ingredients_ingredient_id_idx
  on public.recipe_ingredients (ingredient_id);

create or replace function public.set_recipe_ingredients_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recipe_ingredients_set_updated_at on public.recipe_ingredients;
create trigger recipe_ingredients_set_updated_at
before update on public.recipe_ingredients
for each row execute function public.set_recipe_ingredients_updated_at();

alter table public.recipe_ingredients enable row level security;

revoke insert, update, delete on public.recipe_ingredients from anon, authenticated;
grant select on public.recipe_ingredients to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_ingredients'
      and policyname = 'recipe_ingredients_read_only'
  ) then
    create policy recipe_ingredients_read_only
      on public.recipe_ingredients for select
      to anon, authenticated
      using (true);
  end if;
end $$;

comment on table public.recipe_ingredients is
  'Geordende recept-naar-ingrediëntrelaties; hoeveelheden komen uit Swift IngredientNeed.amountPerPerson.';

comment on column public.recipe_ingredients.amount_per_person is
  'Oorspronkelijke numerieke hoeveelheid per persoon; niet omgerekend naar gewicht of een fictieve standaardportie.';

comment on column public.recipe_ingredients.position is
  'Nulgebaseerde oorspronkelijke volgorde van het ingrediënt binnen het recept.';
