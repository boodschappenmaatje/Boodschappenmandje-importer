# BoodschappenMaatje — gecontroleerde Hoogvliet-catalogusimport

Dit is een server-side Playwright/Chromium-importer. De handmatige GitHub Action bouwt de catalogus gecontroleerd op via vier afzonderlijke zoektermbatches. Per run worden maximaal 100 nieuwe producten toegevoegd en maximaal 180 producten in totaal verwerkt. Geldige producten worden tussentijds via veilige upserts naar de bestaande Supabase-tabellen `products` en `product_prices` geschreven.

De iOS-app en SQLite-laag maken geen onderdeel uit van dit pakket en worden niet gewijzigd.

## Bestanden uploaden

Upload de volledige inhoud van deze map naar de hoofdmap van je private GitHub-repository. Controleer dat deze paden zichtbaar zijn:

- `.github/workflows/import-hoogvliet-poc.yml`
- `src/config.mjs`
- `src/hoogvliet.mjs`
- `src/supabase.mjs`
- `src/importer.mjs`
- `test/importer.test.mjs`
- `.gitignore`
- `package.json`
- `package-lock.json`

Upload **geen** `.env`-bestand en geen sleutel.

## Vereiste GitHub Actions Repository Secrets

Onder **Settings → Secrets and variables → Actions → Repository secrets** moeten bestaan:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

De workflow leest ze uitsluitend als environmentvariabelen. De waarden worden niet door de importer gelogd. Gebruik nooit de Publishable key voor schrijven en plaats de secret nooit in Swift.

## Workflow handmatig starten

1. Open de repository op GitHub.
2. Open **Actions**.
3. Kies **Hoogvliet import proof of concept**.
4. Kies **Run workflow**.
5. Kies bij **Catalogusbatch** achtereenvolgens `core`, `fresh`, `world` of `pantry`.
6. Kies nogmaals **Run workflow** ter bevestiging.
7. Open de run en controleer de stap **Catalogusbatch importeren**.

Een succesvolle run vermeldt per geïmporteerd product alleen SKU, naam en prijs. Secrets worden niet getoond. De workflow heeft bewust geen dagelijks schema.

## Catalogusbatches

| Batch | Zoektermen |
|---|---|
| `core` | gehakt, rundergehakt, kip, kipfilet, varkensvlees, worst, hamburger, shoarma, vis, zalm, tonijn, pasta, spaghetti, macaroni, lasagne, rijst, brood, bolletjes, croissant, melk, yoghurt, kwark, kaas, boter, margarine, room |
| `fresh` | aardappelen, groente, groenten, tomaat, paprika, ui, komkommer, wortel, sla, broccoli, bloemkool, appel, banaan, sinaasappel, fruit, cola, sinas, frisdrank, water, sap, limonade, chips, koek, chocolade, snoep, nootjes |
| `world` | noodles, wraps, taco, tortilla, nasi, bami, curry, knorr, honig, maaltijdmix, pastasaus, tomatensaus, saus, mayonaise, ketchup, pizza, patat, friet, kroket, frikandel, kipnuggets, diepvries, snacks |
| `pantry` | soep, bonen, tomatenblokjes, mais, kruiden, bloem, suiker, olie, koffie, thee, ontbijtgranen, havermout, beschuit, crackers, beleg, pindakaas, jam, hagelslag, eieren, meel, bakproducten, conserven, peulvruchten, azijn, zout, peper |

`SEARCH_TERMS` blijft beschikbaar als expliciete override. Een onbekende `CATALOG_BATCH` stopt veilig met een duidelijke fout.

## Veiligheids- en betrouwbaarheidsregels

- Workflowinstellingen: `MAX_PRODUCTS=180`, `MAX_NEW_PRODUCTS=100` en `MAX_PER_TERM=6`.
- Harde technische limieten: maximaal 200 producten totaal, maximaal 150 nieuwe producten en maximaal 10 gevalideerde producten per zoekterm, ook bij foutieve environmentconfiguratie.
- Voor de scrape wordt uitsluitend de bestaande Hoogvliet-SKU-lijst licht uit Supabase gelezen. Onbekende SKU's krijgen binnen iedere zoekterm voorrang; bestaande SKU's mogen nog steeds opnieuw gevalideerd en bijgewerkt worden, maar tellen niet mee voor `MAX_NEW_PRODUCTS`.
- SKU-deduplicatie gebeurt vóór het openen van een productdetailpagina. Eenzelfde SKU wordt binnen één run dus niet opnieuw gevalideerd of geschreven.
- Geldige producten worden per 10 naar Supabase geschreven. Een onderbroken run behoudt daardoor reeds opgeslagen batches; opnieuw uitvoeren blijft veilig door de bestaande idempotente upserts.
- Eén browsercontext en één detailpagina worden hergebruikt. De bestaande gecontroleerde vertraging blijft actief om onnodige belasting te voorkomen.
- SKU moet exact negen cijfers zijn.
- Product-URL moet `https://www.hoogvliet.com/product/...` zijn.
- De SKU op de productpagina moet overeenkomen met de SKU uit het zoekresultaat.
- Naam, verpakking en actuele prijs moeten daadwerkelijk op de productpagina staan.
- Onzekere optionele data blijft `null`.
- Een complexe aanbieding wordt niet als betrouwbare aanbieding opgeslagen.
- Geen records worden verwijderd wanneer ophalen mislukt.
- Bij CAPTCHA/toegangsblokkade stopt de run zonder een omzeiling te proberen.

## Supabase-voorwaarden

Voor veilige upserts verwacht de importer deze bestaande unieke constraints:

```sql
unique (supermarket, sku)
unique (product_id) -- op product_prices
```

De tweede constraint past bij de bestaande één-op-éénrelatie tussen `products` en de huidige prijs in `product_prices`.

## Tweede run controleren

Start dezelfde batch gerust opnieuw. Door `on_conflict=supermarket,sku` worden bestaande producten bijgewerkt en niet gedupliceerd. `product_prices` wordt via het teruggegeven `product_id` bijgewerkt. De eindlog onderscheidt nieuwe SKU's/producten van bestaande bijgewerkte records en toont compacte dekking per zoekterm zonder secrets.

Controleer daarna in Supabase dat iedere SKU eenmaal voorkomt en dat iedere prijs bij het juiste `product_id` staat. Open vervolgens de bestaande BoodschappenMaatje-app en kies **Prijzen verversen**; de reeds gebouwde Fase-2-sync haalt deze records naar SQLite.

## Lokale dry-run (optioneel)

Zonder Supabase te schrijven:

```bash
npm ci
npx playwright install chromium
DRY_RUN=1 npm run import
```

De bron is een interne webshopinterface en geen aangetoonde openbare API. Als Hoogvliet de browsersessie blokkeert of de DOM wijzigt, stopt de importer gecontroleerd.
