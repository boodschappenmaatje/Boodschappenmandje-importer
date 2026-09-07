# BoodschappenMaatje — gecontroleerde Hoogvliet-catalogusimport

Dit is een server-side Playwright/Chromium-importer. De handmatige GitHub Action voert een gecontroleerde catalogustest uit met maximaal 150 echte producten via dezelfde bewezen Hoogvliet-webshoproute en DOM-velden. Geldige producten worden tussentijds via veilige upserts naar de bestaande Supabase-tabellen `products` en `product_prices` geschreven.

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
5. Kies nogmaals **Run workflow** ter bevestiging.
6. Open de run en controleer de stap **Maximaal 150 producten importeren**.

Een succesvolle run vermeldt per geïmporteerd product alleen SKU, naam en prijs. Secrets worden niet getoond. De workflow heeft bewust geen dagelijks schema.

## Veiligheids- en betrouwbaarheidsregels

- Workflowtest: `MAX_PRODUCTS=150`, `MAX_PER_TERM=3` en 86 breed gespreide zoektermen.
- Harde technische limieten: maximaal 200 producten per run en maximaal 10 gevalideerde producten per zoekterm, ook bij foutieve environmentconfiguratie.
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

Start dezelfde workflow nogmaals. Door `on_conflict=supermarket,sku` worden bestaande producten bijgewerkt en niet gedupliceerd. `product_prices` wordt via het teruggegeven `product_id` bijgewerkt. De eindlog toont totalen en compacte dekking per zoekterm zonder secrets.

Controleer daarna in Supabase dat iedere SKU eenmaal voorkomt en dat iedere prijs bij het juiste `product_id` staat. Open vervolgens de bestaande BoodschappenMaatje-app en kies **Prijzen verversen**; de reeds gebouwde Fase-2-sync haalt deze records naar SQLite.

## Lokale dry-run (optioneel)

Zonder Supabase te schrijven:

```bash
npm ci
npx playwright install chromium
DRY_RUN=1 npm run import
```

De bron is een interne webshopinterface en geen aangetoonde openbare API. Als Hoogvliet de browsersessie blokkeert of de DOM wijzigt, stopt de importer gecontroleerd.
