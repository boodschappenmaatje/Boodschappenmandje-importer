# Eenmalige begrensde PR #23-validatie

Deze route mag pas na expliciete toestemming worden gestart. Toevoegen en testen
van de route voert geen echte import uit.

## Exacte handmatige run

Workflow: `.github/workflows/import-hoogvliet-poc.yml`
(Hoogvliet import proof of concept).
Branch: `fix/planner-new-product-maintenance`.
Job: `falafel-e2e`. Entrypoint: `node scripts/falafel-e2e.mjs`.

Gebruik deze workflow_dispatch-inputs:

```json
{
  "falafel_e2e_only": "true",
  "e2e_test_sku": "730331000",
  "preflight_only": "false",
  "update_mode": "catalog",
  "catalog_batch": "core",
  "growth_limit": "10",
  "advance_discovery_state": "false",
  "price_shard": "auto"
}
```

De laatste vijf bestaande inputs worden niet aan de E2E-job doorgegeven en hebben
geen effect op deze route. De normale importer en de afzonderlijke preflight-job
worden overgeslagen. Checkout gebruikt de exacte dispatch-commit. De job deelt
de bestaande `hoogvliet-supabase-update` concurrencygroep.

## Begrenzing en productiecode

Alleen de exacte SKU, expliciete E2E-modus, juiste repository/branch, handmatige
dispatch en eerste runpoging worden geaccepteerd. Verkeerde of ontbrekende SKU
binnen de E2E-modus stopt voor netwerkverkeer. Invullen van een SKU zonder de
E2E-modus blokkeert eveneens de normale importer en faalt in de E2E-inputcontrole.
Een gewone dispatch zonder E2E-modus en zonder SKU houdt zijn bestaande gedrag.

`refreshExistingProducts` bezoekt uitsluitend de vaste Hoogvliet-detailpagina en
hergebruikt de bestaande bronvalidatie en prijsparser. Er is geen zoeklus,
catalogusgroei, discovery-advance of maximum-aantal als importbegrenzing.
Naam, SKU, verpakking, gewicht, bron-URL en verse positieve bronprijs moeten
overeenkomen. Er staat geen vaste prijs in het entrypoint.

`upsertProducts` verzorgt de echte productinsert, prijsopslag en bestaande
maintenance-client inclusief retries, admin-token en Vercel bypass. Een lokale
HTTP-guard laat alleen deze ene productrow, bijbehorende prijs en één product-ID
naar de vaste Preview-maintenance-route door. Fallback-updates van bestaande
producten, andere SKU's, discovery-writes en andere endpoints worden geweigerd.
De productafwezigheid wordt vóór bronvalidatie en vlak vóór insert gecontroleerd.
Een gelijktijdige insert kan door ignore-duplicates niet worden overschreven.

Bestaande secrets: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
`PLANNER_CACHE_ADMIN_TOKEN`, `VERCEL_AUTOMATION_BYPASS_SECRET`.
Bestaande variable: `PLANNER_CACHE_BASE_URL`. Alleen de bekende database en
PR #23 Preview-origin zijn toegestaan. Geen nieuwe secrets of productiemutaties
aan de applicatiecode zijn nodig. De echte route gebruikt geen mocks.

## Audit en stopvoorwaarden

Vóór writes moet het checkpoint nog gelden: geen falafelproduct, één schone
ongeldige falafel-match en tien bijbehorende readinessrecords voor falafel-pita
(1–10 personen, twee problemen: falafel en pitabroodjes). Een lege-ID-authprobe
moet de verwachte 400 opleveren vóór databasewrites.

Volledige records van twaalf relevante tabellen worden gepagineerd vóór en na
gelezen en op sleutel en SHA256 vergeleken. Toegestaan zijn één nieuw product,
één bijbehorende prijs, één bijgewerkte falafel-match en tien bijgewerkte
readinessrecords. Pitabroodjes blijft het enige probleem. Andere producten,
prijzen, matches, readiness, recepten, ingrediënten, aliases en import/discovery-
administratie moeten ongewijzigd blijven.

JSON-logs bevatten aantallen vóór/na, SKU, product-ID, live bronprijs,
maintenance-pogingen/resultaat, aantallen toegevoegde/gewijzigde/verwijderde
records per tabel, `unexpected_writes` (verwacht 0) en `e2e_passed`.
Geen secrets, willekeurige responsebodies of foutdetails worden gelogd.
Deze vergelijking bewijst netto recordverschillen binnen de gelezen tabellen;
het is geen transactioneel SQL-auditlog. Gelijktijdige externe writes kunnen de
validatie laten falen. Bij onleesbare nacontrole is `unexpected_writes: null`.

Een fout kan volgen op een reeds geslaagde eigen insert. Stop dan en onderzoek
alleen-lezen: geen automatische rollback, volledige import-herhaling of Actions
rerun. Een bestaande SKU blokkeert een volgende dispatch vóór writes.

## Lokale tests

`node --test test/*.test.mjs` gebruikt fixtures en gemockte HTTP voor deze route;
de tests voeren geen echte import, maintenance-call of databasewrite uit.
`test/falafel-e2e.test.mjs` controleert input, context, brondata, scope,
concurrente insert, authenticatie bij retries, discovery, audit en secretlogging.
