# BoodschappenMaatje — Hoogvliet-importer proof of concept

Dit is een **server-side proof of concept**. De importer gebruikt Playwright/Chromium om maximaal tien echte producten via dezelfde Hoogvliet-webshoproute en DOM-velden te lezen die de bestaande app gebruikt. Daarna schrijft hij via veilige upserts naar de bestaande Supabase-tabellen `products` en `product_prices`.

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
6. Open de run en controleer de stap **Maximaal 10 producten importeren**.

Een succesvolle run vermeldt per geïmporteerd product alleen SKU, naam en prijs. Secrets worden niet getoond. De workflow heeft bewust geen dagelijks schema.

## Veiligheids- en betrouwbaarheidsregels

- Harde limiet: maximaal 10 producten, ook als `MAX_PRODUCTS` hoger wordt ingesteld.
- Standaard maximaal twee producten per zoekterm: `gehakt`, `kip`, `cola`, `honig`, `sinas`.
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

Start dezelfde workflow nogmaals. Door `on_conflict=supermarket,sku` worden bestaande producten bijgewerkt en niet gedupliceerd. `product_prices` wordt via het teruggegeven `product_id` bijgewerkt.

Controleer daarna in Supabase dat iedere SKU eenmaal voorkomt en dat iedere prijs bij het juiste `product_id` staat. Open vervolgens de bestaande BoodschappenMaatje-app en kies **Prijzen verversen**; de reeds gebouwde Fase-2-sync haalt deze records naar SQLite.

## Lokale dry-run (optioneel)

Zonder Supabase te schrijven:

```bash
npm ci
npx playwright install chromium
DRY_RUN=1 npm run import
```

De bron is een interne webshopinterface en geen aangetoonde openbare API. Als Hoogvliet de browsersessie blokkeert of de DOM wijzigt, stopt de importer gecontroleerd.
