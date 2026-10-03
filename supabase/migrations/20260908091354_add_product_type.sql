alter table public.products
  add column if not exists product_type text;

create index if not exists products_supermarket_product_type_idx
  on public.products (supermarket, product_type);

comment on column public.products.product_type is
  'Generiek producttype van BoodschappenMaatje; centraal bepaald door de server-side importer.';
