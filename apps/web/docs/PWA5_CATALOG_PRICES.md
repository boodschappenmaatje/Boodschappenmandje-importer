# PWA 5 — Hoogvliet-catalogus en prijzen

## Behouden datastroom

`Hoogvliet → Node/Playwright-importer → GitHub Actions → Supabase → PWA`

De importer blijft server-side schrijven met `SUPABASE_SECRET_KEY`. De PWA
leest uitsluitend met `NEXT_PUBLIC_SUPABASE_URL` en
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (of de bestaande publieke anon-fallback).

## Gebruikte databasevelden

- `products`: `id`, `supermarket`, `sku`, `name`, `brand`, `category`,
  `product_type`, `package_text`, `weight_grams`, `image_url`, `source_url`,
  `is_available`, `updated_at`.
- `product_prices`: `product_id`, `price`, `old_price`, `is_offer`,
  `offer_text`, `valid_from`, `valid_until`, `fetched_at`, `updated_at`.

Een prijs wordt uitsluitend via de foreign key `product_prices.product_id` aan
exact `products.id` gekoppeld. Er bestaat geen naam- of SKU-fallback in de PWA.
De importer blijft producten op `(supermarket, sku)` upserten en prijzen alleen
op het bevestigde `product_id`.

## Actuele prijs en actie

`price` is de door de importer gevalideerde hoofdprijs. `old_price` wordt alleen
als vergelijkingsprijs getoond als `is_offer` actief is en `old_price` hoger is
dan `price`. Een aanwezige actieperiode begrenst de actie; onleesbare, toekomstige
of verlopen grenzen krijgen geen actie-indicatie. Ontbrekende actiegrenzen laten
het expliciete importer-signaal `is_offer` leidend.

Een ontbrekende, niet-positieve of ongeldige prijs wordt nooit vervangen door
`€ 0,00` of fictieve data. De UI toont dan `Prijs tijdelijk niet beschikbaar`.

## Prijsversheid

De workflow ververst dagelijks één van zeven prijsdeelbatches. Daarom geldt een
controlegrens van acht dagen: maximaal één volledige cyclus plus één dag speling.
Oudere data blijft behouden en zichtbaar als `Laatste bekende prijs`, maar wordt
niet als vers gepresenteerd. Het gebruikte tijdstip is eerst `fetched_at` en
daarna `updated_at`.

## Paginering en requests

- Eerste pagina: 20 producten.
- Iedere volgende pagina: maximaal 20 producten.
- Eén extra productrecord bepaalt of een volgende pagina bestaat.
- Per pagina: één productquery en maximaal één gebundelde prijsquery voor alleen
  de twintig getoonde product-ID's.
- Sortering: `name ASC`, daarna `id ASC` voor stabiele paginagrenzen.
- Pagina's worden op product-ID samengevoegd, zodat geen dubbele kaart ontstaat.

Er wordt nooit de volledige catalogus opgehaald en er is geen prijsrequest per
product. Product zoeken, filters en toevoegen aan een lijst blijven bewust buiten
PWA 5.

## Afbeeldingen en eenheidsprijs

Alleen bestaande HTTPS-waarden uit `image_url` worden getoond; anders verschijnt
een lokale placeholder. Een kiloprijs wordt uitsluitend berekend vanuit het
gestructureerde `weight_grams`. De database heeft geen aangetoond gestructureerd
volumeveld, dus de PWA gokt geen literprijs uit vrije verpakkingstekst.
