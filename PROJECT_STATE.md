# Checkpoint — Shanghai safe_to_write PASS, write-volgorde geblokkeerd, 13 oktober 2026

- Branch `codex/shanghai-source-diagnostic-20261012`, Draft PR #90 open en mergeable. Remote main `46cd27f21e130c2dede46805eec65db08e10f42e`; geteste PR-head vóór deze documentatiecommit `8d74a3b27ed1c3394a457e83523fb012ea93b8e8`.
- Finale CI **#539** / run `38373105264` op `8d74a3b`: groen. Importer **501/501**, PostgreSQL **28/28**, web **887/887** in 74 bestanden, seedchecks, ESLint, TypeScript en Production-build groen; Vercel Preview-check groen. De expliciete `safe_to_write`-rapportage is met gerichte fail-closed regressietests gedekt en versoepelt geen bestaande gate.
- Dry-run **#27** / `38372720686` en **#28** / `38372724153` op `758044a`: beide PASS met `blocked=false`, source/parser verified, zeven supplementen, acht matchkeys, tien readiness-projecties, 13 unieke geplande records, blockers []; geen writes. #28 bevestigde onafhankelijk dezelfde head/input.
- Acceptance dry-runs **#29** / `38373889167` (job `115217305710`) en **#30** / `38373919887` (job `115217779455`), beide op `8d74a3b`: **PASS; letterlijk `safe_to_write=true`**, `blocked=false`, blockers []. Run #29 was al gestart door de repository-eigenaar voordat onze dispatch #30 werd ingediend; #30 wachtte op #29 en bevestigde dezelfde uitkomst. Exacte SKU `231215000`, HTTP 200, finale Shanghai-URL, contentroot `main:has(h1)`, instructiepaneel, parser en source verified. Zeven supplementen: 225 g mager rundergehakt, 250 g champignons, 125 g taugé, 3 bosuien, 1 ui, 1 prei, 30 ml olie. Zeven bestaande supplementmatches plus één geplande pakketmatch; readiness-projecties voor personen 1–10, source revision `22372`, blockers [], 13 unieke records en 14 geplande write-operaties. Beide runs bleven `dry-run`: **nul** Production-writes.
- **Harde volgordeblokkade:** bestaande workflow `.github/workflows/shanghai-bounded-writepad.yml` laat de PR-branch uitsluitend in `dry-run` toe; `assertShanghaiWriteArmed` in `apps/web/scripts/shanghai-writepad-core.mjs` eist voor `write` de exacte bevestiging, workflow_dispatch, poging 1 én `refs/heads/main`. Main bevat de PR-code nog niet. De gevraagde mergevoorwaarden eisen eerst Production-write plus verificatie. Een write vóór merge via het bestaande pad kan dus niet; de ref-gate versoepelen is uitdrukkelijk verboden. **Production-write 0, post-write nee, merge nee, release/smoke nee.**
- Exacte volgende stap na expliciete keuze over de volgorde: veiligst is na groene CI en `safe_to_write=true` PR #90 naar main mergen, daarna de op main bestaande bounded write-workflow met exacte bevestiging eenmaal uitvoeren, read-only verifiëren en pas dan release/smoke afronden. Dit wijzigt de door de gebruiker gestelde write-vóór-mergevoorwaarde; voer dit niet zonder aangepaste toestemming uit. Alternatief vereist bewuste nieuwe toestemming voor ref-gatewijziging. ROADMAP blijft open.

---

# Checkpoint — Shanghai dry-run PASS, expliciete write-gate wacht op CI, 13 oktober 2026

- Bestaande branch `codex/shanghai-source-diagnostic-20261012`, PR #90 open/Draft; remote `main` laatst `46cd27f21e130c2dede46805eec65db08e10f42e`. Code-head vóór dit checkpoint: `143877e69d647f88b3ec4ed704c7fe9f339c37dd`.
- Volledige CI **#534** / run `38372009141` op `758044a`: groen, inclusief importer, PostgreSQL, webtests, seedchecks, ESLint, TypeScript, Production-build; Vercel Preview groen.
- Bounded Shanghai dry-run **#27** / run `38372720686`, op `758044a`: **PASS**. Identiteit SKU 231215000/product `837af4a6-b7b6-4fd4-8eea-3437d4f138a7`, HTTP 200, finale Shanghai-URL, contentroot `main:has(h1)`, instructiepaneel en Boodschappenlijstje goed. Parser/source `verified`; zeven supplementen: 225 g mager rundergehakt, 250 g champignons, 125 g taugé, 3 bosuien, 1 ui, 1 prei, 30 ml olie. Acht matchkeys (zeven bestaande supplementmatches, één geplande pakketmatch), tien persoonsprojecties, source revision `22372`, `blocked=false`, blockers [], 13 unieke geplande records/14 write-operaties. **Geen write uitgevoerd**. Gelijktijdig gestarte tweede dry-run **#28** / run `38372724153` op dezelfde head ook groen; lees volledige rapport bij hervatting.
- Omdat de bestaande uitvoer geen letterlijk `safe_to_write` veld bevatte, voegen `2409366`, `ccead21`, `b293a9d` en test `143877e` een expliciete fail-closed data-gate toe: geen blockers, exact één pakketmatch, 13 unieke records, tien readiness-aantallen. Geen write-arming, ref-beperking of andere safety-gate versoepeld. Volledige CI **#538** / run `38373016820` op `143877e` was nog pending bij dit checkpoint.
- **Production-writes: 0.** Geen merge, deployment of smoke test. Exacte volgende stap: wacht op volledige groene CI op actuele head, doe één bounded dry-run en controleer `safe_to_write=true`. De bestaande Production-write workflow eist `refs/heads/main`; PR #90 is nog Draft en de gevraagde volgorde vereist write vóór merge. Verzwak die gate niet: bepaal na PASS een veilige, expliciet geautoriseerde volgorde of rapporteer deze concrete volgordeblokkade.

---

# Checkpoint — Shanghai readiness-preflight via bestaande cache, 13 oktober 2026

- Branch `codex/shanghai-source-diagnostic-20261012`, PR #90 open/Draft. Remote `main` laatst `46cd27f21e130c2dede46805eec65db08e10f42e`. Laatste code-head vóór dit checkpoint: `87a40e3a3065536d994dea4272e2df7790fb30c2`.
- Volledige CI #528 op `ab715ac` groen (importer 498/498, PostgreSQL 28/28, web 887/887; seedchecks, ESLint, TypeScript en build groen). Bounded dry-run #25, Actions `38369650436` op `d6f5f88`, en #26, Actions `38371283837` op `ab715ac`, faalden veilig met nul geplande/write-operaties. Beiden: juiste SKU/bron HTTP 200, contentroot, instructiepaneel, parser en zeven hoeveelheden verified. Eerste blocker `match_changes_across_people` voor supplement **champignons** van één naar vier personen: `product_id`, `product_updated_at`, `price_updated_at`. `safe_to_write=false`; Production-writes blijven **0**.
- De Shanghai-preflight gebruikte de ongebufferde evaluator en eiste identieke producten voor alle persoonsaantallen. De bestaande planner gebruikt bij een actuele supplementmatch juist `resolveRecipeReadiness` met opgeslagen matches en kandidaatproducten. Commit `43b4c68` laat alleen deze Shanghai-preflight dat bestaande pad gebruiken; `0dc8d47`/`00e9b5a` voegen een fail-closed scopecheck toe; `87a40e3` test de cache-/recipegrenzen. Geen algemene evaluator, parser, schema of safety-gate aangepast. Volledige CI op actuele head nog te controleren.
- Exacte volgende stap: wacht op volledige groene CI op de actuele PR-head; start daarna één bounded Shanghai `dry-run` op dezelfde branch. Lees het volledige rapport en verifieer vooral supplementmatch, projectie, `source_verified` en `safe_to_write`. Bij een nieuwe bewezen blocker uitsluitend die oorzaak repareren; geen Production-write zolang `safe_to_write` niet waar is. Bestaande write-workflow is bewust main-only en vereist exacte bevestiging; bij PASS moet de veilige merge/write-volgorde worden beoordeeld zonder die bewaking te verzwakken.

---

# Checkpoint — PR #90 Shanghai readiness-drift diagnose, 13 oktober 2026

- Remote `main`: `46cd27f21e130c2dede46805eec65db08e10f42e`. Bestaande branch `codex/shanghai-source-diagnostic-20261012`; PR #90 is open, Draft, mergeable. Laatste code-head vóór deze documentatiecommit: `d6f5f8813138e6d4a64bcb61348587ab93c3ff47`.
- Na de eerdere Shanghai-specifieke parserfix `cc6af32` zijn source/headless-fixes en readinessdiagnostiek op dezelfde branch gevolgd. CI #521 op `2a4ffdc` was volledig groen. CI #519/#520 faalden uitsluitend op te strenge of syntax-specifieke diagnostiektestassertions; die zijn op dezelfde branch gecorrigeerd.
- Bounded Production **dry-run #24**, Actions-run `38368528661`, attempt 1, op `2a4ffdc`: SKU `231215000`, juiste productidentiteit, HTTP 200, finale Shanghai-URL, contentroot `main:has(h1)` en instructiepaneel gevonden. De expliciete `Boodschappenlijstje`-sectie is geparsed; source/profile zijn `verified`. Zeven supplementen: 225 g mager rundergehakt, 250 g champignons, 125 g taugé, 3 bosuien, 1 ui, 1 prei, olie 30 ml. De bron vermeldde olie en twee bereidingsmetingen. De dry-run bleef `blocked` bij `readiness_row_projection` met exact `match_changes_across_people`; `sourceRevision=null`, `safe_to_write=false`, geplande/write-operaties 0.
- Bewezen technische oorzaak tot nu toe: voor één match-key verschillen bij projectie over personen 1–10 één of meer van product, matchstatus, reden of brontimestamps. Welke sleutel en welk veld verschilt, was in #24 nog niet zichtbaar. Daarom is de fail-closed Shanghai-preflight in commit `92b8407` uitgebreid met uitsluitend veilig begrensde diagnosevelden (matchtype, persoonsaantallen, vooraf toegestane gewijzigde veldnamen); testcommit `d6f5f88` controleert die grens. Geen product-ID, raw error of secret wordt in de nieuwe diagnose gerapporteerd.
- Volledige Core-CI **#523** / run `38368980882` op code-head `d6f5f88` is groen: importer **498/498**, PostgreSQL **28/28**, web **887/887** over 74 bestanden, plus seedchecks, ESLint, TypeScript en Production-build. Vercel Preview-check groen. De documentatiecommit kan een nieuwe CI-run starten; controleer die op de actuele PR-head.
- **Production-writes: 0**. Geen merge, database-migratie, import of Production-release. Exacte volgende stap: na volledig groene CI op de actuele branch-head één bestaande bounded `dry-run` voor SKU 231215000 starten, volledig rapport lezen, de eerste gewijzigde matchveldnaam/het matchtype toetsen, alleen die bewezen Shanghai-oorzaak repareren, tests/CI herhalen en verder tot `safe_to_write=true`.

---

# Checkpoint — Shanghai runtime-importfix en één nieuwe dry-run — 12 oktober 2026

## Minimale runtimefix en verificatie

- Remote `main` bleef **`46cd27f21e130c2dede46805eec65db08e10f42e`**. Bestaande branch `codex/shanghai-source-diagnostic-20261012`, Draft PR [#90](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/90).
- De bewezen `ReferenceError` is minimaal gerepareerd door de reeds geëxporteerde `SHANGHAI_PRODUCT_NAME` uit `shanghai-writepad-core.mjs` ook in `run-shanghai-bounded-writepad.mjs` te importeren. Geen selector-, parser-, source-verification- of projectionlogica is gewijzigd.
- Een regressietest controleert dat het gebruikte `SHANGHAI_PRODUCT_NAME` in het core-importblok van de runner aanwezig is. De bestaande source-probe blijft normale parserbereikbaarheid en fail-closed gedrag dekken.
- Core-CI **#38301333735** is groen op code-head **`5bf44d0401b277d80dcfebeccf36a4292155ea1f`**: importer **490/490**, PostgreSQL **28/28**, web **887/887**, seedchecks, ESLint, TypeScript en Production-build.

## Exact één nieuwe dry-run en stopgrens

- Handmatige Production dry-run **#38302190864**, attempt 1, draaide op exact `5bf44d0401b277d80dcfebeccf36a4292155ea1f`, branch `codex/shanghai-source-diagnostic-20261012`, met `SHANGHAI_WRITE_MODE=dry-run` en lege write-confirmation.
- De `ReferenceError` is verdwenen. De run bereikte de bron: HTTP **200**, finale URL `https://hoogvliet.nl/product/knorr-wereldgerecht-maaltijdpakket-chinese-beef-shanghai-231215000`.
- De run stopte vervolgens fail-closed bij de selector: contentroot `main:has(h1)` niet gevonden binnen de timeout; `error_stage=selector`, `error_type=TimeoutError`, `content_root_found=false`, `parser_status=not_reached`. Daardoor zijn `Gebruiksaanwijzing` en het ARIA-paneel niet bereikt, is geen broninhoud geparsed en bleef source verification uit.
- Identity is groen afgeleid uit het ontbreken van `product_identity_mismatch`; blockers zijn exact `source_unavailable`, `source_not_verified` en `recipe_projection_mismatch`. Geplande records en write-operations zijn allebei 0; `safe_to_write=false`.
- Stopregel gerespecteerd: geen selector-/parservervolgfix en geen tweede dry-run in deze opdracht. De eerstvolgende bewezen blokkade is dat de onafhankelijk in een interactieve live DOM waargenomen root niet verschijnt in de GitHub Actions-headless bronread.
- **Production-writes 0**, dry-runs in dit checkpoint exact 1, merge nee, import/migratie nee. `ROADMAP.md` blijft ongewijzigd omdat roadmap 1B nog actief is.

---

# Checkpoint — Shanghai source-readfix, eerste dry-run stopt vóór source-read — 12 oktober 2026

## Bewezen live DOM en patch

- Remote `main` bleef **`46cd27f21e130c2dede46805eec65db08e10f42e`**. Bestaande branch `codex/shanghai-source-diagnostic-20261012`, Draft PR [#90](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/90). Source-readfixcommit **`f2fc0f7c02a9e3d33fa1dc1a75a8b24e012ef587`**.
- Live DOM-inspectie bevestigde dat de oude selector `[data-testing-id="product-detail-page"]` 0 matches heeft en de semantische contentroot `main:has(h1)` exact 1 match. Deze root bevat exact de Shanghai-`h1`, `239 gram`, `Voor 2-3 personen` en, na het semantisch openen van de knop `Gebruiksaanwijzing`, het via `aria-controls` gekoppelde paneel met 225 g mager rundergehakt, 250 g champignons, 125 g taugé, 3 bosuien, 1 ui, 1 prei en olie.
- De begrensde Shanghai-reader wacht op `main:has(h1)`, vereist de exacte `h1` en exact één knop `Gebruiksaanwijzing`, opent die indien nodig, wacht op het gekoppelde ARIA-paneel en geeft daarna de roottekst aan de bestaande parser. De rootvalidatie vereist vóór parsing alleen exacte productnaam, 239 gram, 2–3 personen en `Boodschappenlijstje:`; de bestaande parser/supplement- en projectionvalidatie blijven intact.
- Regressies dekken de actuele root, onafhankelijkheid van de oude selector, parserbereik, ontbrekende root, malformed content, fail-closed/zero-write en veilige diagnostiek. Core-CI **#38298781970** is groen: importer **489/489**, PostgreSQL **28/28**, web **887/887**, seedchecks, ESLint, TypeScript en Production-build.

## Exact één nieuwe dry-run en stopgrens

- Handmatige dry-run **#38299370698**, attempt 1, draaide op exact `f2fc0f7c02a9e3d33fa1dc1a75a8b24e012ef587`, branch `codex/shanghai-source-diagnostic-20261012`, `SHANGHAI_WRITE_MODE=dry-run`, lege write-confirmation.
- De runner stopte onmiddellijk met veilige publieke uitkomst `{"status":"failed","sku":"231215000","sourceKey":"catalog-mix-231215000","code":"unexpected_writepad_failure"}`.
- Code-inspectie bewijst de oorzaak: `parseCurrentSource` gebruikt `SHANGHAI_PRODUCT_NAME`, maar de source-readfixcommit importeert die constante niet uit `shanghai-writepad-core.mjs`. Dit veroorzaakt een `ReferenceError` bij het opbouwen van de locator, vóór `page.goto`.
- Daardoor zijn in deze run identity, HTTP-status/finale URL, contentrootdetectie, parser, source verification en recipe projection **niet bereikt/niet geëvalueerd**. Er is geen bewijs uit deze run dat de nieuwe contentroot faalt; de runner bereikte hem niet.
- Stopregel gerespecteerd: geen automatische reparatie en geen tweede dry-run. Kleinste vervolgstap is afzonderlijk de ontbrekende bestaande constante-import toevoegen, een regressie/loadtest opnemen die de runner tot het source-readpad uitvoert, alle checks opnieuw groen krijgen en pas na nieuwe expliciete toestemming één volgende dry-run starten.
- **Production-writes 0**, dry-runs in dit checkpoint exact 1, merge nee, import/migratie nee. `ROADMAP.md` blijft ongewijzigd omdat roadmap 1B nog actief is.

---

# Checkpoint — Shanghai source-diagnostiek bewezen — 12 oktober 2026

## Branch, PR en tests

- Remote `main` bleef ongewijzigd op **`46cd27f21e130c2dede46805eec65db08e10f42e`**. Diagnosebranch **`codex/shanghai-source-diagnostic-20261012`**, Draft PR [#90](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/90), code-head **`899a1e7b3b236024d90a269977aa12bb2a082df1`**.
- De identity-gate accepteert uitsluitend voor SKU `231215000` de twee bewezen Shanghai-URL's; SKU, exacte naam, merk en verpakking blijven ongewijzigd streng. Er is geen algemene URL-normalisatie of fuzzy matching toegevoegd.
- Veilige, redacted source-diagnostiek rapporteert uitsluitend navigatiestatus, publieke finale Hoogvliet-URL, foutstadium/type, selector-/parserstatus en timeoutcategorie. De foutuitkomst blijft `source_unavailable`; foutmeldingen, bodies, headers, cookies, tokens en stacktraces worden niet gelogd.
- Core-CI run **#38297086728** is groen: importer `487/487`, PostgreSQL `28/28`, web `887/887`, plus seedchecks, ESLint, TypeScript en Production-build.

## Exact één Production dry-run

- Handmatige dry-run **#38297723917**, attempt 1, draaide op exact code-head `899a1e7b3b236024d90a269977aa12bb2a082df1`, branch `codex/shanghai-source-diagnostic-20261012`, met `SHANGHAI_WRITE_MODE=dry-run` en lege write-confirmation.
- Identity-resultaat: de actuele Production-URL-variant is geaccepteerd; `product_identity_mismatch` ontbreekt.
- Source-resultaat: navigatiestatus **200**; finale URL **`https://hoogvliet.nl/product/knorr-wereldgerecht-maaltijdpakket-chinese-beef-shanghai-231215000`**; `error_stage=selector`; `error_type=TimeoutError`; `selector_status=failed`; `parser_status=not_reached`; `timeout=true`.
- De echte oorzaak van `source_unavailable` is daarmee bewezen: de live pagina laadt succesvol, maar de writepad wacht op de verouderde selector `[data-testing-id="product-detail-page"]`, die niet verschijnt. De parser is niet aangeroepen.
- Finale beslissing: **blocked** met `source_unavailable`, `source_not_verified` en `recipe_projection_mismatch`; geplande records en write-operations zijn allebei 0. De job eindigde daarom verwacht met exitcode 1.
- Stopgrens gerespecteerd: exact één dry-run in dit checkpoint; geen tweede run, geen fetch/parserfix, geen merge, geen importer, geen migratie en **Production-writes 0**. De kleinste vervolgstap is een apart gereviewde, fail-closed Shanghai source-readfix die een bestaande bewezen contentroot/bronextractie hergebruikt, gevolgd door tests en pas na aparte toestemming één nieuwe dry-run.

---

# Checkpoint — Chinese Beef Shanghai bounded writepad Draft PR #89 — 12 oktober 2026

## Basis en PR

- Remote `main` is geverifieerd op **`29964fabfe3849ba7494b45cdcd7fc188333e326`**, de gemergede PR #88-parserfix. De Shanghai-parser blijft SKU-specifiek; dit checkpoint bouwt alleen het latere, afzonderlijk te autoriseren schrijfpad.
- Draft PR [#89](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/89), branch `codex/shanghai-bounded-writepad-20261012`; code-/testcommit **`e40cbbafa5469cd4049634dc992ae21fc69f8702`**. PR #70 is niet gewijzigd.
- Alleen een handmatige `workflow_dispatch`; SKU en `catalog-mix-231215000` zijn vast gecodeerd. Standaard is dry-run. Write vereist exacte bevestiging `WRITE_ONLY_SHANGHAI_231215000`, repository `main` en run attempt 1. Geen vrije SKU-input, schedule, algemene maintenance-modus of automatische write-retry.

## Preflight en begrensde writes

- De dry-run controleert exacte product-/bron-/profile-identiteit, status `needs_review`, lege recipe-link en profile, parser-versie 5, geverifieerde live bron, de zeven bewezen supplementen, drie porties, 40 minuten, ontbrekende recipe `source_key`, zeven current geldige supplementmatches en afwezigheid van de nieuwe pakketmatchcache.
- De bestaande profile-onderhoudsparser en `profileRecipeRow`, readiness evaluator/`rowsForGate` en transactionele `commit_bounded_readiness` worden hergebruikt. Na CAS-linking van recipe/profile commit de cachetransactie alleen de ene nieuwe Shanghai-pakketmatch plus readiness voor personen 1–10. De zeven bestaande supplementmatches zijn read-only; andere profielen of subscribers op die keys worden niet geüpsert of geïnvalideerd.
- Succesvolle doelrecords: **13 uniek** — 1 recipe, 1 `meal_mix_profiles`, 1 `ingredient_product_matches`, 10 `recipe_readiness_cache`. Verwachte applicatie-rijwrites: **14** — profilelink (1), recipe (1), nieuwe match (1), readiness (10), profile-cachestatus naar `current` (1). Interne CAS-/revision-counterwrites vallen buiten die applicatietelling.
- De bestaande `bounded_readiness_state`-RPC is niet aan `service_role` toegekend. Dry-run toont daarom de beschikbare catalogus-`sourceRevision` en `casRevisions=null`; na de profilelink haalt de runner via de bestaande bounded planner een verse CAS-snapshot/token op en valideert die opnieuw in de commit-RPC.
- Recipe-insert, profile-CAS en readinesstransactie zijn drie gefaseerde stappen omdat er geen bestaande transactie is die recipe plus profile omvat. Een fout na recipe-insert kan een ongekoppelde recipe achterlaten. Een fout na de profile-CAS kan een gekoppelde profile met `cache_status=pending` achterlaten. De readiness-RPC is atomair; er ontstaat geen gedeeltelijke readinessset. De profile wordt pas `cache_status=current` na post-write readback.

## Verificatie en stopgrens

- Shanghai-writepad + meal-mix parserregressies: **2 testbestanden groen**. Relevante readiness/cachetests: **109/109 groen**. `npm run check`, ESLint op runnermodules, workflow-YAML-parse en `git diff --check` groen.
- `actionlint` was niet geïnstalleerd. Runner-import eindigde zonder secrets vóór databaseclientgebruik op `database_credentials_missing`; dit was alleen een lokale loadcheck.
- Geen Production-write, workflowdispatch, import, migratie, merge of Production-deployment uitgevoerd. Het openen/updaten van de Draft PR laat de gekoppelde Vercel Preview automatisch bouwen; geen Preview is handmatig gedispatched. `ROADMAP.md` ongewijzigd. Na Chinese Beef Shanghai blijven de overige Honig/Knorr `NO_RECIPE`-profielen geparkeerd en gaat ontwikkeling verder naar Slim Zoeken.

# Checkpoint — PR #87 release, bounded cacheherstel en roadmap 1A.1 — 12 oktober 2026

## Release en cacheherstel

- PR #87 is squash-gemerged als **`6d78d644776d001cf3c789ef27af41126da88ad7`**; remote `main` staat op dezelfde SHA. Post-merge Core-CI **#38234846985** slaagde. Vercel Production deployment **`dpl_5oZPJTv9WbprZD43aunvyf8pyemw`** is **READY** op die SHA.
- Eenmalige bounded recovery-run **#38236050728** slaagde op die main, poging 1. Na verse authenticated dry-run en exacte scope/CAS/dependency/tokenvalidatie volgde één commitrequest zonder retry.
- Geschreven scope: exact **3 matchrijen + 70 readinessrijen**, effecten buiten scope **0**. Onafhankelijke read-only nacontrole bevestigde **3/3** matches en **70/70** readinessrijen CURRENT, zonder invalidatie; matcher/evaluator-versie 5, geldige payloads en toekomstige expiry. Readiness: **10 READY, 60 NOT_READY**. De overige **660** pending rijen vielen buiten scope en zijn niet gewijzigd. Planner-/budgetuitkomsten zijn niet via een mogelijk schrijvende lazy-refreshroute opgehaald.

## Hoogvliet-fallback — bewijsstatus 1A.1

- Zyte-proofrun **#38046108912** slaagde: **6 attempts, 6 successes, 0 failures**. Alle zes responses hadden API-/bronstatus 200, 30 unieke SKU's en dezelfde listingidentiteit; de bestaande parser bevestigde hydratatie. Latency: **5,211–10,096 ms**.
- Volledige Production-maintenance-run **#38125867253** slaagde vanaf main SHA `82b66be59cb565b23052fdf0ce6ad495206db17f`. De bestaande joblog rapporteert **430** primaire listingwindows, **0 Zyte attempts**, **0 provider requests**, **0 successes**, **0 failures**, `fallback_provider=zyte` en `snapshot_complete=true`. De run rapporteerde 526 bestaande prijsupdates en 0 nieuwe producten. Er is geen Bright Data-call in deze run geregistreerd.
- **Technisch bewezen:** de aparte Zyte-proofrequests werken met de bestaande parser; de volledige productie-import voltooide een complete snapshot zonder fallback nodig te hebben; de fallbackcode en safeguards zijn gereleased.
- **Financieel niet bewezen:** de logs bevatten geen factuurbedrag of afgerekende kosten. Er is geen Bright Data-gebruik of providerfactuur beschikbaar in de onderzochte rungegevens. De actuele Bright Data/Zyte-kostenvergelijking is daarom nog niet controleerbaar.
- Roadmap **1A.1 blijft open** tot die financiële vergelijking uit bestaande provider-/factuurgegevens is vastgelegd. Dit is het kleinste resterende checkpoint; er is geen nieuwe import of providerproef nodig. Als historische providergegevens ontbreken, blijft het kostencriterium onbewezen tot afzonderlijke toestemming voor eventueel nieuw bewijs.
- Roadmap **1B is actief**. De zeven Knorr-links en hun gerichte readiness zijn eerder bevestigd; de eerstvolgende 1B-inhoudsstap is brongebaseerde beoordeling van de resterende Honig/Knorr `NO_RECIPE`-profielen. Geen profielen of caches wijzigen zonder aparte scope/toestemming.

- In dit checkpoint zijn uitsluitend bestaande logs/metadata gelezen en documentatie bijgewerkt. Geen workflowdispatch, import, Production-write, migratie of deployment uitgevoerd.


# Checkpoint — 1A.1 planner-cacheherstel na prijsupdates — 12 oktober 2026

## Deelcheckpoint — gedeeltelijke cachewrite hersteld

- PR [#85](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/85), branch `codex/planner-price-cache-recovery-20261012`; code-/testcommit **`695eec450ed725e44866f7de7fbd27b75756007b`**, gebaseerd op remote `main` `82b66be59cb565b23052fdf0ce6ad495206db17f`. Geen nieuwe PR, migratie of databasefunctie.
- Bewezen foutpad gerepareerd: na een geverifieerde match-upsert vangt de route uitsluitend readiness-upsert-/readbackfouten op als bounded-recoverykandidaat. De al vastgelegde scope gaat via één bestaande bounded dry-run en `commit_bounded_readiness`; overige fouten blijven direct fail-closed.
- De preflight bewaart kandidaat-matchkeys uit zowel pending matches als pending readiness-dependencies, begrensd tot actuele recipe requirements. Hij bewaart ook de subscriber-/dependency-snapshot vóór writes. Vóór commit controleert de route opnieuw subscribers en vergelijkt dependencykeys met de dry-run; afwijking, geweigerde scope, stale token/CAS-conflict of overschrijding stopt zonder CURRENT-resultaat. Bij een latere poging kan een current matchkey opnieuw worden gevonden via de nog pending readiness-dependency.
- Na bounded commit worden match- en readinessstatussen opnieuw uit de database gelezen; alle readinessvarianten 1–10 moeten current en niet geïnvalideerd zijn. De bestaande `bounded_only` guard, service-role RPC-grant, scopegrenzen, verse plan-token en CAS zijn ongewijzigd.
- Regressietests A–F toegevoegd voor gedeeltelijke write, herafleiding na current match, geweigerde dry-run, geweigerde/stale commit, opgeslagen 1–10-verificatie en herhaalde refresh zonder extra writes. Gerichte cache-/bounded-/transactietests **34/34**, planner-/week-/budgetregressies **133/133**, ESLint, TypeScript en `git diff --check` groen. Geen Production-tests of writes.
- CI en Vercel Preview voor de nieuwe PR-head worden na push gecontroleerd. Geen merge, Production-import/write, migratie, deployment of wijziging aan PR #84 uitgevoerd.

- Basis: actuele `origin/main` **`82b66be`**; PR #84 bleef ongemoeid. Werkbranch: `codex/planner-price-cache-recovery-20261012`.
- Bewezen oorzaak: `planner_cache_write_guard` zet readiness-upserts van oude schrijvers voor `bounded_only`-resources terug naar `pending` (`transactional_refresh_required`). De bestaande lazy planner-refresh schreef via PostgREST, controleerde de teruggeschreven status niet en telde evaluaties als verversingen. Daardoor leek onderhoud geslaagd terwijl opslag `pending` bleef. Dezelfde route wordt vanuit de planner op gebruik gestart; er is geen geplande achtergrondtaak aangetoond.
- Gerichte reparatie: normale match- en readiness-upserts lezen de werkelijk opgeslagen cachestatus terug. Als readiness door de guard niet `current` is, stopt die route met gewone schrijvers en gebruikt zij één nieuwe bounded dry-run plus `commit_bounded_readiness` met het verse plan-token. De recovery neemt alleen vooraf pending matchkeys en hun bestaande readiness-subscribers mee; scope groter dan 10 recepten of 10 matchkeys, een geweigerde scope, conflict, of opslagverificatie die faalt eindigt gesloten met een fout. De transactie verifieert na commit opnieuw alle matchrijen en readinessvarianten 1–10.
- De databaseguard, import, prijsupdates, triggers en bestaande bounded autorisatie zijn niet gewijzigd. Er was geen databasewijziging nodig. Er is geen retry-loop; het bestaande plannerverzoek blijft de automatische, luie trigger. Een pending cache wordt dus hersteld wanneer de planner die cache opvraagt; er is geen zelfstandige geplande rebuild toegevoegd.
- Tests op deze branch: gerichte planner-/bounded-/weekplanner-/budgetsuite **157/157** groen; lokale disposable PostgreSQL-guard-/rollback-/concurrency-suite **25/25** groen; web TypeScript-check, gerichte ESLint en `git diff --check` groen. De ketentest simuleert guard-downgrade → één bounded commit → verificatie van tien personenvarianten; een geblokkeerde preflight doet geen commit.
- Nog niet bewezen: echte Production-readinesscache is door deze code niet aangeraakt. Na normale review, merge en deployment vereist acceptatie een afzonderlijk toegestane planner-refresh van de getroffen scope, gevolgd door read-only controle van de precieze matchkeys en alle readinessrijen voor personen 1–10. Geen merge, Production-write, import, migratie of deployment uitgevoerd.

---

# Checkpoint — bounded planner-cache GitHub runner dry-run-only voorbereiding — 12 oktober 2026

## Actuele basis en bestaande route

- Remote `main` is geverifieerd op `fafbc62ca118892c10b14531bc848ab3faedbfa6`; PR #85 is gemerged. Vercel Production deployment `dpl_9Dpgw1rG8UKS7eYWTMj9g27CAtUV` is `READY` op exact dezelfde SHA. De bestaande Production-route is `POST /api/internal/planner-readiness/bounded-refresh`.
- De route verwacht JSON met `recipeIds`, `matchKeys` en `mode: "dry-run"`; authenticatie gebruikt `Authorization: Bearer <PLANNER_CACHE_ADMIN_TOKEN>` en de bestaande Vercel-protection-header `x-vercel-protection-bypass` met `VERCEL_AUTOMATION_BYPASS_SECRET`. De route controleert admin-auth vóór requestverwerking en retourneert een transactionele dry-run-snapshot met requested/resolved scope, subscribers, source revision, CAS-revisions, geplande write-aantallen en plan-token. Er is geen directe Supabase-SQL/RPC-route toegevoegd.
- Bestaande `.github/workflows/bounded-production-recompute.yml` was handmatig, maar vroeg onbeperkte vrije recipe-ID-JSON en de runner bevatte een `RECOMPUTE_ARMED=true` commitpad. Daarom was die nog niet passend voor permanent dry-run-only gebruik.

## Voorbereiding op bestaande featurebranch

- Hergebruikt `codex/checkpoint-14a-bounded-runner`, de al gemergede PR #43-runnerbranch; geen nieuwe branch gemaakt. De branch is fast-forward bijgewerkt naar de actuele main. Nieuwe Draft PR **#86** staat open op die branch; PR #43 blijft ongemoeid/gesloten.
- Workflow heeft uitsluitend `workflow_dispatch`, zonder inputs, is begrensd tot repository `boodschappenmaatje/Boodschappenmandje-importer`, branch `main` en eerste runpoging, met bestaande GitHub Actions-secrets `PLANNER_CACHE_ADMIN_TOKEN` en `VERCEL_AUTOMATION_BYPASS_SECRET`. De Production-origin staat vast in workflowcode; er zijn geen Supabase-credentials nodig.
- Runner bevat nu alleen één POST met `mode: "dry-run"`; het commitpad, armingflag en vrije recipe-ID-input zijn verwijderd. De zeven goedgekeurde recipe-ID's en drie matchkeys staan vast in de runner. Hij stopt fail-closed op auth-/HTTP-/JSON-fouten, blocked plan, afwijkende recipe-/matchkey-/subscriber-scope, onverwachte dependencies, readinesscount boven 70, ontbrekende bronrevision/CAS of ongeldig plan-token. Er zijn geen retry, import, refresh, migration of extra requestparameters.
- Resultaatlogging bevat scope/aantallen en revisionsnapshot; plan-token en credentials worden niet gelogd. Historische 38 dependencykeys zijn geen harde actuele eis; de live response moet wel de exacte goedgekeurde matchkeys bevatten en `unexpectedDependencies=[]` teruggeven.
- De secretnamen zijn door bestaande workflows gebruikt; deze sessie kon de actuele secretmetadata niet uitlezen via de beschikbare GitHub-interface. Secretwaarden zijn niet benaderd. Als een benodigde secret ontbreekt, stopt de runner vóór het HTTP-request.

## Verificatie en stopgrens

- Gerichte runner-tests: **12/12** geslaagd. `node --check`, YAML-parse/structuurchecks en `git diff --check` geslaagd. `actionlint` is in de omgeving niet beschikbaar. Het openen van PR #86 startte automatisch Vercel Preview-builds: deployment `dpl_EdG8V6vEowYHXockQfdZ4gw91b5y` op de eerste PR-head bereikte `READY`; latere builds `dpl_HUkpRUSDVf564PoY5kT6jQegGgik`, `dpl_7w7vp1JqwzeCddo2HDDcvSmxAEfB`, `dpl_Gu1uVPCDeyE55JKVLcLb1NDaEatC` en `dpl_FYzYAXHiNYSZURPqZpeoaTR86bc3` zijn geannuleerd. Geen Production deployment is gestart.
- Geen Production-request of workflowdispatch uitgevoerd. Geen bounded commit, planner-refresh, import, database/migrationwijziging, deployment of merge uitgevoerd. `ROADMAP.md` ongewijzigd.
- Volgende uitvoerstap ná PR-review/merge en bijbehorende Production-deployment: controleer workflow op `main` en de secret-aanwezigheid via GitHub Actions-instellingen; start daarna uitsluitend handmatig vanaf `main` de `READ ONLY — NO REPAIR | bounded Production recomputation` dry-run. Vereist afzonderlijke expliciete gebruikersgoedkeuring vóór dispatch. Een groen resultaat bewijst de actuele scope; geen vervolgcommit vanuit deze workflow.

---

# Checkpoint — Knorr zeven Production-links bevestigd — 11 oktober 2026

- PR #80 en #81 zijn gemerged op main; PR #81 mergecommit `242fabcd55089e7bcdfea988aa5c2e0ca84a54f0`. PR #70 blijft een afzonderlijk auditcheckpoint; niet gewijzigd.
- Geautoriseerde GitHub Actions dry-run op 10 oktober 22:30 UTC: `status=dry-run`, `evaluationMode=preflight`, `candidatesChecked=7`, `validLinks=7`, totale writes **0**.
- Vervolgens expliciet geautoriseerde write-run op 10 oktober 22:34–22:37 UTC: `status=complete`, `evaluationMode=preflight`, `candidatesChecked=7`, `validLinks=7`, `writes.recipeIds=7`, `writes.readinessCache=70`, `writes.ingredientMatchCache=0`, `writes.total=77`, `stopReason=null`. De eerdere write-poging zonder bevestiging stopte veilig met `write_confirmation_rejected` en 0 writes.
- Onafhankelijke read-only Production-Supabase-controle na de write-run: alle zeven exacte SKU→recipe-ID-links zijn correct; elk heeft tien cache-rijen voor persoonsaantallen 1–10 (70 totaal). Zes recepten hebben 10/10 READY; Japanse teriyaki SKU `704892000` heeft 0/10 READY en blijft terecht NOT_READY. Alle zeven profielen blijven `needs_review`, `profile=null`. Geen profielpromotie of geforceerde matches.
- Deze documentatie-update voert uitsluitend read-only databasecontrole en GitHub-documentatiewijzigingen uit; geen extra Production-write, refresh, import, migratie of deployment. De zeven-links-writegate is afgerond; roadmap 1B blijft gedeeltelijk actief voor de overige NO_RECIPE-profielen en brongebaseerde beoordeling.

---

# Checkpoint — zichtbare Knorr dry-run-uitkomst — 10 oktober 2026

- Basis: remote `main` **`1e8330bd95ed1cbda940a5e7f63211bcaaaab1f9`** bevat gemergede PR #80. PR #70 blijft open/Draft/ongemergd en is niet gewijzigd. GitHub Actions-run `38090505561` / job `114325781790` eindigde succesvol vanaf deze main-SHA, maar na de runnerstap volgde direct cleanup zonder JSON-resultaatregel.
- Bewezen oorzaak: `runKnorrRecipeLinks` gaf het succesvolle resultaat door aan `dependencies.log`, waarvan de standaardimplementatie `() => {}` was. Het CLI-entrypoint schreef alleen in de `.catch`-fouttak JSON naar stderr. Daardoor kon de succesvolle Promise afronden en Node met exitcode 0 stoppen zonder enige stdout-uitkomst; er was geen bewijs in die joblog dat de zeven kandidaten geldig waren.
- Reparatie: de kernrunner retourneert uitsluitend zijn resultaat. Het CLI-entrypoint valideert daarna opnieuw het succesvolle preflight-/allowlist-/writecontract en schrijft exact één veilige JSON-regel met `status`, `evaluationMode`, `candidatesChecked`, `validLinks`, uitgesplitste en totale writes en `stopReason`. Een ontbrekend of ongeldig resultaat stopt met `runner_result_missing_or_invalid`; preflight-, timeout- en andere fouten blijven een gestructureerde `stopped`-regel geven en zetten de exitcode op 1.
- Alle bestaande grenzen blijven intact: zeven vaste mappings, dry-run-default, Production-auth en bypass, vaste 20-seconden-preflightdeadline, geen retries, writeconfirmation, branch-/attemptguard, readinesscontract en partial-write stop. Workflow en Production-code zijn niet gewijzigd.
- Verificatie: gerichte runner-suite **15/15** groen, inclusief zichtbare succesvolle dry-run, ontbrekend resultaat, ongeldige preflight, timeout en nul databasewrites. Root `npm test` **459/459** groen; `npm run check`, `node --check scripts/run-knorr-recipe-links.mjs` en `git diff --check` groen.
- Branch `codex/knorr-dry-run-result-output-20261010`; Draft PR [#81](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/81). Lokale fixtures bewijzen het uitvoercontract, niet dat de historische groene run 7/7 was. Definitieve acceptatie vereist na review/merge/deployment één afzonderlijk toegestane dry-run vanaf de nieuwe main; die moet de nieuwe JSON-regel tonen en live 7/7 plus nul writes bewijzen.
- Production-writes **0**; geen Production-POST, workflowdispatch, recipe-link-write, readiness-refresh, databasewrite, migratie, merge, secretwijziging of Production-deployment uitgevoerd.

---

# Checkpoint — begrensde Knorr Production-preflight — 10 oktober 2026

- Basis: remote main `42401a024b3513299d152bfb157d9690a8103a16` bevat gemergede PR #79. De handmatige dry-run van 21:56 UTC startte correct maar stopte vóór responseheaders met `production_preflight_timeout`, fase `response_headers`, na de vaste 20-seconden-deadline; `changedSkus=[]` en `readinessRefreshedSkus=[]`. PR #70 blijft open/Draft/ongemergd en is niet gewijzigd.
- Bewezen codeoorzaak: de Production-route herkende `preflight: true`, maar zette alleen `persist:false`. De gedeelde service las alsnog de bestaande readinesscache en voerde daarna voor één allowlisted recept alle **10** persoonsaantallen sequentieel door `evaluateRecipeReadiness`. Kip Siam heeft vier recipe-ingredients; iedere evaluatie herhaalt dezelfde catalogus-/productmatching en bijbehorende databasezoekopdrachten. De preflight deed daarmee vrijwel het volledige refresh-rekenwerk voordat Vercel responseheaders kon sturen. Er is geen middleware/rewrite in de webapp; onjuiste auth, redirect of Vercel-protection zou als afzonderlijke HTTP-/redirectfout worden geclassificeerd, niet als de gemeten headers-timeout.
- Reparatie op `codex/knorr-preflight-bounded-evaluation-20261010`: de bestaande route/auth/service blijven leidend, maar de Production-preflight gebruikt een expliciete read-only evaluatiemodus. Die valideert hetzelfde allowlisted SKU/recept/profiel/receptingrediëntencontract, laadt dezelfde catalogus en voert de normale evaluator exact eenmaal uit voor vier personen. Bij `persist:false` wordt de nutteloze readinesscache-read overgeslagen. De response benoemt `evaluationMode=preflight`; de runner eist exact die mode, één 4-persoonsresultaat en nul readiness-/matchcachewrites.
- De gewone gerichte refresh blijft `evaluationMode=full`, eist in de runner nog steeds 10 unieke persoonsresultaten en behoudt de bestaande readinesscache-writegate. De service weigert `evaluationMode=preflight` wanneer `persist:true`; zeven-SKU-allowlist, auth, Vercel-bypass, exacte write-confirmation, recipe-link-CAS, partial-write stop en geen-retryrails blijven staan. De 20-seconden-deadline is niet verhoogd.
- Verificatie: gerichte runner **11/11**; gerichte service-/route-tests **18/18**. De regressie bewijst één evaluatie voor vier personen, geen readinesscache-read, nul databasewrites en expliciete weigering van persistente preflight; full refresh blijft tien evaluaties uitvoeren. Root `npm test` **455/455** en `npm run check` groen. Web `npm run check`: lint, TypeScript, **878 tests** en production build groen. `git diff --check` groen.
- Dit bewijst en repareert het onbegrensde codepad; lokale tests bewijzen nog niet dat Production binnen 20 seconden antwoordt. Resterende acceptatie na review/merge/deployment: exact één afzonderlijk toegestane dry-run vanaf nieuwe main moet live `evaluationMode=preflight`, één readinessrij, 7/7 kandidaten en nul writes bevestigen.
- Production-writes **0**; geen Production-POST, workflowdispatch, recipe-link-write, readiness-refresh, databasewrite, merge, secretwijziging of Production-deployment uitgevoerd. Branch `codex/knorr-preflight-bounded-evaluation-20261010`, codecommit `5ad6d21`, Draft PR [#80](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/80). ROADMAP blijft ongewijzigd.

---

# Checkpoint — Knorr preflight network/timeout-diagnose — 10 oktober 2026

- Remote main `02577fef64bf4fd46d4acc125b63ae629531cfe2` bevat gemergede PR #78. De eerste handmatige dry-run `38087794048` draaide vanaf die SHA en faalde met `production_preflight_network_or_timeout`; `changedSkus=[]`, `readinessRefreshedSkus=[]`. PR #70 blijft open/Draft/ongemerged.
- Request: POST naar `https://boodschappenmaatje-pwa.vercel.app/api/internal/planner-readiness/explicit-recipe-refresh`, `redirect: manual`, deadline 20.000 ms, bestaande Bearer-auth plus Vercel bypass-header, één exact allowlisted paar en `preflight: true`. De route ondersteunt dit met `persist: false`. Production-alias wijst naar Ready-deployment `dpl_FBcZmqr4PWy2Ei85dMKFGTKo8yro` van dezelfde main-SHA.
- De precieze historische transport-/vertragingsreden is niet bewezen. GitHub runmetadata is beschikbaar, maar ophalen van run-/joblogs geeft HTTP 403. Vercel geeft geen passende runtime-logs/errors in 21:29–21:31 UTC; ontbrekende applicatielogs bewijzen geen ontbrekende invocation. De lokale HEAD-controle werd vóór TLS door de workspaceproxy geweigerd (CONNECT 403); dit is geen bewijs over GitHub→Production. Vercel protection-/redirectblokkade of trage evaluator is niet vastgesteld.
- Wel bewezen codegebrek: de catch gooide iedere oorspronkelijke fetch-fout weg en voegde netwerkfouten en timeout samen. Een timeout tijdens response-body-read werd bovendien als invalid JSON gemeld.
- Kleinste diagnostische fix op `codex/knorr-preflight-error-diagnosis-20261010`: aparte timeout-/network-/HTTP-/redirect-/JSON-codes, herkenning van verlopen AbortSignal en TimeoutError, vaste requestfase en uitsluitend allowlisted transportcodes. Geen exceptionmessages, headers, secrets of vrije URLs worden gelogd. Deadline, authketen, preflight-payload, route/service, zeven mappings, write-confirmation en partial-write stop zijn behouden. Geen retry toegevoegd.
- Gerichte Knorr regressies **11/11** groen, inclusief headers-/body-timeout, AbortError bij verlopen deadline, DNS/connect-timeout, HTTP/redirect, secretredactie en nul writes na falen; `node --check` en `git diff --check` groen. Draft PR [#79](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/79), codecommit `4053fa3`; dit is een diagnosefix en bewijst nog niet de oorzaak van de historische run.
- Production-writes **0**; geen workflowdispatch, Production POST/readiness-refresh, databasewrite, merge of Production-deployment uitgevoerd. Volgende bewijsstap: read-only Vercel request/invocation-trace voor deze route in het runvenster correleren met ontvangst, status en duur. Geen nieuwe dry-run zonder afzonderlijke toestemming.

---

# Checkpoint — GitHub Actions HTTP 422 Knorr-workflow — 10 oktober 2026

- Basis: remote main `f3498711e6a06c3f8aba42e945f74bd73b6645cc` (PR #77 gemerged). PR #70 blijft open/Draft/ongemerged en is niet gewijzigd.
- Exacte oorzaak: `.github/workflows/knorr-recipe-links.yml` regel 15 bevatte een ongequote beschrijving met `write: `; die dubbele punt plus spatie maakt de YAML ongeldig. PyYAML en actionlint reproduceren de parsefout op die regel. GitHub push-run `38085508641` faalde op de workflowfile, vóór jobs; de eerdere dispatch werd afgewezen met HTTP 422, zonder dispatch-run.
- Registratie-ID `380798917` is actief en wijst naar het juiste pad; default branch is main. API-content en remote git hebben dezelfde blob `49030b78299add14c500549cb7afae08f35b6ae9`. Geen aangetoond registratie-/padverschil. `on` is een geldige GitHub Actions-key; PyYAML SafeLoader behandelt hem volgens YAML 1.1 als boolean, terwijl BaseLoader de stringkey behoudt. Dat parserverschil veroorzaakt deze 422 niet.
- Kleinste fix: quote uitsluitend de confirmation-inputbeschrijving. Runner, zeven mappings, dry-run-default, read-only auth-preflight, write-confirmation, main-/attemptguard en partial-write stop zijn behouden.
- Branch `codex/fix-knorr-workflow-yaml-20261010`; codecommit `f91a385`; aparte Draft PR [#78](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/78). ROADMAP blijft ongewijzigd.
- Verificatie: actionlint **1.7.12** verwerpt de originele YAML en accepteert de gecorrigeerde workflow; YAML-parse plus exacte workflow_dispatch-inputs/defaults geslaagd; bestaande Knorr runner-tests **9/9** groen; `git diff --check` geslaagd.
- De gecorrigeerde workflow is lokaal aantoonbaar geldig. GitHub-registratie als dispatchable op main kan pas na merge worden bevestigd; er is geen dispatch gebruikt om dit te testen.
- Production-writes **0**; geen workflowdispatch, Production dry-run, readiness-refresh, databasewijziging, merge of handmatige deployment uitgevoerd. Volgende stap: review en afzonderlijke mergegoedkeuring voor de Draft PR, daarna read-only registratiecontrole op main en pas met expliciete toestemming één dry-run.

---

# Checkpoint — PR #71 release en actieve 1B-writegate — 10 oktober 2026

## Release op actuele main

- PR [#71](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/71) is gemerged. Actuele remote `main` en mergecommit zijn **`4754d127c8a1edc71f261682dea8c9b3ed20a1d4`**. De finale PR-checks waren groen; de Production-build slaagde op exact deze SHA.
- Production deployment is **Ready**, deployment-ID `dpl_J2sHLy4LrGGDitUCXEeSJjdV24Lt`. Production smoke gaf HTTP 200 voor `/week-voorbereiden`, `/budget` en `/lijst`.
- De veilige explicit-recipe readiness-flow voor bewezen links van `needs_review`-profielen staat in Production. De read-only GET is bewust Preview-only; een Production GET geeft daarom verwacht `404 not-found`. Er is geen afzonderlijke GitHub Actions main-run op de mergecommit vastgesteld.
- Tijdens de release waren recipe_id-writes **0**, readiness-refreshwrites **0** en profielstatuswijzigingen **0**. Er is geen recipe- of profieldata gewijzigd en geen readiness-refresh uitgevoerd.
- PR [#70](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/70) blijft open, Draft en ongemerged als audit/documentatiecheckpoint.

## 1B-status en volgende gate

- Roadmap 1B blijft actief. De veilige readiness-ondersteuning is gereleased, maar de zeven bewezen Knorr recipe-links en hun gerichte readiness-refresh zijn nog niet uitgevoerd.
- Previewbewijs vóór release: 6 van de 7 recipes waren READY voor 1–10 personen. SKU `704892000` (Japanse teriyaki) bleef NOT_READY met twee echte readinessproblemen; niets is geforceerd en `needs_review` bleef behouden.
- Volgende afzonderlijke Production-writegate: alleen de zeven bewezen koppelingen voor SKU's `686060000`, `686150000`, `704884000`, `704888000`, `704892000`, `704897000` en `704898000`, gevolgd door uitsluitend hun gerichte readiness-refresh. SKU `704881000` blijft uitgesloten. Andere NO_RECIPE-profielen vragen daarna nog brongebaseerde beoordeling. Geen van deze Production-writes is in dit checkpoint uitgevoerd.

---

# Checkpoint — 1B expliciete recipe-link readiness-flow — 10 oktober 2026

## Releasebasis en auditcheckpoint

- Deze codebranch is gebaseerd op remote `main` **`9922b4b666c89fed42104b0700e5cd690e6b6459`**. PR [#70](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/70) blijft een aparte open Draft PR voor de 1B audit/documentatie; de code in dit checkpoint wordt apart ingediend.
- De release-/maintenancebasis uit PR #70 is PR #69 op dezelfde main-SHA: volledige Hoogvliet dry-run **38061167591** `PASS`, `snapshot_complete=true`; maintenance write-run **38063646183** `PASS`. De run controleerde 7.945 SKU's (7.616 bulkprijschecks, 329 detailfallbacks), wijzigde 562 bestaande prijzen, liet 7.383 gelijk, voegde 0 producten toe en behield 414 Production-only SKU's. Snapshotduplicaten: 0. Postcheck: 8.362 producten/prijsrecords met unieke SKU's, 0 ongeldige/nulprijzen, 520 offers en 0 actieve jobs/locks/attempts/imports. Dit checkpoint start geen nieuwe importer- of Production-run.

## Root cause en invariant

- `/api/internal/planner-readiness/mix-refresh` eist `meal_mix_profiles.status = verified`. Deze check beschermt de plannercontracten: alleen een inhoudelijk geverifieerd profiel met bruikbare profieldata mag als maaltijdmix aan de planner worden aangeboden. De normale recipe repository filtert recipes met niet-verified mixprofielen uit de plannercatalogus.
- De route riep ook `refreshPlannerReadiness` aan, dat via `persistGate` zowel `recipe_readiness_cache` als `ingredient_product_matches` upsert. De route rechtstreeks verruimen zou dus status-/profielbescherming omzeilen én cachewrites buiten de gewenste scope kunnen doen.
- Een exact bewezen SKU→bestaand-receptlink bewijst alleen de link. Het bewijst geen volledig profiel. De nieuwe flow laat daarom `needs_review` en `profile = null` staan en kan alleen de gewone ingredient-/product-/prijsregels van de bestaande readiness-evaluator toepassen.

## Implementatie en grenzen

- Nieuwe interne expliciete readiness-flow accepteert alleen de zeven gereviewde Knorr SKU→recipe-ID-paren uit de audit. SKU, Knorr-merk, profielstatus/leeg profiel, eventuele bestaande `recipe_id`, recipe-bestaan en minimaal één gekoppelde recipe-ingredient worden gevalideerd; `704881000` is uitgesloten.
- Alleen het aangevraagde recipe-ID wordt via een expliciete repository-optie tijdelijk in de interne evaluatiecatalogus toegelaten. De evaluator blijft `evaluateRecipeReadiness`; er is geen tweede readiness-engine of kunstmatige match.
- De geautoriseerde refresh mag uitsluitend `recipe_readiness_cache` voor dat recipe-ID bijwerken (1–10 personen). Semantisch identieke, nog actuele rijen worden overgeslagen. Er zijn geen writes aan `meal_mix_profiles`, `recipes`, `recipe_ingredients`, `products`, `product_prices` of `ingredient_product_matches`; andere recipes/profielen worden niet bijgewerkt.
- Preview heeft uitsluitend een read-only GET-evaluatie. De bestaande normale mix-refresh blijft `verified` eisen. Geen migratie, Production recipe-link, readiness-refresh, Production-write, deployment of merge uitgevoerd.

## Verificatie en volgende gate

- Op branch `codex/needs-review-explicit-recipe-readiness-20261010`: gerichte readiness-/route-/repository-regressies **92/92 groen**; root `npm test` **444/444 groen**; root `npm run check` groen; volledige web `npm run check` groen (**lint, TypeScript, 73 testbestanden/875 tests en productiebuild**); `npm run test:postgres` **28/28 groen** op een tijdelijke lokale PostgreSQL-container; `git diff --check` groen.
- Branch `codex/needs-review-explicit-recipe-readiness-20261010`, codecommit **`631276778f49c3ba12140fc7422849dcf85e404e`**, Draft PR [#71](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/71) naar `main`. De PR-CI en Vercel Preview-check zijn groen.
- Preview/read-only acceptatie op de deployment van deze codecommit: alle zeven allowlisted links gaven HTTP 200; alle zeven responses behielden `needs_review`, meldden `profilePromoted=false`, `readinessWrites=0` en `matchCacheWrites=0`. Zes recipes waren READY voor 1–10 personen; SKU `704892000` bleef NOT_READY voor alle aantallen met 2 readinessproblemen. Daarmee wordt onvoldoende readiness niet geforceerd. De Preview-routes `/week-voorbereiden`, `/budget` en `/lijst` gaven elk HTTP 200; planner-/menu-regressies vallen ook onder de volledige websuite.
- In deze opdracht is uitsluitend de Preview GET gebruikt. Geen Production POST, recipe-link-write, readiness-cache-write, matchcache-write, migratie, Production-deployment of merge uitgevoerd. Resterende gate: review en expliciete mergegoedkeuring voor PR #71. Elke latere Production `recipe_id`-write en readiness-refresh blijft buiten deze opdracht en vraagt afzonderlijke expliciete toestemming. De bestaande `needs_review` status kan met deze flow niet worden gepromoveerd.

# Checkpoint — read-only Production-auth preflight PR #76 hotfix — 10 oktober 2026

## Oorzaak en oplossing

- Actuele remote `main` is `19ce0d561c27aa6f988a1490a97a4d3b943e29a7` (PR #76). PR #70 blijft open, Draft en ongemerged. PR #71 is gemerged; de explicit-recipe readiness-route controleerde in de runner vóórheen alleen later, na de zeven recipe-link-writes. De dry-run controleerde de Production-route helemaal niet.
- De runner voert nu als eerste een authenticated POST uit naar de vaste Production-route `/api/internal/planner-readiness/explicit-recipe-refresh`, met dezelfde `PLANNER_CACHE_ADMIN_TOKEN` Bearer-auth en `VERCEL_AUTOMATION_BYPASS_SECRET` header als de latere refresh.
- De route hergebruikt uitsluitend de bestaande expliciete zeven-item allowlist en readiness-evaluator. Een exacte `preflight: true` payload selecteert `persist: false`; de evaluator bewijst dat de Production-route en readiness-functionaliteit werken en retourneert 10 personenresultaten met exact nul readinesscachewrites en nul ingredient-matchcachewrites. Er is geen nieuwe authketen of alternatieve endpoint toegevoegd.
- Runner faalt gesloten op ontbrekende/verkeerde Production-config, 401/403, 404, redirects, 5xx, timeout/netwerkfout, content-type/JSON/responsecontract-afwijking of non-zero preflight-writetelling. Kandidaatcontroles beginnen pas na succesvolle preflight.
- Write-flow blijft: authenticated read-only preflight → zeven allowlist-kandidaatcontroles → exacte `WRITE_EXACT_7_KNORR_RECIPE_LINKS`-bevestiging → exact zeven conditionele `recipe_id`-writes → pas daarna gerichte readiness-refresh. Er is geen retry na gedeeltelijke writes. De allowlist is exact `686060000`, `686150000`, `704884000`, `704888000`, `704892000`, `704897000`, `704898000`; `704881000` blijft uitgesloten.

## Verificatie en stopgate

- Targeted runner-tests: **9/9**; expliciete route-tests: **4/4**. Dekking omvat geldige read-only preflight, dezelfde authheaders, ontbrekende/wrong auth via 401/403, 404, 5xx, timeout, verkeerde response, geen kandidaatreads na preflightfalen, nul writes, exacte allowlist, confirmation gate en partial-write stop.
- `npm test`: **453/453**; `npm run check`: geslaagd. Web `npm run check`: lint, typecheck, **876 tests**, production build geslaagd. `git diff --check`: volgt na documentatie-update. PostgreSQL-tests zijn niet relevant: geen schema-, query- of databaseimplementatie gewijzigd; de preflight gebruikt de reeds bestaande read-only evaluator.
- Preflightbewijs is lokaal/fixture-gebaseerd: runner valideert de vaste Production-origin en volledige authenticated response; route-test bewijst `persist: false`. Er is geen live Production-call gedaan. Geen Production-workflow/dry-run gestart; recipe-link-writes **0**, readiness-refreshes **0**, readinesscachewrites **0**, ingredient-matchcachewrites **0**.
- Branch: `codex/knorr-prod-auth-preflight-20261010`, vanaf exact remote main; codecommit `2910cdc`. Aparte Draft PR [#77](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/77). PR #70 blijft ongewijzigd.
- Volgende mergegate: review en expliciete goedkeuring van deze Draft PR, plus groene PR-CI. Daarna beslist de gebruiker apart over een workflowdispatch; merge alleen geeft geen toestemming voor Production dry-run of writes. Geen merge uitgevoerd.

---

# Checkpoint — Hoogvliet explicit-empty / non-hydration fix — 10 oktober 2026

## Basis en bewijs

- Remote `main` bleef `1bf913b032cbdfcb6b44ad9dd16da7467aa8f35d` (merge PR #68); PR #69 is Draft en ongemerged.
- De laatste volledige maintenance dry-run blijft run [38055512512](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/38055512512): `category_listing_stagnated` op `https://hoogvliet.nl/frisdrank-sappen/q/page/6`, `transition=next`, `expectedByNext=true`, HTTP 200, nul candidates, `valid_catalog_shell`, `explicit_empty`, fallback uitgesloten en 0 Zyte attempts. Snapshot onvolledig; 0 writes.
- De historische logs bewaarden niet welke bodyphrase of DOM-bron de brede `document.body.innerText`-regex activeerde. De historische DOM en visibility zijn dus niet reconstrueerbaar.
- Gerichte read-only waarneming op exact hetzelfde publieke URL liet een geldige page/6-listing zien met productkaarten en de site-indicatie **447 producten**. Dat bevestigt dat het probleemwindow een echte, gevulde cataloguslisting kan zijn; het reconstrueert de oude response niet. Er is geen tweede controle-URL opgehaald en geen Zyte-request gedaan.
- De code-root-cause in de stoproute was wel concreet: een zwakke bodytekstmatch werd als expliciete lege status gebruikt en blokkeerde daardoor de bestaande fallback voor een concrete, geldige, via `next` verwachte listing. De oplossing hangt niet af van raden welke historische frase is geraakt.

## Fix op de featurebranch

- Branch: `codex/explicit-empty-evidence-1a1-20261010`. Draft PR [#69](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/69), base `main`.
- Veilige observability logt alleen vaste enums voor signaaltype en matchphrase, een statische selector/source, visibility (`true/false/unknown`), strength (`strong/weak/none`), en bestaande route/window/canonical URL/transition/expectedByNext/shellvelden. Geen HTML of vrije bodytekst.
- Alleen een zichtbare empty-marker binnen de bekende listing-shell geldt als sterke expliciete leegstatus. Die marker laat initial en verwachte next-listings natuurlijk completeren.
- Generieke bodyphrase, verborgen marker of onbekende visibility blijft zwak bewijs. Zo'n signaal blokkeert de bestaande Zyte-eligibility voor een concrete geldige `next`-window niet. De bestaande canonical identity-, status-, trigger-, requestbudget-, single-attempt-, parser-, dedupe- en fail-closed providerrails blijven leidend.
- Geen wijzigingen aan 404-, parser/schema-, repeated-window-, loop-, alias-, load-more- of window-capgedrag; geen providerlimieten gewijzigd.

## Tests, veiligheid en releasegate

- Regressies dekken gevulde listings, echte sterke lege initial/next listing, generieke en opacity-hidden lege signalen, non-hydrated verwachte next, load-more, 404, repeated window, pagination-loop, alias, window cap, Zyte budget, maximaal één attempt per canonical window en fail-closed providerfailure.
- Op code-head `6691d2dd7ac0f9237c7e2f2365803c86ec6af2e3` is de volledige `Stability & core flows`-run groen: `npm test` en `npm run check`, PostgreSQL atomic rollback/concurrency en web regressions/lint/TypeScript/build.
- `git diff --check` is groen via de PR-runnerpatchvalidatie. Databasecode is niet gewijzigd.
- In deze goal zijn geen full maintenance-run, Zyte-request, Production-write, migratie, deployment of merge gestart. Product-, prijs- en catalogusrunregistratiewrites zijn 0.
- `ROADMAP.md` blijft ongewijzigd: 1A.1 blijft open totdat de fix na merge live is bewezen. `DESIGN.md` is niet gewijzigd.
- Volgende gate: review en expliciete mergegoedkeuring voor Draft PR #69. Na afzonderlijke mergegoedkeuring: exact één volledige maintenance DRY-RUN vanaf de nieuwe main, volledige accounting, geen write. De finale write blijft een aparte toestemming.

---

# Checkpoint — finale volledige maintenance dry-run na PR #67 — 10 oktober 2026

## Releasebasis en run

- PR #66 is gemerged als `71c183261a99350dab74d91257ad0d702b615f34`; Zyte proofrun `38046108912` bewees 6/6 succesvolle `browserHtml`-requests, 30 SKU's per request en gebruik van de bestaande parser.
- PR #67 is gemerged naar remote `main` als **`3bac1675c46fba5903a6e9736903ffee210fd1e2`**. Deze merge bevat de begrensde Zyte-listingfallback.
- De enige handmatige volledige maintenance dry-run na PR #67 is workflowrun **`38052370086`**, poging 1, vanaf exact deze main SHA. De dispatch had `mode=dry-run`, lege writebevestiging en de fail-closed dispatchvalidatie slaagde.
- De uitvoerende stap had `DRY_RUN=1`, `ZYTE_LISTING_FALLBACK_ENABLED=1`, limiet **3 requests**, timeout **45.000 ms** en de Actions-secret `ZYTE_API_KEY` (in logs door GitHub gemaskeerd). `MAINTENANCE_MAX_LISTING_WINDOWS=800` bleef staan. Verplichte regressies waren groen. Er waren bij de precheck geen actieve maintenance/import Actions; de workflow deelde de bestaande concurrencygroep.

## Dry-run-uitkomst — FAIL, snapshot onvolledig

- De workflow eindigde met **failure** na circa 5m22s in de volledige maintenance-stap. Stopreden: **`category_listing_stagnated`**. De snapshot bereikte de prijs-/productbeoordeling niet.
- Catalogusaccounting: **20** rootcategorieën; **20** listingroutes geselecteerd; **10** routes bezocht; **150** verwerkte listingvensters; **151** primary window requests volgens de fallbackaccounting; **2.828** unieke actuele listing-SKU's; **47** duplicate candidates; `snapshot_complete=false`.
- Zyte-accounting: **0** fallback attempts, **0** providerrequests, **0** successes, **0** failures. Er is geen Zyte-trigger of fallback-URL gerapporteerd; de stagnatie stopte fail-closed vóór een toegestane fallback. Geen fallback raw candidates of SKU-count.
- Bulkprijschecks, detailfallbacks, nieuwe SKU-validaties, prijswijzigingen en ongewijzigde prijzen: **niet bereikt / niet van toepassing**. Production-only/verdwenen SKU's zijn niet opnieuw beoordeeld. De log geeft geen exacte listing-URL van de stagnatie.

## Geen-writebevestiging en gate

- Dispatch: `DRY_RUN=1`, `MANUAL_MAINTENANCE_MODE=dry-run`, `MANUAL_MAINTENANCE_CONFIRM` leeg. De bestaande maintenance-code slaat bij dry-run runregistratie, `upsertProducts` en finish/writepaden over; bovendien stopte de onvolledige snapshot vóór de prijs-/productwriter. Productwrites **0**, prijswrites **0**, catalog import-runregistraties **0**. Geen migration, delete, deployment, retry of tweede maintenance-run gestart.
- **Geen write-acceptatie vrijgegeven.** Omdat de snapshot incompleet bleef en Zyte niet werd ingezet, is een write-run niet verantwoord. `ROADMAP.md` blijft ongewijzigd; stap 1A.1 is niet afgerond.
- Volgende stap: Codex onderzoekt waarom `category_listing_stagnated` in deze run niet tot een toegestane fallbacktrigger leidde en identificeert de ontbrekende route/window-identiteit/accounting. Pas na die diagnose en een aparte expliciete gate kan een nieuwe run worden overwogen. Geen automatische retry.

---

# Checkpoint — veilige Zyte-fallback voor lege verwachte next-window — 10 oktober 2026

## Onderzoek en oorzaak

- Actuele remote `main` is `e77c4c69ed515b7a2c438d3987c84f9b0d0d54ea`, na merge van PR #67 (`3bac1675c46fba5903a6e9736903ffee210fd1e2`). Open PR's #54/#42/#41/#21 raken de Hoogvliet-listingfallback niet. Run [38052370086](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/38052370086) bevestigt alleen de samenvatting: 10/20 routes, 150 listingwindows, 2.828 unieke SKU's, `category_listing_stagnated`, nul fallbackattempts en incomplete snapshot. Het GitHub-logendpoint gaf bij read-only inspectie HTTP 403 en de run heeft geen diagnostisch artifact; daarom is de exacte route/window van die historische run niet meer reconstrueerbaar.
- De controlflow behield `transition=next` en de concrete `expectedWindowURL` tot in de snapshot. De concrete eligibilityfout zat in shellherkenning: `hasCatalogStructure` herkende alleen product-/categorieankers of `/producten`, niet de listingcontainer zelf. Een valide, geladen lege listing-shell zonder subcategorielink werd daardoor `catalog_shell_not_proven`; de fallback werd vóór de generieke `category_listing_stagnated`-classificatie overgeslagen. De oude fixture maskeerde dit doordat ze een kunstmatige subcategorielink bevatte. Load-more-stagnatie heeft terecht geen next-URL en blijft niet eligible.

## Fix, observability en grenzen

- Herkenning van expliciete listingcontainers (`main#catalog-listing` en beperkte catalog-/product-list selectors) is nu onderdeel van de bron-shell/readiness-evidence. Daarmee kan uitsluitend een concrete, geldige en via `next` verwachte pagina met HTTP 2xx/3xx, nul productlinks, een listing-shell en zonder expliciete lege status door de bestaande Zyte-eligibility lopen. De provideruitkomst blijft via dezelfde parser/hydratie-/dedupeflow gaan; mislukking blijft fail-closed.
- Iedere `category_listing_stagnated` krijgt veilige diagnostiek: route, windowindex, canonical URL, transition (`initial`/`next`/`load_more`/`nested`), `expectedByNext`, HTTP-status, raw/unique SKU-count, shell-/empty-classificatie, eligibilityreden, fallback-attemptreden/teller en stopreden. Er worden geen HTML of secrets gelogd.
- Geen Zyte voor initial/nested lege pagina's zonder next-context, expliciete leegstatus, load-more-stagnatie, 404, ongeldige identiteit/URL, loops, repeated SKU, page-alias, parser/schemafout of window-cap. `MAINTENANCE_MAX_LISTING_WINDOWS` en providerlimieten blijven ongewijzigd.

## Branch, verificatie en releasegate

- Branch `codex/fix-zyte-next-window-stagnation-20261010`, gebaseerd op remote `main` `e77c4c6`; codecommit `99e5673`. Open Draft PR [#68](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/68). ROADMAP 1A.1 blijft open.
- Gerichte regressies: listing-shell zonder link, next-success, fallback-empty/fail-closed, explicit-empty, load-more, initial-empty, 404, repeated SKU, pagination-loop, page-alias, window-cap, navigation-only nested en bestaande adapterrails.
- Verificatie: gerichte listingtests **24/24 groen**; volledige `npm test` **441/441 groen**; `npm run check` groen; `git diff --check` groen. PostgreSQL-tests en workflow-YAML-validatie zijn niet relevant: databasecode en Actions-workflows zijn niet gewijzigd.
- Geen Zyte-livecall, maintenance dry-run/write, productimport, databasewrite, migratie, deployment of merge uitgevoerd. Na groene PR-CI en aparte mergegoedkeuring is de exacte Work-gate één volledige maintenance dry-run: bevestig complete snapshot en controleer dat fallback alleen voor een bewezen next-window optreedt. Stop zonder write; finale write blijft een aparte goedkeuringsgate.

# Checkpoint — Production-ready Zyte-listingfallback in Draft — 10 oktober 2026

## Bewezen provider en actuele basis

- PR #66 is gemerged naar `main` als `71c183261a99350dab74d91257ad0d702b615f34`. De afzonderlijke read-only workflowrun [38046108912](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/38046108912) leverde **6/6 succesvolle Zyte `browserHtml`-responses**, nul failures, steeds API-/bronstatus 200, dezelfde listingidentiteit en `hydrated=true` met de bestaande parser.
- Probleemwindow `/chips-zoutjes-noten/q/page/4`: driemaal 30 SKU's in 7.692 / 5.211 / 6.713 ms. Controlewindow `/chips-zoutjes-noten/q/page/1`: driemaal 30 SKU's in 7.336 / 10.096 / 7.055 ms. Totale latency: minimum 5,21 s, gemiddeld circa 7,35 s, maximum 10,10 s; HTML circa 629–634 KB. Dit bewijst Zyte voor incidentele listingfallback, niet als tweede catalogusbron.

## Geïmplementeerde architectuur en rails

- Nieuwe branch `codex/zyte-listing-fallback-1a1-20261010` en Draft PR [#67](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/67) zijn exact vanaf die actuele `main` gestart. Direct Hoogvliet/Playwright blijft primary. Alleen een concrete geldige listing-URL met HTTP 408/425/429/5xx, of een door een betrouwbare `next`-link verwachte vervolgpagina met geldige catalogusschil maar nul producten en zonder expliciete lege status, kan één Zyte-attempt krijgen.
- `src/zyte-listing-fallback.mjs` doet één directe `browserHtml`-POST zonder SDK-retry of providerfailover, valideert doel- en response-URL/listingidentiteit, vereist een 2xx bronstatus, begrenst response en HTML op respectievelijk 2,5 MiB en 2 MiB en retourneert alleen gestructureerde veilige statussen. De HTML wordt met JavaScript en subresources uitgeschakeld door dezelfde `extractCatalogListingCandidates`-parser gelezen en gaat daarna door dezelfde normalisatie, dedupe, GraphQL-hydratatie, detailvalidatie en writergate.
- Fallback is standaard uit. Production-maintenanceworkflows zetten hem alleen op de uitvoerende maintenancestap aan en geven alleen daar `ZYTE_API_KEY` door. Defaults: maximaal 3 providerrequests/run en 45 s/request; hard clamps: 10 requests en 60 s. Eén canonical window krijgt maximaal één poging. `MAINTENANCE_MAX_LISTING_WINDOWS=800` blijft ongewijzigd en providercalls voegen geen listingwindow toe.
- Geen fallback voor 404, ongeldige URL, parser/schemafout, expliciete lege status, repeated SKU-window, pagination-loop/page-alias, listing-window-limit, load-more-stagnatie zonder eigen URL, navigation-only oudercategorie, productdata-/database-/writer-/lockfouten of ongeclassificeerde exceptions. Disabled/missende key, providerfout/timeout, verkeerde URL/identiteit, lege/ongeldige parseruitkomst of uitgeput budget houdt de snapshot incompleet en vóór de writer.
- Veilige accounting logt `primary_listing_windows`, attempts/providerrequests/successes/failures, provider, triggerreden, route/window/canonical URL, API-/bronstatus, latency, HTML-bytecount, raw/unique SKU-count en `snapshot_complete`; nooit API-key, Authorization-header, HTML of providerbody.

## Verificatie en resterende releasegate