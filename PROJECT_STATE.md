# Checkpoint 19 — PR #47 Playwright-hotfix release — 5 oktober 2026

## Merge en Production

- PR #47 is gemerged vanaf goedgekeurde pre-merge head `2b3eddde3bfbc4cf380e97e4610fd8acce5d4143`, squash mergecommit `f3c9ac7a57ac9d371993b0be692c9b2c09a42656`; dit is de actuele `main`.
- Main-CI run **37294369743** (#240) is geslaagd. Vercel Production-deployment `dpl_7ddWk9WaZ1cX2nm5gypivAJ5CVa8` staat **READY**, zonder aliasfout. Read-only homepage-smoke op `https://boodschappenmaatje-pwa.vercel.app/` gaf HTTP 200.
- De runtimefix past de source-evidencewaarden als één object toe op Playwright `page.evaluate`. Bestaande classificatielogica en regressietests zijn behouden.
- Releasegate controleerde dat PR #45 schedulerfix intact is (`0 4 * * *` / `0 5 * * *` UTC met DST-offset-gate), PR #46 `daily_import=true` en de 400-config intact zijn, en `DISCOVERY_STRATEGY_VERSION=hoogvliet-categories-pagination-v2` nog wordt gebruikt. De PR-diff had uitsluitend `src/hoogvliet.mjs`, `test/importer.test.mjs` en `PROJECT_STATE.md`.

## Dagjob read-only gecontroleerd; geen nieuwe run gestart

- Production-job `daily-catalog-growth`, datum `2026-10-05`, ID `53553be0-2158-47b1-92c3-2bc75cd7d0cc`: `failed_requires_attention`, poging 1, 0/400 toegevoegd, resterend 400, `next_retry_at=null`, `lock_expires_at=null`. Stale lock: **nee**.
- Poging 1 is `non_retryable_failure` met `non_retryable_import_error`. Run #112 eindigde vóór discovery: 0 paginahits, 0 unieke kandidaten, 0 discoverysegmenten en 0 toegevoegd. Cumulatief blijft 0/400.
- De bestaande veilige code weigert deze toestand te herstarten: `shouldRunDailyImport` geeft voor `failed_requires_attention` `run=false`; de bestaande `claim_catalog_daily_attempt`-functie retourneert dezelfde status zonder claim. Daardoor was een nieuwe `daily_import=true`-dispatch niet veilig toegestaan zonder statusomzeiling. Er is geen nieuwe dispatch gestart en geen dagstatus aangepast.
- Nieuwe daily-run na PR #47: **geen run-ID**; discovery is niet opnieuw bereikt. Er is geen nieuwe import of Production-databasewrite uitgevoerd.

## Volgende stap

- Ontwerp als afzonderlijke, begrensde release een veilige herstelroute voor uitsluitend de aantoonbaar verholpen Playwright-runtimefout. Behoud bestaande dagcounter, resterend doel, claim/lock en dedupe; geen directe database-edit.
- Pas na die releasegate kan één nieuwe daily-run worden beoordeeld. Als die discovery bereikt maar weinig of geen nieuwe producten vindt, vergelijk eerst het aantal bereikbare unieke Hoogvliet-SKU's met de Production-catalogus; bouw dan niet automatisch een discoveryfix.

# Checkpoint 18 — Playwright-bronstatus hotfix — 5 oktober 2026

## Remote en runtimebevinding

- Actuele remote `main`: `fe5b248815dc0dc2639e8ff6c9f7b00fbac1a785`; PR #46 is daarin gemerged.
- De gecontroleerde Production-run #112 gebruikte de daily-growthroute correct, maar stopte vóór discovery met 0/400 en de fout `Too many arguments. If you need to pass more than 1 argument to the function wrap them in an object.`
- Exacte oorzaak in `src/hoogvliet.mjs`, `readSourcePageEvidence`: `page.evaluate(callback, expectedSelector, responseStatus)` gaf twee losse serialiseerbare argumenten door. Playwright accepteert één argument naast de callback.

## Beperkte fix en regressie

- De callback destructureert nu `{ selector, responseStatus }`; de aanroep geeft één object met dezelfde twee bestaande waarden door. Classificatiegedrag is niet gewijzigd.
- Repositorybrede GitHub-codezoekactie vond twee `page.evaluate`-locaties: deze importer-aanroep en `scripts/pwa13-browser.mjs`, waar de callbacks geen extra argumenten krijgen. Geen tweede foutief meervoudig-argumentgebruik gevonden.
- `test/importer.test.mjs` bevat een regressietest via `waitForSourceContent` met een strikte `page.evaluate`-contractstub. Die controleert één objectargument en bevestigt dat een expliciet lege pagina nog steeds `valid_empty_search` oplevert. Bestaande bronclassificatietests blijven ongewijzigd en dekken challenge, bronstoring, parserstructuur en navigatiefout.
- De volledige root/importer-suite en `npm run check` zijn via GitHub Actions releasegate-run **37290835429** (run #236) geslaagd op functionele code/test-head `4c511a0`. Ook de PostgreSQL atomic rollback/concurrency-gate en web core flows, lint, TypeScript en Production-build zijn groen. De regressietest liep mee in de importer-suite. Latere commits op deze branch wijzigen alleen documentatie/PR-tekst, niet de geteste code. De lokale Codex-werkruimte bevatte geen checkout; verificatie is uitgevoerd in GitHub Actions.
- Alleen importerbron, regressietest en deze projectstatus zijn gewijzigd. Geen discovery-, scheduler-, dedupe-, validatie-, retry- of dagjoblogica gewijzigd. In dit hotfixcheckpoint is geen live import, Production-databasewrite, merge of Production-deploy gestart.
- Featurebranch `codex/fix-playwright-evaluate-arguments-20261005` werd PR #47 en is na dit checkpoint gemerged; zie checkpoint 19 voor de release- en dagjobstatus.

# Checkpoint 17 — handmatige daily-dispatch en bronclassificatie — 5 oktober 2026

## Remote, PR-status en incidentbewijs

- De actuele remote `main` is gecontroleerd op `d0836510f02f09b33bc1fd696859f31c5a506e39`. PR #44 (discoveryfix) en PR #45 (schedulerfix) zijn volgens GitHub gemerged; deze featurebranch is daarvan afgeleid en merge’t niet terug naar `main`.
- PR #45 blijft functioneel onaangetast: de primaire workflow gebruikt nog steeds `0 4 * * *` en `0 5 * * *`; de Europe/Amsterdam-gate laat exact de kandidaat voor 06:00 lokale tijd door. De prijs- en wekelijkse catalogustriggers zijn niet gewijzigd.
- Handmatige run `37282770828` op `main` kreeg `RUN_IMPORT=1`, `UPDATE_MODE=catalog`, `CATALOG_BATCH=core`, `MAX_PRODUCTS=180`, `MAX_NEW_PRODUCTS=100`, `DAILY_IMPORT_JOB=0` en `DAILY_NEW_PRODUCT_TARGET=180`. Daardoor werd `npm run import` gestart. Dit was geen dagelijkse 400-job.

## Bewezen oorzaak en veilige handmatige route

- De workflow had geen expliciete `daily_import`-dispatchinput. De bestaande handmatige defaults stuurden naar de normale catalogusmodus; alleen de aparte legacy-optie `daily_attempt_only` forceerde de daily-tak. Dat verklaart `DAILY_IMPORT_JOB=0` en het verkeerde doel.
- De workflow heeft nu `daily_import: true`. Die route zet uitsluitend de bestaande daily-configuratie aan: `UPDATE_MODE=growth`, `CATALOG_BATCH=growth`, `MAX_PRODUCTS=400`, `DAILY_IMPORT_JOB=1`, `DAILY_NEW_PRODUCT_TARGET=400`, `IMPORT_TRIGGER=schedule` en `ADVANCE_DISCOVERY_STATE=1`. De importstap kiest daardoor `npm run import:daily`.
- De dagelijkse jobclaim blijft leidend: de code gebruikt de persistente `dailyImportId`, bestaande dagstand en `remainingTarget`; `MAX_NEW_PRODUCTS=400` is alleen de bovengrens van de workflowconfiguratie en vervangt geen dagclaim. Duplicates, bestaande SKU’s, invalid-producten, locks, retries en de 400-cap zijn niet omzeild. `daily_import` wordt uitgesloten van preflight/E2E-paden en conflicten met legacy daily-attempt/challenge-resume worden afgewezen.

## Drie lege zoekroutes: bewijsgrens en codeoorzaak

- De runtime-log bewees voor `gehakt`, `rundergehakt` en `kip` alleen: drie opeenvolgende routes met nul geparseerde productdata, waarna de oude teller globale `source_unavailable` veroorzaakte. Het log bevatte geen HTTP-status, redirect, DOM-signatuur, responseclassificatie of XHR-bewijs.
- Een live bronreproductie kon in deze Codex-omgeving niet veilig worden vastgesteld: de Hoogvliet-host gaf hier DNS/network `EAI_AGAIN` en er was geen browserbinary. De GitHub runlog kon via de read-only log-URL niet worden opgehaald (`403 Forbidden`). Daarom is A–F (tijdelijke bronuitval, layout/API, client-side data, URL-fout, challenge, te agressieve drempel of catalogusuitputting) niet als upstream oorzaak bewezen. Er is geen Zyte-request uitgevoerd.
- Wel bewezen in code: elk niet-herkend document werd door `classifySourcePageEvidence` als gewone lege route behandeld. Daardoor kon onbekende HTML/parserstructuur of een niet-gediagnosticeerde route in de drie-lege-routes-stop belanden als `source_unavailable`. Dat is de concrete fout die deze checkpoint oplost; het is geen onbewezen parser- of bronclaim.

## Codefix en observability

- `src/hoogvliet.mjs` bewaart nu compacte response-evidence (HTTP-status, navigatiefout, verwachte productstructuur, expliciete lege zoekstaat, nul-producten en security-signatuur) zonder HTML op te slaan. De classificaties zijn `valid_empty_search`, `source_unavailable`, `challenge`, `parser_structure_changed` en `navigation_error`; Incapsula blijft security/challenge-safe.
- Een geldige lege zoekroute is lokale uitputting en reset de globale opeenvolgende-lege-routes-teller. Een onbekende structuur faalt expliciet als `parser_structure_changed`; navigatiefouten zijn begrensd retrybaar; tijdelijke HTTP-bronfouten blijven `source_unavailable`. De compacte log toont per lege route `term`, classificatie en ruwe kandidaten.
- `src/catalog-growth.mjs` en `src/daily-catalog-growth.mjs` behouden de nieuwe foutcodes in status/retrybeleid. Dedupe, validatie, discovery-fingerprint, pagination/cursor, safe exhaustion en dagboekhouding zijn niet versoepeld.

## Tests en stopgrens

- Volledige root-suite: **334/334 groen**. `npm run check`: groen. Getest zijn onder meer de expliciete daily-dispatchwaarden, persistente remainingTarget/dagstand, normale catalogusmodus, geldige lege routes, challenge, bronstoring, parserwijziging, navigatiefout, duplicates/existing/invalid/new, pagination en bestaande scheduler/retry-/prijs-/weektriggers.
- YAML-validatie: `.github/workflows/import-hoogvliet-poc.yml` is geldig; primaire schedules zijn exact `0 4 * * *`, `0 5 * * *`, `17 2 * * *` en `43 3 * * 0`. Geen `timezone:`-constructie is toegevoegd. Schedulerfix PR #45 is behouden.
- Geen live productimport, workflow-dispatch, databasewrite, migration, deploy of merge uitgevoerd. `ROADMAP.md` is niet gewijzigd.
- Branch: `codex/fix-highvliet-daily-dispatch-source-20261005`. Work controleert PR en CI; na expliciete mergegoedkeuring kan de gebruiker zelf exact één workflow-dispatch met uitsluitend `daily_import=true` starten. Controleer dan eerst de logvelden `DAILY_IMPORT_JOB=1`, `DAILY_NEW_PRODUCT_TARGET=400`, `npm run import:daily`, dezelfde `dailyImportId`, funnel en cumulatieve `X/400`.

# Checkpoint 16 — schedulerfix 06:00 Europe/Amsterdam — 5 oktober 2026

## Bewezen schedulerstatus en oorzaak

- De actuele `origin/main` is opnieuw gecontroleerd op `f07fa6e27e526110721fbd97f5ef0cd3ec4b5586`; default branch is `main`, de workflow is actief en de werkboom was schoon. Tussen 04:00 en 07:21 UTC op 5 oktober 2026 registreerde GitHub geen scheduled run voor `import-hoogvliet-poc.yml`, hoewel de main-head om 23:15 UTC al actief was. De GitHub read-only API geeft geen interne reden waarom dit event niet werd aangemaakt.
- De actuele officiële GitHub Docs ondersteunen op GitHub.com inmiddels een optionele IANA-`timezone` voor `schedule` (`actions-schedule-timezone`, GitHub.com-versie `*`). De eerdere aanname dat de sleutel per definitie ongeldig was, is dus niet bewezen. De repository-ervaring toont wel dat de primaire timezone-afhankelijke trigger operationeel niet betrouwbaar genoeg was voor deze deadline; de fix maakt de UTC-planning expliciet en is niet afhankelijk van timezone-aware scheduling.

## Codefix

- `.github/workflows/import-hoogvliet-poc.yml` gebruikt nu alleen geldige UTC-crons `0 4 * * *` en `0 5 * * *`. De eerste is de Nederlandse 06:00-kandidaat tijdens CEST, de tweede tijdens CET.
- `src/daily-schedule-gate.mjs` laat exact één kandidaat door op basis van de actuele `Europe/Amsterdam`-DST-offset. Het gate’t niet op de runner-wandklok, zodat een door GitHub vertraagde geldige event niet onterecht wordt overgeslagen. De bestaande persistente daily claim, lock, dedupe, retries en 400-cap blijven de feitelijke tweede duplicate-/dagbudgetbeveiliging.
- Prijsdeelbatch `17 2 * * *`, zondagse catalogustrigger `43 3 * * 0`, monitor en retryworkflow zijn niet functioneel gewijzigd.

## Tests en releasegate

- Schedulerregressies: **5/5 groen**; volledige root-suite: **331/331 groen**; `npm run check`: groen; web `npm run check`: groen (**69 testfiles / 855 tests**, lint, TypeScript en Next production build). PyYAML valideerde alle workflowbestanden; de primaire schedulestructuur bevat exact de vier verwachte cronentries en geen `timezone:`.
- De officiële broncontrole was `github/docs` `workflow-syntax.md` en `actions-scheduled-workflow-example.md` op 5 oktober 2026: GitHub.com documenteert timezone-aware scheduling als ondersteund. De fix kiest desondanks expliciete UTC-crons om de niet-geschedulede repository-run niet opnieuw afhankelijk te maken van die optionele timezone-laag.
- Geen productimport, databasewrite, migration, deploy of merge uitgevoerd. Branch: `codex/fix-highvliet-scheduler-20261005`; PR wordt pas na groene lokale releasegate aangemaakt.

## Work-controle na PR

- Work controleert PR + CI en verifieert op main dat de twee UTC-crons zijn gepubliceerd. Vóór expliciete goedkeuring geen merge en geen import.
- Na expliciete toestemming: merge, daarna één gecontroleerde dagelijkse run via dezelfde persistente `import:daily`-job, 400/dag-cap, dedupe, lock en retrypad; controleer funnel en cumulatieve dagstand.

# Checkpoint 15 — Hoogvliet discovery/exhaustion-fix en 06:00-planning — 4 oktober 2026

## Diagnose en bewezen oorzaak

- Actuele remote `main` is vóór deze wijziging gecontroleerd op `13bd4f60fcc00e6821458d1f8a2afb3a4a188a22`; de werkboom was schoon. Deze wijziging staat op featurebranch `codex/fix-highvliet-discovery-400-20261004`; er is niet naar `main` gemerged.
- De historische nulrun bewees geen lege Hoogvliet-catalogus. De eerder vastgelegde run had 18.286 ruwe hits: 8.651 bestaande, 2.459 duplicaten, 7.112 niet-relevant, 64 herhaalde pagina-hits en 0 nieuw. De in deze opdracht genoemde legacy-funnel van circa 8.550 pagina-hits is niet meer volledig reconstrueerbaar: het oude runrecord bewaart geen betrouwbare unieke-kandidaat-SKU-set. Daarom wordt voor die 8.550 geen verzonnen kandidatengetal gerapporteerd.
- De codeoorzaak die wél bewezen is: persistente `exhaustedTerms` hadden geen fingerprint van de discoverystrategie. Route-einden uit een oudere listing-/paginationruimte konden daardoor een gewijzigde, grotere bereikbare ruimte overslaan; bij lege resterende routes kon `discovery_exhausted` volgen zonder bewijs dat de actuele ruimte was uitgeput. De al eerder bewezen historische beperkingen — te smalle dynamische keywordruimte, foutieve `+`-spatiecodering en keywordfiltering op categorieproducten — zijn op actuele `main` al opgelost met publieke categorie-routes en behouden normalisatie.
- Bestaande SKU’s, duplicaten, invalidatie/detail/prijsgates en veilige bron-/paginationstops zijn niet versoepeld. Een route wordt nog steeds niet als globale uitputting gezien door alleen bekende resultaten; uitsluitend de actuele volledige routeverzameling kan `discovery_exhausted` opleveren.

## Codefix en observability

- `DISCOVERY_STRATEGY_VERSION` wordt persistent opgeslagen. Ontbrekende of afwijkende strategy-state wist alleen de oude route-einden/stalls en reset de discoverycursor éénmalig; bestaande producten blijven door SKU-dedupe beschermd. Daarna geldt de normale veilige exhaustionlogica opnieuw.
- De resumable dagrun houdt een in-memory cross-segment SKU-set bij voor exacte unieke-kandidaatrapportage. De compacte summary toont nu page hits, unieke kandidaten, bestaande SKU’s, duplicaten, invalid, nieuwe geldige kandidaten, werkelijk toegevoegd, stopreden en cumulatieve `X/400`.
- De primaire workflow staat op `0 6 * * *` met `timezone: Europe/Amsterdam`: op 5 oktober 2026 is dat aantoonbaar 04:00 UTC / 06:00 Nederlandse tijd. De workflow-dispatchvertakking gebruikt dezelfde cronwaarde.
- Retries behouden de bestaande persistente daily claim en gebruiken uitsluitend `remainingTarget`; ze proberen niet ieder afzonderlijk 400 producten. De summary toont de cumulatieve dagstand als `cumulatief_nieuw=X/400`.

## Tests en verwachte flow

- Nieuwe regressies bewijzen dat 5.000 bekende kandidaten discovery niet blokkeren als latere nieuwe kandidaten bereikbaar zijn, legacy exhaustion na strategywijziging éénmaal wordt herhaald, de funnelsummary correct is en de primaire cron exact 06:00 NL is.
- Root-gate: **328/328 tests groen**, inclusief pagination/cursor, categorie-traversal, bestaande SKU’s, duplicates, invalid, nieuwe geldige SKU’s, exhaustion-vs-stall, 400-target, retries/dagstand en challenge/bronfouten. `npm run check` groen inclusief syntaxchecks en drie seedchecks.
- Geen live productimport, databasewrite, migration, Production-deploy of merge uitgevoerd. `ROADMAP.md` is niet gewijzigd.

## Work-controle na PR

- Work controleert PR + CI op exact deze branch/head en voert vóór merge geen import uit.
- Na expliciete mergegoedkeuring: verifieer dat Production de workflow met de nieuwe `0 6`-cron bevat, dat de eerste natuurlijke run 5 oktober om 06:00 NL start, dat de gewone daily claim actief is en dat retries dezelfde `dailyImportId`/dagstand aanvullen.
- Monitor live minimaal de funnelvelden en stopreden: page hits → unieke kandidaten → bestaande SKU’s/duplicates/invalid → nieuwe geldige kandidaten → werkelijk toegevoegd, plus `X/400`. Bevestig dat geen duplicate, ongeldige of onbetrouwbare kandidaat als groei telt.

# Checkpoint 14C — productidentiteit en product_type read-only gecontroleerd — 4 oktober 2026

## Remote en Production

- Remote `main` vóór documentatie-update: `b01c4bc4858de490ac29e0c12a8c45b8ee365a54`. Production Supabase-project `pjcqxufvbkkjehituzxz`; alleen SELECT-controles.
- Checkpoint 14B blijft onveranderd: één bounded commit SUCCESS; exact 3 matchrecords en 70 readinessrecords binnen scope; geen buiten-scopewrites. AFTER op 4 personen: Honig 11/7/1, Knorr 17/5/14. `RECOMPUTE_ARMED=false`, `REPAIR_ARMED=false).
- Producttabel heeft geen opgeslagen raw/source-payloadkolommen. Wel zijn naam, merk, categorie, package/gewicht, image-URL, source-URL en tijdstempels beschikbaar.

## Productrecords en officiële bron

| SKU | Production-record | Bron- en catalogusbewijs | Oordeel |
| --- | --- | --- | --- |
| `733659000` | Hoogvliet Riblappen; categorie `Vlees, vis, vegetarisch/Rund-en varkensvlees/Stoofvlees`; `product_type=Varkensvlees`; catalogus `Ca. 700 gram`, gewicht 700 g; source URL `https://www.hoogvliet.com/product/hoogvliet-riblappen9`; image asset bevat dezelfde SKU. | De actuele officiële pagina noemt “Runderriblappen / rundvlees”, 100% rundvlees en 3–5 uur stoven. De bestelkop toont circa 700 g en de normale prijs per kilo past bij die circa 700 g. Het afzonderlijke fabrikantveld “Netto-inhoud 1000 GR” conflicteert met de bestelkop en catalogus; daarom is dit geen bewijs voor een exact pakketgewicht. De importer valideert bovendien dat de SKU uit de officiële productpagina gelijk is aan de kandidaat-SKU. | Productidentiteit als runderriblappen is onafhankelijk bevestigd. `SAFE_READY` voor de hacheevlees-matchidentiteit; niet gelezen als bevestiging van een exact gewicht. |
| `060936000` | Trostomaten; categorie `Aardappelen, groente, fruit/Groente/Tomaat, paprika`; `product_type=Aardappelen`; package/gewicht 500 g; source URL `https://www.hoogvliet.com/product/trostomaten-verpakt`; image asset bevat dezelfde SKU. | De actuele officiële pagina toont Trostomaten, 500 g, en productinformatie met netto-inhoud 500 g. Dit bevestigt de tomatenidentiteit en huidige verpakking, niet een aantal stuks. | Matchidentiteit is veilig; readiness blijft geblokkeerd voor een receptbehoefte in stuks. Geen stuks-per-500-g afgeleid. |

## Oorzaak en structurele impact van product_type

- `product_type` wordt door de server-side importer afgeleid; het is geen onafhankelijk gescrapet productveld. `classifyProductType()` combineert naam, merk en categoriepad en kiest de eerste passende regel. De aardappelregel komt vóór de tomaatregel; het brede categoriepad begint letterlijk met “Aardappelen”. Het vleespakketpad bevat “Rund-en varkensvlees”; de varkensregel matcht “varkens” vóór de rundvleesregel. Dat verklaart beide exacte conflicten.
- De Hoogvliet refresh-classifier berekent dit opnieuw; als de classifier “Onbekend” geeft, kan hij de bestaande classificatie behouden. De aparte importer-classify/backfill herclassificeert bestaande productrecords. Voor deze twee records is de fout geen stale waarde maar een reproduceerbare overmatch op het brede categoriepad.
- Read-only Production-profiel vond **280** producten met `product_type=Aardappelen`, zonder “aardappel” in naam/merk en binnen het brede aardappel/groente/fruit-categoriepad, plus **21** producten met `product_type=Varkensvlees`, zonder varkens-termen in naam/merk maar binnen “Rund-en varkensvlees”. Dit zijn kandidaatrecords voor classifierreview, niet allemaal individueel bewezen misclassificaties.
- Conclusie: **structurele classifierbug ja**; niet geïsoleerd tot deze twee rijen. Geen codewijziging of classificatiebackfill uitgevoerd. Structurele correctie hoort bij roadmap **1C Data Health**.

## Read-only readinesscontrole en roadmapbesluit

- Verse Production-readinesspayloads voor de zeven goedgekeurde 14B-scope-recepten op 4 personen tonen drie tomatenblokkades: behoefte in `piece`, productverpakking 500 g, `package_unknown`; en de Knorr kebab-blokkade: behoefte in gram, pita-verpakking alleen 10 stuks, `package_unknown`. Dit zijn echte verpakkings-/datablokkades, geen reden om READY te forceren.
- De overige 14B AFTER-blokkades zijn concreet ontbrekende catalogusproducten of onveilige package/category-dekking: Provençaalse wokgroenten, verse basilicum met category mismatch, rookworstverpakking, sneetjes volkoren brood, lasagnebladen en magere yoghurt. De volledige AFTER-audit blijft: Honig 11 READY / 7 NOT_READY / 1 NO_RECIPE; Knorr 17 / 5 / 14.
- Beide doelproducten zijn inhoudelijk correct geïdentificeerd; de hachee-match is veilig voor productidentiteit. De resterende NOT_READY-items hebben echte catalogus- of verpakkingsblokkades. Geen regressie is zichtbaar en de begrensde 14B-write is binnen scope geverifieerd.
- **Roadmap 1A kan sluiten.** De aparte structurele `product_type`-classifierfout wordt naar **1C Data Health** verplaatst. ROADMAP-status bijgewerkt: 1A afgerond en 1A.1 externe scrapingfallback voor Hoogvliet is nu de volgende stap. Er is geen nieuwe recomputation uitgevoerd.
- Dit checkpoint deed geen databasewrite, matchwijziging, readinesswrite, import, scrapingimport, migrationwerk, classifiercorrectie of bounded commit. De twee workflowflags blijven disarmed.

---

# Checkpoint 14B — bounded recomputation en AFTER-audit — 4 oktober 2026

## Uitvoering
- Main bleef op 52d206f95e25e47e5093f5103b1b3fdb08cb04ea. De verse DISARMED precommit-run 37214147981 was SUCCESS. Scope: exact 7 goedgekeurde recipe IDs, 3 matchkeys, 38 dependencykeys, 70 subscribers, 0 onverwachte dependencies; 3 matchwrites + 70 readinesswrites voorgesteld; source revision 2332, 45 CAS-entries; plan token aanwezig maar niet vastgelegd.
- Na expliciete toestemming is exact één armed runner-run uitgevoerd: 37214943380 op de tijdelijke branch codex/checkpoint-14b-single-run-armed, gebaseerd op main. De runner deed intern opnieuw de dry-run en scope/CAS-validatie en accepteerde één transactionele bounded commit: 3 matchwrites + 70 readinesswrites. Resultaat SUCCESS; geen retry of tweede commit.
- Alleen de workflowregel RECOMPUTE_ARMED is tijdelijk false→true gezet en direct na succesvolle run true→false teruggezet. Disarm-commit: 22d066c6b036370034e9b657a18ee99d831a4319. De uiteindelijke workflowinhoud is byte-identiek aan main; main en de tijdelijke branch tonen RECOMPUTE_ARMED=false. De migration-repairworkflow bleef REPAIR_ARMED=false.
- De runner-log vermeldt alleen aantallen en withholding van plan token. Tokenwaarde en secrets zijn niet gelezen of vastgelegd.

## Write-verificatie en datasanity
- Directe read-only verificatie op Production vond exact 3 matchrecords en 70 readinessrecords met update-tijd van de commit; 0 bijgewerkte records buiten de goedgekeurde scope. De transactionele runner valideerde exact 3 matchwrites, 70 readinesswrites en 0 outside-scope effects.
- Voor de 7 scope-recepten/personen 1–10: vóór de commit 70 NOT_READY (20 current, 50 pending door product_match_changed); erna 10 READY en 60 NOT_READY, alle 70 current. De 10 READY betreffen Honig Basis voor hachee voor personen 1–10.
- Matchrecords na commit:
  - hacheevlees: invalid/no_catalog_product → valid, SKU 733659000 Hoogvliet Riblappen, circa 700 g;
  - pitabroodjes: invalid/no_catalog_product → valid, SKU 675984000 G'woon Pita broodjes, verpakking 10 stuks;
  - tomaten: valid SKU 733141000 Mutti Gepelde tomaten → valid SKU 060936000 Trostomaten, verpakking 500 g.
- Readiness blokkeert nog op package_unknown waar de receptbehoefte niet veilig uit de verpakking kan worden afgeleid: tomaten in 3 scope-recepten vereisen stuks maar het gekozen product vermeldt gewicht; Knorr kebab vereist grammen maar de pita-verpakking vermeldt alleen 10 stuks.
- Read-only catalogussanity vóór→na bleef gelijk: products 7543, product_prices 7543, ingredient_product_matches 245, recipe_readiness_cache 1370, planner_write_revisions 368. Het aantal rijen in planner_write_revisions veranderde niet; individuele counterdelta’s zijn niet uit de runner-samenvatting af te leiden en worden niet toegeschreven.
- Productmetadata vraagt extra controle: de nieuwe hacheevleesmatch is gekoppeld aan “Hoogvliet Riblappen” met product_type=Varkensvlees; de tomatenmatch aan “Trostomaten” met product_type=Aardappelen. De namen passen bij de ingrediënten, maar de producttype-classificaties spreken die namen tegen. Dit is niet aangepast in dit checkpoint en verhindert een stellige claim dat alle nieuwe READY-uitkomsten semantisch veilig zijn.
- Geen migration repair, migration-SQL, schemawijziging, import, scraping, NO_RECIPE-opbouw of bounded tweede poging uitgevoerd.

## Honig/Knorr AFTER-audit (4 personen)
| Merk | BEFORE READY / NOT_READY / NO_RECIPE | AFTER READY / NOT_READY / NO_RECIPE |
| --- | --- | --- |
| Honig | 10 / 8 / 1 | 11 / 7 / 1 |
| Knorr | 17 / 5 / 14 | 17 / 5 / 14 |

- Honig NOT_READY: Bakplaat mix broccoli & rundervink, Bakplaat mix courgette & kip en Basis voor chili con carne blijven geblokkeerd door tomaten — Trostomaten SKU 060936000, package_unknown voor een behoefte in stuks. Basis voor Italiaanse kruidensaus: Provençaalse wokgroenten ontbreken en verse basilicum heeft category_mismatch. Basis voor macaronisaus stroganoff: Provençaalse wokgroenten ontbreken. Maaltijdsoep erwten: rookworst-verpakking heeft onbekende dekking. Mix voor boerenomelet: sneetjes volkoren brood ontbreken in de catalogus.
- Knorr NOT_READY: Maaltijdmix kebab — G'woon Pita broodjes, package_unknown omdat 10 stuks geen gramgewicht geven; Kip madras en Wereldgerechten Mexicaanse taco’s — tomaten/package_unknown; Lasagne bolognese — lasagnebladen/package_unknown; Tikka masala — magere yoghurt/package_unknown.
- De genoemde NOT_READY-statussen zijn door de readinesspayload aan concrete ontbrekende catalogusdekking of onveilige verpakkingsomrekening gekoppeld. Geen READY is geforceerd. De bestaande 1 Honig en 14 Knorr NO_RECIPE-profielen zijn ongemoeid gelaten.

## Roadmapbesluit
- Roadmap 1A blijft open. De bounded commit en audit zijn uitgevoerd en er is geen readiness-regressie zichtbaar, maar de conflicterende producttype-classificaties bij de nieuw bijgewerkte matchrecords moeten inhoudelijk worden bevestigd voordat de READY-uitkomst voor hachee zonder voorbehoud als veilig kan gelden. De nog resterende package-/category-/catalogusblokkades moeten eveneens volgens de roadmapcriteria worden beoordeeld.
- ROADMAP.md is niet gewijzigd; 1A.1 blijft afhankelijk van afronding van 1A. Volgende stap: read-only bron-/classificatiecontrole van de hachee- en tomatenproducten, daarna resterende 1A/1C-blokkades beoordelen. Geen nieuwe live write zonder een afzonderlijk goedgekeurde scope.
- Na deze documentatie-update is de actuele main-head de nieuwe documentatiecommit; functionele appcode is niet gewijzigd.
- Geen PR-merge of handmatige Production-deploy gestart. De PROJECT_STATE-commit 003102a7a976e1d9d7f26ba87c9724bc49a1f8af triggerde via de bestaande Git-integratie automatisch Vercel Production-deployment dpl_FMcM56zZX9NUnurSDbZWmRkSB5xS; deze is READY en bevat geen functionele appcodewijziging.

---

# Checkpoint 14A.3 — integratie en DISARMED Production dry-run afgerond — 4 oktober 2026

- PR #43 is na expliciete toestemming op 4 oktober gemerged met normale merge-commitstrategie. PR-head: `ce798bca9a0610bee0c07e275cdd73c75ac795cc`; mergecommit en main-head voor de Production-deployment: `755282274e0bb6755dacefe3a9a9cfe5508057c4`.
- Automatische Vercel Production-deployment `dpl_5oTo7wRDSP51sbc1fhKH1GVNrXZE` hoort bij exact die main-head en is **READY**; geen tweede handmatige deploy gestart. Read-only Production-smoke: Home `/`, Menu `/week-voorbereiden`, Lijst `/lijst`, Budget `/budget`, Meer `/meer` gaven HTTP 200.
- Production-project is bereikbaar en ACTIVE_HEALTHY (`pjcqxufvbkkjehituzxz`, eu-west-1). Read-only migration list bevat de volledige 13 verwachte versies; PR #43 wijzigde geen migrationfiles, dus migration history blijft 13/13 uitgelijnd.
- Eenmalige DISARMED workflowrun `37213025960` op main-head `755282274e0bb6755dacefe3a9a9cfe5508057c4` was **SUCCESS**. De log toont `RECOMPUTE_ARMED=false`; de scope-summary bevestigt exact 7 goedgekeurde recepten, 3 goedgekeurde matchkeys, 38 dependencykeys, 70 subscribers, 0 onverwachte dependencies, 3 voorgestelde matchwrites en 70 voorgestelde readinesswrites, source revision `2332`, 45 CAS-revisionregels en plan token aanwezig (waarde niet getoond). De runner eindigde expliciet met **DISARMED; commit POST niet verstuurd**.
- De twee Actions-secrets waren voor deze succesvolle Production dry-run beschikbaar; waarden zijn nooit gelezen of gelogd. Het workflowpad blijft alleen `workflow_dispatch` en de hard ingestelde runnerstatus blijft `RECOMPUTE_ARMED=false`. De afzonderlijke migration-repairworkflow blijft `REPAIR_ARMED=false`.
- Read-only datasanity na de dry-run: products `7543`, product_prices `7543`, ingredient_product_matches `245`, recipe_readiness_cache `1370`, planner_write_revisions `368`. De eerdere planner_write_revisions-referentie was `362`; de toename van zes rijen is niet verklaard en wordt niet aan de dry-run toegeschreven. Geen write-request is door de runner verstuurd.
- Geen bounded live commit, migration repair, schemawijziging, import, merge buiten PR #43 of AFTER-audit uitgevoerd. Honig/Knorr AFTER-audit en roadmapbesluit 1A blijven open.
- Volgende stap: afzonderlijk **Checkpoint 14B** — alleen na expliciete toestemming een verse dry-run beoordelen en, als die nog exact veilig is, de begrensde commit uitvoeren; daarna direct verifiëren en Honig/Knorr AFTER-audit doen. Tot die toestemming blijft er geen live commit plaatsvinden. `ROADMAP.md` is niet gewijzigd.

---

# Checkpoint 14A.2B — nieuwe read-only Production-scopebaseline, scope goedgekeurd — 4 oktober 2026

## Scopebaseline en actuele Production-data

- Remote Production `main`: `7f8e8fbdd4acf16f8b7d90e8bb7ed2f2692daabc`. Runnerbranch vóór integratie: `27e40392e4cf3bca6ec92c53160d9c981183461a`; na fixturecorrectie: `ab4cb6a658080f459a6d74c82ec0c3022031e482`. Project/ref is Supabase Production `pjcqxufvbkkjehituzxz`.
- De oude historische UUID-identiteit bleef onbewijsbaar. De volgende lijst is daarom expliciet de **CHECKPOINT 14 NIEUWE VOORGESTELDE PRODUCTION SCOPE**. De gebruiker heeft deze nieuwe scope op 4 oktober goedgekeurd als kandidaat voor de bounded recomputation.
- De enige drie doelkeys zijn de bestaande PR #39/runner-allowlistkeys:
  - `meal-mix-ingredient:mix-supplement-hacheevlees:g:ingredient:generic` — huidig `invalid/current/no_catalog_product`.
  - `meal-mix-ingredient:mix-supplement-tomaten:piece:ingredient:generic` — huidig `valid/current`, Mutti Gepelde tomaten SKU `733141000`, 400 g; verpakking bewijst geen aantal stuks.
  - `meal-mix-ingredient:mix-supplement-pitabroodjes:g:ingredient:generic` — huidig `invalid/current/no_catalog_product`.

| Recipe UUID | Recept | Merk | Dependencykey | Readiness personen 1–10 |
| --- | --- | --- | --- | --- |
| `4e60b9b6-abd3-46e7-b6a1-b10f73ccbec3` | Honig Bakplaat mix broccoli & rundervink | Honig | tomaten/piece | 10 NOT_READY; 0 current, 10 pending (`product_match_changed`), 0 failed |
| `baf31144-bb45-4c2b-aa2f-2f9be588b01c` | Honig Bakplaat mix courgette & kip | Honig | tomaten/piece | 10 NOT_READY; 0 current, 10 pending (`product_match_changed`), 0 failed |
| `3bbe1561-d757-422e-aded-3d802310805c` | Honig Basis voor chili con carne | Honig | tomaten/piece | 10 NOT_READY; 0 current, 10 pending (`product_match_changed`), 0 failed |
| `5726609e-82a3-4fa7-b5b0-dab78b2b59f1` | Honig Basis voor hachee | Honig | hacheevlees/g | 10 NOT_READY; 0 current, 10 pending (`product_match_changed`), 0 failed |
| `4f871e07-a684-4014-843a-f72a11b4c01d` | Knorr Maaltijdmix kebab | Knorr | pitabroodjes/g | 10 NOT_READY; 10 current, 0 pending, 0 failed |
| `2825125a-4ec4-4fae-a5f3-b44be2afb0aa` | Knorr Maaltijdmix kip madras | Knorr | tomaten/piece | 10 NOT_READY; 5 current, 5 pending (`product_match_changed`), 0 failed |
| `6a85d19f-5654-440b-b296-325c8f9fbd30` | Knorr Wereldgerechten Mexicaanse taco’s | Knorr | tomaten/piece | 10 NOT_READY; 5 current, 5 pending (`product_match_changed`), 0 failed |

- Read-only dependency-unie: 7 unieke recepten / 70 readinessrecords. Per key: tomaten 5 recepten/50 records (20 current, 30 pending); hacheevlees 1/10 (10 pending); pitabroodjes 1/10 (10 current). Totaal: 20 current, 50 pending, 0 failed.
- Historisch bleef bewezen: 3 keys, 7 recepten, 70 records, 35 current, 35 pending, 0 failed. Actueel zijn keys en aantallen recepten/records gelijk; historische UUID-identiteit is niet bewezen. Vijftien records zijn nu pending in plaats van current en dragen de reden `product_match_changed`; geen failed records.

## Integratie en stopgrens

- Draft PR #43: runnerbranch naar `main`; geen merge. De toevoeging in `.github/workflows/bounded-production-recompute.yml` is uitsluitend `workflow_dispatch`, zet hard `RECOMPUTE_ARMED=false` en gebruikt alleen de bestaande authenticated `mode: "dry-run"` POST. De write-tak gebruikt een aparte `mode: "write"` en wordt bij `false` niet bereikt. De plan/snapshot-RPC’s zijn read-only; de transactionele commit-RPC is niet aangeroepen.
- Eerste CI-run `37211328015` faalde doordat bestaande transactionele tests `state.resources` misten in hun DB-planfixture na de nieuwe metadata-validatie. Alleen die fixture is aangepast; latere commits zijn workflowtekst en documentatie. De actuele PR-head vóór deze state-update was `119269296e1100c4bc4fcb36f3bb5918ca1bcc00`; CI-run `37211748596` eindigde **SUCCESS**, inclusief importer-/seedchecks, PostgreSQL rollback/concurrency-tests, webtests, lint, TypeScript en Production-build. De Vercel Preview-deployment `dpl_CySN57QCovTfn7t5RTFCnzcknhER` voor exact die head is **READY**. Read-only page smoke gaf HTTP 200 voor `/`, `/week-voorbereiden` (Menu), `/lijst`, `/budget` en `/meer`; `/menu` zelf is geen geregistreerde route en geeft 404. De Preview bounded-refresh GET met de goedgekeurde scope gaf HTTP 200, `blocked=false`, exact 7 recipes, 3 matchkeys, 38 dependencykeys, 70 subscribers en 0 unexpected dependencies. Deze Preview-read-only response heeft `transactional=false`, `planToken=null` en geen CAS/source revision; het is dus niet de Production runner dry-run.
- GitHub Actions meldt voor de nog niet op `main` aanwezige workflow `This workflow does not exist`. Daarom is nog geen Production DISARMED dry-run uitgevoerd. De Production dry-run vereist integratie/deployment van de service-response-uitbreiding; daarvoor is een afzonderlijke expliciete mergegoedkeuring nodig. Dit scope-akkoord is geen merge- of live-writegoedkeuring.
- Geen bounded dry-run, commitrequest, databasewrite, import, migrationwerk, runnermerge of Production-deploy uitgevoerd. `ROADMAP.md` bleef ongewijzigd.

---

# Checkpoint 13 — PR #39 gemerged, Production-deployment en smoke — 3 oktober 2026

- PR #39 is na expliciete gebruikersgoedkeuring gemerged via de normale merge-commitstrategie. Pre-merge PR-head: `14c40dd3e9b555ab14d09932e0dae9ff875e4c1f`. Mergecommit en nieuwe main-head: `27732625d798b0b9b25cce285480047161c2c14a`. GitHub merge-tijd: `2026-10-03T21:23:30Z`.
- De automatische Vercel Production-deployment `dpl_9vXRQHffVnUftWbcU2jodR1WYcBJ` hoort bij exact die main-head, is **READY**, heeft Production-target, Production-aliases en geen aliasfout. Geen tweede handmatige deployment gestart.
- Read-only Production-smoke op `https://boodschappenmaatje-pwa.vercel.app`: Home, Menu, Lijst, Budget en Meer laden. Menu toont de start van een nieuwe weekvoorbereiding; de Production-sessie heeft geen actieve week of geplande maaltijden, een lege boodschappenlijst en geen ingesteld budget. De lijst- en budgetschermen laden bruikbaar zonder zichtbare server-/databasefout. Er is geen week gestart en geen test- of gebruikersdata gewijzigd.
- Read-only Supabase-controle: Production is bereikbaar; de actuele lokale migrations op main en remote history zijn exact **13/13 MATCH**. Alle vijf referentieaantallen zijn ongewijzigd: products `7543`, product_prices `7543`, ingredient_product_matches `245`, recipe_readiness_cache `1370`, planner_write_revisions `362`.
- De repairworkflow blijft aanwezig maar **DISARMED** met `REPAIR_ARMED=false`; er is geen repair-job geactiveerd en geen pending migration-SQL. In checkpoint 13 is geen migration repair, schemawijziging, appdatawrite, import of bounded live recomputation uitgevoerd.
- De bestaande week/planner- en maaltijdmix-flow kon zonder Production-testdata niet end-to-end worden uitgevoerd. Geen data aangemaakt om die flow te testen; geen nieuwe fysieke iPhone-test verricht.
- PR #39 is gemerged. **Roadmap 1A blijft open** totdat bounded live recomputation van de goedgekeurde scope en de Honig/Knorr AFTER-audit zijn uitgevoerd en beoordeeld. `ROADMAP.md` is in dit checkpoint niet gewijzigd.
- Volgende stap: **Checkpoint 14** — begrensde live herberekening van de goedgekeurde PR #39-scope, daarna read-only AFTER-audit Honig/Knorr en beoordeling van resterende NOT_READY-blokkades. Werk daarna `PROJECT_STATE.md` en `ROADMAP.md` bij; rond 1A alleen af als de resultaten dat aantonen. Pas dan door naar roadmap 1A.1, externe scrapingfallback voor Hoogvliet.

## Checkpoint 14A — tijdelijke bounded Production runner — 4 oktober 2026

- Remote `main` is opnieuw gecontroleerd op `7f8e8fbdd4acf16f8b7d90e8bb7ed2f2692daabc`; PR #39 is gemerged. Runner en deze documentatie zijn lokaal voorbereid op een aparte Codex-werkbranch; er is niets naar `main` gepusht.
- De workflow gebruikt uitsluitend de bestaande `POST /api/internal/planner-readiness/bounded-refresh` op `https://boodschappenmaatje-pwa.vercel.app`. Auth is `Authorization: Bearer` met `PLANNER_CACHE_ADMIN_TOKEN`; Vercel deployment protection gebruikt `x-vercel-protection-bypass` met `VERCEL_AUTOMATION_BYPASS_SECRET`. Deze secretnamen staan al in bestaande workflows; GitHub-secretbeschikbaarheid kon niet onafhankelijk worden uitgelezen (GitHub API gaf 403). Geen Supabase/databasecredential nodig.
- `.github/workflows/bounded-production-recompute.yml` is uitsluitend `workflow_dispatch`, met `RECOMPUTE_ARMED=false`. De bestaande service levert nu ook dependency keys, subscriber scope, source revision en de revision-CAS-snapshot in de admin dry-run response, zodat de runner die bestaande scope kan valideren; de runner berekent die scope niet zelf. De dispatcher moet de exacte zeven eerder goedgekeurde recipe-ID's expliciet invoeren; die UUID's staan niet in de repository-state.
- Geen workflow-run of Production dry-run uitgevoerd; de vereiste secretwaarden en recipe-ID's zijn hier niet beschikbaar. Geen commit-POST, databasewrite, directe RPC, repair, schemawijziging, deploy of merge uitgevoerd.
- Volgende stap: **Work checkpoint 14A-review** — workflow/API-uitvoer en vereiste GitHub Secrets controleren en de goedgekeurde recipe-ID's aanleveren. Daarna checkpoint 14B: verse disarmed dry-run beoordelen; alleen bij exacte goedgekeurde scope een afzonderlijke armed-run uitvoeren en direct disarmen, gevolgd door Honig/Knorr AFTER-audit. `ROADMAP.md` is niet gewijzigd.

---

# Checkpoint 11H.3 — post-repair disarmed validator hersteld — 3 oktober 2026

- PR #39 staat OPEN, Draft, mergeable en ongemerged op `feature/meal-mix-supplement-matches`. De gevalideerde workflow-/validatorhead was `8c1b7a861ea024ddb323ce530b1530d74a6c0a4a`.
- Validator/workflowlogica hersteld: disarmed precheck gebruikt uitsluitend post-repair-validatie en vereist exact 13/13 local↔remote. Alleen `pre-repair` met `REPAIR_ARMED=true` accepteert de oude 5 remote + 8 local-only toestand; die armed-modus weigert 13/13 en kan geen tweede repair vrijgeven. Workflowflag blijft `false`; repair-job is gated op geslaagde precheck plus `repair_armed=true`.
- Finale disarmed read-only Actions-run **37153814333** op de gevalideerde head was **SUCCESS**. De precheck slaagde. De post-repair-validator accepteert uitsluitend exact alle 13 lokale en remote versies, dus local↔remote is **13/13 MATCH**. De repair-job was **SKIPPED**.
- YAML en exacte triggers, Bash-syntax, `git diff --check` en acht mocktests slaagden. `actionlint` is niet beschikbaar.
- In 11H.3 is geen migration repair, SQL-/databasewrite, schemawijziging, echte `db push`, merge of Production-deploy uitgevoerd. Alleen de read-only migration-list-run draaide; `REPAIR_ARMED=false`.
- Volgende stap: **PR #39 releasegate** — volledige CI controleren; Preview alleen opnieuw bevestigen indien nodig; bepalen of functionele appcode sinds de goedgekeurde iPhone-test veranderde (zo niet, geen nieuwe iPhone-test); daarna expliciete mergegoedkeuring vragen vóór merge naar main.

---

# Checkpoint 11H.2 — migration history geregistreerd, workflow DISARMED — 3 oktober 2026

- PR #39 vóór documentatie stond open, Draft, mergeable en ongemerged op `feature/meal-mix-supplement-matches`; head `ea1727107d266e5ee3b8ba3a87f6e3a26f9cb635`, base/main `7446d411e9d9cdf48b52df2a6edb2cc4eff34723`.
- Workflowreview op de actuele branch bevestigde de gepinde officiële Supabase CLI 2.119.0, vaste Production-ref `pjcqxufvbkkjehituzxz`, Session pooler `aws-1-eu-west-1.pooler.supabase.com:5432`, fail-closed precheck, repair-job-gate op beide geslaagde precheck en expliciete arming, en uitsluitend de goedgekeurde officiële repairbatch. Geen directe SQL tegen migration history, geen echte db push, migration up/reset of apply_migration.
- Verse disarmed precheck-run `37152881130` op de start-head was SUCCESS en bewees de verwachte 5 remote records, afwezigheid van de 8 baselineversies en exact 13 lokale versies.
- Uitsluitend `REPAIR_ARMED: 'false' → 'true'` is gecommit als `d890d0a6cb3254ced6c5880cb41d9183939ea87b`. De padgefilterde armed run `37153208375` was SUCCESS; de volledige verse Production-precheck slaagde. De repair-job voerde uitsluitend de officiële `supabase migration repair --status applied` uit voor exact:
  `20260908091354`, `20260908110213`, `20260908121109`, `20260908222836`, `20260914193340`, `20260915151220`, `20260915173523`, `20260917092809`.
  GitHub Actions-log bevestigt alle acht versies als applied. De workflow controleerde daarna de exacte 13/13 local↔remote match en `supabase db push --dry-run`; de validator slaagde en de workflow rapporteerde Production up-to-date, zonder pending migration-SQL.
- Read-only sanitycheck na de run: products `7543`, product_prices `7543`, ingredient_product_matches `245`, recipe_readiness_cache `1370`, planner_write_revisions `362`; alle gelijk aan de referentiewaarden. Geen aanwijzing van appdatawijziging.
- Na succesvolle repair is uitsluitend `REPAIR_ARMED: 'true' → 'false'` gecommit als `ea1727107d266e5ee3b8ba3a87f6e3a26f9cb635`. Workflow staat nu **DISARMED**. De daardoor getriggerde finale read-only run `37153303492` bevestigt `REPAIR_ARMED=false` en dat de repairjob is **skipped**, maar de precheck zelf faalde gesloten met `remote migration history differs from expected baseline`. De actuele disarmed precheck roept nog de pre-repair-validator aan, die 5 remote + 8 ontbrekende baselines verwacht; na de geslaagde repair zijn alle 13 remote aanwezig. Dit is een validator-/precheckmismatch, geen aanwijzing voor mislukte repair. Geen tweede repair of workaround uitgevoerd.
- Geen migration-SQL uitgevoerd; alleen de acht expliciet toegestane migration-history metadatarecords zijn gewijzigd. Geen appdatawrite, schemawijziging, merge of Production app-deploy.
- **Resterende blokkade:** maak in een afzonderlijk, uitsluitend read-only/disarmed vervolgcheckpoint de validator geschikt voor de normale post-repair 13/13-history en voer dan alleen een DISARMED-precheck uit. Workflow blijft intussen `REPAIR_ARMED=false`; voer geen repairbatch opnieuw uit. PR #39 blijft Draft en ongemerged.
- **Volgende releasegate na groene disarmed precheck:** CI controleren; Preview alleen opnieuw bevestigen indien nodig; geen nieuwe fysieke iPhone-test tenzij functionele appcode sinds de goedgekeurde releasecandidate wijzigde; daarna expliciete mergegoedkeuring vragen. Merge, Production-deploy/smoke en bounded live herberekening + AFTER-audit blijven afzonderlijke latere stappen.
- `ROADMAP.md` is niet gewijzigd.

---

# Checkpoint 11H.1 — tijdelijke migration-repairworkflow gebouwd, DISARMED — 3 oktober 2026

- PR #39 was OPEN, Draft, mergeable en ongemergd op `feature/meal-mix-supplement-matches`, start-head `552ccaac7950c12580748eca19b186bc3f10e872`.
- De tijdelijke `.github/workflows/supabase-migration-history-repair.yml` gebruikt uitsluitend `workflow_dispatch` en een push-filter op exact deze branch en exact dit workflowbestand. `REPAIR_ARMED=false`. De read-only precheck controleert de Production-ref/pooler, secrets aanwezig zonder waarden te loggen, officiële CLI 2.119.0, exact de vijf bestaande remote versies, afwezigheid van de acht baselines en aanwezigheid van exact alle 13 lokale versies. Elke afwijking faalt gesloten.
- De aparte repair-job is job-level gated op een geslaagde exacte precheck en `REPAIR_ARMED=true`; de shell herhaalt die harde guard en de volledige read-only precheck vóór de enige toegestane batch. Die batch markeert alleen de acht goedgekeurde baselineversies als applied. Daarna vereist de workflow een exacte 13/13 historymatch en een `db push --dry-run` die expliciet meldt dat Production up-to-date is.
- Statische controles: YAML-/workflowstructuur en exacte triggers geldig; beide Bash-stappen slagen voor `bash -n`; verboden commands en directe history-SQL ontbreken. Vijf mocktests geslaagd (disarmed, verkeerde history, baseline al remote, bestaande versie ontbreekt, correcte armed-precheck). `actionlint` is niet beschikbaar in deze runtime.
- Codex heeft geen workflowdispatch of live CLI uitgevoerd. De padgefilterde push kan uitsluitend de disarmed read-only precheck starten; de repair-job blijft overgeslagen. Geen repair/databasewrite, SQL- of schemawijziging, merge of deploy. `REPAIR_ARMED` blijft `false`.
- Volgende stap: **Work checkpoint 11H.2** — workflowcode en actuele remote history reviewen; pas na expliciete toestemming `REPAIR_ARMED=true` zetten en uitsluitend de goedgekeurde run volgen.

---

# Checkpoint 11H — Production precheck groen, CLI-uitvoering geblokkeerd — 3 oktober 2026

- Startcontrole: PR #39 stond open, Draft, mergeable en ongemerged op de verwachte branch `feature/meal-mix-supplement-matches`, head `5f2566fd7d0f44527a9d125b0b42e674fa76206e`; base/main `7446d411e9d9cdf48b52df2a6edb2cc4eff34723`.
- Read-only Production precheck via de beschikbare Supabase/GitHub-connectoren: project `pjcqxufvbkkjehituzxz`, BoodschappenMaatje, `eu-west-1`, ACTIVE_HEALTHY. De op de branch ingestelde IPv4 Session pooler is `aws-1-eu-west-1.pooler.supabase.com:5432`.
- De connector-migration list gaf exact de vijf bestaande remote versions: `20260919154657`, `20260920213421`, `20260920220220`, `20260921104333`, `20261002220202`. Geen van de acht baselineversions was aanwezig.
- De volledige GitHub directorylisting van `supabase/migrations` op deze head bevat exact de 13 verwachte unieke 14-cijferige files: die vijf matches plus `20260908091354`, `20260908110213`, `20260908121109`, `20260908222836`, `20260914193340`, `20260915151220`, `20260915173523`, `20260917092809`. Alle 13 files konden op de branch worden opgehaald.
- **De verplichte officiële CLI-precheck is niet uitgevoerd**: de Work-runtime bevat geen lokale repository of Supabase CLI; de GitHub Actions-connector biedt geen workflow-dispatch/startactie. De branchworkflow `.github/workflows/supabase-migration-history-check.yml` is expliciet “READ ONLY — NO REPAIR” en kan uitsluitend migration list uitvoeren. Daarmee is er in deze Work-run geen door ons beschikbare CLI-runner om de verplichte lijst, repair en dry-run uit te voeren.
- Daarom is fase 2 NIET gestart: er is geen officiële `supabase migration repair` uitgevoerd. Ook `supabase db push --dry-run` is niet uitgevoerd. De Supabase SQL-connector kan niet worden gebruikt voor reparatie: directe SQL tegen `supabase_migrations.schema_migrations` is uitdrukkelijk verboden.
- Read-only datasanity nu: products/prices `7543/7543`, ingredient_product_matches `245`, recipe_readiness_cache `1370`, planner_write_revisions `362`. Checkpoint 11F noemde products/prices `7159/7159`; de huidige catalogus is sindsdien 384 rijen groter. Omdat deze run geen databasewrite deed, schrijven we dat verschil niet aan deze run toe. De match- en readinessaantallen zijn gelijk aan de eerder vastgelegde tellingen.
- **Geen history-write, migration repair, migration-SQL, appdatawrite, schemawijziging, import, merge of Production-deploy uitgevoerd.**
- Blokkade voor afronding 11H: een ondersteunde runner nodig die officiële Supabase CLI 2.119.0 tegen Production kan uitvoeren met bestaande GitHub Secrets en de gecontroleerde pooler. Hervat daarna bij de CLI `migration list`; herhaal eerst de volledige precheck. Alleen bij exact dezelfde toestand mag de acht-versie repairbatch uit checkpoint 11F worden uitgevoerd. Daarna pas post-repair list, `db push --dry-run` en nieuwe read-only sanitycheck.
- PR #39 blijft Draft en ongemerged. Volgende releasegates ná migration-history-afstemming: CI controleren, zo nodig Preview opnieuw bevestigen, fysieke iPhone-test alleen herhalen als functionele appcode sinds de goedgekeurde releasecandidate wijzigde, expliciete mergegoedkeuring, merge, Production-deploy/smoke en daarna afzonderlijke bounded live herberekening met AFTER-audit.

---

# Checkpoint 11G — migrationfilenames genormaliseerd, geen databasewrite — 3 oktober 2026

- PR #39 staat open, Draft en mergeable op `feature/meal-mix-supplement-matches`; start-head was `c0a797c8aecf23e39693543c5fe1def3ccf96184`. Alle 13 opgegeven migrationfiles zijn naar unieke 14-cijferige versies hernoemd: de vijf bestaande Production-versies sluiten exact aan en acht bewezen oudere migrations hebben elk hun goedgekeurde unieke baselineversie.
- Actieve padverwijzingen zijn bijgewerkt in README's, planner-/Supabase-documentatie, de importer-foutmelding en migrationpath-tests. Oude seedpaden en historische checkpoints zijn ongewijzigd. Geen oud migrationbestandspad wordt functioneel meer gebruikt.
- Validatie: alle migratiefilenames hebben 14 cijfers en alle versies zijn uniek; alle 13 SQL-bestanden zijn byte-identiek aan hun pre-rename Git-blobs (inclusief de transactionele migratie). `git diff --check` slaagde. Root-tests: 313 geslaagd; gerichte web-migrationtests: 11 geslaagd.
- Geen databaseverbinding of SQL-uitvoering, migration repair, `db push`, schema-/databasewrite, merge of Production-deploy uitgevoerd.
- Volgende stap: **Work checkpoint 11H** — verse read-only `supabase migration list`; bevestig dat uitsluitend de acht baselineversies local-only zijn; registreer daarna uitsluitend die acht via officiële `supabase migration repair --status applied`; herhaal migration list en `db push --dry-run`; stop vóór PR-merge.

---

# Checkpoint 11F — read-only migration baseline bewezen — 3 oktober 2026

## 11E-plan en actuele remote status

- Voorkeursstrategie B blijft passend: laat de lokale filenames/versies aansluiten op de bewezen Production-history; voeg voor de acht oudere bewezen migrations afzonderlijke historyrecords toe met de officiële Supabase CLI. Geen remote record van de bestaande vijf herschrijven.
- PR #39 blijft open, Draft, mergeable en ongemerged op `feature/meal-mix-supplement-matches`, head `a9642aaa41bc0afb11364037a759ff12016469c0`. De actuele PR-basis/main-head is `7446d411e9d9cdf48b52df2a6edb2cc4eff34723`.
- Production is project `pjcqxufvbkkjehituzxz`, BoodschappenMaatje, `eu-west-1`, PostgreSQL 17.6, status ACTIVE_HEALTHY.
- Read-only Production-history bevat exact vijf records: `20260919154657 persistent_planner_readiness_cache`, `20260920213421 meal_mix_profiles_and_candidate_cache`, `20260920220220 invalidate_readiness_on_candidate_change`, `20260921104333 meal_mix_verified_water_only`, `20261002220202 transactional_bounded_readiness_20261002120000`. De vijf voorgestelde versies bestaan nog; de acht voorgestelde baselineversies ontbreken.
- Read-only inspectie van `supabase_migrations.schema_migrations`: `version text NOT NULL`, `name text`, `statements text[]`; ook `created_by`, `idempotency_key` en `rollback` zijn aanwezig.
- De gebruikte Supabase-controles waren uitsluitend SELECT/cataloguslezingen en de Supabase migration-list-actie. Geen history- of schemaschrijfactie.

## Acht oudere lokale migrations — Production-bewijs

| Lokale migration | Production-bewijs | Status | Veilige toekomstige actie |
| --- | --- | --- | --- |
| `20260908_add_product_type.sql` | `products.product_type`, index `products_supermarket_product_type_idx` en de bedoelde kolomcommentaar zijn aanwezig. | **PROVEN_APPLIED** | Versie `20260908091354` officieel als applied registreren. |
| `20260908_create_ingredients.sql` | Beide tabellen, kolommen, unieke/check/FK-constraints, indexen, updated-at-functies/triggers, RLS, read-only policies, tabel-/kolomcommentaar aanwezig. | **PROVEN_APPLIED** | Versie `20260908110213` officieel als applied registreren. |
| `20260908_create_recipes.sql` | Tabel, kolommen, unieke/check-constraints, weekmenu-index, updated-at-functie/trigger, RLS, read-only policy en comments komen overeen. | **PROVEN_APPLIED** | Versie `20260908121109` officieel als applied registreren. |
| `20260908_create_recipe_ingredients.sql` | Tabel, FK/check/unique-constraints, beide indexen, updated-at-functie/trigger, RLS, read-only policy en comments komen overeen. | **PROVEN_APPLIED** | Versie `20260908222836` officieel als applied registreren. |
| `20260914_secure_catalog_browser_read.sql` | RLS staat aan op products/prices; beide bedoelde SELECT-policies en comments bestaan; anon/authenticated hebben SELECT en geen INSERT/UPDATE/DELETE. | **PROVEN_APPLIED** | Versie `20260914193340` officieel als applied registreren. |
| `20260915_catalog_growth.sql` | Beide productkolommen en check, beide catalogustabellen met kolommen/constraints/indexen, trigram-extension/indexen, RLS/policy, browser- en service-roleprivileges en comments komen overeen. | **PROVEN_APPLIED** | Versie `20260915151220` officieel als applied registreren. |
| `20260915_catalog_search_relevance_v2.sql` | `unaccent` staat in schema `extensions`; beide functies hebben de bedoelde signature, bodygedragingen, immutability/stability, lege search_path, comments en browser-EXECUTE-grants. De searchfunctie ondersteunt tokenranking, filters, sortering en paginering. | **PROVEN_APPLIED** | Versie `20260915173523` officieel als applied registreren. |
| `20260917_self_healing_daily_catalog_growth.sql` | Beide job/attempt-tabellen hebben alle bedoelde kolommen, constraints, indexen, RLS/policy, grants en comments. De drie SECURITY DEFINER-functies hebben de bedoelde signatures/logic, `search_path=public`; EXECUTE is service_role-only. | **PROVEN_APPLIED** | Versie `20260917092809` officieel als applied registreren. |

Er is geen aanwijzing voor een gedeeltelijke of afwijkende toepassing van een van deze acht files: alle bedoelde structurele, functionele en rechten-/RLS-effecten zijn read-only gecontroleerd. De status bewijst de huidige Production-toestand; het is geen bewijs van historische uitvoervolgorde.

## Vijf bestaande Production-matches

| Remote version | Logische lokale file | Read-only bevestiging |
| --- | --- | --- |
| `20260919154657` | `20260919_persistent_planner_readiness_cache.sql` → toekomstige filenameversie `20260919154657` | Match/readiness-cachetabellen, dependencies, policies, invalidatiegedrag en cachetriggers aanwezig. |
| `20260920213421` | `20260920211532_meal_mix_profiles_and_candidate_cache.sql` → `20260920213421` | Profiel-/kandidaatcacheobjecten en constraints aanwezig; latere water-only constraint staat apart onder de eigen remote migration. |
| `20260920220220` | `20260920220500_invalidate_readiness_on_candidate_change.sql` → `20260920220220` | Candidate-change invalidatiefunctie en ingeschakelde producttrigger aanwezig; readiness-invalidatie blijft enabled. |
| `20260921104333` | `20260921104226_meal_mix_verified_water_only.sql` → `20260921104333` | Verified water-only blijft alleen geldig met `source_evidence` en `source_fingerprint`. |
| `20261002220202` | `20261002120000_transactional_bounded_readiness.sql` → `20261002220202` | Revisietabel, bounded plan/commit/revision-functies en guards aanwezig; security-definer search_path is vastgezet en alleen bedoelde RPC's zijn service_role-uitvoerbaar. |

## Toekomstige gecontroleerde stap — nog NIET uitgevoerd

Na eerst de vijf lokale filenames exact naar bovenstaande bestaande remote versies te laten aansluiten en de acht oudere filenames uniek te maken, controleer Work opnieuw de PR-head en voer met officiële Supabase CLI 2.119.0 een verse read-only `supabase migration list` uit. Als die controle ongewijzigd dezelfde Production-projectref/history toont, is uitsluitend deze batch veilig om in het volgende checkpoint officieel te registreren:

```text
20260908091354 --status applied
20260908110213 --status applied
20260908121109 --status applied
20260908222836 --status applied
20260914193340 --status applied
20260915151220 --status applied
20260915173523 --status applied
20260917092809 --status applied
```

Gebruik uitsluitend `supabase migration repair` via de officiële CLI voor die acht versions. Voer geen repair uit voor de vijf bestaande matches en geen migration SQL uit. Daarna opnieuw `supabase migration list` lezen en controleren dat alle lokale/remote entries overeenkomen. Stop bij elke nieuwe historyregel, gewijzigde PR-head, onverwachte objectafwijking of projectref-wissel.

**Blokkades:** alleen de noodzakelijke, nog niet uitgevoerde filename-aanpassing en de afzonderlijke toestemming/uitvoering in het volgende checkpoint. Deze checkpoint heeft **geen migration repair, geen SQL-write, geen schemawijziging, geen merge en geen Production-deploy** uitgevoerd.

---

# BoodschappenMaatje — Project State

## Checkpoint 11D — read-only migration list groen; volledige driftmapping bekend — 3 oktober 2026

- GitHub Actions run **37148490682** op head `2f2e22b534d49810ce7149c39a93a0af7bf3cc3d` is **SUCCESS** voor de tijdelijke workflow `.github/workflows/supabase-migration-history-check.yml`.
- Supabase IPv4 Session pooler `aws-1-eu-west-1.pooler.supabase.com:5432`, database-authenticatie en de officiële Supabase CLI 2.119.0 werken nu vanuit GitHub Actions.
- De read-only `supabase migration list` gaf deze lokale↔remote drift:
  - lokale 8-cijferige versies zonder remote record: `20260908` (4 bestanden), `20260914`, `20260915` (2 bestanden), `20260917`, `20260919`;
  - logisch overeenkomstige maar anders getimestampte paren:
    - local `20260919_persistent_planner_readiness_cache.sql` ↔ remote `20260919154657 persistent_planner_readiness_cache`;
    - local `20260920211532_meal_mix_profiles_and_candidate_cache.sql` ↔ remote `20260920213421 meal_mix_profiles_and_candidate_cache`;
    - local `20260920220500_invalidate_readiness_on_candidate_change.sql` ↔ remote `20260920220220 invalidate_readiness_on_candidate_change`;
    - local `20260921104226_meal_mix_verified_water_only.sql` ↔ remote `20260921104333 meal_mix_verified_water_only`;
    - local `20261002120000_transactional_bounded_readiness.sql` ↔ remote `20261002220202 transactional_bounded_readiness_20261002120000`.
- Er zijn dus **geen exact gelijk getimestampte remote matches** voor de huidige lokale migraties. De drift is structureel en ouder dan PR #39; alleen de nieuwste versie repareren zou geen reproduceerbare migratiehistorie opleveren.
- De nieuwe transactionele SQL van PR #39 is al exact één keer op Production toegepast en schema/data bleven aantoonbaar groen volgens checkpoint 9; deze read-only run heeft niets gewijzigd.
- **Geen migration repair, SQL-write, schemawrite, db push, migration up of reset uitgevoerd.**
- Volgende checkpoint: eerst een klein, expliciet repair-/baselineplan opstellen voor deze bewezen mapping. Gebruik alleen officiële `supabase migration repair`; geen directe edits van `supabase_migrations.schema_migrations`. Voer nog niets uit voordat het plan per versie duidelijk maakt welke remote history-records `reverted` en welke lokale versies `applied` zouden worden en waarom.

## Checkpoint 11C.7 — GitHub poolerpad bereikbaar; databasewachtwoord faalt authenticatie — 3 oktober 2026

- Tijdelijke read-only GitHub Actions-diagnose op PR #39 bevestigt dat `SUPABASE_ACCESS_TOKEN` en `SUPABASE_DB_PASSWORD` als secrets aanwezig zijn en afgeschermd worden gelogd.
- De bewezen Supabase IPv4 Session pooler is `aws-1-eu-west-1.pooler.supabase.com:5432`; TCP vanaf de GitHub-hosted runner is **reachable**.
- Een onafhankelijke read-only PostgreSQL-smoke (`SELECT 1`) via gebruiker `postgres.pjcqxufvbkkjehituzxz` faalt veilig als **password_auth_failed**. Daarmee is de actuele blokkade het databasewachtwoord/secret, niet GitHub-netwerk, DNS of poolerbereikbaarheid.
- `supabase migration list` blijft daarom geblokkeerd; nog geen migration mapping mogelijk.
- **Geen migration repair, migratie-SQL, schemawrite of andere databasewrite uitgevoerd.**
- Volgende stap: het GitHub-secret `SUPABASE_DB_PASSWORD` exact gelijkzetten aan het actuele Production databasewachtwoord en daarna uitsluitend dezelfde read-only migration-list-check opnieuw uitvoeren.

## Checkpoint 11C — tijdelijke read-only migration-list-workflow — 3 oktober 2026

- Toegevoegd: `.github/workflows/supabase-migration-history-check.yml`, uitsluitend `workflow_dispatch`, op `feature/meal-mix-supplement-matches`; PR #39 blijft Draft en ongemergd. Officiële `supabase/setup-cli` installeert vastgezette CLI **2.119.0**. Alleen `migration list --linked --project-ref` op Production **`pjcqxufvbkkjehituzxz`**; geen repair-mode, SQL, schema- of historywrite.
- Secrets: **`SUPABASE_ACCESS_TOKEN`** en **`SUPABASE_DB_PASSWORD`**, via repositorysecrets of het bestaande GitHub-environment **Production**. De expliciete databasepassword voorkomt CLI-aanmaak van een tijdelijke loginrol. Projectref is een vaste publieke identifier; geen projectref-secret nodig. GitHub secret-list geeft HTTP 403; Work moet de twee namen controleren/toevoegen. Ruwe CLI-uitvoer blijft afgeschermd; alleen gevalideerde migratieversies/tijden komen in de summary. Ontbrekende secrets, onleesbare Production-history of onveilige/lege output laten de run falen.
- Verificatie groen: YAML-parse, `actionlint` 1.7.12 (Actions-structuur), `bash -n`, `git diff --check` en acht lokale mockcontroles (succes, CLI-fout, ontbrekende token/password, verkeerde triggercontext, ontbrekende remote history, onveilige output, ongeldige JSON). Werkelijke officiële CLI-binary 2.119.0 en `migration list --help` gecontroleerd, zonder databaseverbinding. Workflow niet gestart; **geen live databaseactie of write uitgevoerd**. ROADMAP ongewijzigd.
- GitHub vereist een `workflow_dispatch`-definitie op de default branch voordat handmatige dispatch beschikbaar is. Dit bestand staat alleen op de Draft-branch; beschikbaarheid moet Work controleren. Geen merge of extra trigger als omweg uitgevoerd.
- **Volgende Work-checkpoint: HANDMATIGE READ-ONLY WORKFLOW STARTEN → MIGRATION LIST CONTROLEREN → NOG GEEN REPAIR.** Eerst bovenstaande secretnamen en dispatchbeschikbaarheid controleren; mapping blijft onbewezen tot de remote lijst veilig is gelezen.

## Checkpoint 10 — migratiehistorie read-only onderzocht; geen repair uitgevoerd — 3 oktober 2026

- Production migration history bevat voor de nieuwe transactionele migratie versie `20261002220202` met naam `transactional_bounded_readiness_20261002120000`; repositorybestand is `supabase/migrations/20261002120000_transactional_bounded_readiness.sql`. De SQL is al exact één keer toegepast en schema/data blijven groen.
- Officiële Supabase-documentatie bevestigt `supabase migration repair <version> --status applied|reverted` als ondersteunde methode om uitsluitend de remote migration history te repareren; `reverted` verwijdert een history-record en `applied` voegt er één toe, zonder de migratie-SQL opnieuw uit te voeren.
- De huidige Work/Supabase-connector exposeert geen officiële `migration repair`-actie en de beschikbare lokale runtime heeft geen Supabase CLI. Daarom is conform stopregel geen handmatige wijziging van `supabase_migrations.schema_migrations` uitgevoerd.
- Belangrijker: read-only vergelijking toont dat de drift niet uniek is voor deze migratie. Production heeft o.a. `20260919154657 persistent_planner_readiness_cache`, `20260920213421 meal_mix_profiles_and_candidate_cache`, `20260920220220 invalidate_readiness_on_candidate_change` en `20260921104333 meal_mix_verified_water_only`, terwijl de repository respectievelijk andere/verkorte timestamps gebruikt. De repository bevat bovendien meer historische migratiebestanden dan de vijf remote history-records. Een één-op-één lokale↔remote migratielijst kan dus niet veilig worden geclaimd door alleen `20261002220202` te repareren.
- Besluit: **geen history-write** en geen SQL-herhaling. Eerst een afzonderlijk klein migratie-baseline/history-normalisatieplan bepalen met officiële Supabase CLI/tooling. De veiligste richting moet kiezen tussen (a) repositoryversies gericht laten aansluiten op bewezen remote history waar logisch, of (b) een gecontroleerde officiële history-normalisatie/baseline; geen brede handmatige metadata-edit.
- PR #39 blijft Draft/ongemergd; geen appdeploy, bounded live write, cachewrite, import of reset. Releasegate blijft geblokkeerd totdat duidelijk is hoe deze bestaande migratiehistoriedrift structureel wordt beheerd.

## Checkpoint 9 — Production-schema geïnstalleerd, migratiehistorie nog uitlijnen — 3 oktober 2026 (Europe/Amsterdam)

- Gebruiker heeft de fysieke iPhone-test van PR #39 goedgekeurd. De PR-omschrijving is gecorrigeerd: PR #39 bevat de additive transactionele migratie, schema-eerst is vereist en live bounded herberekening volgt pas ná de apprelease. PR #39 blijft Draft, mergeable en ongemergd. Exact functioneel geteste releasecandidate `896736f10d93c2ea553e639de831a882bc01efae`: CI `37068494672` SUCCESS (25 PostgreSQL-concurrencytests, 313 root/importertests, 855 webtests, seed/lint/TypeScript/build); Preview `dpl_FgJFUHkFn5ETSb5iyk5La2LtHdDa` READY op exact die SHA. Dit documentatiecheckpoint verandert de functionele code niet.
- Productieproject `pjcqxufvbkkjehituzxz` (BoodschappenMaatje, eu-west-1, PostgreSQL 17.6) was ACTIVE_HEALTHY, zonder Supabase-branches. Vóór uitvoering waren de vier historische migraties geregistreerd, de zeven nieuwe functies en revisietabel afwezig en de relevante bestaande tabellen aanwezig. Alleen de exact uit PR-head `896736f` opgehaalde file `supabase/migrations/20261002120000_transactional_bounded_readiness.sql` (Git blob `fbdffa1899dd38a371e6cac6613ae39f37b02bf3`) is via Supabase apply_migration eenmaal op Production uitgevoerd; resultaat `success=true`.
- Directe schrijfvrije verificatie: `public.planner_write_revisions` bestaat met RLS, uitsluitend postgres ACL, één catalogusrij met revision 0 en geen `bounded_only`. Zeven bedoelde functies bestaan met `SECURITY DEFINER` en `search_path=pg_catalog`; uitsluitend source-revision, plan en commit-RPC hebben EXECUTE voor `service_role`, geen nieuwe functie voor `anon`, `authenticated` of `PUBLIC`. Zeven source-statementguards en twee cache-rowguards zijn enabled; de bestaande match→readiness-invalidatietrigger bleef enabled. Geen bounded RPC is aangeroepen.
- Vóór/na dezelfde SQL-snapshot: alle **negen** bestaande bron-/cachetabellen hadden identieke aantallen én volledige inhoudshashes. Kernstand: products/product_prices `7159/7159`, matches `245`, readiness `1370`; de overige recepten/ingrediënten/aliassen/relaties/profielen eveneens byte-inhoudelijk gelijk volgens de genomen JSONB-hashes. Geen nieuwe pending/failed-cache door schema-installatie. Read-only Production Home HTTP 200; Vercel meldde geen runtime error in het gecontroleerde venster. Geen gebruikersdata-, cache-, maintenance- of productimportwrite door deze run, behalve de bedoelde nieuwe schemametadata.
- **Open operationele blokkade vóór merge:** Supabase apply_migration registreerde dezelfde SQL onder **remote versie `20261002220202`**, naam `transactional_bounded_readiness_20261002120000`. De repositoryfile draagt **versie `20261002120000`**. Het schema is aantoonbaar aanwezig, maar de verschillende versies kunnen een latere CLI `db push`/migratiesync de file opnieuw laten aanbieden. Herhaal de SQL niet. Stem de migratiehistorie in een afzonderlijke, gecontroleerde Work-stap af met de bestaande file en verifieer de migratielijst/dry-run vóór PR-merge; geen schemareset of extra migratie. Daarna: PR #39 merge → automatische Production-deploy en smoke → afzonderlijke bounded live herberekening en AFTER-audit. Cataloguswachttijd blijft bij die latere bounded write een te monitoren punt.
- **Stopstatus:** schema/RPC/rechten/guards en bestaande data groen; migratieversiemapping nog niet groen. Geen appmerge, geen Production-appdeploy, geen bounded live write, geen cache-herberekening, geen import of reset. ROADMAP-fase blijft actief.

## Checkpoint 6 — transactionele bounded write bewezen — 2 oktober 2026

- **Functionele implementatie:** `3fe1824e0c61be0bd433856ad18b62e2365ba7ca` op `feature/meal-mix-supplement-matches`, bestaande Draft PR #39. Hervat vanaf remote `e1a68def66f580e9fdf2a4b1326e1545ff172066`; `cce023e68797689d84abe2c95933d7db5a5134a6` blijft de eerdere functionele candidate in de geschiedenis. Geen restart, branchreset of overname van andere productcode.
- **Atomaire eenheid:** één finale `commit_bounded_readiness(p_recipe_ids uuid[], p_match_keys text[], p_dependency_keys text[], p_expected_plan_token text, p_match_rows jsonb, p_readiness_rows jsonb) returns jsonb`. Scopecontrole, locks, CAS, match-upserts, normale triggerinvalidaties, readiness-upserts en finale scopecontrole zitten in één PostgreSQL-transactie. Iedere fout rolt ook revisies en beschermingsvlaggen terug. De bounded serverroute gebruikt geen losse write-upserts meer; conflict → 409, echte DB-/infrastructuurfout → 503. Een verloren commitbevestiging vereist een verse inspectie, nooit blind herhalen of een onbeveiligde fallback.
- **Locks/CAS:** deterministisch gesorteerde transactionele advisory locks voor betrokken matchkeys én receptidentiteiten, inclusief oude/geplande readdependencies. Guards op alle match-/readiness-DML laten ook legacy writers meedoen; conflicts fail-closed. SHA-256 over DB-canonieke scope, subscribers en monotone key-/recept-/bronrevisies vervangt tijdstempels als concurrencygarantie. Catalogusladen wordt met bronrevisies begrensd. Tijdens de korte commitfase gebruiken bounded requests een gedeelde cataloguslock; bronwriters nemen vóór hun statement een exclusieve lock en wachten zo nodig. Die bronfence is nodig voor nieuwe kandidaten in cataloguszoekopdrachten; disjuncte bounded requests kunnen aantoonbaar parallel committen.
- **Triggers/legacy:** `ingredient_product_matches_invalidate_readiness` blijft ingeschakeld. De scopeguard weigert iedere outside-scope match-/readinesswijziging, ook vanuit triggers, met rollback. Na een geslaagde bounded commit zijn uitsluitend de behandelde writekeys en recepten `bounded_only`: oudere writers zonder CAS kunnen daar geen `current` READY publiceren, ook niet via delete/reinsert met oude dependencies. Zo'n payload blijft pending; bestaande pending/failed-status en invalidatieredenen blijven behouden. De schrijfvrije evaluatorfallback blijft beschikbaar. Verder persistent verversen van behandelde recepten gaat via de bounded RPC; dit operationele effect moet in Work worden geaccepteerd.
- **Additive schema/autorisatie:** `supabase/migrations/20261002120000_transactional_bounded_readiness.sql` voegt private revisiemetadata, RPC's en guards toe, zonder datareset of rewrite. Bestaande data blijft bij installatie byte-identiek; legacy current-writes vóór activatie zijn getest. SECURITY DEFINER met vaste `search_path=pg_catalog`, gekwalificeerde objecten en uitsluitend service-role EXECUTE op de drie bedoelde RPC's. Geen directe service-/browsermutatierechten op revisies; RLS/admin-token en Preview-writeblokkade blijven intact. Preview-GET inspecteert alleen scope en geeft geen uitvoerbaar token.
- **Echt lokaal bewijs:** **25/25 PostgreSQL 17-tests** in een tijdelijke Docker-container, met echte repository-cachemigraties/triggers en afzonderlijke transacties. Alle tien gevraagde failure-/concurrencygevallen groen: fouten in match/readiness/tussenfase, outside-scope trigger, nieuwe subscribers, stale match, overlappende en disjuncte requests, replay/recovery. Extra bewijs voor echte INSERT-phantoms, late legacy READY, delete/reinsert, catalogusphantoms, een daadwerkelijk in `pg_locks` waargenomen wachtende bronwriter, ontbrekende matchrijen en privileges. Rollbackproeven vergelijken volledige cache én revisiemetadata. De historische catalogus-DDL ontbreekt in de repo; uitsluitend die twee basistabellen gebruiken een lokale fixture op basis van de importercontracten, zonder claim over niet-opgeslagen Production-DDL.
- **Volledige lokale gate:** **855/855 webtests** (69 bestanden, inclusief bounded maintenance, planner-cache-service, persistent cache en readiness), **313/313 root/importertests**, alle drie seedchecks, syntaxchecks, lint, TypeScript en Next.js Production-build groen. Codex Cloud blokkeerde aanvankelijk Node-subprocessen met EPERM; de definitieve volledige uitvoering buiten die sandbox is het geldige bewijs. Geen checks overgeslagen om de build groen te krijgen.
- **CI:** volledige workflow `Stability & core flows`, run [37066712658](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37066712658), op `847134ad0535a06a7836e6a83c78234c3bec9595` **SUCCESS**: importer/seedchecks, echte PostgreSQL-gate, volledige websuite, lint, TypeScript en Production-build. De code is functioneel gelijk aan `3fe1824`, met daarnaast de expliciete branch-CI-trigger. Vercel-check op die head eveneens SUCCESS (Preview-check, geen fysieke acceptatie). Het daaropvolgende documentatiecheckpoint verandert geen functionele code; actuele PR-head en zijn eigen CI blijven via GitHub te controleren.
- **Actuele integratiegrens:** main schoof tijdens deze run van `0c57d03ecd0428f293b91bef067a3e7baa176764` naar `7446d411e9d9cdf48b52df2a6edb2cc4eff34723`, uitsluitend door ROADMAP-documentatie. GitHub meldt PR #39 nu **CONFLICTING/DIRTY**; read-only `git merge-tree` bevestigt uitsluitend `ROADMAP.md` als conflict. Conform opdracht is ROADMAP in dit checkpoint niet gewijzigd en is geen merge uitgevoerd. Dezelfde volledige CI draait daarom op de exacte featurebranch-head via push; dit is geen bewijs van een reeds mergeable PR-mergecommit.
- **Rollback/herstel:** stop bounded writes, rol de app terug indien nodig, maar behoud schema, guards, revisies en bounded_only-bescherming. Geen cache-/tabelreset en geen onbeveiligde oude writefallback. Historische pending/partiële staat kan alleen via expliciete recipe-ID's/matchkeys, verse admin-dry-run, token en dezelfde RPC worden hersteld. Exact token opnieuw → stale/conflict; een vers plan upsert dezelfde logische rijen zonder duplicaten. Dit recoverypad is lokaal bewezen en niet live uitgevoerd.
- **Volgende Work checkpoint 7:** eerst het afzonderlijke ROADMAP-integratieconflict oplossen volgens de actuele Work-roadmap; daarna CI op de resulterende exacte head/merge-ref en Preview verifiëren. Review migratie, bevoegdheden, globale bronfence/wachttijd en legacy-pending/fallbackeffect. Uitrolvolgorde later: schema/RPC → verificatie → goedgekeurde apprelease → expliciete bounded live acceptance met BEFORE/AFTER en outside-scope-audit. Fysieke iPhone-/releasegoedkeuring en overige Work-releasegates blijven open. De transactionele technische gate is bewezen; dit is geen Production-releasegoedkeuring.
- Volledig ontwerp, failurematrix, deploy-/rollbackvolgorde en bounded recovery: `docs/transactional-bounded-readiness.md`. **0 live migraties, 0 live DB-/cache-/maintenancewrites, 0 imports, geen merge en geen Production-deploy of gebruikersdatawijziging.** Productdata & receptkwaliteit blijft actief; ROADMAP-fasestatus niet gewijzigd.
- **KLAAR VOOR WORK CHECKPOINT 7**: transactionele races en echte PostgreSQL-concurrencygate bewezen; het hierboven genoemde ROADMAP-conflict en de reguliere release-/live-/fysieke acceptatie blijven afzonderlijke Work-stappen.

## Checkpoint 5 — releasegate geblokkeerd door atomaire-scope-race — 2 oktober 2026

- Draft PR #39 blijft ongemergd op functionele head `cce023e68797689d84abe2c95933d7db5a5134a6`; vóór dit documentatiecheckpoint was de remote head `f5a361d0bbc45302f7f0f707125a12b2f0205584`. PR is conflictvrij/mergeable; de 19 gewijzigde bestanden liggen in de afgesproken productmatching, cache, begrensde route, regressies en documentatie. CI `37057428129` op cce groen; exacte Preview `dpl_C98WbU4Yajwr9K4cJPmcG9io7Us7` READY op cce. Bestaande 803 webtests, importer/root, seedchecks, lint, TypeScript en build blijven het bewijs voor deze ongewijzigde functionele head.
- Write-pad: dry-run en token → initiële scopecontrole → evaluatie 70 varianten → scope-hercontrole → match-upsert → readiness-upsert. De twee upserts zijn afzonderlijke PostgREST-transacties. Bij mislukte match-upsert volgt geen readiness-upsert en antwoordt de route HTTP 503. Bij geslaagde match- en mislukte readiness-upsert komt eveneens HTTP 503; gewijzigde matchrijen invalideren via `ingredient_product_matches_invalidate_readiness` alle opgeslagen subscribers naar `pending`. Als de match-upsert semantisch niets wijzigt, hoeft die trigger echter geen oude READY-rij te invalideren. Een lokale, **niet gepushte** pending-stageproef met drie fault-injectiontests (8/8 gerichte tests groen) maakte zo'n partial failure herkenbaar en via herhaling herstelbaar; dit is geen vrijgavebewijs en veranderde de PR niet.
- Doorslaggevende race: na `inspectBoundedScope` kan een andere writer een nieuwe subscriber voor een toegestane matchkey toevoegen. De bestaande database-trigger werkt dan op **alle** subscribers en kan buiten de allowlist readiness wijzigen. Daarnaast kan een andere match/cachewriter na hercontrole of na de match-upsert de toestand wijzigen, waarna de laatste readiness-upsert een inmiddels verouderde READY-payload als `current` kan terugzetten. Twee gelijktijdige bounded requests delen geen lock of transactionele CAS. Het plan-token detecteert alleen wijzigingen vóór de laatste hercontrole; een app-side pending-stage sluit deze vensters niet. De afgeleide cache en fallback beperken de impact van zichtbare `pending`-rijen, maar leveren geen harde buiten-scope-garantie.
- **Besluit: NIET releaseklaar, geen iPhone-/releasegoedkeuring vragen.** Kleinste structurele vervolg is een database-transactie/gesloten server-side functie met autorisatie, scope- en tokencontrole, locks/serialisatie van relevante matchkeys/subscribers en match+readinesswrites in één eenheid; triggeruitbreiding moet daarin worden gecontroleerd of fail-closed teruggerold. Hiervoor is een afzonderlijk getoetste schema-/RPC-migratie nodig. Conform checkpoint 5 vóór uitvoering gestopt. Eerst daarna failure-injection/concurrency regressies, volledige gate, CI en exacte Preview opnieuw; dan fysieke iPhone-/releasegoedkeuring. Rollback van alleen een Vercel-deployment herstelt geen half bijgewerkte databasecache, dus vóór release ook een bewezen rematch/herstelpad eisen.
- Deze run: **0 live maintenancewrites**, 0 Production-deployments, 0 imports, 0 migraties/resets, geen main-merge en geen gebruikersdatawijziging. ROADMAP-status onveranderd; Honig/Knorr-audit blijft de bewezen 10/8/1 en 17/5/14 totdat na veilige release een gerichte live audit plaatsvindt.

## Actueel — Honig/Knorr-consolidatie voor iPhone-acceptatie — 1 oktober 2026

- Checkpoint 4 (2 oktober; functionele PR #39-head `cce023e68797689d84abe2c95933d7db5a5134a6`): generieke begrensde readiness-maintenance op de bestaande Draft-branch toegevoegd. Een expliciete allowlist van maximaal 10 recipe-ID's en 10 matchkeys plant de scope voor personen 1–10, leest vóór writes alle bestaande subscribers van uitsluitend die keys, blokkeert onbekende targets en alle subscribers buiten de allowlist, en bindt catalogusdependencies plus subscriber-`updated_at` aan een SHA-256-plan-token. Write-mode berekent alle 70 doelvarianten met de bestaande evaluator, filtert matchwrites tot exact de drie toegestane keys, verifieert consistente matches per persoon en hercontroleert het plan onmiddellijk vóór de upserts. Preview-write wordt vóór databasegebruik geweigerd; Production-POST vereist het bestaande admin-token. De read-only Preview-GET gebruikt uitsluitend de publieke catalogusselecties. Dry-run op exacte Preview `dpl_C98WbU4Yajwr9K4cJPmcG9io7Us7` (target Preview, READY, exacte functionele SHA) met de zeven live bewezen recipe-ID's en drie matchkeys gaf `blocked=false`, `plannedMatchWrites=3`, `plannedReadinessWrites=70`, `unexpectedDependencies=[]`. Negatieve proef met één doelrecept weggelaten gaf HTTP 409, `blocked=true`, `dependency_outside_allowlist`, 10 onverwachte varianten en **0 geplande writes**. Voor de drie keys zijn live 70 subscribers/7 recepten en 0 buiten de allowlist; de eerder geconstateerde 26 andere recepten delen uitsluitend overige read-only keys uit de 38 dependencykeys en worden door deze route niet upsert. Tests: 803 webtests, root/importerfixtures (17 testbestanden), seed/syntaxchecks, lint, TypeScript en lokale Production-build groen; GitHub CI [37057428129](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37057428129) op de exacte functionele SHA groen. **0 live writes**; geen merge, Production-deploy, import, migratie/reset of gebruikersdatawijziging. Volgend checkpoint: PR #39-releasegate en fysieke goedkeuring; na reguliere merge/Production pas gerichte live herberekening met verse BEFORE/AFTER-audit. De twee database-upserts blijven afzonderlijke requests; de plan-hercontrole is optimistisch en geen databasebrede transactielock, dus deze racegrens opnieuw beoordelen in de releasegate.
- Checkpoint 3 (2 oktober, functionele head `1e73e545`): Vercel Preview `dpl_4iBJdftJCacz7YwNrGdkCJVnufMX` blijft READY op exact die commit; de bestaande Vercel-connector gaf read-only HTTP 200 met correcte paginatitels voor Home, Menu (`/week-voorbereiden`), Budget en Meer. Lijst was eerder HTTP 200. Gerichte live BEFORE-snapshot: 3 matchkeys (`mix-supplement-hacheevlees:g`, `mix-supplement-tomaten:piece`, `mix-supplement-pitabroodjes:g`), 7 geverifieerde recepten en 70 readiness-varianten (personen 1–10); alle 7 bij vier personen NOT_READY en evaluator v4. Hachee `invalid/no_catalog_product`, zonder SKU; tomaten `valid` op ongeschikte Mutti bliktomaten SKU 733141000 met `package_unknown` in vijf recepten; pita `invalid/no_catalog_product`, zonder SKU. Matchkeys hachee/pita `current`, tomaten `pending`; 35/70 readiness-varianten `pending` wegens `product_match_changed` (35 `current`, 0 `failed`). De bestaande `mix-refresh`-route accepteert maximaal 5 recipe-ID's per POST, herberekent alle ingrediënten van geselecteerde recepten en upsert hun matchkeys; deze zeven recepten hebben samen 38 dependencykeys waarvan gedeelde keys ook 26 andere recepten/260 varianten raken. Production draait nog matcher/evaluator v4, terwijl de gerichte v5-fix alleen op Draft PR #39 staat. De geëiste begrenzing en correcte live code zijn dus niet aantoonbaar: **veiligheidsgate afgewezen; 0 cache-/readinesswrites**. Live telling bij vier personen blijft Honig 10 READY/8 NOT_READY/1 NO_RECIPE en Knorr 17 READY/5 NOT_READY/14 NO_RECIPE. Eerstvolgende technische checkpoint: een aantoonbaar begrensde route voor deze dependencyset voorbereiden en testen; uitvoering pas wanneer de juiste functionele code volgens de reguliere releaseflow live is. Geen merge, Production-deploy, productimport, migratie, reset of gebruikersdatawijziging.
- Checkpoint 2 (functionele head `1e73e545b2b8516a262b6fe334f004061a1b6a65`): GitHub Actions `Stability & core flows` run [36916459209](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/36916459209) is voltooid/groen. Exacte Vercel-deployment `dpl_4iBJdftJCacz7YwNrGdkCJVnufMX` (`https://boodschappenmaatje-56h3dmb5v-dennisverkaik-4661.vercel.app/`) heeft dezelfde commit-SHA, Preview-target (`target: null`), status READY en geen aliasfout. Read-only routefetch: `/lijst` gaf eenmaal HTTP 200 met de titel `Lijst · BoodschappenMaatje`; Home, Menu, Budget en Meer konden door Vercel Authentication/SSO-redirects (HTTP 302) niet betrouwbaar als geladen worden bevestigd. De volledige vijf-scherm-smoke blijft open; daarna volgt pas gerichte live readiness-herberekening en voor/na-audit. Geen live cachewrite, merge, Production-deployment, import, migratie of reset.
- Draft PR #39 (`feature/meal-mix-supplement-matches`) is gekozen als bestaande consolidatiebranch. De afgebakende tomatenfix uit PR #38 en de pita-massaregressies uit PR #40 zijn zonder dubbele matcherregels samengebracht; #38 en #40 zijn daarna als vervangen gesloten, ongemerged. Hun bron- en regressiebewijs zit in #39. PR #41 (importplanning) staat hier los van. Geen merge naar main of Production-actie in deze fase.
- Schrijfvrije live audit: 6759 producten en 6759 prijsregels; Honig **10 READY / 8 NOT_READY / 1 NO_RECIPE**, Knorr **17 READY / 5 NOT_READY / 14 NO_RECIPE**. De volledige huidige blokkadelijst staat in `docs/honig-knorr-readiness-audit-20261001.md`. De live cache behoudt dezelfde aantallen zolang deze Draft-code niet gereleased en gericht volgens de bestaande route herberekend is; geen kunstmatig READY.
- Code: exact bewezen Hoogvliet Riblappen SKU 733659000 wordt als hacheevlees herkend en per ca. 700 g heel pakket geprijsd. Tomaten in blik en snack/cherry worden voor verse tomaten per stuk geweigerd. Verse trostomaten zonder vast stukaantal blijven NOT_READY; pita in stuks blijft voor 400 g eveneens NOT_READY. Basilicum 15 g versus 30 ml, lasagnebladen 250/500 g versus 12 stuks, yoghurt 500 ml versus 260 g, halve rookworst, broodsneden en Provençaalse wokgroenten hebben aantoonbare bron-/eenheidsblokkades.
- Nieuwe gerichte cachecorrectie: alleen matchkeys `mix-supplement-hacheevlees`, `mix-supplement-tomaten` en `mix-supplement-pitabroodjes` krijgen matcher-/evaluatorversie 5. Hun oude v4-resultaten vallen in Preview schrijfvrij terug naar de actuele matcher; andere READY-cache blijft op versie 4 bruikbaar. De bestaande browser-refresh is op Preview `preview-read-only` en schrijft daar niets. Na release kan dezelfde bestaande onderhoudsroute alleen deze oude receptvarianten voor personen 1–10 verversen. Nieuw-productonderhoud herkent zowel v4 als v5 en filtert per sourceKey, zodat later nieuwe exacte kandidaten niet worden gemist. Drie gerichte cachetests en de volledige websuite (795 tests), lint, TypeScript en build zijn lokaal groen; nieuwe head-CI/Preview volgen. Geen databasewrite uitgevoerd.
- De NO_RECIPE-groep (1 Honig, 14 Knorr) is de directe vervolgstap binnen deze roadmapfase na fysieke acceptatie en release. Exacte geconsolideerde PR #39-head `41d1477e868c0899a9d1b5518830621f1382e0f5` is mergeable en Draft. CI `36913107415` op die head is groen. Vercel Preview `dpl_CXDKMJ6gka6G68wKXcLVGZRX2Roq` is READY op die head, zonder aliasfout; Preview is beschermd met Vercel Authentication en een volledige interactieve browsercontrole is nog niet bewezen. Lokale controles: 275 root-tests, seed/syntaxchecks, 792 webtests, lint, TypeScript en Next Production-build groen. Herhaalde live audit blijft 10/8/1 Honig en 17/5/14 Knorr; geen cacheverversing gedaan omdat de code nog niet op Production draait. Fysieke iPhone-test staat open. Geen import, migratie of databasewrite uitgevoerd.


## Actueel — PR #37 gereleased naar Production — 1 oktober 2026

- PR #37 is na volledige releasegate gemerged naar `main` als **`40f340681f116193f265891716f72082eaa65718`**. De PR-head was `c9c60fbd3c463ea976c9bbf328368fda29a30b7e`; functioneel/live geteste head `8988a3b0345122ca8e8192806f8d9a679cc2f491`.
- Releasegate: PR conflictvrij/mergeable, 13 commits vóór en 0 achter main; diff uitsluitend importer/workflow/tests/documentatie/screenshots, zonder design-, schema- of migratiewijzigingen en zonder code uit PR #38/#39/#40.
- Actuele PR-CI `36844939333` groen; na merge is main-CI `36846316766` eveneens groen. Importerfixtures/seedchecks, webregressies, lint, TypeScript en Production-build slaagden.
- Live read-only eindbewijs opnieuw bevestigd: dagjob **400/400**, remaining **0**, catalogus **6759 producten / 6759 prijzen**, vandaag precies 400 nieuwe producten. Duplicaten supermarkt/SKU 0, ongeldige/niet-positieve prijzen 0, orphan prijzen 0 en producten zonder positieve prijs 0.
- Dagjob `f029e527-662c-4047-9a74-43646f92b559` staat `target_reached`, attempt_count 3, zonder lock of retry. Attempts: 100 succesvol → 0 door historische `source_challenge` → 300 succesvol. Geen actieve daily attempts of catalogusimports.
- Maintenance: `confirmed`, `notifiedProducts=704`, pending 0, failures 0. Discovery eindigde op term_cursor 10, `category:999999-1000`, page_cursor 0, `growth_target_reached`.
- Structurele source_challenge-afhandeling is gereleased: gedeelde seriële pacing minimaal 2s / maximaal 30 top-levelnavigaties per minuut, checkpointbehoud, geen gebufferde writes na challenge, 15/30/60 minuten begrensde backoff, maximaal drie challenge-vervolgpogingen binnen dezelfde dag, normale claim-RPC en hard dagmaximum 400. Geen proxy/header/cookie/identity-bypass.
- Vercel Production deployment **`dpl_EzwQdgRR57VpBMvNY3HeXqLvxztd`** staat **READY** op exact mergecommit `40f3406`; Production-alias `boodschappenmaatje-pwa.vercel.app` wijst ernaar. Read-only smoke: Home, Menu, Lijst, Budget, Meer en Vrije keuze alle HTTP 200.
- Rollbackpad: de nieuwe Production-deployment is door Vercel als rollback candidate gemarkeerd; vorige Production-release blijft in deploymenthistorie beschikbaar.
- Open operationele verificatie: de natuurlijke primaire **06:07 Europe/Amsterdam**-trigger en afzonderlijke **08:30**-monitortrigger zijn op 1 oktober niet aangemaakt. Configuratie staat op main en de bekende latere schedule-run bewijst deze twee triggers niet. Geen willekeurige cronwijziging gedaan; dit blijft een afzonderlijk verificatiepunt en blokkeerde de bewezen PR #37-release niet.
- **Geen verdere productimport op 1 oktober starten:** dagmaximum 400 is bereikt. Geen reset of extra retry.
- Eerstvolgende productfase: **Productdata & receptkwaliteit**.


## Historische checkpoints — onderstaande tussenstanden zijn geen actuele dagstatus

## PR #37 — dagelijkse 100→resterend-acceptatie — 1 oktober 2026

- Hervat vanaf remote PR #37 `986422f9b38d6b76f142101612fadbd124c67e2c`, main/default branch `b202d19f874d0ace293c6ef76c57529b6e3e79eb`. PR #41 is inmiddels `13bba46798de5fc107d52edb9aa14d82337a3a39` en bevat een nog niet gereleased recovery-schema; niet overgenomen of gewijzigd. PR #38/#39/#40 en het ontwerp blijven onaangeraakt.
- Read-only controle 09:51 Europe/Amsterdam: vandaag geen dagjob, actieve claim, running attempt of catalogusrun; 0 nieuwe producten. Catalogus 6359 producten/6359 prijzen; geen dubbele supermarkt/SKU, ongeldige prijzen, orphan prijzen of producten zonder positieve prijs. Maintenance v4 `confirmed`, pending 0, failures 0, notified 304.
- Primaire 06:07- en monitor 08:30-trigger zijn bij controle nog niet als Actions-run aangemaakt. Main bevat de tijdzonecron zonder uitvoertijdpoort. De primaire workflow is ingeschakeld (GitHub toont de optie Disable workflow); geen queued/in-progress runs. GitHub schedule-trigger niet aangemaakt; exacte platformoorzaak niet bewijsbaar. Geen speculatieve cronwijziging. Laatste retry `36784343276` was buiten het dagvenster; nieuwe controles blijven nodig vóór live start.
- De bestaande `daily_attempt_only` overschreef de groeilimiet met 400 en sloot de dagjob terminaal. Nieuwe expliciete keuze `growth_limit=100` vereist `daily_attempt_only=true`, behoudt **dagdoel 400** en gebruikt uitsluitend de normale dagclaim/importer. Fase A begrenst alle discoverysegmenten samen op 100 bevestigde product+prijs-inserts.
- Na Fase A stopt discovery voor een bounded, schrijfvrije integriteitsgate: catalogus-/prijsdelta, nieuwe SKU-identiteiten, positieve prijzen, duplicaten/orphans, ongewijzigde bestaande prijzen, Nederlandse dagtelling, balanced discoveryaccounting en exact bijbehorende maintenance-acknowledgements. Alleen exact 100 zonder fouten kan Fase B vrijgeven. De dagstand wordt eerst met de bestaande finish-RPC opgeslagen; B moet een nieuwe normale claim op **dezelfde dailyImportId** krijgen en mag uitsluitend het werkelijke restant importeren. De workflow houdt tussen beide fasen dezelfde gedeelde concurrency vast. Runtimebudget 105 minuten wordt over beide fasen gedeeld; geen dagreset, DB-migratie, claimoverride of losse testimport.
- Bij minder dan 100 of een gatefout start B niet; bevestigde groei blijft in de normale dagaccounting. Een terminale dag wordt niet heropend. Automatische planning op main is niet gewijzigd. Deze acceptance mode is alleen op Draft PR #37 beschikbaar; geen merge of Production-release toegestaan in deze opdracht.
- Nieuwe regressies: 100+300, eerdere daggroei 25+100+275, <100 sluit zonder B, maintenancefout behoudt bevestigde inserts, actieve claim start niets, duplicate/orphan/niet-positieve prijs, identiteit/boekhouding en expliciete workflowinputs. Functionele head `4901eb15b5586367eff3db62dd9c250cc5a13585`: 303 root-tests, seedchecks, 791 webtests, lint, TypeScript en build groen; volledige CI `36833985961` geslaagd. Exacte Preview `dpl_4nddJb9SLfoBRdYsZUAekycbBN2V` READY. Production blijft `dpl_9CpqCd7nQbXHVAMzz6JrwFgzsmLd` op main `b202d19`, ongewijzigd.
- **LIVE START 10:12 CEST:** één nieuwe workflow_dispatch, Action `36834839193` (#98), exact head `4901eb1`, branch `feature/hoogvliet-product-coverage`, growth/growth, daily_attempt_only=true, growth_limit=100, advance_discovery=true. Geen rerun. Vlak vóór start 10:11:51 opnieuw 6359/6359, 0 vandaag, geen actieve/queued workflow, claim of attempt, maintenance confirmed/pending0/notified304, nul integriteitsafwijkingen. Normale dailyImportId `f029e527-662c-4047-9a74-43646f92b559`, eerste poging, dagdoel400. Deze bestaande run volgen; **nooit opnieuw starten bij hervatting**. Definitieve fase-uitkomst volgt hieronder.

### Live Fase A bewezen geslaagd — 10:35 CEST

- Action `36834839193`, eerste dagelijkse poging afgerond 08:34:59Z: **100 werkelijk nieuwe producten en 100 positieve prijsregels**, nul importer-/bronfouten. Catalogus 6359→6459 producten en 6359→6459 prijzen. Schrijfvrije gate bevestigt nieuwe SKU-identiteit, geen bestaande prijswrites, geen duplicaten/orphans/ongeldige prijzen, exact100 acknowledgements, notified304→404, pending0/failures0.
- Discovery: 7511 ruwe paginahits, 397 gestarte routes; balanced accounting: nieuw100, bestaand4768, duplicaten636, niet-relevant1980, niet-verwerkt27 wegens bereikte100-grens, alle overige foutcategorieën0. Stopreden `growth_target_reached`, niet bronuitputting. Drie aanvullende categorieën bereikt (`999999-100`, `999999-200`, `999999-300`).
- De importer telt uitsluitend supermarktnaam `Hoogvliet` (6356→6456); de gehele tabel bevat daarnaast3 bestaande `hoogvliet`-records. Daarom verschilt het importer-totaal3 van de totale catalogus; geen ontbrekende inserts. Ook schrijfvrij gecontroleerd op case-insensitieve supermarkt/SKU-duplicaten:0.
- Dagboekhouding opgeslagen:100/400, resterend300, attempt1 `succeeded`. Fase B is als attempt2 op dezelfde dailyImportId `f029e527-662c-4047-9a74-43646f92b559` via normale claim gestart, maximaal300. Geen tweede workflow_dispatch.

### Harde stop Fase B — bronblokkade, 10:36 CEST

- Fase B is bij normale broninitialisatie gestopt met **`source_challenge`**: Hoogvliets Incapsula-veiligheidscontrole werd niet binnen de bestaande wachttijd afgerond. **0 nieuwe producten, 0 prijsinserts, 0 paginahits** in B. Geen bronuitputting bewezen; de resterende300 zijn niet als onbeschikbaar aangemerkt. Action `36834839193` eindigde terecht `failure`, niet groen gepresenteerd.
- Conforme harde stop: geen retry/rerun, geen andere bronroute/proxy/sessie als omweg, geen dagreset of claimoverride. Geen verdere live import in deze opdracht. De bestaande terminale dagjob wordt niet heropend.
- Eindcontrole 10:37:42 CEST: **6459 producten/6459 prijzen,100 nieuw vandaag**, dagjob `daily_target_partial`, target400/collected100/remaining300, attempts2, next_retry_at=null, lock=null. Actieve locks/attempts/imports0. Dubbele supermarkt/SKU (ook case-insensitief)0, ongeldige/null/niet-positieve prijzen0, orphan prijzen0, producten zonder geldige prijs0.
- Maintenance: **confirmed, notified404, pending0, failures0**. De100 nieuwe producten kregen een succesvolle bestaande new-products-respons, inclusief gevalideerde match-/readinessresultaatvelden. Afzonderlijke aantallen gewijzigde matches/ververste readiness zijn niet duurzaam in de importerrespons opgeslagen; geen fictieve aantallen gerapporteerd.
- **Fase A geaccepteerd; volledige A+B-acceptatie NIET geslaagd.** PR #37 blijft Draft. Functionele code `4901eb1`; documentatiecheckpoint tijdens de run `77f10e9`; actuele einddocumentatiehead staat op PR #37. Volledige CI `36833985961` (functioneel) en `36835420384` (checkpoint) groen; einddocumentatie-CI apart verifiëren. Main/Production, PR #41 en PR #38/#39/#40 zijn ongewijzigd.
- Vóór merge/release: bron moet normaal bereikbaar zijn zonder omzeiling; een opnieuw expliciet afgesproken veilige vervolgaanpak moet een claimbare dag/budget respecteren. Ook automatische 06:07-/08:30-triggerwerking is nog onbewezen. Geen dagelijkse beschikbaarheid van400 nieuwe producten bewezen. ROADMAP niet afgerond gemarkeerd.

## Actueel PR #37 — growth-onderzoek en claimgrens — 30 september 2026, 21:12 Europe/Amsterdam

- **Releasebasis:** main `b202d19f874d0ace293c6ef76c57529b6e3e79eb` (goedgekeurd ontwerp via PR #30); Vercel Production `dpl_9CpqCd7nQbXHVAMzz6JrwFgzsmLd` Production-target, READY en alias `boodschappenmaatje-pwa.vercel.app`. PR #37 blijft Draft; de branch is conflictvrij met de goedgekeurde main verenigd als `fd8295c1308ad1a67f60f8145e166dd19c3e1b25` (`mergeable=true`). De actuele diff bevat dezelfde tien importer-/test-/documentatiebestanden, zonder UI-, database- of workflowwijziging. Functionele code `5dd8bbc`; volledige CI `36764592413` op de branchmerge groen. Preview `dpl_CaFdgDzM3Ey1RHxWyBMSCec6uuaj` READY op deze exacte head; Home read-only geopend met de goedgekeurde slogan. De hierop volgende documentatiecommit wijzigt alleen dit checkpoint en moet opnieuw door CI.
- **Laatste echte growth (niet PR #37):** Action `36667726775` op `d93248c` startte poging 1 om 06:13 Nederlandse tijd. Twee bounded segmenten telden samen 18.286 ruwe paginahits: 8.651 bestaande treffers, 2.459 duplicaten, 7.112 niet-relevant, 64 herhaalde paginahits, 0 nieuw en 4 zoekroutefouten. Segment 1 stopte op `page_safety_limit`; segment 2 op `discovery_incomplete_stalled_terms` (fruit, diepvries, kattenvoer, hondenvoer). Action `36671598645` op `875ac98` deed poging 2 om 07:03; dezelfde 598 afgehandelde oude routes gaven 0 paginahits en 0 nieuw, `discovery_exhausted` voor die routes. Dit is geen bewijs van uitputting van het volledige Hoogvliet-assortiment. De latere handmatige `36750206659` op oude main was `UPDATE_MODE=catalog`, `CATALOG_BATCH=core`, geen growth of PR #37-acceptatie.
- **Database nu, read-only:** Nederlandse dagjob 30 september `daily_target_partial`, 0/400, twee pogingen, `completed_at=2026-09-30T05:03:45.675Z`, geen retry of actieve claim; geen lopende import. Discovery-state v4, cursor term 204/pagina 0, 598 afgehandelde routes. Producten/prijzen 6359/6359; nul niet-positieve prijzen. Maintenance `confirmed`, pending 0, `notifiedProducts=304`. Vandaag kan de normale databaseclaim de terminale dagjob niet opnieuw aannemen; geen dispatch, reset, tweede import, acknowledgement of databasewrite door deze hervatting.
- **Actuele bronsteekproef:** alle 59 op 30 september schrijfvrij als ontbrekend gemeten SKU's ontbreken nog in de database. Op de openbare site tonen twee actuele pagina's van bier/wijn/alcoholvrij dezelfde 14+15 ontbrekende SKU's; Bewuste voeding toont nog 7 van de eerdere 8 op pagina 1. Dus **36 van 59** zijn in deze hervatting opnieuw zichtbaar op precies gecontroleerde bronpagina's, met listingprijzen; de overige 23 zijn niet opnieuw via alle categoriepagina's gecontroleerd. De eerdere 15 detailvalidaties zijn historisch bewijs, geen nieuwe volledige detailvalidatie. Er zijn geen daadwerkelijke inserts of nieuwe prijzen in deze opdracht.
- **Volgende veilige acceptatiegrens:** natuurlijke import op **1 oktober 2026 vanaf 06:07 Europe/Amsterdam**, monitor gepland 08:30; de retryworkflow beoordeelt daarna zijn eigen `next_retry_at`. Controleer hun eindstatus, actuele dagstand, claim, gedeelde Actions-concurrency, bron en maintenance opnieuw. Voer de ene PR #37-`daily_attempt_only` uitsluitend uit als een werkelijk claimbare dagjob binnen 06:00–23:00 en zonder automatische run of due retry bestaat. Een kloktijd alleen garandeert dat niet; als de automatische cyclus de job weer terminaal afsluit, wacht op een latere nieuwe dag en stem af zonder dubbele import. Geen live acceptatie of merge bewezen; 400 dagelijkse nieuwe producten blijft een doel, geen resultaat.

## Actueel — definitieve designrelease — 30 september 2026

- De gebruiker keurde Home Optie C, het projectbrede heldere iconenblauw en de definitieve tweeregelige Home-slogan `Slim kopen.` / `Lekker eten.` fysiek goed. PR #30 is na conflictvrije diff, 791 webtests, lint, TypeScript, build, 275 importerregressietests en groene CI `36760308853` gemerged als **`2e327dc9cf3b1598d2122245dfa14a46fe123742`**.
- Vercel Production-build **`dpl_7owhtFUCLC2i3PTPATMK7r72JVsN`** van deze mergecommit werd `READY` en de Production-alias `boodschappenmaatje-pwa.vercel.app` wees ernaar. De publieke Home toont de exacte slogan zonder kleine ondertitel. Home, Menu, Lijst, Budget, Meer en Vrije keuze zijn read-only via de echte Production-navigatie geopend en renderen zonder fout. In de schone browser was geen opgeslagen week: de Home-slider toonde correct zijn lege staat; de gevulde slider en dagdoorklik waren op de identieke functionele Preview-code eerder getest en fysiek goedgekeurd, maar niet opnieuw met Productiedata gegenereerd.
- Definitieve kleuren en slogan staan nu in DESIGN.md; ROADMAP.md markeert de visuele tussenstap afgerond. Alleen documentatie werd na de functionele merge vastgelegd, zodat een daaropvolgende inhoudelijk identieke Production-build mogelijk is. PR #37, importer, database, maintenance, prijzen, gebruikersgegevens en dagplanning bleven ongemoeid; geen productimport gestart.

## Home Optie C — definitieve slogan ter fysieke eindcontrole — 30 september 2026

- Na de fysieke iPhone-feedback vervangt de definitief gekozen Home-slogan beide eerdere headerteksten: twee grote witte regels, `Slim kopen.` en `Lekker eten.`. De kleinere contextafhankelijke ondertitel vervalt volledig. Deze tekst geldt ongeacht of de week al volledig is voorbereid.
- Bestaande Draft PR #30 `feature/home-option-c` hervat vanaf `64ed8676092e647f8002aeb5cf8db71a4019cef8`; alleen de twee headerregels, direct benodigde typografische maat voor smalle schermen en tekstverwachtingen in Home-tests veranderen. De blauwe stijl, mascotte, overige componenten en functies blijven gelijk. PR #37 en main onaangeroerd.
- Status: laatste fysieke iPhone-controle van de actuele Preview nog open; geen merge of Production-deploy. De voorafgaande headertekst hieronder is historisch checkpoint, niet de huidige kop. DESIGN.md is niet aangepast; de definitieve slogan staat hier en in de code.

## Home Optie C — definitieve headertekst, laatste iPhone-controle — 30 september 2026

- Fysieke iPhone-feedback keurt het Home-design, de projectbrede heldere blauwe huisstijl, mascotte en functionaliteit goed. Alleen de Home-headertekst verandert: `Hoi!` → `Goed geregeld.`; bij een volledig voorbereide week `Je week staat klaar.` → `Je maaltijden en boodschappen op een rij.` De bestaande lege-weektekst blijft `Wat eten we deze week?`.
- Bestaande Draft PR #30 `feature/home-option-c` hervat vanaf `b84fef09fec852ca9b220fc6b64046dce388c786` op main `7e35035a02996ef403546eb3878e706e93f8da3c`. Alleen de direct betrokken koptypografie/hoogte is compact aangepast voor de langere tekst; geen andere Home- of schermwijziging. PR #37 blijft onaangeraakt.
- Gericht Home-testresultaat, lint, TypeScript, build, CI en de exacte nieuwe Preview staan na verificatie hieronder in de PR. Nog geen fysieke controle van de definitieve woorden: **KLAAR VOOR LAATSTE FYSIEKE IPHONE-CONTROLE**; geen merge of Production-release. DESIGN.md blijft ongewijzigd.

## Actueel — projectbreed icoonblauw, fysieke hertest open — 30 september 2026

- Fysieke feedback: Home-design en alle bestaande functies zijn door gebruiker goedgekeurd. Nieuwe opdracht is uitsluitend het consequent doorvoeren van hetzelfde icoonblauw naar de overige PWA-schermen; layouts blijven behouden.
- Hervat vanaf PR #30-head `85270eaa99bde4480db9c163e26c068d347879c0`, main `7e35035a02996ef403546eb3878e706e93f8da3c`. Functionele kleurcommit **`b5d983e082178514a9237d14be08e2c30dde9d09`**. PR #30 blijft Draft; actuele documentatiehead staat op GitHub. PR #37 bleef `c01740c8d42312dca1ba94754727b3e2493a6927`, onaangeraakt.
- Oorzaak van inconsistentie: Home had eigen icoonblauwe tokens; andere schermen gebruikten nog de oude gedeelde kleuren. Centrale `--brand-*` tokens nemen nu exact de vijf opnieuw uit het bijgevoegde originele icoon gemeten kleuren over: #1D87F7, #278EF7, #62BFFC, #034ECD, #0448B3. Home verwijst naar dezelfde bron; de fysiek goedgekeurde Home-kleuren blijven gelijk.
- Gedeelde semantische kleuren voor knoppen, tekst, selecties, randen, lichte vlakken, schaduwen, focus, diagram en navigatie gebruiken deze familie. Kleine witte knoptekst gebruikt de primaire/diepe 55:45-mix #116DE4; contrastratio >=4.5:1 getest. Groen/rood/waarschuwingen blijven semantisch ongewijzigd. Browser-/installatiekleuren zijn bijgewerkt; app-icoon en install-identiteit blijven gelijk.
- Functionele diff van deze opdracht: uitsluitend `styles/tokens.css`, `styles/branding.test.ts`, `config/app.ts`. Geen wijzigingen in globals.css-layouts, componentstructuur, berekeningen, opslag, database of importer. Oude merkhexen en oude blauwe RGBA-schaduwen komen niet meer voor in actieve styling.
- Tests: **791/791 webtests**, lint, TypeScript en Production-build lokaal groen; volledige CI **36705723580** op de functionele kleurhead groen, inclusief importerfixtures en seedchecks. Kleurtests bewaken gemeenschappelijke bron, contrast, semantische statuskleuren, manifest en diagramlegenda.
- Preview **dpl_4UBeNkPDi4nJ3nPbVPUR47ehUK6L**, exacte kleurhead b5d983e, READY, Preview-target. Vaste link: https://boodschappenmaatje-pwa-git-feature-ho-02f3d4-dennisverkaik-4661.vercel.app/ . Een documentatiecheckpoint kan een nieuwe inhoudelijk identieke Preview opleveren.
- Echte browsercontrole: Home, Menu, Lijst, Budget, Meer en Vrije keuze geopend. Gerenderde tekst/achtergrond/rand/focus/schaduw/gradient/iconkleuren en pseudo-elementen gecontroleerd: **0 oude-kleurhits op alle zes routes**, geen horizontale pagina-overflow. Bestaande lokale testweek bleef 5 dagen/4 gerechten/15 lijstproducten, €17,82 gepland en €82,18 resterend; geen nieuwe week gegenereerd of gegevens gewijzigd.
- Echte screenshots: `docs/screenshots/blue-home.jpg`, `blue-menu.jpg`, `blue-lijst.jpg`, `blue-budget.jpg`, `blue-meer.jpg`. Dit zijn desktopcloudbrowserbeelden (1363×936; responsieve inhoud), geen mobiele emulatie. De browser heeft geen ondersteunde viewport-emulatie; een lokale 390px-testweergave werd door URL-beleid geblokkeerd en niet omzeild. Mobiele safe areas/kleine schermen moeten fysiek worden herbevestigd; de bestaande layout-CSS is ongewijzigd.
- **KLAAR VOOR FYSIEKE IPHONE-HERTEST.** Controleer alle vijf tabs, Menu/Vrije keuze, Lijstfilters/+/−, Budgetdiagram en meldingskleuren. DESIGN.md blijft conform opdracht ongewijzigd tot projectbrede fysieke goedkeuring. Geen merge, Production-release of PR #37-/import-/databasehandeling.

## Home Optie C — goedgekeurde mockup / icoonblauw — 30 september 2026

- Bestaande Draft PR #30 en branch `feature/home-option-c` hervat vanaf `d288e533b25c428580b467f47d86439b959a7e84`. Actuele main `7e35035a02996ef403546eb3878e706e93f8da3c` geïntegreerd in de featurebranch; alleen documentatie overlapte. Importer/serverclient/maintenance/workflows zijn exact main, niet teruggezet naar de oude Home-basis. PR #37 onaangeraakt.
- Nieuwe door gebruiker goedgekeurde Home-mockup is leidend: helderblauwe gradientheader, officiële bestaande losse mascotte, witte budgetkaart, verticale dagkaarten in bestaande horizontale scroll-snap-slider, grote “Naar je boodschappenlijst”-knop, drie echte informatiekaarten en compacte weekstatus. Vijf bestaande tabs; alleen actieve Home-staat krijgt icoonblauw.
- Palette rechtstreeks uit onveranderd origineel `apps/web/assets/branding/boodschappenmaatje-original.jpeg` (1254×1254): `#1D87F7` (1100,600), `#278EF7` (1100,340), `#62BFFC` (620,100), `#034ECD` (650,1190), `#0448B3` (340,1080). Afgeleide lichte vlakken en contrastvariant via CSS color-mix; centrale `--home-c-*` tokens. Bestaande gedeelde kleuren en app-iconen blijven byte-identiek. DESIGN.md blijft ongewijzigd tot fysieke goedkeuring.
- Echte budgetberekening behouden: weekkosten prominent, maaltijdkosten/-grens afzonderlijk in dezelfde kaart, resterend bedrag in informatiekaart. Onbekende/onvolledige prijs, geen budget en overschrijding blijven expliciet. Geen bedragen/gerechten/personen uit mockup hardcoded.
- Slider blijft opgeslagen dagvolgorde, bestaande foto/fallback, actuele personen/verpakkingsprijs en exacte `/week-voorbereiden?day=N` / `/vrije-keuze?day=N`-routes gebruiken. Vinkje betekent werkelijk ingepland gerecht, geen afgevinkte boodschappen of nieuwe dagselectie. Eerste kaart is uitsluitend visueel uitgelicht; geen nieuwe state.
- Bewuste verschillen met mockup: geen niet-functionele notificatiebel; behouden aparte maaltijdbudgetregel en werkelijke gerechtkosten/personen; onderste Weekinstellingen/Nieuwe week blijven bereikbaar. Echte gegevens en passende bestaande gerechtbeelden vervangen voorbeeldinhoud.
- Hervatting na timeout: de bestaande slider/dagroutes stonden al op PR-head `d288e53`; de mockupimplementatie stond lokaal, nog niet gepusht. In deze hervatting afgerond en gepusht als `83389fc`, met laatste CSS-afwerking `3d77f962784370d6b11c44114d6d9cc659eb0963`. Het daaropvolgende documentatiecheckpoint verandert geen functionele code; actuele PR-head is GitHub PR #30.
- Verificatie: **790/790 webtests**, **275/275 importerfixtures**, seed-/syntaxchecks, lint, TypeScript en Production-build groen. CI `36702091114` op `83389fc` volledig groen; definitieve CSS-head-CI **`36702753471` volledig groen**. Twee nieuwe presentatieregressies bewaken echte informatiekaarttellingen en onvolledig geprijsde budgetruimte.
- Preview `dpl_4xcf4KSUPWWZE3o8bWTohc7Gd9Zh`, echte codehead `3d77f96`, target Preview, **READY**. Stabiele branchlink: https://boodschappenmaatje-pwa-git-feature-ho-02f3d4-dennisverkaik-4661.vercel.app/ . Een later documentatiecheckpoint krijgt mogelijk een nieuwe inhoudelijk identieke Preview.
- Echte browsercontrole: lege Home, daarna via normale Preview-UI een lokale week met 2 personen/5 dagen, vier echte plannerrecepten en één vrije-keuzedag. 15 lijstregels/16 verpakkingen, € 17,82 gepland, weekbudget € 100, maaltijdgrens € 65 en € 82,18 resterend; identiek op Home/Lijst/Budget. Geen fictieve gerechten/prijzen geïnjecteerd. Dit zijn browserlokale testkeuzes, geen Production-gebruikersgegevens.
- Dinsdagkaart opende `/week-voorbereiden?day=1` met het juiste receptdetail; vrijdag opende `/vrije-keuze?day=4`. Horizontale slider 418 px breed/616 px inhoud, zelfstandig naar laatste kaart gescrold; alle Home-acties minimaal 44 px hoog. Afbeeldingen geladen, opgeslagen week na reload behouden. Geen horizontale pagina-overflow op de geteste cloudbrowser.
- Werkelijke screenshots bijgewerkt in `docs/screenshots/home-option-c-preview.jpg` en `docs/screenshots/home-option-c-week-slider.jpg`. Het zijn uitsneden van de echte 430 px brede Home-inhoud in de desktopcloudbrowser, geen gegenereerde mockup en geen iPhone-emulatie. Safari, fysieke safe areas, kleine iPhone-hoogtes en native swipe blijven fysieke acceptatiepunten.
- Status: **KLAAR VOOR FYSIEKE IPHONE-TEST**, definitieve functionele CI groen. Fysieke goedkeuring nog niet gegeven. PR #30 blijft Draft. Geen merge, Production-deploy, productimport of databasewijziging. DESIGN.md en PR #37 ongewijzigd.


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
