# PWA 4 — Supabase read-pad en veiligheidsinventarisatie

## Datastroom

De bestaande stroom blijft ongewijzigd:

`Hoogvliet → Node/Playwright-importer → Supabase → PWA (read-only)`

De browser gebruikt uitsluitend `NEXT_PUBLIC_SUPABASE_URL` met één publieke
publishable/anon key. De importer gebruikt buiten de browser zijn bestaande
`SUPABASE_SECRET_KEY`.

## Tabellen en toegang

| Tabel | Doel | Sleutel/relaties | PWA 4 | Vastgelegde RLS |
| --- | --- | --- | --- | --- |
| `products` | Hoogvliet-productidentiteit en metadata | `id` PK; uniek `supermarket + sku` | read | beveiligingsmigratie `20260914_secure_catalog_browser_read.sql` |
| `product_prices` | huidige normale/actieprijs | `product_id` FK → `products.id`, uniek | read | beveiligingsmigratie `20260914_secure_catalog_browser_read.sql` |
| `recipes` | centrale recepten | `id` PK; `source_key` uniek | later read | `recipes_read_only` |
| `ingredients` | centrale ingrediënten | `id` PK; `source_key` uniek | later read | `ingredients_read_only` |
| `ingredient_aliases` | aliases voor matching | `ingredient_id` FK → `ingredients.id` | later read | `ingredient_aliases_read_only` |
| `recipe_ingredients` | recept ↔ ingrediënt | FK's → `recipes.id` en `ingredients.id` | later read | `recipe_ingredients_read_only` |

De actuele repository bevat geen Supabase-tabellen voor de actieve lijst,
aankoopgeschiedenis, voorkeuren, patroonherkenning, suggesties, budget of
voorraad. Deze gegevens bestaan in de Swift-referentie lokaal en worden in PWA
4 niet gemigreerd of browser-schrijfbaar gemaakt. Categorie en productmatching
zijn momenteel productkolommen/relaties, geen aangetoonde aparte tabellen.

## Belangrijke kolommen

- `products`: `id`, `supermarket`, `sku`, `name`, `brand`, `category`,
  `product_type`, `package_text`, `weight_grams`, `image_url`, `source_url`,
  `is_available`, `updated_at`.
- `product_prices`: `product_id`, `price`, `old_price`, `is_offer`,
  `offer_text`, `valid_from`, `valid_until`, `fetched_at`, `updated_at`.
- `recipes`: `id`, `source_key`, `name`, `normalized_name`, `symbol`,
  `preparation_minutes`, filters en `budget_tier`.
- `recipe_ingredients`: `recipe_id`, `ingredient_id`, `amount_per_person`,
  `unit`, `position`.

## Prijsintegriteit

De PWA haalt eerst maximaal tien producten op en vraagt daarna uitsluitend de
prijzen voor de gevonden `product_id`-waarden op. De mapper koppelt prijzen
alleen via exact `product_prices.product_id`. Naam- of SKU-fallbacks zijn niet
toegestaan. Een niet-positieve of ongeldige prijs wordt niet getoond.

`price` is de actuele prijs. Bij een geldige actie kan `old_price` als eerdere
prijs worden getoond; `is_offer`, `offer_text`, `valid_from` en `valid_until`
blijven afzonderlijk beschikbaar. Een prijs per kilogram wordt alleen afgeleid
wanneer een positieve `weight_grams`-waarde bestaat. Er wordt geen literprijs
uit vrije verpakkingstekst gegokt.

## RLS-verificatie

De vier recept-/ingrediëntmigraties zetten RLS aan, verlenen alleen `select` aan
`anon`/`authenticated` en trekken browserwrites in. Voor de twee catalogustabellen
legt de PWA 4-migratie dezelfde minimale bescherming vast.

Een publieke REST-client kan live bevestigen dat `select` werkt, maar kan
`pg_policies` niet uitlezen. Controleer na toepassing van de migratie daarom in
de Supabase SQL Editor of Dashboard dat beide tabellen RLS actief tonen en dat
de genoemde read-only policies aanwezig zijn. Browserwrites blijven in de PWA
code volledig afwezig.

## Uitgevoerde read-controle

Op 14 september 2026 gaf de bestaande publieke configuratie HTTP 200 voor een
begrensde `select` op alle zes genoemde tabellen. `products` en
`product_prices` leverden ieder tien rijen met exact de hierboven vastgelegde
velden. Er zijn geen inserts, updates, deletes, upserts of RPC's uitgevoerd.
