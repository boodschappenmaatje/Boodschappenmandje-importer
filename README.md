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

Een succesvolle run vermeldt per geïmporteerd product alleen SKU, naam en prijs. Secrets worden niet getoond. De workflow ververst dagelijks één begrensd prijsdeel en draait wekelijks één roulerende catalogusbatch; handmatig starten blijft beschikbaar.

## Catalogusbatches

| Batch | Zoektermen |
|---|---|
| `core` | 37 termen voor vlees/vis, pasta/rijst, brood en zuivel, inclusief onder meer biefstuk, schnitzel, rookworst, garnalen, penne, fusilli en volkorenbrood |
| `fresh` | 40 termen voor aardappelen, groente, fruit, dranken en snacks, inclusief onder meer spinazie, andijvie, sperziebonen, druiven, cola, vruchtensap en energiedrank |
| `world` | 33 termen voor wereldkeuken, sauzen en diepvries/gemak, inclusief onder meer woksaus, sojasaus, pesto, couscous, roti en diepvriesgroente |
| `pantry` | 38 termen voor voorraad, ontbijt, beleg en huishoudelijke boodschappen, inclusief toiletpapier, wasmiddel, vaatwastabletten, tandpasta en dierenvoer |

`SEARCH_TERMS` blijft beschikbaar als expliciete override. Een onbekende `CATALOG_BATCH` stopt veilig met een duidelijke fout.

## Veiligheids- en betrouwbaarheidsregels

- Workflowinstellingen: `MAX_PRODUCTS=180`, `MAX_NEW_PRODUCTS=100`, `MAX_PER_TERM=20` en `MAX_PAGES_PER_TERM=4`.
- Harde technische limieten: maximaal 500 producten totaal, maximaal 300 nieuwe producten, maximaal 40 gevalideerde producten en maximaal 8 resultaatpagina's per zoekterm, ook bij foutieve environmentconfiguratie.
- Iedere resultaatpagina wordt op SKU gededupliceerd. Een lege pagina, een herhaalde paginasignatuur of de ingestelde paginalimiet stopt de paginering veilig.
- Zoekresultaten moeten via naam, merk of broncategorie woord-/prefixrelevant zijn. Zo blijft een geldige merkvariant behouden, terwijl een toevallige middenwoordmatch wordt geweigerd.
- Voor de scrape wordt uitsluitend de bestaande Hoogvliet-SKU-lijst licht uit Supabase gelezen. Catalogusruns richten zich op onbekende SKU's; de dagelijkse prijsdeelruns houden reeds bekende producten en prijzen actueel.
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
