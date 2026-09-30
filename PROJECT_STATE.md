# BoodschappenMaatje — Project State

## Actueel — importer- en maintenancehoofdstuk afgerond — 30 september 2026

### Release

- **Functionele mainrelease:** PR #31 is na groene CI en live acceptatie gemerged als `e6ab4199bd868a651f84fd5bb03a99855515d12f`.
- **Production:** Vercel-deployment `dpl_3Sk5Y5RHftvEu7pq4sc91Tk1cAtu` is een automatische Production-target build van exact deze maincommit, `READY`, zonder aliasfout. Publieke Home, Menu (`/week-voorbereiden`), Lijst en Budget zijn na release read-only gesmoked.
- **Rollback:** de vorige gezonde mainrelease was `dfa3d7773eb070de457ad2a9ac379acd9840f123` op `dpl_HK3GSecBCEvtcDmchGBdFqcJ251y`.
- **PR-status:** PR #33 is gemerged; PR #31 is gemerged; PR #32 is als superseded/diagnostic-only gesloten zonder merge. Geen diagnostische PR #32-code is gereleased.
- **Volgende productstap:** Productdata & receptkwaliteit. Deze feature is nog niet gestart.

### Maintenance en serverclient

- De definitieve oorzaak van de historische HTTP 503 `cache-unavailable` was `supabase-secret-header-invalid`: de toenmalige Vercel Production `SUPABASE_SECRET_KEY` was niet bruikbaar als HTTP-header.
- De correcte bestaande server-side Supabase-key is beveiligd in Production opgeslagen en met een echte Production-target build bewezen. Er is geen secretwaarde, fragment of header vastgelegd en er is geen onnodige keyrotatie uitgevoerd.
- PR #33 release `3eaef7fabee19efe6cde5273bcba11124259eef3` bevat veilige fail-closed reasoncodes en de maintenance-only replay.
- Historische 290 producten zijn in max-20-batches verwerkt; de eerdere 10 en latere 4 zijn afzonderlijk gericht verwerkt. Totaal: **304 acknowledgements**, `pending=0`, `notifiedProducts=304`, nul maintenance-retries/errors.
- De maintenance-replay startte geen productimport, discovery of dagjob en schreef geen producten of prijzen. Product- en prijsaantallen bleven tijdens maintenance 6359/6359.
- Actuele discovery-state is **v4**. De CAS-writerbescherming voorkomt dat oudere/generieke writers maintenancevelden wissen.

### Dagelijkse 400-flow

- Discovery is begrensd en hervatbaar: **800 pagina's per segment**, maximaal **8 segmenten**, één gedeeld runtimebudget van **105 minuten**, één daily claim en maximaal het actuele resterende dagdoel tot 400 bevestigde inserts.
- Alleen nieuwe, unieke, geldige, positief geprijsde en succesvol bevestigde product+prijs-inserts tellen mee.
- Duplicaten, bestaande producten, filterhits, ongeldige items en items zonder positieve prijs tellen niet mee.
- Een segment-/runtime-safety-limit levert een hervatbare status op en geldt nooit als bronuitputting. Een ambigue stall blijft fail-closed en stopt alleen de betrokken route.
- Een identieke herhaalde SKU-pagina (`repeated_sku_set`) is een bewezen lokaal route-einde: die route wordt uitgeput gemarkeerd zonder bronfout. Oude checkpoints met deze reden worden veilig naar `exhaustedTerms` gemigreerd.
- Dagbudget, cursor, dedupe, locks, retries en acknowledgements blijven veilig over segmenten en dezelfde dag heen; een nieuwe dag krijgt een eigen maximaal-400-budget.

### Live acceptatie — 30 september 2026

- **Eerste run:** Actions `36667726775`, op de toenmalige PR #31-head. De run scande 18.286 ruwe hits en schreef niets. Accounting: existing 8651, duplicates 2459, irrelevant 7112, new 0. Vier deterministische `repeated_sku_set` route-einden werden ten onrechte als stalls/bronfouten geclassificeerd, waardoor `discovery_incomplete_stalled_terms` ontstond.
- **Structurele fix:** `growth-collector.mjs` behandelt `repeated_sku_set` als lokaal route-einde; `catalog-growth.mjs` migreert overeenkomstige opgeslagen checkpoints naar uitgeputte routes. Ambigue stalls blijven fail-closed. Exact geteste PR-head: `875ac98a667585b0cbbcf980c1e471328c913333`.
- **Gecorrigeerde acceptatie:** Actions `36671598645` eindigde succesvol met `discovery_exhausted`. Alle **598** routes waren aantoonbaar uitgeput, `searchErrors=0`, `stalledTerms=[]`, nieuwe producten 0.
- De dagjob eindigde `daily_target_partial` met `collected=0`, `remaining=400`, `next_retry_at=null`, geen lock en geen lopende poging. Minder dan 400 is hier correct omdat echte bronuitputting is bewezen; dit was geen `page_safety_limit` of faux exhaustion.
- Producten/prijzen bleven **6359/6359**; op 30 september waren er 0 product- en 0 prijsinserts. De mislukte eerste poging en alle audit/accounting zijn behouden; er is geen dagreset of auditverwijdering uitgevoerd.
- Maintenance bleef tijdens en na de import gezond: v4, `pending=0`, `notifiedProducts=304`.

### Verificatie

- Gerichte regressies: 53/53 groen.
- Root: 273/273 tests plus syntax/seedchecks groen.
- Web: 756/756 tests, lint, TypeScript en Next.js Production-build groen.
- PR-head-CI: `Stability & core flows` run `36671219719` groen; Vercel-check groen.
- Live acceptatierun `36671598645` groen.
- Geen full backfill, destructieve databasehandeling, productreset, tijdspoof of tweede ongecontroleerde import uitgevoerd.

## Eerstvolgende roadmapstap

**Productdata & receptkwaliteit**: productmatching, receptprofielen, verpakkingsinformatie, readiness en Data Health systematisch verbeteren. Eerst de scope concretiseren; nog geen nieuwe feature bouwen in dit checkpoint.
