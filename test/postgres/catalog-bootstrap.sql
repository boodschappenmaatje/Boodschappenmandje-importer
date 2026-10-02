-- Local-only contract fixture for the two pre-existing catalog tables whose
-- original DDL is not in this repository. Columns/uniqueness come from
-- src/supabase.mjs productPayload/pricePayload and README.md. Cache, recipe,
-- ingredient, profile, RLS and trigger DDL below is loaded from real migrations.
create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.products (
  id uuid primary key default gen_random_uuid(),
  supermarket text not null, sku text not null, name text not null,
  brand text, category text, package_text text, weight_grams numeric,
  image_url text, source_url text, is_available boolean default true,
  updated_at timestamptz default now(), unique(supermarket, sku)
);
create table public.product_prices (
  product_id uuid primary key references public.products(id),
  price numeric, old_price numeric, is_offer boolean, offer_text text,
  valid_from date, valid_until date, fetched_at timestamptz, updated_at timestamptz default now()
);
grant usage on schema public to anon, authenticated, service_role;
