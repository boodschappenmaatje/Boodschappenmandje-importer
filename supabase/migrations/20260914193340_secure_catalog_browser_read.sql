begin;

-- PWA 4: de openbare catalogus mag vanuit een browser worden gelezen, maar
-- nooit met de anon/authenticated-rollen worden gewijzigd. De server-side
-- importer blijft met zijn afzonderlijke secret/service-role werken.
alter table public.products enable row level security;
alter table public.product_prices enable row level security;

revoke insert, update, delete on public.products from anon, authenticated;
revoke insert, update, delete on public.product_prices from anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.product_prices to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'products_catalog_read_only'
  ) then
    create policy products_catalog_read_only
      on public.products
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'product_prices'
      and policyname = 'product_prices_catalog_read_only'
  ) then
    create policy product_prices_catalog_read_only
      on public.product_prices
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

comment on policy products_catalog_read_only on public.products is
  'PWA-catalogus: publieke read-only productmetadata; writes blijven server-side.';

comment on policy product_prices_catalog_read_only on public.product_prices is
  'PWA-catalogus: publieke read-only prijsdata; writes blijven server-side.';

commit;
