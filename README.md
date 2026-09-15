# BoodschappenMaatje — gecontroleerde Hoogvliet-catalogusimport

Dit is een server-side Playwright/Chromium-importer. De handmatige GitHub Action bouwt de catalogus gecontroleerd op via vier afzonderlijke zoektermbatches. Per run worden maximaal 100 nieuwe producten toegevoegd en maximaal 180 producten in totaal verwerkt. Geldige producten worden tussentijds via veilige upserts naar de bestaande Supabase-tabellen `products` en `product_prices` geschreven.

De iOS-app en SQLite-laag maken geen onderdeel uit van dit pakket en worden niet gewijzigd.

## Centrale ingrediëntenbibliotheek (stap 5)

De eerste ingrediëntenbasis is rechtstreeks geïnventariseerd uit de bestaande Swift `IngredientLibrary`: 140 centrale definities, 403 receptvermeldingen en 114 unieke Ingredient-ID's die door de huidige 100 recepten worden gebruikt. De overige 26 definities zijn bestaande, bewust beschikbare vervangingskandidaten. Recepthoeveelheden en concrete SKU-/prijsdata maken nadrukkelijk geen deel uit van deze laag.

De Supabase-structuur bestaat uit:

- `ingredients`: stabiele UUID, bestaande Swift `source_key`, canonieke naam, genormaliseerde naam, standaardeenheid en generieke categorie;
- `ingredient_aliases`: expliciete veilige schrijfvarianten die via `ingredient_id` naar hetzelfde centrale ingrediënt verwijzen.

Normalisatie maakt hoofdletters, diakritische tekens, interpunctie en overtollige spaties gelijk, maar singulariseert of synonymiseert niet automatisch. Daardoor worden bijvoorbeeld `kipsaté`/`kipsate`, `maïskorrels`/`maiskorrels` en `half-om-half`/`half om half` veilig herkend, terwijl `kipfilet` en `kipdijfilet` of `basmatirijst` en `jasmijnrijst` afzonderlijk blijven.

### Eenmalig uitvoeren in Supabase

Voer na deze commit in de Supabase SQL Editor exact in deze volgorde uit:

1. `supabase/migrations/20260908_create_ingredients.sql`
2. `supabase/seeds/20260908_ingredients.sql`

Beide bestanden zijn veilig opnieuw uitvoerbaar. De seed upsert op de bestaande Swift Ingredient-ID, verwijdert niets en weigert een alias stil naar een ander ingrediënt om te koppelen. RLS staat aan; `anon` en `authenticated` krijgen alleen leesrecht. De bestaande `products` en `product_prices` worden niet aangepast.

`data/ingredients.json` is de onderhoudbare bron voor de seed. Na een bewuste wijziging wordt het SQL-bestand opnieuw gegenereerd met `npm run build:ingredient-seed`; `npm run check` controleert dat JSON en SQL exact overeenkomen.

## Centrale receptenbasis (stap 5.1)

De bestaande Swift-bron bevat exact 100 recepten: 15 legacyrecepten en 85 recepten uit de uitgebreide catalogus. Alle 100 bestaande Recipe-ID's en genormaliseerde namen zijn uniek; er zijn geen lege of synthetisch toegevoegde records.

`recipes` bewaart uitsluitend de bestaande stabiele `source_key`, naam, genormaliseerde naam, SF Symbol, bereidingstijd, vier bestaande harde filtervelden en het bestaande budgetniveau. De Swift-bron bevat geen bereidingsinstructies, standaardporties of vaste receptprijs, dus die data wordt niet verzonnen. Ingrediënten en hoeveelheden volgen relationeel in stap 5.2; de definitieve categorie-/tagstructuur volgt in stap 5.3.

### Eenmalig uitvoeren in Supabase

Nadat de ingrediëntenmigratie en -seed van stap 5 succesvol zijn uitgevoerd, voer je in de Supabase SQL Editor uit:

1. `supabase/migrations/20260908_create_recipes.sql`
2. `supabase/seeds/20260908_recipes.sql`

Beide bestanden zijn veilig opnieuw uitvoerbaar. De UUID van een bestaand recept blijft bij een volgende seed behouden doordat de upsert de stabiele Swift `source_key` gebruikt. RLS staat aan; `anon` en `authenticated` krijgen alleen leesrecht. Geen product- of ingrediëntentabel wordt gewijzigd.

`data/recipes.json` is de onderhoudbare bron. Gebruik na een bewuste wijziging `npm run build:recipe-seed`; `npm run check` bewaakt dat de SQL-seed exact bij de bron hoort.

## Recept-ingrediëntrelaties (stap 5.2)

De 100 bestaande Swift-recepten bevatten samen 403 geordende `IngredientNeed`-regels en gebruiken 114 van de 140 centrale Ingredient-ID's. De Swift-bron slaat iedere hoeveelheid expliciet op als `amountPerPerson`; er zijn geen vrije-teksthoeveelheden en er is geen standaardportiegrootte in het receptmodel. `recipe_ingredients.amount_per_person` bewaart daarom exact die bestaande betekenis, zonder verzonnen porties of conversies.

De relatie gebruikt uitsluitend UUID-foreign keys naar `recipes.id` en `ingredients.id`. `position` bewaart de nulgebaseerde oorspronkelijke receptvolgorde. Bron-eenheden worden alleen veilig genormaliseerd: `grams → g`, `millilitres → ml`, `pieces → piece`, `litres → l` en `loaves → loaf`. De laag bevat geen product, SKU, supermarkt, prijs of recepttags.

De huidige bron koppelt alle 403 regels exact via de bestaande stabiele Ingredient-ID; er zijn geen fuzzy matches of ongekoppelde regels nodig. De matcher ondersteunt daarnaast gecontroleerd canonieke naamnormalisatie en de bestaande aliases, zodat latere veilige schrijfvarianten niet tot een tweede systeem leiden.

### Eenmalig uitvoeren in Supabase

Nadat stap 5 en 5.1 live zijn uitgevoerd, voer je in de Supabase SQL Editor exact in deze volgorde uit:

1. `supabase/migrations/20260908_create_recipe_ingredients.sql`
2. `supabase/seeds/20260908_recipe_ingredients.sql`

De seed controleert vooraf of alle stabiele recept- en Ingredient-ID's bestaan, en stopt bij een verweesde bronregel. De upsert gebruikt `(recipe_id, position)`, maakt bij een tweede uitvoering geen duplicaten en verwijdert geen bestaande data. RLS staat aan; `anon` en `authenticated` krijgen alleen leesrecht.

`data/recipe-ingredients.json` is uit de twee bestaande Swift-catalogi geëxtraheerd met `npm run extract:recipe-ingredients`. Na een bewuste bronwijziging genereert `npm run build:recipe-ingredient-seed` de SQL opnieuw; `npm run check` bewaakt dat bron en seed gelijk blijven.

## Automatische productontdekking

De bestaande wekelijkse catalogusrun is tevens de veilige discovery-run. GitHub Actions rouleert `core`, `fresh`, `world` en `pantry`. Voor iedere run wordt eerst één lichte lijst met bestaande Hoogvliet-SKU's uit Supabase geladen. Alleen onbekende SKU's gaan door de volledige productpagina-, prijs- en producttypevalidatie; bekende SKU's worden door de dagelijkse prijsruns actueel gehouden.

Een nieuw product wordt pas toegevoegd als SKU, naam, verpakking, Hoogvliet-product-URL en actuele verkoopprijs betrouwbaar bij hetzelfde product horen. De centrale classificatie uit stap 4.4 vult `product_type`, met `Onbekend` als veilige fallback. Nul nieuwe SKU's is een geldige, succesvolle discovery-run wanneer de gevonden resultaten aantoonbaar al in Supabase bestaan. Er worden nooit producten verwijderd omdat ze tijdens één run niet gevonden zijn.

## PWA 8.1 — dagelijkse catalogusgroei

De groeimodus gebruikt de bestaande Playwright-validatie en dezelfde idempotente
`(supermarket, sku)`- en `product_id`-upserts. Dagelijks worden maximaal 400
productkandidaten verwerkt; `processed` is de som van nieuw, inhoudelijk
bijgewerkt, ongewijzigd, na validatie overgeslagen en productspecifieke fouten.
Het aantal nieuwe producten kan dus lager zijn dan 400.

GitHub Actions plant twee UTC-momenten (`04:00` en `05:00`) en laat alleen het
moment door waarop `Europe/Amsterdam` daadwerkelijk 06:00 aangeeft. Daardoor
blijft de ochtendrun zonder handmatige cronwijziging correct bij CET en CEST.
`workflow_dispatch` blijft beschikbaar. Kies voor de verplichte veilige test
eerst `growth` met limiet 10 en uitgeschakelde cursorverplaatsing, herhaal exact
die run voor de idempotentiecontrole en gebruik pas daarna limiet 400.

`catalog_discovery_state` roteert de startzoekterm zodat een volgende run niet
steeds bij dezelfde populaire resultaten begint. `catalog_import_runs` bewaart
alleen één compacte samenvatting per run. Een unieke partial index voorkomt
parallelle running-runs; een status ouder dan drie uur wordt gecontroleerd als
mislukt afgesloten. Producten worden niet verwijderd wanneer ze tijdelijk niet
gevonden worden. Afbeeldingen blijven URL's en `product_prices` blijft één
actuele rij per `product_id`, zodat identieke dagelijkse prijsrecords niet
worden opgestapeld.

De PWA leest uitsluitend de runstatus via een read-only policy. Discovery-state
en importerwrites blijven server-side. Exact databaseopslaggebruik wordt niet
naar de browser gebracht zolang dit niet veilig zonder beheercredentials kan;
er wordt nooit een fictieve MB-waarde getoond.

### Dagelijkse importbewaking

De geplande groeirun controleert zijn eigen eindstatus direct. Daarnaast draait
`monitor-catalog-import.yml` dagelijks om 08:30 Nederlandse tijd. Ook deze
workflow gebruikt twee UTC-momenten met een `Europe/Amsterdam`-poort, zodat CET
en CEST geen handmatige aanpassing vragen. De controle faalt bewust wanneer de
06:00-run ontbreekt, ouder is dan zes uur, nog loopt, gedeeltelijk is voltooid
of is mislukt. Zo kan GitHub een Actions-melding/e-mail versturen volgens de
persoonlijke notificatie-instellingen. `workflow_dispatch` blijft beschikbaar
voor een handmatige controle of herstelrun.

Catalogusstatus onder **Meer** blijft de gebruikersgerichte controle: groen is
alleen volledig succes, geel is `running` of `partial` en rood is `failed`.
Bij een gedeeltelijke run maakt de PWA onderscheid tussen productfouten en
bron-/zoekroutewaarschuwingen. De laatst geldige catalogus blijft in alle
gevallen beschikbaar. Bewaking gebruikt uitsluitend de bestaande server-side
GitHub Secrets; er komt geen beheerkey in de browserbundle.

## Automatische prijsupdates

De dagelijkse prijsrun gebruikt de bestaande Hoogvliet-SKU en product-URL als identiteit. Zeven vaste SKU-shards verdelen het werk over de week. Wanneer een shard later meer producten bevat dan de begrensde batchgrootte, roteert iedere nieuwe week automatisch naar het volgende venster; nieuwe catalogusproducten blijven daardoor niet achter de eerste honderd SKU's vastzitten.

Voor vergelijking worden de bestaande prijzen één keer uit Supabase gelezen en uitsluitend via `product_id` gekoppeld. De run rapporteert gewijzigde en ongewijzigde prijzen, actieve/gestarte/beëindigde acties, niet gevonden producten en ongeldige prijzen. Een prijsrecord wordt alleen geschreven na een geslaagde productpagina- en SKU-validatie. Een ontbrekende of ongeldige nieuwe prijs wist nooit de laatst geldige prijs, en een tijdelijk ontbrekend product wordt niet verwijderd. `product_type`, afbeelding, merk en categorie blijven behouden wanneer de prijsbron geen betrouwbare vervanging levert.

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

## Producttype-classificatie

`src/product-type.mjs` bepaalt centraal een generiek `product_type` uit productnaam, merk, bestaande Hoogvliet-categorie en—alleen als fallback—de gebruikte zoekterm. Merk, Zero/Max en verpakkingsformaat worden geen zelfstandig producttype. Onzekere producten blijven behouden als `Onbekend`.

Voer eenmaal `supabase/migrations/20260908_add_product_type.sql` uit in de Supabase SQL Editor. De kolom is nullable en breekt bestaande clients niet. Zolang de kolom nog ontbreekt, blijven catalogus- en prijsimports zonder `product_type` functioneren.

Kies daarna in de handmatige GitHub Action **Soort update → classify** om bestaande producten met dezelfde centrale regels bij te werken. Nieuwe catalogusproducten en toekomstige prijsvalidaties krijgen hun producttype vervolgens automatisch. De classify-run wijzigt geen `product_prices`.

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
