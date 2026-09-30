# BoodschappenMaatje — Project State

## Actueel — herstel gereleased; operationele eindverificatie deels open — 30 september 2026

### Release

- **Functionele mainrelease:** PR #31 is na groene CI en live acceptatie gemerged als `e6ab4199bd868a651f84fd5bb03a99855515d12f`.
- **Releasecommits:** PR #35-documentatie `bfa116253dd696d4035f27e058a81e31389b6768`; PR #36-workflowcorrectie `93435b36679a90c4814830d8690d86aa1dec1a71`. De actuele main-head is de repository-HEAD; documentatiecheckpoints kunnen die veranderen.
- **Production-release PR #36:** `dpl_5aDkTgLHigPZuFn1nndf6DH6BT3q`, Production-target van mergecommit `93435b3`, `READY` en zonder aliasfout. Home, Menu (`/week-voorbereiden`), Lijst en Budget zijn na de merge read-only geopend en renderen correct. Een later documentatiecheckpoint kan automatisch een nieuwere, inhoudelijk identieke Vercel-build opleveren; controleer voor actuele Current altijd de Production-alias. Dit is navigatie-/laadsmoke, geen schrijf- of fysieke iPhone-acceptatie.
- **Rollback:** de vorige gezonde mainrelease was `dfa3d7773eb070de457ad2a9ac379acd9840f123` op `dpl_HK3GSecBCEvtcDmchGBdFqcJ251y`.
- **PR-status:** PR #33 is gemerged; PR #31 is gemerged; PR #32 is als superseded/diagnostic-only gesloten zonder merge. Geen diagnostische PR #32-code is gereleased.
- **Volgende afzonderlijke opdracht:** VERBETERING HOOGVLIET-PRODUCTDEKKING, binnen de bredere roadmap Productdata & receptkwaliteit. Niet gestart.
- **Afrondingsstatus:** functionele herstelrelease en maintenance afgerond; documentatie-PR #35 is gemerged. Automatische planning is nog niet end-to-end bevestigd. De bewezen uitvoertijdpoortfout is in PR #36 gecorrigeerd met één tijdzonegebonden trigger per workflow en zonder startuurpoort. De configuratie, PR-head-CI `36688714761`, main-CI `36689014992` en Production-smoke zijn groen. De primaire dagelijkse import en standalone monitor zijn na de merge nog niet natuurlijk uitgevoerd; een vertraagde automatische prijsshard is afzonderlijk geslaagd. Er is geen handmatige productimport gestart.

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
- Een identieke herhaalde SKU-pagina (`repeated_sku_set`) wordt door de huidige strategie als lokaal route-einde geclassificeerd: die route wordt uitgeput gemarkeerd zonder bronfout. Dit bewijst niet dat elders in het Hoogvliet-assortiment geen producten bestaan. Oude checkpoints met deze reden worden veilig naar `exhaustedTerms` gemigreerd.
- Dagbudget, cursor, dedupe, locks, retries en acknowledgements blijven veilig over segmenten en dezelfde dag heen; een nieuwe dag krijgt een eigen maximaal-400-budget.

### Live acceptatie — 30 september 2026

- **Eerste run:** Actions `36667726775`, op de toenmalige PR #31-head. De run scande 18.286 ruwe hits en schreef niets. Accounting: existing 8651, duplicates 2459, irrelevant 7112, new 0. Vier deterministische `repeated_sku_set` route-einden werden ten onrechte als stalls/bronfouten geclassificeerd, waardoor `discovery_incomplete_stalled_terms` ontstond.
- **Structurele fix:** `growth-collector.mjs` behandelt `repeated_sku_set` als lokaal route-einde; `catalog-growth.mjs` migreert overeenkomstige opgeslagen checkpoints naar uitgeputte routes. Ambigue stalls blijven fail-closed. Exact geteste PR-head: `875ac98a667585b0cbbcf980c1e471328c913333`.
- **Gecorrigeerde acceptatie:** Actions `36671598645` eindigde succesvol met `discovery_exhausted`. De huidige discovery-state markeerde **598 geconfigureerde zoekroutes** als uitgeput, `searchErrors=0`, `stalledTerms=[]`, nieuwe producten 0. Dit resultaat geldt binnen de huidige zoekstrategie; het bewijst geen volledige Hoogvliet-dekking.
- De dagjob eindigde `daily_target_partial` met `collected=0`, `remaining=400`, `next_retry_at=null`, geen lock en geen lopende poging. Dit is het ontworpen eindresultaat bij uitputting volgens de huidige zoekstrategie; de stopreden was geen `page_safety_limit`. Het is geen bewijs dat dagelijks 400 nieuwe producten gevonden kunnen worden, noch onafhankelijk bewijs van uitputting van het volledige assortiment.
- Producten/prijzen bleven **6359/6359**; op 30 september waren er 0 product- en 0 prijsinserts. De mislukte eerste poging en alle audit/accounting zijn behouden; er is geen dagreset of auditverwijdering uitgevoerd.
- Maintenance bleef tijdens en na de import gezond: v4, `pending=0`, `notifiedProducts=304`.

### Verificatie

- Gerichte regressies: 53/53 groen.
- Root: 273/273 tests plus syntax/seedchecks groen.
- Web: 756/756 tests, lint, TypeScript en Next.js Production-build groen.
- PR-head-CI: `Stability & core flows` run `36671219719` groen; Vercel-check groen.
- Live acceptatierun `36671598645` groen.
- Actuele main-CI `Stability & core flows`, run `36672086621`, volledig geslaagd: importerfixtures/seedchecks, webtests, lint, TypeScript en build. Deze controle wijzigt uitsluitend documentatie; functionele tests zijn niet onnodig opnieuw gedraaid.
- Geen full backfill, destructieve databasehandeling, productreset, tijdspoof of tweede ongecontroleerde import uitgevoerd.

## Read-only releasecontrole — 30 september 2026, circa 09:12 Europe/Amsterdam

### Database en integriteit

- 6359 producten, alle beschikbaar; 6359 prijsregels.
- 0 dubbele combinaties supermarkt/SKU, 0 null/niet-positieve prijzen, 0 producten zonder positieve prijs, 0 verweesde prijsregels.
- Vandaag 0 nieuwe producten en 0 vandaag bijgewerkte prijsregels. Deze integriteitschecks bewijzen referentiële/prijsvaliditeit, niet semantische kwaliteit of actuele winkelprijzen.
- Maintenance-state v4: `confirmed`, `pendingProductIds=[]`, `notifiedProducts=304`, `failures=[]`; geen nieuwe acknowledgements nodig.
- Dagjob 2026-09-30: `daily_target_partial`, 0/400, 2 historische pogingen, `next_retry_at=null`, `lock_expires_at=null`. Geen lopende import of poging.
- De historische dagjob van 29 september blijft bewaard; geen reset, queuewrite, databasewijziging of nieuwe import uitgevoerd.

### Automatische planning en retries

- Primaire workflow: cron 04:00 en 05:00 UTC, met Europe/Amsterdam-uurcontrole op 06:00. Alleen de passende zomertijd-/wintertijdtrigger voert de dagelijkse flow uit.
- Werkvenster 06:00–23:00 Nederlandse tijd. Back-off 120/180/240 minuten; DB-claim 130 minuten. Gedeelde Actions-concurrency `hoogvliet-supabase-update`, zonder annuleren van een lopende run.
- Retryworkflow: 08:17/13:17/18:17 UTC (zomertijd 10:17/15:17/20:17; wintertijd 09:17/14:17/19:17). Eerst schrijfvrije due-check; alleen bij een verschuldigde poging worden dependencies en importer gestart.
- Geen retry bij gehaald dagdoel, afgesloten `daily_target_partial`, benodigde aandacht, actieve claim, nog niet verschuldigde poging of gesloten dagvenster. Hervatbare safety-budgetstops blijven onderscheiden van discovery-uitputting.
- Monitor: 06:30 en 07:30 UTC met Nederlandse uurcontrole op 08:00; bedoeld voor 08:30 lokaal.
- Overige bestaande planning: dagelijks prijsshard om 02:17 UTC (1 van 7, max 100) en zondag cataloguscontrole om 03:43 UTC (max 180). In deze controle niets gestart.
- Laatste waargenomen automatische retry: run `36650165488`, 30 september 02:24 lokaal, groen; due-check geslaagd, importer en installatie terecht overgeslagen. Deze run was vóór de huidige release.
- Laatste zichtbare standalone monitorruns: `36573258853` (29 september 15:11 lokaal) en `36580601377` (16:10 lokaal). Beide Actions-runs kregen de status `success`, maar checkout, installatie en `Dagelijkse import controleren` werden overgeslagen. De log van de eerste toont expliciet `DST-poort: deze UTC-run is lokaal 15:30 en wordt veilig overgeslagen.` De workflow is ingeschakeld.
- **Bewezen workflowfout:** de lokale-uurpoort gebruikt de werkelijke starttijd (`TZ=Europe/Amsterdam date +%H`) in plaats van het geplande tijdstip. Een door GitHub vertraagde monitorrun wordt daardoor als `success` afgesloten zonder de catalogus te controleren. De primaire dagworkflow heeft dezelfde kwetsbare uurpoort. GitHub documenteert dat geplande runs vertraagd of zelfs niet aangemaakt kunnen worden; de precieze reden waarom op 30 september om circa 09:35 lokaal nog geen monitor- of automatische importrun zichtbaar was, is niet vastgesteld.
- **Nog open:** PR #36 is gemerged en gebruikt één `Europe/Amsterdam` cron per dagflow (06:07, buiten GitHubs drukke hele-uurgrens) en monitor (08:30), zonder uitvoertijdpoort; prijs- en weekruns blijven UTC. De code/configuratie, main-CI en Production zijn groen, maar de primaire dagtrigger en monitor moeten bij hun volgende geplande run operationeel worden bevestigd. Een niet aangemaakte GitHub-schedule kan deze code niet zelf herstellen. Deze status staat los van productdekking. Geen workflow handmatig gestart of productimport uitgevoerd.

## Eerstvolgende afzonderlijke ontwikkelopdracht

**VERBETERING HOOGVLIET-PRODUCTDEKKING**

Onderzoek aanvullende categorieën, zoekmethoden, productpagina's en andere toegestane methoden om geldige nieuwe producten te ontdekken. Maak zichtbaar welke delen van het assortiment de huidige 598 routes wel/niet dekken en toets route-eindesignalen tegen werkelijke dekking.

Doel blijft **maximaal 400 daadwerkelijk nieuwe, unieke, geldige en positief geprijsde bevestigde inserts per dag wanneer voldoende geldige kandidaten beschikbaar zijn**. De acceptatie met nul inserts bewijst deze dagelijkse groei niet. Behoud dagbudget, dedupe, cursors, bounded retries, concurrency en de gezonde maintenanceketen.

Deze opdracht is uitsluitend vastgelegd, niet uitgevoerd. De bredere roadmapfase blijft Productdata & receptkwaliteit. `DESIGN.md` blijft ongewijzigd.

### Workflowcorrectie — PR #36 (releasecontrole 30 september 2026)

- De twee geplande monitorruns op 29 september hadden `success`, maar sloegen de daadwerkelijke monitorstap over; in de log van `36573258853` staat de lokale-uurpoort met een start om 15:30. GitHub kan geplande runs vertragen of laten vervallen.
- De aparte branch corrigeert de bestaande primaire dag- en monitorworkflows met GitHub's gedocumenteerde tijdzonecron. Eén cron per Nederlandse dag voorkomt een dubbele DST-trigger; de databaseclaim en het resterende 400-dagbudget blijven ongewijzigd. Gerichte configuratieregressie is toegevoegd.
- Workflowfix CI op de volledige PR-head `db1264ee142db1ff47b1603e1b83e71481d1bae9`: Actions `36686741289` groen, inclusief importerfixtures/seedchecks, webtests, lint, TypeScript en Production-build; Vercel Preview-check groen. De functionele head `0e6ff5c` had eveneens 275 roottests en 756 webtests groen. Dit bewijst de code/configuratie, niet een geplande live run.
- PR #36 is conflictvrij met schone diff en groene CI gemerged als `93435b3`. De main-CI `36689014992` en Production-build `dpl_5aDkTgLHigPZuFn1nndf6DH6BT3q` zijn geslaagd; Home/Menu/Lijst/Budget renderen. Op 30 september waren de verwachte automatische primaire en monitortriggers vóór de release niet zichtbaar; hun precieze afwezigheidsreden is niet bewezen. De eerstvolgende geplande primaire run is 1 oktober om 06:07 Europe/Amsterdam, monitor om 08:30; GitHub kan vertragen of een trigger missen. Een volledige primaire dagimport-/monitorcyclus na de release is nog niet waargenomen. De vertraagde automatische prijsshard `36689990758` startte om 10:29 lokaal, voltooide prijsbatch 3/7: 100 gecontroleerd en geschreven, 17 gewijzigd, 83 ongewijzigd, 0 fout. De catalogus bleef 6359 producten/6359 prijzen, 0 nieuwe producten, 100 vandaag bijgewerkte prijsregels; maintenance v4 bleef 0 pending/304 bevestigd. Dit is geen bewijs voor dagelijkse productgroei of de nieuwe monitorplanning. Geen dubbele of handmatige import gestart.
- Read-only DB-check na merge: 6359 producten, 6359 prijzen, vandaag 0 nieuwe; dagjob `daily_target_partial` 0/400, 2 eerdere pogingen, geen actieve lock of retry; 0 lopende imports of daily attempts. Discovery-state v4, maintenance `confirmed`, 0 pending, `notifiedProducts=304`.
