# Gerichte planner-cachekoppeling na nieuwe importerproducten

## Scope

Deze aanvulling op PR #22 verandert geen canonieke receptdata, matcherregels,
databaseobjecten, grants of importplanning. Er wordt geen onderhoud gestart bij
module-import, app-build, deployment of een gewone GET. Alleen de vertrouwde
importer kan de token-beveiligde POST-route aanroepen na product- én prijsopslag.

`POST /api/internal/planner-readiness/new-products` accepteert uitsluitend
`{ "productIds": ["UUID"] }`, maximaal 20 UUIDs. Geen receptselectie, personenbereik,
matchoverride of full-backfilloptie kan door de aanroeper worden opgegeven.

## Insertbewijs en importer

- De bestaande gezamenlijke `upsertProducts`-opslaglaag wordt gebruikt door catalog
  en growth/daily import. Prijsrefresh en classificatie krijgen geen extra koppeling.
- Indien geconfigureerd: probeer een insert met een per poging gegenereerde UUID en
  `ON CONFLICT (supermarket,sku) DO NOTHING` (`resolution=ignore-duplicates`).
- Alleen een bevestigde eigen UUID bewijst dat deze poging echt een product toevoegde.
  Een bestaande of gelijktijdig toegevoegde SKU wordt normaal bijgewerkt zonder
  nieuw-products-signaal. Herhaling na verloren netwerkantwoord behoudt dezelfde UUID.
- Pas na bevestigde prijsopslag worden nieuwe IDs doorgegeven, in batches van maximaal 20.
- `finally` bewaart de notificatie voor eerdere succesvolle product/prijsparen wanneer
  een later product in dezelfde batch een structurele schrijffout krijgt.
- Een onderhoudsfout verandert een succesvolle productimport niet in een mislukte
  productimport. Er zijn maximaal drie HTTP-pogingen; daarna vermeldt de waarschuwing
  uitsluitend de exacte product-IDs voor gerichte hervatting. Geen secrets of responsebody.
- Een procescrash vóór notificatie of langdurige onderhoudsuitval heeft geen duurzame
  outbox/automatische aflevergarantie. Zo'n incident vereist gerichte herhaling van de
  bekende IDs, geen full-backfill. Een duurzame queue zou een apart ontwerp/goedkeuring
  vragen en is niet stiekem toegevoegd.

## Centrale matching en gerichte writes

1. Laad alleen de opgegeven nieuwe producten met prijzen in één productbatch.
2. Lees uitsluitend current, niet-geïnvalideerde, huidige matcher-versie
   `invalid/no_catalog_product`-records.
3. Voer lokaal de bestaande `isReliableIngredientMatch` en
   `selectIngredientProduct` uit; geen nieuwe SQL-matcher of globale product-search.
4. Vereis een passende verpakking en gekoppelde bruikbare prijs voordat een match
   betrouwbaar wordt gekoppeld. Een onzeker resultaat blijft onaangeraakt.
5. Update alleen bewezen opgeloste matchkeys met een compare-and-set op de gelezen
   status/versie/timestamp. Bestaande geldige matches worden niet herschreven.
6. Bestaande matchtriggers invalidaten uitsluitend afhankelijke readiness.
7. Lees die bestaande pending varianten met `dependency_match_keys` overlap, p1–p10.
   Evalueer alleen deze recepten, maximaal tien per evaluatiebatch, met de bestaande
   `resolveRecipeReadiness`. Geldige productmatches worden hergebruikt.
8. Schrijf uitsluitend bestaande readinessrecords terug, met een timestampcontrole.
   Schrijf GEEN overige matchrows uit het readinessresultaat terug: zo blijven ook
   matches die met andere recepten gedeeld worden onaangeroerd.
9. Een herhaalde notificatie slaat geldige matches/current readiness over en kan na
   een onderbreking alleen nog afhankelijke pending readiness afmaken.

Een falafelmatch maakt een recept met ook ontbrekende pitabroodjes niet READY.
Recepten zonder relatie met de gewijzigde match blijven byte-voor-byte ongemoeid.
De receptcatalogus wordt read-only geladen voor de bestaande evaluator; dit betekent
geen evaluatie of herschrijven van alle recepten.

## Configuratie / afzonderlijke activatie

Importer runtime:

- `PLANNER_CACHE_BASE_URL`: HTTPS-origin van de goedgekeurde appomgeving;
- `PLANNER_CACHE_ADMIN_TOKEN`: dezelfde server-side admin-token als op die appomgeving.

Beide leeg: bestaande import blijft ongewijzigd, onderhoud niet actief.
Slechts één ingesteld/ongeldige URL: configuratiefout vóór writes.
De normale import- en retryworkflows geven alleen deze twee waarden door; hun cron,
daily-joblogica, concurrency, fail-fast, checkpointing en monitoring zijn ongewijzigd.
Geen echte variable/secretwaarde wordt door deze codecommit geconfigureerd.

De server gebruikt de bestaande `SUPABASE_SECRET_KEY` en `PLANNER_CACHE_ADMIN_TOKEN`.
Geen browsersecret, nieuwe key, grant, trigger of migratie is nodig voor deze code.
Een beschermde Preview vereist daarnaast bestaande geautoriseerde deploymenttoegang;
de importer volgt nooit redirects en schakelt geen beveiliging uit.

## Validatiegrens

Testfixtures gebruiken de echte centrale matcher, readinessresolver en evaluator,
met een in-memory database-adapter die gerichte invalidatie simuleert.
Dit is code-/regressiebewijs, geen claim van een uitgevoerde Production-import.
Voor de echte falafel-E2E-test moet afzonderlijk toestemming volgen.
