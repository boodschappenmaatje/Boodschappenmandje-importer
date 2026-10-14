# Checkpoint — Home-top zoeken + Ontdek-kaart volgens referentie — 14 oktober 2026

- De supermarktkeuze was eerder op iPhone visueel geaccepteerd. Home-top volgt nu de nieuwe leidende referentie: bestaande blauwe hero met merknaam/subtitel, slogan links en officiële mascotte rechts; de bestaande grote witte kaart overlapt de hero/content-overgang.
- Binnen de kaart blijft de bestaande supermarktselector met logo en sheet links. Rechts is een groot zoekveld zonder losse blauwe knop; de volledige zoekstrook focust het invoerveld en Enter/search behoudt de bestaande routering naar `/ontdek` of `/ontdek?q=...`.
- `Ontdek & bespaar` staat direct onder de zoekrij als een brede, tweede actiekaart met rond prijslabel-icoon, titel, uitleg en chevron. Bestaande budget, maaltijdbudget, week, lijstactie en bottom navigation blijven behouden.
- Provider-, lijst-, budget-, week- en zoeklogica zijn niet gewijzigd; alleen Home-presentatie en gerichte dashboard-test zijn aangepast. Gerichte dashboard-/selector-tests **5/5**; web `npm run check`: lint, typecheck, **910/910 tests** en production build; root `npm test`: **515/515**; root `npm run check` en `git diff --check` groen.
- Chromium op **390×844** en **430×844** bevestigt geen horizontale overflow, winkelkeuze opent de bestaande sheet, hele zoekstrook focust, zoeken met `pasta` behoudt `/ontdek?q=pasta`, Ontdek-kaart opent `/ontdek` en de bestaande budget/week/list/navigation blijft aanwezig. CI-run **#574** en Vercel zijn groen; Preview alias geeft HTTP 200. Fysieke iPhone-heracceptatie van deze Home-versie staat open.

# Checkpoint — Home-bovenkant volgens goedgekeurde visual — 14 oktober 2026

- De supermarktkeuze was eerder op iPhone visueel geaccepteerd. Voor deze Home-stap is de bovenkant herwerkt: grotere linkse slogan en officiële mascotte rechts in de bestaande blauwe hero, gevolgd door een brede witte zoekkaart die de hero en contentlaag overlapt.
- De actieve supermarkt met bestaand logo en chevron staat nu links in dezelfde kaart als het zoekveld rechts. Beide blijven dezelfde `SupermarketSelector`, actieve providerstate, wisselsheet en bestaande `/ontdek`-routering gebruiken; query blijft via `?q=` meegaan. De bestaande `Ontdek & bespaar`-link blijft behouden.
- Budget, maaltijdbudget, week, lijstactie, navigatie en Home-data zijn functioneel ongemoeid gelaten. Geen andere Slim Zoeken-schermen of backend-/databaselogica gewijzigd.
- Home-renderingstest uitgebreid voor de geïntegreerde selector/zoekkaart en bestaande ontdekroute. Web `npm run check`: lint, typecheck, **910/910 tests** en production build groen; root `npm test`: **515/515**; root `npm run check` en `git diff --check` groen.
- Chromium op **390×844** en **430×844** bevestigt volledige zichtbaarheid van de winkelnaam, geen horizontale overflow, kaart-overlap met de hero, correcte bestaande sheet-openactie en zoeken via `/ontdek?q=pasta`. Budget, week, lijstactie en bottom navigation blijven aanwezig.
- Commit `02ea8d4` is gepusht op de bestaande branch en staat op Draft PR #96. CI-run **#571** en Vercel zijn groen; Preview alias geeft HTTP 200. Fysieke iPhone-check van deze Home-stap staat nog open.

# Checkpoint — Supermarktkeuze glossy banneruitwerking — 14 oktober 2026

- De meegestuurde goedgekeurde iPhone-visual is toegepast op de supermarktkeuze. Eerste keuze en wisselsheet delen dezelfde brede kaarten, hiërarchie, glanzende diagonale CSS-lagen en zachte tinten per supermarkt.
- Hoogvliet blijft de prominente blauwe kaart; AH, Jumbo, Lidl en Dirk hebben een eigen subtiele merktoon met `Binnenkort`. De Jumbo-markering is breder weergegeven zonder vervorming of afkapping. Alle kaarten bevatten uitsluitend het officiële supermarktlogo en CSS-vlakken; er staan geen groenten, fruit of productfoto's in.
- Dezelfde bestaande selector/rendering wordt voor eerste keuze en wisselen gebruikt. De Home-selector, sheet/portal, providerstate, `setActiveSupermarket`, disabled toekomstige winkels en lijstisolatie zijn functioneel ongewijzigd.
- Merkaccenten staan als benoemde supermarkt-tokens in `apps/web/src/styles/tokens.css`; componentstyling gebruikt uitsluitend die tokens plus de bestaande blauwe/semantische tokens. `DESIGN.md` en `ROADMAP.md` zijn ongewijzigd.
- Web `npm run check`: lint, typecheck, **910/910 tests** en production build geslaagd. Root `npm test`: **515/515**; root `npm run check` en `git diff --check` geslaagd.
- Chromium-controle op **390×844** en **430×844**: alle vijf logo's geladen; kaarten benutten de breedte (354/394px), geen horizontale overflow; Jumbo-logovak 64px met 73px brede onbeschadigde woordmarkering; eerste keuze en wisselsheet tonen dezelfde kaartstijl; bottom navigation valt niet over de sheet; selector openen, sluiten en kiezen werken. Nieuwe Preview is beschikbaar (HTTP 200); fysieke iPhone-heracceptatie staat open.

# Checkpoint — Supermarktkeuze laatste visuele tweaks — 14 oktober 2026

- Na fysieke iPhone-feedback zijn drie presentatiedetails aangepast: Jumbo-logo iets vergroot met behoud van aspect ratio, alle vijf logovakken gelijkgetrokken naar 64×64px met dezelfde radius, en wissel-eyebrow exact gewijzigd naar `JE LIJSTEN BLIJVEN PER WINKEL APART`.
- Mobile bottom sheet, portal, providerstate, `setActiveSupermarket`, lijstisolatie, disabled toekomstige winkels, assets, compacte selector en zoek-/opslaglogica zijn ongemoeid gelaten. Nieuwe iPhone-heracceptatie staat open.
- Gerichte componenttest slaagt; web `npm run check` slaagt met lint, typecheck, **910/910 tests** en production build. Root `npm test`: **515/515**; root `npm run check` en `git diff --check` slagen.
- Chromium op **390×844** en **430×844** bevestigt vijf geladen logo's, identieke 64×64px logovakken met 15px radius, grotere Jumbo-weergave zonder aspect-ratiovervorming, de volledige kopregel op één regel, geen horizontale overflow, sheet tot de viewportbodem boven de navigatie, en sluiten/winkelen wisselen blijft werken. Preview en laatste fysieke iPhone-heracceptatie volgen na CI.

# Checkpoint — Supermarktkeuze mobile sheet polish — 14 oktober 2026

- De eerste keuze en winkelwissel openen op mobiel nu als een bottom sheet: de Home-hero blijft zichtbaar, de sheet vult de onderkant tot de veilige schermrand en de bottom navigation ligt er niet meer overheen. Desktop blijft een gecentreerde dialoog.
- De bestaande modal wordt via een React portal boven de Home-stacking context gerenderd. Providerkeuze, disabled winkels, lijstisolatie en alle zoek-/opslaglogica blijven ongewijzigd.
- De componenttest slaagt; web `npm run check` is groen: lint, typecheck, **910/910 tests** en production build. Chromium controle op 390×844 en 430×844 toont alle logo's, geen horizontale overflow en geen navigation-overlay op de sheet.
- Nieuwe Preview en fysieke iPhone-heracceptatie zijn de volgende acceptatiestap; de gebruiker beslist over de visuele acceptatie.

# Checkpoint — Supermarktkeuze banners en logo's — 14 oktober 2026

- Eerste supermarktkeuze en wisselmodal zijn visueel bijgewerkt met vijf echte, ongewijzigde supermarktbeeldmerken. Herkomst staat bij de assets in `apps/web/public/branding/supermarkets/README.md`; merkrechten blijven bij de betreffende winkels.
- Beide situaties gebruiken nu dezelfde brede afgeronde banners: Hoogvliet is een opvallende blauwe hoofdkaart met beschikbare producten/prijzen; AH, Jumbo, Lidl en Dirk zijn brede secundaire kaarten met de status `Binnenkort`. De wisselmodal markeert de actieve winkel met `Gekozen`.
- De compacte selector toont ook het actieve beeldmerk. Providerstate, `setActiveSupermarket`, uitgeschakelde toekomstige winkels, winkelgebonden lijsten en alle opslag-/migratie-/zoeklogica zijn ongewijzigd.
- Alleen de supermarktselector, bijbehorende CSS, gerichte componenttest, logo-assets en dit statusdocument zijn gewijzigd. De componenttest slaagt; web `npm run check` is groen met **910/910 tests**, lint, typecheck en production build. Root `npm test` is **515/515**, root `npm run check` en `git diff --check` zijn groen.
- Chromium op 390×844 en 430×844 bevestigt dat beide modals alle logo's laden, binnen de viewport passen en geen horizontale overflow veroorzaken; toekomstige keuzes blijven disabled. Preview en fysieke iPhone-heracceptatie staan open; de gebruiker beslist over de visuele acceptatie. Draft PR #96 blijft open en wordt op dezelfde branch bijgewerkt.

# Checkpoint — Slim Zoeken 2.0 visuele acceptatiefix — 14 oktober 2026

- De bestaande kernflow is op een fysieke iPhone functioneel grotendeels goedgekeurd, maar visueel afgekeurd omdat Home-zoeken te los aanvoelde en `/ontdek` te vlak/druk was ten opzichte van de afgesproken drie-schermenreferentie. Stap 1B.1 blijft open; fysieke visuele heracceptatie is niet geclaimd.
- Zelfde branch `codex/smart-search-2-0-foundation-20261013`, zelfde Draft PR #96. De actuele `origin/main` blijft `3e6e3f05c7a8c163a7f3c4ca8868526640f2145e`; vóór deze wijziging controleerde PR #96 de verwachte head `051d654938f32ebcbcb6f63ec6d3572bff3c2cdc`. Geen merge, Production-deployment, backendwijziging of databasewijziging.
- De Home-zoekingang gebruikt nu een sterkere witte zoekkaart die visueel in de blauwe hero overloopt; de bestaande compacte supermarktkeuze staat erbij en de aparte actie `Ontdek & bespaar` blijft beschikbaar. Zoekterm-URL, mascotte, exacte slogan, budget/week/lijst en bottom navigation blijven behouden.
- `/ontdek` heeft een blauwe, compacte header, compacte winkelrij, prominente zoekingang en een welkomstkaart met het bestaande officiële mascotteasset. De lege ontdekstate toont een rustige tweekolomsingang voor echte aanbiedingen, voordelig sorteren en alle echte categorie-facets. Zodra een zoekterm, categorie of filter actief is, verdwijnt de welkomst-/tegelinhoud en komen zoekcontext, compacte filters/sortering en resultaten direct in beeld. Categoriebron blijft uitsluitend `getFilterOptions` met de bestaande Hoogvliet-velden; geen nieuwe data of zoekengine.
- Supermarktkeuze is opnieuw vormgegeven als een compacte blauwe Hoogvliet-hoofdkaart plus rustigere AH/Jumbo/Lidl/Dirk-kaarten met `Binnenkort`. Geen supermarktlogo-assets waren beschikbaar; er is een generiek bestaande winkelicoon gebruikt. Dezelfde `setActiveSupermarket`-providerstate, disabled-regel, lijstisolatie en switchbescherming blijven leidend.
- Productrijen hebben een grotere afbeelding, sterkere actuele prijs, compactere verpakkingstekst en ronde blauwe `+`; bestaande onafhankelijke `− / aantal / +` blijft de lijstbediening. `CatalogProductCard`, bestaande positieve-prijsfilter, actuele aanbiedingstatus, `addProduct`/`increase`/`decrease`, bijdragebescherming, providerrepository, productdetail en terugkeer-URL zijn niet functioneel herbouwd. Een nieuwe gedeelde vergrootglasicoon wordt voor beide zoekvelden gebruikt.
- De 390×844 lokale Chromium-weergaven van Home, ontdek en actieve zoekstate laden zonder horizontale overflow. De lokale browseromgeving heeft geen gekoppelde catalogus, dus echte productrijen moeten op Preview worden gecontroleerd. De winkelmodal past binnen de viewport; iPhone/Safari en keyboard blijven onderdeel van de Work-heracceptatie.
- Tests: volledige web `npm run check` groen — lint, typecheck, **910/910 tests in 77 bestanden** en production build. Root `npm test`: **515/515**; root `npm run check` groen; `git diff --check` wordt na deze documentwijziging herhaald. De build meldt alleen de bestaande waarschuwing over root- en web-package-lockbestanden.
- Bewust buiten scope: favorieten, populariteitsranking, aanbevelingen/alternatieven, fictieve besparingen, aanvullende winkelintegraties, backend, animaties en Production. Exacte volgende stap voor Work: Preview-browsercontrole op 390–430px, daarna fysieke iPhone-test van Home/zoeken/keyboard/filter/modal en visuele heracceptatie door de gebruiker.

# Checkpoint — Slim Zoeken 2.0 provider- en lijstfundament — 13 oktober 2026

- Roadmap **1B blijft open**. Deze aparte featurebranch `codex/smart-search-2-0-foundation-20261013` is gebaseerd op actuele `origin/main` **`3e6e3f05c7a8c163a7f3c4ca8868526640f2145e`** en bevat alleen het fundament voor stap **1B.1 Slim Zoeken 2.0**.
- Centrale provideridentiteiten `hoogvliet`, `ah`, `jumbo`, `lidl` en `dirk` zijn toegevoegd. Alleen Hoogvliet heeft een catalogusintegratie. De actieve winkelvoorkeur wordt lokaal onthouden; een ontbrekende of onbekende waarde valt veilig terug naar Hoogvliet. De lijstcontext kan wisselen tussen providers en laadt/schrijft per provider zonder records samen te voegen. Onopgeslagen lijstwijzigingen blokkeren een winkelwissel.
- Bestaande IndexedDB-lijsten gebruiken voortaan providergebonden sleutels zoals `active:hoogvliet`. De oude sleutel `active` wordt alleen bij het laden van Hoogvliet gemigreerd: de bestaande record wordt eerst gevalideerd, daarna in dezelfde IndexedDB-transactie naar de nieuwe sleutel gekopieerd en de oude sleutel verwijderd. Een conflicterende of ongeldige opslag faalt gesloten en wordt niet overschreven. Herhaald laden is idempotent. Quantities, checked-state, origin/contributions en receptlinks blijven in de bestaande lijstpayload.
- De productzoek- en detailpaden gebruiken de actieve provider. Catalogusaanvragen voor een niet-ondersteunde provider worden expliciet afgewezen en kunnen niet naar Hoogvliet-resultaten terugvallen. De bestaande Hoogvliet-RPC, filters, product-/prijsqueries en planner blijven dezelfde bron gebruiken. Weekreceptbijdragen blijven alleen toegestaan voor de huidige ondersteunde provider.
- Geen Supabase-schemawijziging of migratie nodig; geen Production-call, release of datawrite in deze stap. `ROADMAP.md` en `DESIGN.md` zijn ongewijzigd.
- Gerichte regressies: **47/47** over vier suites; volledige web-check: lint, typecheck, build en **903/903** tests groen. Root `npm test`: **515/515**; root `npm run check` en `git diff --check` groen. Next.js gaf alleen de bestaande niet-blokkerende waarschuwing over twee package-lockbestanden.
- **Nog niet gebouwd:** supermarktkeuze-/wissel-UI, Home → `Ontdek & bespaar`, categorieën, extra supermarktintegraties en visuele zoekpolish. Volgende Codex-stap: die iPhone-flow bovenop dit fundament bouwen; daarna Work voor Preview en fysieke iPhone-acceptatie. Geen Preview/Production-release vanuit deze branch.

# Checkpoint — Slim Zoeken 2.0 mobiele kernflow — 14 oktober 2026

- Actuele remote `main` bij start: **`3e6e3f05c7a8c163a7f3c4ca8868526640f2145e`**. Verdergewerkt op de bestaande branch `codex/smart-search-2-0-foundation-20261013` en Draft PR **#96** (geen nieuwe branch/PR). Het bestaande provider-/lijstfundament uit `be185006b5f39b5b4b6744f4ea1795c27d9b0a6a` is behouden.
- Nieuwe route **`/ontdek`** met compacte winkelkeuze, zoekbalk en mobiele productontdekking. Home heeft een zoekingang die een optionele zoekterm als URL-state meeneemt en een aparte actie `Ontdek & bespaar`. De bestaande slogan, mascotte, budget-, week-, lijst- en bottom-navigationflows zijn behouden.
- Winkelkeuze gebruikt `ActiveShoppingListProvider.setActiveSupermarket`. De eerste expliciete Hoogvliet-keuze wordt nu ook onthouden als diezelfde winkel al als veilige beginwaarde actief is. AH, Jumbo, Lidl en Dirk staan als disabled **Binnenkort**; alleen Hoogvliet kan zoeken. Providerwissel blijft geblokkeerd bij mislukte lokale opslag en laadt de eigen lijstcontext.
- Categorieën en merken komen uitsluitend uit `getFilterOptions` van de actieve Hoogvliet-catalogus (bestaande `category`/`brand`-facets; niet uit afgeleide of verzonnen categorieën). Categorie, zoekterm, merk, aanbiedingen en sortering blijven in dezelfde catalogusquery/URL-state te combineren. `Alles` wist de categorie maar behoudt de overige zoekcontext.
- Sortering gebruikt bestaande serverlogica: `Relevant` gebruikt de bestaande zoekranking-RPC. `Goedkoopste` gebruikt de bestaande prijsquery met zoekterm/categorie/merkfilters en een expliciete `price > 0`-grens; zo worden nulprijzen niet vóór geldige resultaten gepagineerd. `Aanbiedingen` gebruikt het bestaande actieve-aanbodsignaal, geldigheidsdatums en positieve prijs. UI-resultaten zonder actuele betrouwbare positieve prijs worden niet getoond. Merkfilter alleen wanneer echte merknamen als facets beschikbaar zijn.
- Productdetails blijven via de provider-aware repository laden en terugkeren via dezelfde browserhistorie; de zoekcontext wordt tevens aan de detail-URL gekoppeld. Quick-add en hoeveelheid gebruiken bestaande `addProduct`/`increase`/`decrease`-mutaties. Onafhankelijke catalogusbijdragen krijgen −/aantal/+; bij receptbijdragen toont de zoekregel de lijststatus en biedt + de bestaande veilige extra toevoeging. Acties blokkeren tijdelijk dubbele snelle mutaties.
- Lijstisolatie blijft op providercontext: toevoegen accepteert alleen een product van de actieve supermarkt; de bestaande regressies controleren afzonderlijke providerlijsten, heropenen en onthouden van de actieve winkel. Niet-ondersteunde catalogi krijgen geen Hoogvliet-resultaten.
- Gerichte regressies toegevoegd voor Home/`/ontdek`, eerste expliciete winkelkeuze, disabled toekomstige winkels, positieve prijsweergave, prijsquery met gecombineerde zoekterm/categorie en bestaande providerlijstisolatie. Root `npm test`: **515/515**; root `npm run check`: **groen**. Volledige web `npm run check`: lint en typecheck groen, Vitest **909/909 in 77 bestanden**, production build groen. Next.js gaf de bestaande niet-blokkerende waarschuwing over root- en web-package-lockbestanden. `git diff --check` wordt na de definitieve documentatie-update nogmaals uitgevoerd.
- Bewust niet gebouwd: echte integraties voor AH/Jumbo/Lidl/Dirk, favorieten, recente zoekopdrachten, populariteitsranking, aanbevelingen/alternatieven, fictieve bespaarbedragen, uitgebreide vergelijking en uitgebreide animatiepolish.
- Preview/browseracceptatie en fysieke iPhone-test zijn **open voor Work**. Er is geen Production-deployment of merge uitgevoerd.

# Checkpoint — Shanghai shared-scope read-only runner voorbereid — 13 oktober 2026

- Na expliciete toestemming is PR #93 gemerged op `main` (`1308ba5364921597939d5f20e31d372c84feed51`). Shanghai dry-run run **38449274591** slaagde; de runner accepteerde exact 20 recepten, 2 matchkeys en 200 subscribers. De voorafgaande dispatch **38443749835** startte geen job door GitHub billing en deed geen Production-request.
- De gedeelde matchdata is nog niet geschreven. Het bestaande one-shot writerpad is aantoonbaar al eerder gebruikt en hardcoded op een andere scope van 7 recepten/3 keys/70 rijen; dat pad is ongeschikt voor deze refresh. Een aparte Shanghai one-time runner/workflow is daarom voorbereid op deze featurebranch: verse server-side dry-run, exacte CAS/scope-validatie, maximaal één transactionele `mode: "write"` zonder retry, daarna alleen `mode: "verify"`. Production verifier staat alleen deze Shanghai-set of het bestaande legacy allowlist-paar toe. Tests lokaal: importer 514/514; web 894/894, lint/typecheck/build groen. Er is nog geen Shanghai refresh-write uitgevoerd; Production-writes **0**.
- PR #93 CI-run #555 vond een regressie omdat de one-shot write/verify-runner de Shanghai-runner-validator deelde. Hersteld door de bestaande 7-recepten/3-matchkeys/70-rijen scope en validator naar `bounded-production-recompute-once-scope.mjs` te isoleren; de Shanghai-runner blijft exact 20/2/200 en dry-run-only. Gerichte suites 28/28, volledige `npm test` 503/503, `npm run check` en `git diff --check` groen. Geen Production-call, workflow-dispatch of write uitgevoerd.
- PR **#92** is gemerged. De gecontroleerde actuele remote `main` is **`7e54907ad386ef2840e045828ecd14155fc438e6`**. Production-migratie `secure_shared_match_readiness` is toegepast als versie **`20261013162855`**.
- De Production-read-only nulmeting bevestigt nog steeds exact twee stale maar valid matchkeys: olie (`meal-mix-ingredient:mix-supplement-olie:ml:ingredient:generic`) met 16 recepten/160 readinessrijen en ui (`meal-mix-ingredient:mix-supplement-ui:piece:ingredient:generic`) met 9/90. Samen zijn dat exact 20 unieke recepten/200 readinessrijen. Er is geen derde stale Shanghai-key.
- Work kon geen directe dry-run starten omdat Vercel de Production-admin-token maskeert. De poging stopte vóór POST; geen credential is getoond en geen POST is uitgevoerd. Production-writes sinds de vorige stap: **0**.
- De bestaande GitHub Actions-workflow `.github/workflows/bounded-production-recompute.yml` blijft de veilige vervolgstap: zij haalt benodigde secrets server-side op en roept de read-only runner `src/bounded-production-recompute.mjs` aan. Deze branch beperkt de runner tot exact de bewezen 20 recipe IDs, 2 matchkeys en 200 subscriber-rijen en laat uitsluitend `mode: "dry-run"` versturen. Geen migration- of writefunctionaliteit is toegevoegd; `bounded-production-recompute-once.mjs` is niet aangepast.
- Regressietests dekken de exacte scope, 19/21 recipes, extra matchkey, ontbrekende/extra subscriber, write-aantal, blocked/unexpected dependencies, token-redactie en uitsluitend dry-run-request. Productie-run is niet uitgevoerd; na merge en groene CI is de volgende stap één workflow-run op `main`, output valideren, token niet tonen en geen tweede run starten. Geen refresh-write zonder nieuwe expliciete toestemming.

# Checkpoint — 1B transactionele shared-match-refresh voorbereid — 13 oktober 2026

- Basis is actuele remote `main` **`38dcbd8a304d7591034e879a6c0545029736d046`**. Featurebranch `codex/roadmap-1b-shared-match-refresh-20261013`, Draft PR **#92** open; implementatiecommit `df5b09d`. De bewezen Shanghai-blocker blijft exact twee valid maar stale matchkeys voor SKU `231215000`: olie (`meal-mix-ingredient:mix-supplement-olie:ml:ingredient:generic`) en ui (`meal-mix-ingredient:mix-supplement-ui:piece:ingredient:generic`). Productie-read-only scope: olie 160 rijen/16 recepten, ui 90/9, overlap 5, samen exact 200 rijen/20 unieke recepten met 10 persoonsaantallen elk. Geen derde stale Shanghai-key. Write-run #31 bleef fail-closed (`safe_to_write=false`), nul geplande writes; Production-writes blijven **0**.
- Oorzaak: `MAX_RECIPES=10` in de TypeScript maintenance-planner en de `bounded_readiness_plan`-RPC blokkeren batches boven 10 recepten. `commit_bounded_readiness` eist precies 10 readinessrijen per recept (persons 1–10), waardoor de bestaande cap de transactie op maximaal 100 readinessrijen begrenst. De code documenteert geen verdere historische reden voor exact 10. De limiet is niet naar een onbeperkte waarde gezet: de bewezen volledige set past binnen een expliciete cap van 20 recepten/200 readinessrijen.
- Ontwerpkeuze **A: bestaande bounded RPC veilig uitbreiden**. De nieuwe migratie `20261013153408_secure_shared_match_readiness.sql` vervangt alleen de planfunctie: maximaal 20 recepten, exacte DB-validatie dat de meegegeven recipe IDs gelijk zijn aan de volledige subscriber-set, geen extra/missende recipe IDs en exact 10 subscriber-rijen per recept. De bestaande `commit_bounded_readiness` blijft het enige writepad. Een aparte RPC zou dezelfde CAS-, lock-, scope- en rollbacklogica dupliceren en twee transactionele paden onderhouden.
- Transactionele garanties blijven in het bestaande RPC-pad: READ COMMITTED-only; shared catalog fence; gesorteerde try-advisory-xact-locks voor match-, dependency- en recipe-resources; plan-token wordt na lock opnieuw gevalideerd; transactionele scopeguard; match-upsert triggert readiness-invalidatie; readiness-upsert volgt binnen dezelfde database-RPC/transactie. Een conflict, buiten-scope-trigger of gedeeltelijke SQL-fout rolt alle match-, readiness-, invalidatie-, revisie- en protection-updates terug. De call schrijft alleen de opgegeven matchkeys en hun exacte volledige subscriberset; batches splitsen is niet toegestaan.
- Gewijzigd: migratie hierboven; `bounded-readiness-maintenance.ts` verhoogt de expliciete maximumscope naar 20 en valideert subscriber-recipe IDs en 1–10-rijen exact; TypeScript- en PostgreSQL-regressies plus deze statusnotitie. Geen nieuwe route/maintenance-feature; `ROADMAP.md` blijft ongewijzigd omdat 1B-scope hetzelfde blijft.
- Verificatie op de branch: PostgreSQL **36/36**, importer **501/501** (inclusief Shanghai/writepad safetytests), web **892/892**; web lint, typecheck en production-build groen; root `npm run check` en `git diff --check` groen. De PostgreSQL-suite draait alleen in een wegwerpcontainer; geen Production-DB aangeraakt.
- **Nog niet gedaan:** Production-migratie, RPC-vervanging/deployment, datawrite, refresh, Shanghai-run, merge. Production-writes **0**.
- Exacte volgende Production-stap voor Work, pas na PR-review/merge en afzonderlijke goedkeuring voor de migratie: voer uitsluitend `20261013153408_secure_shared_match_readiness.sql` uit op Production; doe daarna read-only een scopecheck die de twee keys, volledige 20 recepten en 200 readinessrijen bevestigt. Alleen bij exacte match mag Work één dry-run voor die twee keys maken. Een daadwerkelijke refresh vereist daarna afzonderlijke toestemming; nooit in twee batches opsplitsen.

# Checkpoint — PR #90 gemerged; Shanghai bounded write veilig geblokkeerd — 13 oktober 2026

- PR #90 is gemerged en gesloten met mergecommit **`955186670a63f161c3a94fc966ef61bcf60f88e9`**; de geteste PR-head was `dacbfecd52e9d617e08c1083ad94047617781f60`. Daarna is alleen deze documentatiecheckpoint naar `main` geschreven; de acht gewijzigde codebestanden blijven inhoudelijk gelijk aan de geteste PR-head. CI #542 en de Vercel status-check op de mergecommit zijn groen.
- Bestaande workflow-runs voor **Shanghai one-SKU writepad** gecontroleerd: #1 op main (vóór merge) was `dry-run`, geblokkeerd met lege bevestiging en nul writes; #27–#30 waren bounded dry-runs op de PR-branch; #29 en #30 rapporteerden `safe_to_write=true`. Na merge bestond nog geen write-run. Daarom is exact één write-dispatch gestart.
- Production deployment voor mergecommit `9551866` staat in Vercel op **READY**, target `production`: deployment `dpl_3tjzbdsZVHpqEbo8Piiu534qXuur`. Dit bevestigt de code-deployment, niet de Shanghai-datawrite.
- De enige post-merge write-run is **#31**, Actions run `38411445134`, job `115344547664`, branch/ref `main`, commit `955186670a63f161c3a94fc966ef61bcf60f88e9`, attempt 1, mode `write`, exacte bevestiging `WRITE_ONLY_SHANGHAI_231215000`. De volledige joblog is gecontroleerd.
- Run #31 bereikte de bestaande fail-closed preflight. SKU/productidentiteit, source fetch (HTTP 200, juiste finale Shanghai-URL), parser/source verification en recipe projection slaagden. De bron leverde de zeven verwachte aanvullingen en hoeveelheden. Gerichte read-only Production-SELECTs bevestigden dat vijf van de zeven supplementmatches current zijn; **olie** en **ui** zijn `match_status=valid` maar `refresh_status=pending`, met `invalidation_reason=candidate_product_or_price_changed` (13 oktober 12:09:57Z en 12:11:17Z). Matcher-versie is 4. Dit bewijst de blocker `supplement_match_not_current`.
- De gate rapporteerde `safe_to_write=false`, `blocked=true`, nul geplande records en nul write-operaties. **Er zijn geen Production-records gewijzigd; Production-write: niet uitgevoerd.** Een tweede write-run is niet gestart. Er zijn daarom geen post-write verificatie en geen post-write smoke test uitgevoerd. Er is geen bewijs van onverwachte writes.
- **Roadmap 1B blijft open**; `ROADMAP.md` is niet als afgerond gemarkeerd. De huidige Production-deployment draait de gemergede code, maar de Shanghai-dataflow is niet compleet.
- Read-only dependency-scopecheck toont dat de olie-matchkey voorkomt in 160 readinessrijen / 16 recepten en de ui-matchkey in 90 readinessrijen / 9 recepten, telkens voor persons 1–10. Deduplicatie over beide keys toont **200 unieke readinessrijen voor 20 recepten**. Een gedeelde refresh zou dus ook buiten Shanghai cachedata raken, buiten de geautoriseerde Shanghai/SKU-scope. De Shanghai-writepad kan deze supplementmatches niet bijwerken en blokkeert terecht. Geen refresh, tweede write-run of gate-omzeiling uitgevoerd.
- **Harde scopeblokkade:** binnen de huidige Shanghai-only toestemming is er geen bestaand veilig pad dat uitsluitend deze Shanghai-data ververst. De volgende stap vereist een afzonderlijk goedgekeurde scope-uitbreiding voor de gedeelde olie-/ui-matchkeys en bijbehorende readinessrijen, of een nieuw ontwerp dat die bijwerkingen aantoonbaar isoleert. Run #31 heeft nul writes verricht; `ROADMAP.md` blijft open.

---

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

- Gerichte fallback-/listing-/maintenance-/workflowproof: **63/63 groen**. Volledige `npm test`: **439/439 groen**. `npm run check`: groen. `npm run test:postgres`: **28/28 groen**. De vier betrokken workflow-YAML's parsen geldig; `git diff --check` groen.
- Geen Zyte-livecall, workflowdispatch, maintenance dry-run/write, productimport, databasewrite, migratie, merge of Production-deployment uitgevoerd. `ROADMAP.md` blijft ongewijzigd en 1A.1 blijft open.
- Resterende gate: Draft PR review en groene CI, daarna aparte mergegoedkeuring. Pas na merge voert Work één volledige maintenance **dry-run** uit en controleert complete snapshot plus fallbackaccounting; een groene dry-run geeft nog geen writetoestemming. Daarna blijft één afzonderlijk goedgekeurde finale write-acceptatie nodig.

---

# Checkpoint — handmatige Zyte read-only proofworkflow — 10 oktober 2026

## Technische proofstap

- Op branch `codex/hoogvliet-listing-fallback-1a1-20261010` / Draft PR [#66](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/66) staat nu een afzonderlijke `workflow_dispatch`-workflow: `.github/workflows/manual-zyte-listing-proof.yml`. Er is geen schedule, push- of pull-requesttrigger.
- `scripts/probe-zyte-listing-windows.mjs` doet hard gecodeerd exact zes sequentiële Zyte `browserHtml`-requests: eerst 3× `https://hoogvliet.nl/chips-zoutjes-noten/q/page/4`, daarna 3× `https://hoogvliet.nl/chips-zoutjes-noten/q/page/1`. Iedere call heeft één timeout van maximaal 60 seconden; er is geen retry, extra URL of providerfailover.
- De provider-HTML wordt offline door de bestaande `extractCatalogListingCandidates`-parser verwerkt. Subresources worden geblokkeerd. Per call worden alleen requestnummer, doel-URL, API-/bronstatus, veilige uiteindelijke Hoogvliet-URL, latency, HTML-bytecount, raw candidates, unieke SKU-count, hydratatiestatus en listingidentiteit gelogd. HTML, API-key en Authorization-header worden niet gelogd.
- `ZYTE_API_KEY` komt uitsluitend uit GitHub Actions secrets en is alleen beschikbaar in de secretcheck en proofstap. Checkout, dependencyinstallatie en Chrome-selectie krijgen de secret niet. Ontbrekende configuratie stopt vóór browser- of netwerk-I/O.

## Schrijfgrens, verificatie en overdracht

- Het proofscript importeert alleen Playwright en bestaande read-only Hoogvliet-parserhelpers. De workflow bevat geen Supabase-config, databaseverbinding, importer, maintenance-orchestrator, runregistratie, product-/prijswriter, deployment of migratie. Er is nog steeds geen fallbackproductiecode toegevoegd.
- Verificatie: gerichte proofregressies **5/5 groen**; `npm test` **417/417 groen**; `npm run check` groen; workflow-YAML parse geldig; `git diff --check` groen. PostgreSQL-tests zijn niet geraakt: deze wijziging heeft geen databasepad.
- De workflow is niet gestart en PR #66 is niet gemerged. `workflow_dispatch` wordt in de GitHub Actions-UI pas bruikbaar nadat deze workflow via een afzonderlijk goedgekeurde merge op default branch `main` staat. Exact volgend Work-checkpoint: review PR #66, geef apart mergebesluit, merge via de normale procedure en start daarna eenmaal **Actions → Handmatige Zyte listingproof → Run workflow → main**. Stop na de zes read-only requests; geen maintenance-run of write-run.
- `ROADMAP.md` blijft ongewijzigd en 1A.1 blijft open totdat de echte Zyte-proof groen is en de latere fallback afzonderlijk veilig is geïmplementeerd en bewezen.

---

# Checkpoint — roadmap 1A.1 providerbesluit; integratie wacht op live-proof — 10 oktober 2026

## Actuele bronstoring en remote basis

- Remote `main` en lokale basis zijn `f9fef2484ecae2fe588c76819e14005269082d8c` (PR #64 gemerged). Open PR's #54, #42, #41 en #21 raken deze listingfallback niet. PR #65 is gesloten zonder merge en wordt niet heropend.
- De gezonde proof bewees 20 root/listingroutes, 359 listingwindows, 6.766 unieke actuele listing-SKU's en natuurlijke exhaustion onder de ongewijzigde 800-cap. Run `37989858110` bewees daarna tijdelijke non-hydratatie op `chips-zoutjes-noten/q/page/4`: nul raw SKU's waar een eerdere gezonde proof er 20 zag. Dry-run `38032494407` stopte fail-closed na 12/20 routes, 226 windows en 4.288 SKU's op `category_listing_stagnated`; GraphQL-/prijsfase en writer zijn niet bereikt.
- Daarmee blijven traversal, cap en writer buiten de bewezen oorzaak. Echte stagnatie, repeated windows, loops, 404's, parserwijzigingen en caps moeten fail-closed blijven.

## Provideronderzoek en besluit

- Bright Data Web Unlocker en Zyte API kunnen beide één exacte URL server-side met JavaScript/anti-botondersteuning ophalen. Bright Data gebruikt voor de kleinste route een API-token plus Web Unlocker-zone en documenteert pay-per-success; Scraping Browser/remote CDP is voor één HTML-window onnodig zwaar. Zyte gebruikt één API-key en één `browserHtml`-POST met response-URL en past daardoor het kleinst vóór de bestaande parser.
- Voorkeur voor de verplichte live-proof: **Zyte API**. De importer mag pas worden gekoppeld nadat `hoogvliet.nl`-support, actuele domeinprijs, latency en herhaalbare producthydratie met een echt account zijn bewezen. Zonder credentials zijn die feiten niet objectief vast te stellen; daarom is geen gokadapter aan het productiepad toegevoegd.
- De exacte vergelijking, fallbacktrigger, toekomstige grenzen en maximaal-zes-request Work-proof staan in `docs/hoogvliet-listing-fallback-1a1.md`. Beoogde defaults: provider uit, maximaal 3 fallbackrequests/run (hard maximaal 10), één poging/window, 45 s timeout (hard maximaal 60 s), geen SDK-retry/providerfailover, secret alleen server-side en dezelfde parser/normalisatie/dedupe/GraphQL-pipeline.

## Scope, branch en vervolg

- Branch: `codex/hoogvliet-listing-fallback-1a1-20261010`; documentatiecommit `a5487fe`; Draft PR [#66](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/66). Geen importer-, workflow-, database-, migration-, delete-, budget-, gebruikersdata- of providerconfigwijziging; geen workflowdispatch, maintenance-run, Production-write, deployment of merge.
- Verificatie op de actuele main-basis: `npm test` **412/412 groen**, `npm run check` groen en `git diff --check` groen. PostgreSQL-tests zijn niet geraakt of nodig voor deze documentatie-only providergate.
- `ROADMAP.md` blijft ongewijzigd: 1A.1 is nog niet technisch afgerond. Exacte Work-stap: voer alleen de gedocumenteerde Zyte domain-pricing-check en read-only 3× probleemwindow + 3× controlewindow proof uit. Stop daarna zonder maintenance dry-run/write. Bij groen gaat de uitkomst terug naar Codex voor de minimale adapter en de tien regressies.

---

# Checkpoint — listing-window-limit root cause en fix — 9 oktober 2026

## Failure en bewezen hoofdoorzaak

- Remote basis en mislukte run: `main` `0306dda5ad9acd6a6bbc33f6b062892b2fca7a5e` (PR #63 gemerged), handmatige read-only maintenance-run [37889890176](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37889890176). Setup, runner-Chrome en 407/407 regressies waren groen; de maintenance stopte fail-closed op `listing_window_limit` bij `MAINTENANCE_MAX_LISTING_WINDOWS=800`. Er zijn geen writes uitgevoerd en geen retry/maintenance-dispatch gestart.
- Hoofdoorzaak **B**: de root leverde de geldige hoofdcategorieën, maar `collectPublicCatalogCandidates` ontdekte daarna op iedere categoriepagina opnieuw geneste categorielinks en crawlde zowel de geaggregeerde ouderlisting als alle overlappende kinderen volledig. Bovendien navigeerde iedere niet-rootcategorie eerst voor child discovery en direct daarna opnieuw in `collectCatalogListing`. De 800-cap telde daardoor overlappende nested listingvensters, niet 800 noodzakelijke unieke catalogusvensters.
- De cap zelf is niet te laag. Read-only openbare-bronproof [37899504710](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37899504710) op de gefixte code exhaustte natuurlijk met **20 unieke geldige rootcategorieën**, **20 listingroutes** (**21 routes inclusief root**), **359 listingvensters**, **6.766 unieke actuele listing-SKU's**, **0 herhaalde windowfingerprints**, **1 venster zonder nieuwe globale SKU**, **0 page-0/1-aliases** en `sourceExhausted=true`. Marge tot de ongewijzigde 800-cap: **441 vensters**. Er is geen pagination-loop en geen nieuwe cap nodig.

## Minimale fix en veiligheid

- De rootcategorieboom wordt na URL-normalisatie exact gededupliceerd. Alleen minimale geaggregeerde listingroutes worden gecrawld; een geneste route wordt uitsluitend als fallback bezocht wanneer de ouder aantoonbaar een navigatie-only pagina zonder listingproducten is. Elke categorie krijgt één initiële navigatie in plaats van de eerdere dubbele voornavigatie.
- Page `0`/`1`-aliassen delen één canonical listing-identiteit en blokkeren een echte volgende pagina niet. Een herhaalde verse SKU-set stopt fail-closed als `category_listing_repeated_sku_window` en telt niet als extra venster. Natuurlijke exhaustion op exact de safety-cap wordt correct als compleet herkend; een echte cap met verdere pagination blijft onvolledig en bereikt geen writer.
- `MAINTENANCE_MAX_LISTING_WINDOWS` blijft **800**. Geen importer-, prijsrefresh-, database-, scheduler-, delete-, full-rebuild- of gebruikersdatapad is toegevoegd of uitgevoerd. Onvolledige snapshots blijven vóór `assessDailyCatalogCandidates`/`upsertProducts` stoppen; er bestaat geen automatische maintenance-importretry in deze flow.
- Maintenance success/failure-accounting vermeldt voortaan rootcategorieën, geselecteerde/bezochte routes, listingvensters, unieke SKU's en duplicates, zodat een toekomstige bronwijziging direct bewijsbaar is.

## Tests, branch en overdracht

- Gerichte discovery/importer/maintenance-regressies: **167/167 groen**. Toegevoegd/gedekt: category-URL-dedupe, ouder/nested-overlap éénmaal, navigatie-only nested fallback, repeated SKU-window zonder lus/hercount, page-0/1-alias plus echte next, natuurlijke exhaustion exact op cap, echte cap blijft fail-closed en onvolledige snapshot doet nul writes/nul retry.
- `npm test`: groen. `npm run check`: groen. `git diff --check`: groen. Read-only sourceproof `37899504710`: groen. De eerdere bounded diagnoseprobe `37896952067` stopte op zijn 20-minutengrens bij een experimentele 1.500-window observability-run; hij deed geen writes en is niet herhaald als maintenance.
- Branch: `codex/debug-listing-window-limit-20261009`. Functionele code-head: `4f65d1465c00a2cc58ceda30fe4dd1e2ddf3fc1d`. Draft PR: [#64](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/64); geen merge.
- Exacte Work-vervolgstap: review de kleine discoverydiff en groene CI/proof. Merge alleen via de normale releaseprocedure. Voer daarna maximaal één handmatige **dry-run** vanaf `main` uit en controleer in de nieuwe accounting `sourceExhausted`, root/listingroutes, circa 359 listingvensters, unieke SKU's en marge onder 800. Geen write-mode, retry of capverhoging in dit checkpoint.

---

# Checkpoint — PR #63 Hoogvliet category-URL hotfix — 9 oktober 2026

## Bewezen oorzaak en fix

- Actuele basis was remote `main` `8a9a6d2dca0f65b4e8f9f3d87d0b879d1cad7eff`; PR #62 is daarop gemerged. Handmatige volledige-maintenance-run `37879813707` op die main faalde met de gemelde `GET https://hoogvliet.nl/Hoogvliet.nl` / `route=catalog:category` / HTTP 404.
- `collectPublicCatalogCandidates` ontdekte categorieën uit publieke `a[href]`-links. `normalizeCatalogCategoryURL` eiste eerst alleen de juiste host en sloot bekende niet-catalogpaden uit; daardoor werd `/Hoogvliet.nl` ten onrechte als categorie geaccepteerd. De collector zette dit ontdekte pad vervolgens zelf als `categoryURL` in de requestcontext vóór navigatie. De echte HTTP 404-classificatie `source_unavailable` was correct en is behouden. De parser gebruikt geen canonical-tag om deze URL te vormen; de zichtbare request is de ontdekte linkroute, geen aangetoonde canonical/redirectroute.
- Hetzelfde toelatingsgat gold voor andere URL-paden met een domeinachtig puntsegment. Normalisatie en de readiness-check wijzen nu elk pad met een punt in een decoded segment af, ook `%2E`; geldige root- en geneste categorieën blijven toegelaten. Regressiefixture bevat zowel geldige categorieën als `/Hoogvliet.nl` en bewijst dat alleen de geldige routes ontdekt/bezocht worden.

## Verificatie en releasegate

- Gerichte discovery/importer-tests: **112/112 groen**, inclusief de bestaande 404-bronfoutregressie. `npm test`: **407/407 groen**. `npm run check`: groen. `git diff --check`: groen.
- Live read-only dry-run niet uitgevoerd: directe Hoogvliet-toegang vanuit deze omgeving wordt door de network proxy geweigerd; lokale Chromium-fixturetests verifiëren de discoveryfilter. Geen retry, workflowdispatch, Production-write, databasewrite of migratie uitgevoerd.
- Hotfix branch `codex/hotfix-catalog-category-url-20261009`, functionele codecommit `e34addaaaf2fec95471f386a646de93b1f9115a0`; PR #63: https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/63. Op de laatste code/test-head `ab85315813a6e0fbdce61f20bc28040f1ba37c5d` zijn Core-CI run `37886169402`, read-only offer-audit `37886169362`, explicit-SKU run `37886169415` en Vercel Preview **allemaal groen**. De lokale volledige suite (407/407), gerichte suite (112/112), `npm run check` en `git diff --check` zijn eveneens groen. PR is open en mergeable; niet gemerged.

---

# Checkpoint — PR #62 workflowfix en finale releasegate — 9 oktober 2026

## Actuele basis en bewezen blokkade

- Remote `main` is ongewijzigd `c4c34a59cc8dc546a9ffdfe915ae58a57cbd2899`. PR #62 bleef Draft en mergeable; de onderzochte oude PR-head was `b985ff2365e98b2c743df99431318d7eb5b8fa9a`.
- Op die oude head waren Core-CI, Vercel Preview en de read-only offer-audit groen. Explicit-SKU-run `37832327035`, job `113500774771`, hing exact van 19:30:06 tot 20:30:16 UTC in `npx playwright install --with-deps chromium`; de SKU-validatiestap werd overgeslagen toen de jobtimeout annuleerde.
- De normale schedule-route gebruikte volledige maintenance, maar Actions bood handmatig alleen legacy/importermodi en geen expliciete full-maintenance dry-run/write-route.

## Uitgevoerde fixes

- Functionele fixcommit: `c102321b7a7bd91242cd260893325b79a600e2f1` (`Fix maintenance workflow release gates`) op bestaande branch `codex/daily-catalog-maintenance-20261008`; geen nieuwe PR.
- Explicit-SKU, normale schedule en retry selecteren nu de reeds aanwezige GitHub-runner Chrome/Chromium en geven het vaste executable path via `CHROME_PATH` aan dezelfde Playwright-code. Er is in die paden geen `playwright install --with-deps` of Ubuntu-pakketinstallatie meer. Een lokale echte launch via `/usr/bin/chromium` slaagde met Chromium `151.0.7922.173`.
- Nieuwe handmatige workflow `manual-daily-catalog-maintenance.yml` roept exact dezelfde `npm run import:daily`-orchestrator aan als schedule/retry, deelt concurrencygroep `hoogvliet-supabase-update` en gebruikt dezelfde maintenance-config. Default `dry-run` leest en beoordeelt de volledige flow zonder runregistratie/product-/prijswrites; `write` vereist `refs/heads/main` plus exact `RUN_DAILY_MAINTENANCE_WRITE`.
- De maintenance-orchestrator rapporteert in dry-run de aantallen nieuwe en bestaande records die hij zou schrijven, maar roept `startCatalogImportRun`, `upsertProducts`, `finishCatalogImportRun` en de nacontrolewriteflow niet aan. Het normale writepad, de bestaande catalogusrun-lock, last-known-good en alle prijs-/aanbiedingslogica zijn ongewijzigd behouden.
- De scheduled 06:00 DST-route en watchdog/retry blijven volledige maintenance zonder max-400 of 1/7×100. De handmatige legacy-400-route blijft afzonderlijk bestaan en kan niet per ongeluk door de nieuwe handmatige workflow worden gekozen.

## Tests en actuele remote releasegate

- Gerichte workflow-/maintenance-/explicit-SKU-regressies: **52/52 groen**. Volledige `npm test`: **407/407 groen**. `npm run check`: groen. `npm run test:postgres`: **28/28 groen**. `git diff --check`: groen. Vier betrokken YAML-workflows parsen geldig.
- Nieuwe head `c102321b7a7bd91242cd260893325b79a600e2f1`: Core-CI run `37873837104` **success** in 3m01s; Vercel Preview **success**; offer-audit run `37873837086` **success** in 5m00s.
- Explicit-SKU-run `37873837109`, job `113637711231`: **success in 34s**. Runner-Chrome-selectie en de daadwerkelijke bounded final_batch3 read-only SKU-validatie zijn beide uitgevoerd en groen; de eerdere 60-minuteninstallatieblokkade is weg.
- GitHub meldt PR #62 op deze functionele head `CLEAN` en `MERGEABLE`. De handmatige workflow is statisch en via regressies gevalideerd; hij wordt pas na merge vanaf `main` dispatchbaar. Er is in deze Codex-run geen workflowdispatch gedaan.
- Geen merge, Production-maintenance, productimport, prijsrefresh, Production-databasewrite, migratie of deploy gestart. Alleen branchcode, tests, documentatie, read-only PR-checks en Vercel Preview zijn uitgevoerd.

## Releasebesluit

- PR #62 is functioneel releaseklaar. Volgende stap: Work beoordeelt de kleine workflowdiff en geeft afzonderlijk mergetoestemming. Na merge mag eerst de handmatige **dry-run** vanaf `main` worden gebruikt; een geslaagde dry-run geeft uitdrukkelijk geen toestemming voor `write`.

---

# Checkpoint — volledige dagelijkse catalogus- en prijsonderhoudsflow — 8 oktober 2026

## Implementatie en root gap

- Root gap opgelost: de normale daily route gebruikt nu één `daily-catalog-maintenance`-orchestrator voor de volledig en aantoonbaar uitgelezen actuele Hoogvliet-listingset. Nieuwe SKU's gaan door de bestaande exacte detailvalidator; bestaande SKU's gebruiken exacte SKU-GraphQL-prijs-/aanbiedingsdata en alleen bij ontbrekende/inconsistente bulkdata de bestaande detailfallback.
- De orchestrator stelt eerst de volledige betrouwbare snapshot en alle benodigde fallbacks vast en schrijft daarna alleen nieuwe SKU's en werkelijk gewijzigde bestaande prijsstatussen via het bestaande `upsertProducts`-pad. Een onvolledige, geblokkeerde of lege snapshot bereikt geen writer. Per-SKU-fouten, 404, ontbrekende of niet-positieve prijs behouden last-known-good; er is geen deletepad voor verdwenen of Production-only SKU's.
- Aanbiedingsnormalisatie is gecentraliseerd: actief schrijft actieprijs, normale `old_price`, `is_offer=true` en beschikbare periode/tekst; een betrouwbaar beëindigde/verlopen aanbieding schrijft de actuele normale prijs en wist de actieve aanbiedingstatus. Hoogvliet blijft de enige prijsbron; afbeeldingen en gebruikersdata vallen buiten deze route.
- De bestaande 06:00 Europe/Amsterdam DST-gate, workflowconcurrency, `catalog_import_runs`-lock, watchdog en retryvensters zijn behouden. De monitor en retries beoordelen nu de maintenance-runstatus in plaats van een 400-doelstatus. De 70 globale pending readinessrijen worden niet gelezen of gemuteerd en blokkeren deze onderhoudsroute niet.

## Limits en efficiëntiebewijs

- Normale daily: geen target van 400 nieuwe producten, geen 1/7-prijsshard en geen max-100 prijsrefreshes meer. De oude growth/state-machine met max 400 blijft uitsluitend beschikbaar als expliciete handmatige legacy/catch-up-route via `import:daily-growth`; bestaande handmatige catalog/price/classify-routes zijn niet blind verwijderd.
- Lokale read-only proof beoordeelt **8.355** actuele bestaande SKU's in één maintenance-assessment: **8.355 bulkprijschecks**, **0 detailfallbacks**, **0 writes** bij ongewijzigde prijzen. Listingfixtures bewijzen één GraphQL-call per vers listingvenster (2 vensters = 2 calls voor 3 SKU's), niet één detailbrowserbezoek per SKU. Dagelijkse aanbiedingstart en -einde zitten voor iedere actuele bestaande SKU in dezelfde bulkbeoordeling.
- Detailfallback heeft alleen een fail-safe maximum van 500 voor nieuwe/onvolledige/inconsistente kandidaten; dit is geen dekkinglimiet voor betrouwbare bulkprijschecks. Listingtraversal heeft een ruime veiligheidsgrens van 800 vensters en moet bewezen uitputten voordat writes mogelijk zijn.

## Tests, branch en overdracht

- `npm test`: **405/405 groen**. Verplicht afgedekt: normale prijswijziging, aanbieding start/wijzigt/eindigt, expired offer, bronfout/last-known-good, null/€0, nieuwe SKU, verdwenen SKU, Production-only SKU, dedupe, geen 1/7 × 100, geen normale max-400 en geen gebruikersdata-/deletepad.
- `npm run check`: **groen**. `npm run test:postgres`: **28/28 groen**. `git diff --check`: **groen**. De drie gewijzigde workflow-YAML-bestanden parsen geldig.
- Branch: `codex/daily-catalog-maintenance-20261008`. Functionele code-head: `ddf61cd` (`Implement full daily catalog maintenance`). Draft PR: [#62](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/62).
- Database-migratie: **nee**. `ROADMAP.md` is ongewijzigd: dit herstelt bestaand dagelijks onderhoud en introduceert geen apart roadmapdoel.
- Exacte Work-vervolgstap: review Draft PR #62 en wacht op groene PR-CI; controleer workflowdiff en merge daarna pas via de normale releaseprocedure. Voer na merge maximaal één gecontroleerde scheduled-equivalent maintenance-run uit en controleer read-only runstatus, catalogus-/prijsaantallen, aanbiedingen en duplicates. Geen automatische retry buiten de bestaande watchdog, geen full rebuild en geen database-migratie.
- In deze Codex-run zijn **geen Production-import, prijsrefresh, workflowdispatch, databasewrite, migratie, deploy of merge** uitgevoerd.

---

# Checkpoint — snelle audit dagelijkse catalogus- en prijsonderhoud — 8 oktober 2026

## Audituitkomst

- Technische basis: actuele `origin/main` en lokale HEAD zijn beide `c4c34a5`. Open Draft-PR's #54, #42, #41 en #21 leveren geen actuele daily-maintenancefix op; remote main blijft de technische waarheid.
- De 06:00-flow voert dagelijks root→categorie-listingdiscovery uit en valideert nieuwe SKU's via exacte detail-SKU, naam, verpakking, Hoogvliet-URL en positieve prijs. Hij is echter nog een persistente **400-nieuwe-producten-job** en slaat bestaande SKU's tijdens growth-discovery over.
- Bestaande prijzen lopen apart om 02:17 UTC: één van zeven SKU-shards per dag, met maximaal 100 producten uit een weekcyclusvenster. Bij circa 8.355 producten duurt één volledige ronde daardoor ongeveer 12 weken; dit is niet dagelijks actueel.
- Voor een daadwerkelijk ververste SKU zijn aanbieding start/einde correct: actieve aanbieding schrijft `price=actieprijs`, `old_price=normale prijs`, `is_offer=true`; na bronvalidatie zonder actieve aanbieding worden `old_price=null` en `is_offer=false`. Een verlopen aanbieding kan door de trage ronde tot de volgende SKU-refresh opgeslagen actief blijven.
- Last-known-good is veilig voor fetch-/parse-/not-found- en niet-positieve-prijsfouten: zo'n kandidaat wordt overgeslagen en `upsertProducts` weigert iedere niet-eindige of niet-positieve prijs vóór product-/prijswrites. Er is geen deletepad voor verdwenen of Production-only SKU's; beide blijven bestaan. Exacte SKU-dedupe en de database-upsertkey voorkomen productduplicaten.
- Gerichte read-only regressiegate: `node --test test/importer.test.mjs test/daily-catalog-growth.test.mjs test/catalog-growth-integration.test.mjs` — **138/138 groen**.
- De gewenste flow past op de bestaande discovery-, detail/GraphQL-validatie-, offernormalisatie- en Supabase-upsertcomponenten. De ontbrekende hoofdcomponent is één dagelijkse catalogusmaintenance-orchestrator die de actuele listingset reconcilieert, nieuwe SKU's veilig toevoegt en alle bestaande prijzen/aanbiedingen dagelijks ververst zonder groeidoel of deletes.
- De 70 globale `pending` readiness-cacherijen blokkeren catalogus-/prijsmaintenance **niet**; dit blijft een los data-health-item en is niet verder onderzocht.

| Onderdeel | Werkt al? | Belangrijkste bevinding | Wijziging nodig? |
|---|---|---|---|
| daily catalogus | Deels | Dagelijkse listingdiscovery bestaat, maar is target-400 growth en geen volledige maintenance-reconciliatie. | Ja |
| nieuwe SKU | Ja | Exacte SKU/detail/data en positieve prijs zijn verplicht vóór insert; duplicates worden gededupliceerd. | Nee, hergebruiken |
| bestaande prijs | Nee | Dagelijks slechts 1/7 shard × max. 100; volledige ronde circa 12 weken. | Ja |
| aanbieding start | Deels | Semantiek is correct bij refresh, maar niet dagelijks voor iedere SKU. | Ja |
| aanbieding einde | Deels | Refresh zet normale prijs en `is_offer=false`; expired state kan tot de volgende ronde blijven staan. | Ja |
| last-known-good | Ja | Bron-/validatiefout schrijft geen vervangende prijs. | Nee, behouden |
| null/€0 bescherming | Ja | Niet-eindige en niet-positieve prijs stopt vóór writes. | Nee, behouden |
| verdwenen SKU | Ja | Not-found wordt overgeslagen; geen hard delete. | Nee, behouden |
| Production-only | Ja | Niet in listing aangetroffen records worden niet verwijderd. | Nee, behouden |
| max-400 | Ja, actief | 400 nieuwe producten is nog hard onderdeel van normale daily job/state machine en strijdt met de onderhoudseis. | Ja |
| efficiëntie | Deels | Listings/API/GraphQL bestaan, maar prijsmaintenance gebruikt per geselecteerde SKU een detailpagina en bereikt slechts 100/dag. | Ja |
| 70 pending readiness | N.v.t. | Blokkeert maintenance niet; los data-health-item. | Nee in deze scope |

## BELANGRIJKSTE BEWEZEN HOOFDGAP

- Er ontbreekt één dagelijkse catalogusmaintenance-orchestrator voor de volledige actuele SKU-set.
- De normale daily flow is nog growth-only met doel 400 en slaat bestaande SKU's over; de aparte prijsflow ververst slechts 100 producten per dag.
- Daardoor kunnen bestaande prijzen en aanbieding start/einde niet dagelijks actueel zijn.
- Pas de bestaande daily workflow/orchestratie rond `collectProducts`, `refreshExistingProducts` en `upsertProducts` aan; geen nieuwe prijsbron of database-migratie nodig.

## Implementatiecheckpoints

### Checkpoint 1 — Codex

- Doel: bouw de dagelijkse maintenance-orchestratie op de bestaande listing/API/GraphQL- en upsertlogica; verwijder max-400 als normaal daily doel; voeg nieuwe valide SKU's toe, ververs alle bestaande prijzen/aanbiedingen en behoud records die ontbreken of alleen in Production bestaan.
- Concrete bestanden/componenten: `.github/workflows/import-hoogvliet-poc.yml`, `.github/workflows/retry-daily-catalog-import.yml`, `package.json`, `src/config.mjs`, `src/daily-catalog-growth.mjs` (of de vervangende daily-maintenance-entrypoint), `src/catalog-growth.mjs`, `src/hoogvliet.mjs`, `src/importer.mjs` en gerichte importer/daily/workflowtests.
- Database-migratie: **nee**.
- Tests, uitsluitend: (1) normale prijs verandert; (2) aanbieding start; (3) aanbieding eindigt; (4) fetchfout behoudt geldige prijs; (5) null/€0 overschrijft niets; (6) nieuwe SKU wordt toegevoegd; (7) verdwenen SKU blijft bestaan; (8) Production-only SKU blijft bestaan; (9) duplicates blijven 0.

### Checkpoint 2 — Work

- Doel: review/release van Checkpoint 1 en één gecontroleerde scheduled-equivalent acceptatie op de normale flow; bewijs daarna read-only de negen scenario-uitkomsten en dat de flow geen 400-nieuw-doel of deletepad meer gebruikt.
- Concrete componenten: PR/CI, beide daily workflows, Actions-runsummary en read-only Production-nacontrole van producten/prijzen/duplicates.
- Database-migratie: **nee**.
- Tests: dezelfde negen scenario's; geen extra acceptatie-eisen.

## Uitvoeringsgrens

- In deze audit zijn **geen writes, productimports, prijsrefreshes, workflowdispatches, migraties of databasewijzigingen** uitgevoerd. Alleen `PROJECT_STATE.md` is bijgewerkt; `ROADMAP.md` blijft ongewijzigd omdat dit een correctie van bestaand importer-/maintenancegedrag is en geen nieuw structureel roadmaponderdeel.

---

# Checkpoint — PR #61 gerichte planner-maintenance — 8 oktober 2026

## Release en annulering check
- PR #61 is squash-gemerged als b3de9ea447da08e6bb178f751853c8837839b53c; actuele main-head bij deze checkpoint is dezelfde SHA.
- Main-CI Stability & core flows run 37808629960 is groen. De workflow .github/workflows/planner-maintenance-targeted.yml staat op main.
- PR-head Core-CI run 37801863524 was groen. PR-check Explicit SKU catch-up run 37801863422 was cancelled met GitHub-annotatie: "Canceling since a higher priority waiting request for hoogvliet-supabase-update exists". Het runrecord heeft nul jobs; dit was concurrency-supersede, geen testfailure en geen Production-import.
- Scope-review: alleen handmatige workflow_dispatch vanaf main, vaste final_batch3-bron, exacte bevestiging, exact-12-guard, Production-prechecks en maximaal één POST. Geen importer-, prijsrefresh-, schedule/push-, discovery-, migration-, retry- of full-rebuildpad.

## Verse Production-precheck en dispatch
- Final CSV op main: data/hoogvliet-missing-production-2026-10-08-final.csv; SHA-256 d5c43b501d4dfbf2498d1765340b354b4b487d47806c0b8683dcfcb748025dd5.
- Vlak vóór dispatch read-only gemeten: **8.355 producten**, **8.355 unieke SKU's**, **8.355 prijzen**, **0 duplicate-SKU-groepen**; running daily jobs **0**, attempts **0**, catalog-imports **0**, actieve importerlocks **0**, granted advisory locks **0**. Er waren **2** oude retry_scheduled records maar **0 huidige claimbare retries**.
- Exact 12 doel-SKU's waren aanwezig met 12 unieke interne UUID's en alle prijzen > €0. 727643000 was afwezig. Geen actieve concurrentie.
- Exact één handmatige run vanaf main: [Targeted planner maintenance run 37809361387](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37809361387), commit b3de9ea447da08e6bb178f751853c8837839b53c, inputs source=final_batch3 en confirm=RUN_TARGETED_MAINTENANCE. Conclusion **success**; runtime circa **20 seconden**. Runner voerde exact **1 POST** uit met 12 product-UUID's.
- Endpoint accepteerde de aanvraag (HTTP **2xx**, route-default **200**); runnerstatus confirmed, response productCount=12, changedMatchKeys=0, affectedRecipeIds=0, refreshedReadinessCount=0, linked matchrows **0**, affected readinessrows **0**. Geen retry of full rebuild; er is geen importer gestart.

## Read-only nacontrole en conclusie
- Production na de run bleef **8.355 producten / 8.355 unieke SKU's / 8.355 prijzen**, **0 duplicates**; alle 12 doelproducten bleven aanwezig en 727643000 afwezig. Geen product-/prijsmutatie.
- Na afloop: running jobs/attempts/imports **0**, actieve locks **0**, granted advisory locks **0**.
- De persistente catalog_discovery_state toont plannerMaintenance.status=confirmed, pendingProductIds=[], notifiedProducts=1489; recordtijd **2026-10-08 12:37:34 UTC**, dus deze bevestigde state bestond al vóór de targeted POST. Er zijn geen ingredient_product_matches gekoppeld aan de 12 doelproducten. De POST was daarom een geaccepteerde, begrensde no-op: er waren geen target-relevante matches/recept-readinessrijen om te wijzigen. De call zelf heeft geen cache/readinessrijen vernieuwd.
- Globaal waren read-only **70** readiness-cache-rijen pending en **1.300** current; door nul target-matchkeys zijn die 70 niet aan deze 12 toe te schrijven. Claim daarom geen algemene planner-cache-clean status.
- Planner-maintenance voor deze 12: **SUCCESS / bevestigd zonder targetwijzigingen**; pending_requires_attention is in de actuele persistente state afwezig, maar was al opgelost vóór deze call. Geen tweede call.
- Volgende checkpoint kan de dagelijkse catalogus-/prijsverversing en last-known-good afzonderlijk oppakken; beoordeel daarbij de 70 globale pending-readinessrijen expliciet. Geen nieuwe import of prijsrefresh is in deze run gestart. ROADMAP.md is ongewijzigd.

---

# Checkpoint — planner-cache herstel hervat; POST geblokkeerd door ontbrekende request-capability — 8 oktober 2026

## Main/CI en schedulerstatus

- Actuele main vóór deze checkpoint-update: `f5145822e68b9714342333c4fafd8ba32dadc555`; PR #60 mergecommit `9483da35399c987146e4501c71645c1d884db1b1` staat erop.
- Main Core-CI is groen op actuele main (Core flows, regressions & production build; check run `37768583490`). De PR-mergecheck `37768188977` is eveneens groen.
- Read-only schedulerbeoordeling: `inspect:daily` haalt uitsluitend de job op voor de huidige Amsterdamse datum. De twee `retry_scheduled` records horen bij 2026-10-06 en 2026-09-29 en zijn daarom niet claimbaar door de normale retry-workflow voor 2026-10-08. Geen job/attempt/lock is verwijderd, geannuleerd of geforceerd.
- Laatste Production-precheck: running daily jobs **0**, running attempts **0**, running catalog_import_runs **0**, actieve importerlocks **0**, granted advisory locks **0**; retry_scheduled **2**, beide niet claimbaar door de huidige scheduler.

## Configuratie en Production-data

- Expliciete SKU-workflow op main bevat de Production-origin `https://boodschappenmaatje-pwa.vercel.app`; het domein staat bij het Vercel-project `boodschappenmaatje-pwa`, waarvan de laatste deployment `READY/production` is.
- Vereiste secretnamen zijn aanwezig in GitHub Actions; `PLANNER_CACHE_ADMIN_TOKEN` is ook aanwezig als sensitive Vercel Production-env-var. Secretwaarden zijn niet uitgelezen of getoond. GitHub/Vercel token-gelijkheid is niet zelfstandig leesbaar en kon zonder endpointcall niet functioneel bevestigd worden.
- Laatste read-only Production-meting: **8.355 producten**, **8.355 unieke SKU's**, **8.355 prijsrecords**, **0 duplicate-SKU-groepen**. Dit is één hoger dan het vorige checkpoint door de afzonderlijke geplande catalog-import `ab2c14ad-891b-4bd7-987c-974191e9f0f1` (`trigger=schedule`, status `partial`, `new_count=1`, foutcount 0; product `731552000`, prijs €2,29). Deze run was niet door planner-maintenance gestart.
- De 12 final_batch3-SKU's zijn read-only opnieuw bevestigd: **12 SKU's / 12 unieke product-ID's**, alle 12 met positieve prijs, naam, verpakking en Hoogvliet-product-URL. `727643000` blijft afwezig. Bestaande match-cache-rijen gekoppeld aan deze product-ID's: 0 vóór herstel.

## Maintenance-call

- Er is **geen** POST naar `/api/internal/planner-readiness/new-products` uitgevoerd; dus HTTP-status, processed/notified count en uitkomst bestaan niet. Geen productimport, prijsrefresh of database-/cachewijziging is door deze sessie gestart.
- Blokkade is uitvoertechnisch: de beschikbare connectors bieden read-only HTTP-fetch, maar geen geauthenticeerde POST met JSON-body en headers. De expliciete SKU Actions-workflow is niet als alternatief gestart omdat die ook de importer uitvoert. Geen credentials zijn gereconstrueerd of naar een andere bestemming doorgestuurd.
- `pending_requires_attention` is daardoor niet bevestigd opgelost; geen full cache rebuild is uitgevoerd.
- Volgende stap: voer na een nieuwe read-only concurrentieprecheck exact één geauthenticeerde POST uit via een goedgekeurde runner die uitsluitend de 12 gecontroleerde product-UUID's aanbiedt; doe daarna de gevraagde read-only cache- en count-nacontrole. Geen importerdispatch, retry of full rebuild.
- `ROADMAP.md` is ongewijzigd.

---

# Checkpoint — PR #60 planner-maintenance release; targeted repair blocked by active importer — 8 oktober 2026

## PR #60 release

- PR #60 is squash-merged. Mergecommit / main-head at release: `9483da35399c987146e4501c71645c1d884db1b1`.
- Main-CI run [37768188977](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37768188977) was still `in_progress` at the latest check; green status is not yet confirmed.
- The merged explicit SKU workflow sets `PLANNER_CACHE_BASE_URL=https://boodschappenmaatje-pwa.vercel.app` and passes the GitHub Actions secrets `PLANNER_CACHE_ADMIN_TOKEN` and `VERCEL_AUTOMATION_BYPASS_SECRET`.
- The Vercel project `boodschappenmaatje-pwa` lists `boodschappenmaatje-pwa.vercel.app` as its Production domain. Vercel Production has a sensitive `PLANNER_CACHE_ADMIN_TOKEN`; GitHub Actions lists both requested secrets. Secret values were not read or disclosed. Exact value equality between the write-only GitHub secret and Vercel Production configuration could not be independently verified.

## Read-only Production check; maintenance call NOT made

- Production counts: **8,354 products**, **8,354 unique SKUs**, **8,354 price records**, **0 duplicate-SKU groups**.
- All 12 final_batch3 SKUs are present with positive prices. Excluded SKU `727643000` is absent.
- The safety precheck found a running daily job, a running daily attempt, and an active unexpired importer lock. It also found two older `retry_scheduled` daily-job records. Running catalog_import_runs: **0**; granted advisory locks: **0**.
- The running job/attempt and active lock violate the no-concurrent-import requirement. Fail-safe applied: **no planner-maintenance POST was issued**. No product import, price refresh, cache maintenance, migration, or database mutation was started by this checkpoint.
- Since the maintenance endpoint was not called, cache/readiness status remains unverified; `pending_requires_attention` is not confirmed resolved.

## Result and safe next step

- PR #60 release: merged; mergecommit above.
- Targeted planner-cache repair: **BLOCKED**, not failed at the endpoint. No response status or processed/notified count exists because the call was deliberately withheld.
- Resume only from a newly authorized checkpoint after main-CI is green, all running daily jobs/attempts/imports and relevant locks are absent, and the secret configuration can be safely validated. Then re-check the exact 12 Production UUIDs and send at most one bounded maintenance request. Do not retry or run a full rebuild automatically.
- `ROADMAP.md` is unchanged.

---

# Checkpoint — finale catch-up batch 3 write — 8 oktober 2026

## Write-run en scope

- Vanaf main `a4820cf70cb4c18e22815067b8a3ff90f9dba0bd` is exact één dispatch gedaan: [Explicit SKU catch-up run 37760954697](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37760954697), `source=final_batch3`, `mode=write`, `max=12`.
- Vóór de dispatch: 8.342 producten, 8.342 unieke SKU's, 8.342 prijsrecords; 0 duplicate-SKU-groepen; final-SKU's aanwezig 0/12; running daily jobs 0, attempts 0, catalog-imports 0, relevante locks 0 en granted advisory locks 0.
- De vaste CSV is opnieuw gecontroleerd: 12 SKU's, 12 uniek, geen lege SKU's; SHA-256 `d5c43b501d4dfbf2498d1765340b354b4b487d47806c0b8683dcfcb748025dd5`. `727643000` is niet opgenomen en was vóór/na de run afwezig. De workflow gebruikte uitsluitend deze allowlisted CSV en `npm run import:skus`; geen brede discovery.
- Runresultaat: requested/processed/imported **12/12/12**; `already_exists=0`, `invalid=0`, `not_found=0`, `temporary_error=0`, `skipped=0`; `stop_reason=null`, `post_read_error=null`; importer-runtime **19.308 ms**. Catalog-import-runstatus `success`, processed 12, new 12, errors 0.
- Alle 12 aangemaakte records zijn exact de final CSV-SKU's, met productnaam, verpakking, exacte Hoogvliet-detail-URL en positieve prijs. De 12 productrecords die sinds dispatch zijn aangemaakt komen exact overeen met de opgegeven set; buiten de set is niets toegevoegd. Prijsrecords bestaan voor alle 12; geen niet-positieve prijs en geen duplicate SKU-groep.
- Production: producten **8.342 → 8.354**, unieke SKU's **8.342 → 8.354**, prijsrecords **8.342 → 8.354**. Nacontrole: alle 12 final SKU's aanwezig, duplicate-SKU-groepen 0, actieve daily jobs/attempts/imports/locks 0, `727643000` afwezig.
- Red Bull `733741000` is opgeslagen met actuele prijs **€1,39**, `old_price=€1,72`, `is_offer=true`, label `per blik 1,39` en aanbiedingperiode **2026-10-07 t/m 2026-10-13**; dit volgt de actuele bron-/GraphQL-aanbiedingsvelden uit de generieke PR #59-fix.

## Catch-up eindstatus en aandachtspunt

- Read-only vergelijking van de oorspronkelijke CSV (812 uniek) met Production: **811 aanwezig**, **1 ontbrekend**. De enige ontbrekende SKU is `727643000` (Verspakket cajun kip), bewust uitgesloten na actuele Hoogvliet-detail-404; geen vervanging of geforceerde match. De oorspronkelijke catch-up is daarmee afgerond voor alle nu valideerbare/importeerbare items; dit is geen claim van 100% actuele live catalogusdekking.
- De bestaande planner-cache-na-import-hook meldde voor deze 12 nieuwe producten `pending_requires_attention` met `planner-maintenance-not-configured` (notifiedProducts 0). Product-/prijsimport zelf en Production-nacontrole zijn succesvol; dit onderhoud is geen reden voor een importretry.
- Geen tweede dispatch, retry, daily import, brede discovery, migration, recovery of supersede uitgevoerd. Geen batch 4. Eerstvolgende stap: geen verdere catch-up import; planner-cacheconfiguratie kan afzonderlijk worden nagekeken. `ROADMAP.md` is ongewijzigd.

---

# Checkpoint — PR #59 aanbiedingfix + final_batch3 read-only gate — 8 oktober 2026

## Releases en CI

- PR #59 `fix: detect current comparison-price offers` is squash-merged. Mergecommit: `3a40ab89f37da93f3fb171cfa388c68d2b3be5b3`. Main-CI run [37758471080](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37758471080) is groen.
- PR #58 `feat: prepare final 12-SKU catch-up batch 3` is daarna squash-merged op de bijgewerkte main. Mergecommit en main-head tijdens de proof: `5b33fb9ce79e652d874975978b345d1f0a69c347`. Main-CI run [37758875614](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37758875614) is groen. PR #58 branch is niet apart bijgewerkt vóór merge; de merge is clean op de actuele main gemaakt en bevat daardoor PR #59. De final proof is rechtstreeks op die main uitgevoerd.
- De PR #59 aanbiedingfix staat op main. Geen Vercel-deployment of handmatige Production-mutatie uitgevoerd; de wijzigingen betreffen importer/workflow.

## Verse Production-precheck en final_batch3 proof

- Direct vóór dispatch read-only gecontroleerd: **8.342 producten**, **8.342 unieke SKU's**, **8.342 prijsrecords**, **0 duplicate-SKU-groepen**; actieve daily jobs **0**, attempts **0**, running catalog-imports **0**, relevante locks **0**.
- Vaste final input op main: `data/hoogvliet-missing-production-2026-10-08-final.csv`; SHA-256 `d5c43b501d4dfbf2498d1765340b354b4b487d47806c0b8683dcfcb748025dd5`; exact 12 SKU's. `727643000` is uitgesloten. Workflow-runner gebruikte alleen deze expliciete CSV en `npm run import:skus`; geen brede discovery.
- Exact één read-only dispatch [run 37759464444](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37759464444), op main `5b33fb9ce79e652d874975978b345d1f0a69c347`, `source=final_batch3`, `mode=dry-run`, `max=12`. Uitkomst success; requested/processed **12/12**, `valid_new=12`, `already_exists=0`, `invalid=0`, `not_found=0`, `temporary_error=0`, `skipped=0`; importer-runtime **21.040 ms**. Producten **8.342 → 8.342**, prijzen **8.342 → 8.342**, productwrites **0**, prijswrites **0**. Er is geen write-dispatch of productimport gestart.
- De 12 classificaties zijn exact de 12 toegestane SKU's in de final CSV; elke detailvalidatie was bereikbaar en prijs positief. Runner meldde 12/12 `valid_product_price`.

## Aanbiedingssemantiek en veiligheidsbewijs

- PR #59 bounded read-only audit [run 37751352900](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37751352900) bevestigde voor Red Bull Pistache winter edition (`733741000`) de actuele brondata en normalisatie: prijs **€1,39**, vergelijkingsprijs/`old_price` **€1,72**, `is_offer=true`, label `per blik 1,39`, geldigheid **2026-10-07 t/m 2026-10-13**. De periode is actueel op 8 oktober. Dezelfde audit testte 5/5 aanbiedingen en 5/5 niet-aanbiedingen correct, zonder Production-write.
- De audit bevestigde ook dat verlopen aanbiedingen niet worden gereactiveerd; onbetrouwbare fetch/lege of niet-positieve prijs wist geen bestaande geldige prijs (last-known-good); er is geen geforceerde SKU-match. Dit is generieke importerlogica, geen SKU-hardcode.
- Final dry-run gate: **PASS**. Geen brede discovery, parser/sourcefouten, ongeldige prijzen of writes waargenomen.

## Vervolg

- Geen finale write uitgevoerd. De finale 12 zijn technisch kandidaat voor één afzonderlijke expliciet geautoriseerde run. Vóór die run opnieuw Production-counts, duplicates, actieve jobs/attempts/imports/locks en final-CSV-checksum read-only controleren. Alleen bij schone precheck mag Work exact één keer `source=final_batch3`, `mode=write`, `max=12` dispatchen; daarna nacontrole en STOP. Geen automatische retry of volgende batch. `ROADMAP.md` is ongewijzigd.

---

# Checkpoint — aanbiedingenaudit PR #59 — Red Bull 733741000 — 8 oktober 2026

## Root cause en minimale fix

- Actuele Red Bull-detailpagina: HTTP **200**, final URL `https://hoogvliet.nl/product/red-bull-pistache-winter-edition-733741000`, title `Red Bull Pistache winter edition online bestellen | Hoogvliet`. De pagina levert in JSON-LD alleen Product `offers.price=1.39`; de oude DOM-prijsselectors `.kor-product-sale-price-value` en `.product-promo-price` zijn leeg.
- De bestaande exacte-SKU GraphQL-route leverde wél de beslissende velden: `is_promotion=true`, `price_range.minimum_price.final_price.value=1.39`, `regular_price.value=1.72`, `discount.percent_off=19.19`, `promotion_meta_data.raw_discount_label.full_label="per blik 1,39"`, `valid_from=2026-10-06T22:00:00+00:00` en `valid_to=2026-10-13T21:59:00+00:00`.
- De validator gebruikte die GraphQL-call voor ontbrekende verpakking, maar mapte de promotion-/regular-price-velden niet naar de prijssemantiek. Daardoor bleef `regularPrice` leeg, werd `oldPrice` null en was `isOffer=false`; de oude `simpleOffer`-check vereiste bovendien een DOM-aanbiedingsperiode plus tekst die met `per ` begint. Dit is de concrete eerste falende invariant: **actuele GraphQL-aanbieding werd niet doorgegeven aan de bestaande offer-normalisatie**.
- Minimale generieke fix in `src/hoogvliet.mjs`: de bestaande exacte-SKU GraphQL-response gebruikt nu `is_promotion`, positieve `final_price`, positieve en hogere `regular_price`, promotion label en geldigheidsperiode. Een aangeboden periode wordt alleen geaccepteerd zolang die actueel is; verlopen data wordt niet gereanimeerd. Geen SKU-hardcode, geen geforceerde match, geen fictieve prijs.
- Het bestaande prijscontract blijft gelijk: `price` is de actuele prijs, `old_price` de vergelijkingsprijs, `is_offer=true` voor een actuele aanbieding, met bestaande geldigheidsvelden. De bestaande upsert/PWA-resolutie en positieve-prijs-/last-known-good-bescherming zijn hergebruikt; een ongeldige prijs start geen write en wist de bestaande geldige prijs niet.

## Bounded read-only proof

- PR #59 [fix: detect current comparison-price offers](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/59), branch `codex/audit-offer-prices-20261008`, code-head `24971667ec0c011a93419991d91bdb974fe1fc56`, blijft Draft/open en is niet gemerged.
- Read-only aanbiedingenaudit [Actions-run 37750733485](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37750733485) is groen. De audit gebruikte alleen bestaande Production-URL's plus de expliciete Red Bull-URL; geen catalogusdiscovery. De bekende offerpool was begrensd op 80 records en stopte na vijf actuele aanbiedingen.
- Red Bull normaliseerde exact naar `price=1.39`, `old_price=1.72`, `is_offer=true`, `offer_text="per blik 1,39"`, `valid_from=2026-10-07`, `valid_until=2026-10-13`; geen forced match. De vijf offer-proofregels waren Red Bull plus vier aanvullende actuele Production-SKU's: `000737000` Pitloze witte druiven (€1,99 / €2,39), `049673000` Almhof Halfvolle yoghurt perzik (€1,49 / €2,56), `058289000` Almhof Halfvolle yoghurt kers (€1,49 / €2,15) en `060335000` Lay's Mama Mia's Cheese & Paprika (€1,49 / €2,34). Aanbiedingen correct **5/5**. Van de 80 bekende candidates waren 76 historische/inactieve records; die zijn niet als actieve aanbieding geteld.
- Niet-aanbiedingen correct **5/5**: `000016000`, `000062000`, `000167000`, `000310000`, `000418000`; alle vijf hadden een positieve actuele prijs, `old_price=null` en `is_offer=false`.
- Production read-only prijsaudit: **8.342** price records; **383** `is_offer=true`; **376** records met `price < old_price`; **0** verdachte records met `old_price > price` en `is_offer=false`; **7** `is_offer=true` zonder geldige vergelijkingsprijs; **0** ongeldige/niet-positieve prijzen. De audit deed **0 productwrites** en **0 prijswrites** en zag geen muterende Hoogvliet-request. Dit is een audit, geen databasecorrectie.

## Tests, releasegrens en vervolg

- Definitieve lokale gates: `npm test` **377/377**, `npm run check` groen, `npm run test:postgres` **28/28**, `git diff --check` groen. Nieuwe regressies testen GraphQL-aanbiedingvelden, Red Bull `1.39/1.72/is_offer=true`, geldige/non-offer- en verlopen-aanbiedingen, positieve prijs en bestaande auditclassificatie. Normale daily/importerregressies blijven groen.
- PR #59 Actions op de definitieve code-head zijn groen: core run **37750733517**, expliciete-SKU run **37750733595** en aanbiedingenaudit **37750733485**. Er is geen Production-write, merge, deploy of dagelijkse 8K-prijsrefresh uitgevoerd.
- PR #58 [feat: prepare final 12-SKU catch-up batch 3](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/58) blijft Draft/open op head `c3f2e3d75d5e569d132b5cac1d115e5f99834025`; de final explicit-SKU proof **37744701592** en core run **37744701563** zijn groen. Dat maakt PR #58 technisch groen, maar niet vrijgegeven voor merge/write.
- Finale batch 3 is in deze stap **niet gestart** en is nog niet vrijgegeven: PR #59 moet eerst gereviewd en regulier gemerged worden, met verse main-CI en een nieuwe Production-precheck. `ROADMAP.md` is ongewijzigd.
- Exacte Work-vervolgstap: review PR #59 en merge alleen na expliciete releasebeslissing; controleer verse main-head/main-CI; voer daarna read-only Production-precheck uit op counts, duplicate SKU's, actieve daily jobs/attempts/imports/locks en prijsstaat; voer op main eerst de vaste `source=final_batch3`, `mode=dry-run`, `max=12` proof uit; alleen bij exact 12 `valid_new`, 0 overige classificaties en 0 writes mag Work een afzonderlijke expliciete write-opdracht uitvoeren met `source=final_batch3`, `mode=write`, `max=12`, gevolgd door Production-nacontrole en STOP. Geen batch 3 in Codex.

---

# Checkpoint — finale read-only Hoogvliet-broncontrole van 13 SKU's — 8 oktober 2026

- Gebaseerd op remote main `082ccfd9c1d9df29b74ed832bc500eeab639bab9`. De gecontroleerde selectie is exact de 13 SKU's die na batch 2 nog ontbreken; er is geen importcommand, workflowdispatch, discoverycrawl of databasewrite uitgevoerd.
- Production read-only vóór en na broncontrole: **8.342 producten**, **8.342 unieke Hoogvliet-SKU's**, **8.342 prijsrecords**, **0 duplicate-SKU-groepen**. Alle 13 gecontroleerde SKU's zijn afwezig gebleven. Lopende daily jobs **0**, attempts **0**, import runs **0**, zichtbare granted advisory locks **0**. Productwrites **0**, prijswrites **0**.
- Methode: alleen de 13 vaste detail-URL's uit de vertrouwde residual-CSV en vijf bijbehorende afdelingsroutes zijn gecontroleerd. De listingpagina's laadden elk de eerste 40 productlinks; daarin stond geen van de doel-SKU's. Er is niet gepagineerd of verder gecrawld, dus dit is geen bewijs dat ze buiten die geladen pagina overal ontbreken. De directe detailpagina en haar Product-JSON-LD zijn gebruikt voor de SKU-/naam-/prijsvalidatie. De browser gaf geen numerieke HTTP-responsecode door; voor 12 SKU's was de actuele productdetailpagina volledig gerenderd; voor `727643000` toonde Hoogvliet de applicatie-404 “De pagina … bestaat helaas niet (meer)”.
- `GraphQL metadata` is niet afzonderlijk opgevraagd: bij alle 12 bereikbare SKU's stond verpakkings-/hoeveelheidsinformatie op de detailpagina, zodat de bestaande verpakkingsfallback niet nodig was. Dit is een read-only broncontrole langs dezelfde velden als de bestaande PR #55-validatie, geen uitvoering van de importer zelf.

| SKU | Actuele detailnaam | Verpakking/hoeveelheid op detail | Actuele prijs | Detail-JSON-LD SKU/prijsvak | Classificatie |
|---|---|---|---:|---|---|
| `727643000` | — | — | — | Geen Product-JSON-LD; pagina toont 404 | `not_found` |
| `733574000` | Snelle Jelle Kruidkoek | 455 gram | €1,99 | exact / positief | `valid_new` |
| `733575000` | Snelle Jelle Kruidkoek rozijnen | 455 gram | €1,99 | exact / positief | `valid_new` |
| `733741000` | Red Bull Pistache winter edition | 250 milliliter | €1,39 (actuele Product-JSON-LD prijs; detail toont ook €1,72) | exact / positief | `valid_new` |
| `770787000` | Odorex Natuurlijk fris | 50 milliliter | €2,99 | exact / positief | `valid_new` |
| `770809000` | Odorex Deospray marine fris | 150 milliliter | €3,99 | exact / positief | `valid_new` |
| `777641000` | Trida Luxe zeep | 300 gram | €1,39 | exact / positief | `valid_new` |
| `905631000` | Hoogvliet Runderlever gelardeerd | ca. 120 gram | €3,02 | exact / positief | `valid_new` |
| `921742000` | Hoogvliet Bacon | ca. 110 gram | €2,96 | exact / positief | `valid_new` |
| `926108000` | Eyssen 25+ plakken | ca. 120 gram | €1,88 | exact / positief | `valid_new` |
| `926876000` | Hoogvliet Geitenkaas | ca. 141 gram | €2,89 | exact / positief | `valid_new` |
| `927082000` | Hoogvliet Port Salut | ca. 180 gram | €4,23 | exact / positief | `valid_new` |
| `927120000` | Hoogvliet Roquefort | ca. 136 gram | €3,53 | exact / positief | `valid_new` |

- Voor alle 12 `valid_new`-SKU's bleven de final URL's op de exacte SKU-detailroute; productnaam, exacte SKU in Product-JSON-LD, positieve EUR-prijs en hoeveelheid stonden op de pagina. Hoogvliet labelde de pagina's `Alleen in winkel`; dat verandert deze bronvalidatie niet in een online-bestelbaarheidsclaim. Geen fuzzy/slug-alternatief gebruikt.
- Classificaties: **valid_new 12** (`733574000, 733575000, 733741000, 770787000, 770809000, 777641000, 905631000, 921742000, 926108000, 926876000, 927082000, 927120000`); **not_found 1** (`727643000`); **invalid 0**; **temporary_error 0**.
- Geen brede discovery gestart. Production-counts vóór/na onveranderd. Exacte kandidaat voor een eventueel later, afzonderlijk geautoriseerd laatste mini-batch: **12 SKU's** (alleen de 12 `valid_new`-SKU's). Er is in deze run geen write of batch 3 gestart.

---

# Checkpoint — read-only controle resterende catch-up SKU's — 8 oktober 2026

- Remote main vóór deze documentatie-update: `5c8126b7d12467130374e778717d45f175979638`.
- Verse read-only vergelijking van de oorspronkelijke CSV met Production: 812 SKU's, alle uniek; 799 aanwezig en exact 13 nog afwezig.
- Residual van batch 2: 412 uniek; 399 aanwezig en 13 afwezig. Production staat op 8.342 producten, 8.342 unieke Hoogvliet-SKU's en 8.342 prijzen; dubbele SKU-groepen 0; actieve daily jobs, attempts, catalog-imports en locks 0.
- Resterende SKU's: `727643000`, `733574000`, `733575000`, `733741000`, `770787000`, `770809000`, `777641000`, `905631000`, `921742000`, `926108000`, `926876000`, `927082000`, `927120000`.
- De enige batch-2 `not_found` is `727643000`, CSV-naam “Verspakket cajun kip”. De run classificeerde deze als `notFound`; de oorspronkelijke detail-URL kon niet betrouwbaar als detailpagina worden bevestigd. De actuele [Hoogvliet-lijst met maaltijdpakketten](https://hoogvliet.nl/aardappelen-groente-fruit/verspakketten/maaltijdpakketten) toont 17 producten en noemt dit product niet. Een oudere zoekindexweergave (2 dagen eerder) noemde “Verspakket cajun kip” als “Alleen in winkel”. Dit ondersteunt de inferentie dat de detailbron/online beschikbaarheid is gewijzigd; er is geen bewijs voor een structurele parserfout. Geen vervangende match geforceerd.
- In deze controle geen write, importdispatch, herstel of discovery gestart. Geen batch 3. Volgende veilige stap: vóór een eventuele aparte catch-up opnieuw de 13 SKU's read-only controleren en voor `727643000` eerst actuele detailbronbeschikbaarheid bevestigen.

---

# Checkpoint — PR #57 release en catch-up batch 2 — 8 oktober 2026

## Release

- PR #57 [feat: add verified residual SKU source for catch-up batch 2](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/57) is ready en squash-merged.
- Mergecommit en main-head vóór deze documentatie-update: `cffbc18b23423d158f00785be418d2d547c452a6`.
- Main-CI [run 37739622762](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37739622762): groen. Dit was een importer/workflow-update; geen Vercel Production-deployment nodig.

## Verse precheck en residual op main

- Direct vóór de write: 7.943 Hoogvliet-producten, 7.943 unieke SKU's en 7.943 prijsrecords; 0 dubbele SKU-groepen, 0 actieve daily jobs, 0 actieve attempts, 0 actieve catalog-imports en 0 actieve locks.
- Residualbestand `data/hoogvliet-missing-production-2026-10-08-residual.csv`: 412 unieke, niet-lege SKU's; SHA-256 `dd785a974054c257d7c4d2bc6248204ab8fe8e971bd865c16a2c2785b3e57254`. Vóór de run waren 0 van deze 412 aanwezig.
- Op main bestaat de vaste `original` / `residual_batch2` bronkeuze. De write-route vereist expliciete `workflow_dispatch`, `mode=write`, en gebruikt uitsluitend `npm run import:skus` met harde `max=400`; geen brede discovery.

## Batch 2

- Exact één write-dispatch: [Actions-run 37740056187](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37740056187), main `cffbc18b23423d158f00785be418d2d547c452a6`, source `residual_batch2`, mode `write`, max 400.
- Gevalideerde command: `npm run import:skus -- --file data/hoogvliet-missing-production-2026-10-08-residual.csv --max 400 --write`. De run startte geen brede discovery en verwerkte uitsluitend de residualset.
- Resultaat: requested 400; processed 400; imported/valid_product_price 399; already_exists 0; invalid 0; not_found 1 (`727643000`, reason `notFound`); temporary_error 0; skipped 12, alle `max_batch_size`. Geen stopreason of post-read-error.
- Importerruntime `835395 ms` (13 min 55,395 s); totale Actions-run circa 14 min 44 s. CSV checksum en alle verwerkte SKU's kwamen overeen met de vertrouwde residualbron.
- Alle 399 geïmporteerde records hebben een positieve prijs, naam, verpakking en geldige Hoogvliet-detail-URL. 0 productrecords zonder prijs, 0 niet-positieve prijzen, 0 dubbele SKU-groepen. Import-runstatus `success`, `new_count=399`, `error_count=0`; er zijn na afloop 0 actieve imports/locks.

## Production nacontrole en volgende stap

- Producten/unieke Hoogvliet-SKU's: 7.943 → 8.342 (werkelijk toegevoegd 399). Prijsrecords: 7.943 → 8.342. Dubbele SKU-groepen: 0.
- Van de 412 residual-SKU's zijn er nu 399 aanwezig en 13 ontbreken: 1 `not_found` (`727643000`) plus 12 wegens `max_batch_size`. Op basis van de oorspronkelijke 812-SKU-set zijn nu 799 aanwezig en 13 afwezig.
- Geen batch 3 gestart. Eerstvolgende veilige stap: bereken read-only de actuele resterende 13 tegen Production en beoordeel de ene `not_found`; vraag daarna een aparte expliciete uitvoeringsopdracht voor een volgende write.

---

# Checkpoint — geverifieerde residual-input voor catch-up batch 2 — 8 oktober 2026

## Production-gebonden residual

- Gebaseerd op remote main `12ed0f2bb3b33283a7ac9e1d8791d94de6f82fe1`; PR #56 mergecommit `296df858fd63fe469732d73a60bfc3ca76bf4b5e`.
- Verse read-only Production-snapshot: 7.943 producten, 7.943 unieke Hoogvliet-SKU's, 7.943 prijsrecords, 0 dubbele SKU-groepen, 0 actieve daily jobs, 0 actieve attempts, 0 actieve catalog-imports en 0 actieve locks.
- De originele CSV `data/hoogvliet-missing-production-2026-10-06.csv` bevat 812 unieke niet-lege SKU's. Production bevatte 400 uit die set, en alle eerste 400 SKU's van batch 1 waren aanwezig. Residual is berekend als de volledige originele set MINUS de actuele Production-SKU's; dus niet op basis van een blinde rij-offset.
- Residualbestand: `data/hoogvliet-missing-production-2026-10-08-residual.csv`; 412 rijen, 412 uniek, geen lege SKU's, 0 overlap met Production en 0 overlap met batch 1. De 412 SKU's zijn byte-exact de originele CSV-waarden buiten de eerste batch. SHA-256: `dd785a974054c257d7c4d2bc6248204ab8fe8e971bd865c16a2c2785b3e57254`.

## Runnerroute en read-only proof

- PR #57 branch `codex/residual-sku-catch-up-batch2-20261008`; code/data-head die de proof draaide: `4106c51f476b0267c7bf5492a4de492445b36cfe`. PR #57 is Draft; geen merge.
- De bestaande runner gebruikt een vaste enumeratie `original` / `residual_batch2`; geen vrije pad- of URL-input. Pull-request-runs zijn vastgepind op `residual_batch2`, `dry-run`, max 10. Alleen expliciete workflow_dispatch op main kan write kiezen; max blijft 1–400. Beide routes roepen alleen `npm run import:skus` aan; daily workflow en importerlogica zijn ongewijzigd.
- Read-only proof [Actions-run 37737744075](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37737744075): source `residual_batch2`, exact commando `npm run import:skus -- --file data/hoogvliet-missing-production-2026-10-08-residual.csv --max 10 --dry-run`; requested/processed 10/10, valid_new 10, imported 0, already_exists/invalid/not_found/temporary_error elk 0, skipped 402 uitsluitend `max_batch_size`; runtime 20.225 ms.
- De 10 gevalideerde SKU's zijn exact residual-rijen 1–10: `697042000, 697052000, 697147000, 697409000, 697422000, 697501000, 697542000, 697560000, 697957000, 697960000`; allemaal `valid_new`, met positieve prijzen. Geen batch-1 SKU of geforceerde match.
- Geen brede discovery. Producten en prijzen bleven in de proof 7.943 → 7.943; productwrites 0 en prijswrites 0.
- Core-CI [run 37737744074](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37737744074) is groen: `npm test`, `npm run check`, `npm run test:postgres` en webchecks/build. Proof-workflow valideerde YAML door uitvoering en `git diff --check` slaagde. Normale daily workflow is niet gewijzigd.
- In deze voorbereiding geen importwrite, merge of deploy uitgevoerd. `ROADMAP.md` is ongewijzigd.

## Eerstvolgende Work-stap

- Controleer de actuele PR #57-head en groene checks; markeer de Draft PR ready en merge alleen na expliciete releasebeslissing. Controleer daarna de actuele main-head en main-CI.
- Vlak vóór batch 2: verse Production read-only precheck op product-/SKU-/prijstellingen, duplicaten, actieve daily jobs/attempts/imports en locks. Bij enige concurrerende run of lock stoppen.
- Na geslaagde precheck dispatch op main exact één keer `.github/workflows/import-explicit-skus.yml` met `source=residual_batch2`, `mode=write`, `max=400`. Dit zal maximaal 400 van de 412 residual-SKU's verwerken. Geen discovery, geen tweede batch, geen migration/recovery/supersede. Controleer run en Production-nacontrole en stop daarna; de resterende SKU's vereisen een afzonderlijke berekening en opdracht.

---

# Checkpoint — PR #56 release en catch-up batch 1 — 8 oktober 2026

## Release

- PR #56 is via squash gemerged. Mergecommit en main-head direct na merge: `296df858fd63fe469732d73a60bfc3ca76bf4b5e`; PR-head was `67faefd6e6d10514f641df3db4ffc91a3bc523e8`.
- Main-CI `37733779160` is groen, inclusief importerfixtures, PostgreSQL atomic rollback/concurrency en web core flows/build. De runner is Actions-only; er was geen Vercel-deployment of database-migration nodig.
- Workflow op main: `.github/workflows/import-explicit-skus.yml`; vaste bron `data/hoogvliet-missing-production-2026-10-06.csv`, SHA-256 `a24da369b15d4ddf0d8741f7aeb4d3fee2f733e74e2d448ec1ffcd1b8ab30246` (812 unieke SKU's).

## Batch 1 — exact één write-dispatch

- Workflow-run [37734457123](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/37734457123) draaide eenmaal via `workflow_dispatch` op `main` / commit `296df858fd63fe469732d73a60bfc3ca76bf4b5e`, `mode=write`, `max=400`. Run-conclusie: success.
- Exact commando: `npm run import:skus -- --file data/hoogvliet-missing-production-2026-10-06.csv --max 400 --write`. De workflow startte geen brede discovery.
- Resultaat: requested 400; processed 400; imported/valid_product_price 400; already_exists 0; invalid 0; not_found 0; temporary_error 0; skipped 412, allemaal `max_batch_size`. Input: 812 rijen / 812 uniek. Geen stopreason of post-read-error.
- Importerruntime: 588,757 seconden (9 min 48,757 s; runtime_duration_ms=588757); totale Actions-run: circa 10 min 47 s. De 400 geïmporteerde SKU's zijn exact gelijk aan de eerste 400 CSV-SKU's; de 188 voorloopnul-SKU's in die batch zijn byte-exact behouden en alle geïmporteerde prijzen waren > €0.

## Production-precheck en nacontrole

- Directe read-only precheck vóór dispatch: 7.543 producten, 7.543 unieke SKU's, 7.543 prijsrecords, 0 duplicate SKU-groepen, 0 running daily jobs, 0 running attempts, 0 actieve catalog_import_runs en 0 actieve locks. De actuele dag had 0 verschuldigde retry-jobs. Er waren 2 oudere `retry_scheduled` records die niet draaiden; geen bijbehorende actieve attempt of Actions-run.
- Directe read-only nacontrole: 7.943 producten, 7.943 unieke SKU's en 7.943 prijsrecords; werkelijk toegevoegd: 400 producten en 400 prijzen. Duplicate SKU-groepen: 0; writes buiten de CSV: 0; 400/400 batch-SKU's exact aanwezig; ontbrekende naam, verpakking, geldige detail-URL of positieve prijs: 0.
- Van de oorspronkelijke 812-SKU-set zijn nu 400 aanwezig en 412 nog afwezig. `catalog_import_runs`: status `success`, trigger `manual`, processed 400, new 400, errors 0; na afloop geen actieve import of lock.
- Telemetrie-aantekening: het `catalog_import_runs.total_unique_products_before`-veld meldt 7.540, terwijl de directe Production-telling en importer-samenvatting 7.543 melden. De tabel bevatte vóór de run 7.540 `Hoogvliet`- en 3 `hoogvliet`-records; de werkelijke tabeldelta is ondubbelzinnig 7.543 → 7.943 = 400. Gebruik de directe tabeltelling als autoritatief en onderzoek de casing-afhankelijke telemetrie vóór een volgende batch.

## Eerstvolgende veilige stap

- Batch 1 is afgerond; er is geen tweede dispatch gestart. De huidige workflow met dezelfde CSV en `max=400` selecteert opnieuw de eerste 400 rijen. Start die workflow niet opnieuw om de resterende 412 te bereiken.
- Bereid voor een afzonderlijke, expliciet goedgekeurde vervolgstap een geverifieerde residual-input/offset voor de nog ontbrekende 412 SKU's voor. Voer vóór die stap opnieuw een Production-precheck uit. `ROADMAP.md` is ongewijzigd.

---

# Checkpoint — expliciete SKU Actions-runner PR #56 — 8 oktober 2026

## Runner en begrenzing

- Vanaf actuele main 618e5bda8dc2b5d0fac2bafe14962d12a485786c is branch codex/explicit-sku-actions-runner-20261008 gemaakt. PR #56 staat Draft/open; geen merge of Production-import uitgevoerd.
- Nieuwe workflow: .github/workflows/import-explicit-skus.yml; vaste runner: scripts/run-explicit-sku-catch-up.mjs. De runner roept uitsluitend npm run import:skus aan met de vaste file data/hoogvliet-missing-production-2026-10-06.csv. Geen brede catalog discovery, daily import of tweede batch.
- De CSV is byte-voor-byte hersteld uit de bestaande proof-bron; SHA-256 a24da369b15d4ddf0d8741f7aeb4d3fee2f733e74e2d448ec1ffcd1b8ab30246. In runner gevalideerd: 812 rijen, 812 unieke SKU’s, geen lege/duplicaat/ongeldige rijen en leading-zero SKU’s behouden.
- Inputs zijn alleen mode (choice dry-run / write, standaard dry-run) en max (1–400). Pad, shell command en URL zijn niet invoerbaar. Dispatch wordt alleen op main geaccepteerd; write vereist expliciet workflow_dispatch met mode=write.
- PR-event dwingt dry-run --max 10 af. Workflow heeft geen schedule/push-trigger, deelt de bestaande importer-concurrencygroep, en doet vóór write uitsluitend GET-prechecks op actieve daily jobs, attempts, catalog import runs en locks. Bij onleesbare/conflicterende status stopt write; geen recovery/supersede of migration.
- De eerste PR-run 37730988418 stopte vóór npm-install/import omdat standaard git diff --check de oorspronkelijke CSV-CRLF als whitespace markeerde. CSV is ongewijzigd gebleven; commit 1635012ca0446b6b5c50ab73fd62c3d0b7b6560c gebruikt core.whitespace=cr-at-eol, terwijl normale trailing whitespace nog steeds faalt. De daaropvolgende proof-run slaagde.

## Checks en live read-only proof

- Explicit SKU workflow-run 37731107102 op head 1635012ca0446b6b5c50ab73fd62c3d0b7b6560c: succesvol, PR-event, mode dry-run, max 10. Exact commando: npm run import:skus -- --file data/hoogvliet-missing-production-2026-10-06.csv --max 10 --dry-run.
- Resultaat: requested 10, processed 10, valid_new=10, imported 0, already_exists=0, invalid=0, not_found=0, temporary_error=0, skipped 802 (alleen max_batch_size). Importerruntime 15 264 ms (circa 15,3 seconden); workflowjob circa 47 seconden. Alle 10 hadden positieve gevalideerde prijzen; eerste SKU 000685000 behield voorloopnullen en werd als valid_new met €1,99 gerapporteerd.
- Dry-run productcount 7.543 → 7.543 en pricecount 7.543 → 7.543; productwrites 0 en prijswrites 0. Geen discovery gestart; de geteste commandroute gebruikte uitsluitend de expliciete CSV.
- Normale regressie-CI 37731107103 doorliep importer-fixtures/seed consistency, PostgreSQL atomic rollback/concurrency gate en web core flows/regressions/lint/TypeScript/build succesvol. Daarmee zijn npm test, npm run check en npm run test:postgres op deze PR-head via de normale CI gevalideerd. git diff --check plus YAML-/JS-validatie slaagden op de PR-route.
- Normale daily workflow is niet aangepast. ROADMAP.md is ongewijzigd.

## Releasegrens en Work-vervolgstap

- Huidige uitvoering is featurebranch + Draft PR #56; geen merge, deployment of write. Branch-head vóór deze documentatiecommit: 1635012ca0446b6b5c50ab73fd62c3d0b7b6560c.
- Work: controleer de actuele PR #56-head en vereiste checks; markeer na review ready en merge via normale repositorystrategie. Controleer main-CI en Production READY/smoke waar van toepassing. Voer daarna verse read-only Production-precheck uit en dispatch deze workflow éénmaal met mode=write, max=400. Dit is batch 1; start geen tweede batch automatisch en houd de resterende set apart voor een volgende expliciete opdracht.

---

# Checkpoint 36 — daily root-404 hotfix onderzocht en PR voorbereid — 6 oktober 2026

## Exacte oorzaak en minimale fix

- Gestart vanaf actuele `origin/main` **33aeb68720397990305e33919a6f5fdfae365f18** op branch `codex/hotfix-daily-root-404-20261006`.
- De Production-log van daily attempt `21cd0a4d-e34b-4639-a8f3-228aceb53539` bewaart geen request-URL. De tellerbalans **787 raw hits = 380 bestaande + 55 invalid detail + 352 technisch niet verwerkt** bewijst dat de fout ná listingdiscovery ontstond tijdens de volgende **GET product-detailnavigatie**, terwijl de fout alleen met `term=catalog:root` werd gelabeld. De read-only proof valideerde geen details en kon deze request dus niet raken.
- Een productdetail-HTTP **404** is geen globale bronuitval: de listing kan een stale/verdwenen kaart bevatten. `validateCandidate` boekt die request nu veilig als `notFound`/`invalidDetail` en gaat door. Root-, categorie-, GraphQL- en echte navigatie-404’s blijven `source_unavailable`.
- Elke toekomstige bronfout bevat nu veilig: route key, request type, gesaniteerde URL, final URL, cursor/page, categorie, upstream-status, classificatie en GraphQL operation. Querywaarden voor `query`, `variables`, tokens, cookies en keys worden geredigeerd.

## Read-only bewijs en gates

- Normale bounded proof Actions-run **37425920472** op head `514b6798f7aa93421c824ec70e3800a2a3e91c7f`: groen; **20** dynamische categorieën, **2** routes, **40** kandidaten, **2** pagina’s, geen legacy discovery.
- Begrensde 20-page request-audit Actions-run **37425928361**: groen; **20** pagina’s, **400** unieke kandidaten, **20** dynamische categorieën, `navigation404s=[]`; dezelfde daily collector/detail-path: **91** unieke kandidaten, **2** pagina’s, `sourceErrors=0`.
- Geen Production-import, Supabase-write, recovery, supersede, migration, merge of deploy uitgevoerd. De optionele proofworkflow gebruikt alleen publieke requests, geen Supabase of `onBatch`.
- Lokale gates: `npm test` **356/356**, `npm run check` groen, `npm run test:postgres` **28/28**, `git diff --check` groen. Nieuwe regressies dekken stale detail-404, requestcontext en bestaande root/category/pagination/dedupe/detail/state-machine-contracten.

## Releasegrens

- Code commits: `732abc31ca8ad75bf1d1e443cb65cbbc8571a5ce` en `514b6798f7aa93421c824ec70e3800a2a3e91c7f`; branch is gepusht, PR volgt. De historische concrete product-slug kan niet eerlijk worden gerapporteerd omdat Production-run 37421689708 die context vóór deze hotfix niet logde; de nieuwe observability maakt een volgende echte bronfout exact reproduceerbaar.
- Na PR/releasegate stoppen. Geen live import. Alleen na releasegate de normale geplande retry/state-machine beoordelen volgens de expliciete vervolginstructie.

# Checkpoint 35 — PR #52 watchdog Production en daily funnel — 6 oktober 2026

## Release

- PR #52 `codex/fix-daily-scheduler-watchdog-20261006` is normaal gesquasht na releasegate: pre-merge head `ba674e5b9118c868a99d33a098dde17b14678c99`, mergecommit en main-head `ae1c999b88846462a120ab1eb129378ea93ab056`.
- PR-CI `37420498039` en main-CI `37421152488` zijn volledig geslaagd. Preview was READY. Automatische Vercel Production-deployment `dpl_49YsguokycavKZgGn7XywCZWzkxK` is READY op de mergecommit; homepage-smoke HTTP 200.
- De main-workflow `.github/workflows/retry-daily-catalog-import.yml` bevat watchdogcron `17 4 * * *` en `17 5 * * *`, naast de bestaande retries. GitHub Actions toont zowel de primary workflow als retry/watchdog als ingeschakeld. Voor 7 oktober: primary 06:00 Europe/Amsterdam; watchdog 06:17 CEST.

## Daily run 6 oktober

- Vóór de start was Production-read-only gecontroleerd: geen daily job, attempt of actieve catalog import voor 6 oktober. De primary schedule-run ontbrak; de retryworkflow had wel run `37391772606` om 02:01 lokaal, zonder dagjob/attempt.
- Exact één dispatch met uitsluitend `daily_import=true`: workflowrun **#115 / 37421689708**, op main `ae1c999`, gestart 08:03 CEST. Geen tweede dispatch, supersede of recovery.
- Dagjob `0501990b-44cd-4959-b0a4-e3669eee87be`: target 400, cumulatief **0/400**, attempt_count 1, recovery_count 0. Attempt `21cd0a4d-e34b-4639-a8f3-228aceb53539` eindigde `retryable_failure`; lock is vrij. Job staat `retry_scheduled`, next_retry_at `2026-10-06T08:10:38Z` (10:10:38 CEST). Geen handmatige retry gestart; de bestaande normale retrytrigger staat op 10:17 CEST.
- Production-import-run `3e9ff661-8c52-4754-8bf8-c271c369a46a`: status failed, totaal Hoogvliet-producten bleef 7540, 0 inserts en 0 updates.
- Strategie `hoogvliet-public-catalog-api-pagination-v4`; discovery-log startte met `dynamic_terms=0`. Enige bezochte route was `catalog:root`; log toont root-cursors 0 en 20, maar geen dynamische categorie-route of category-listing-pagina. Dynamische categorieën **0**, categorieën bezocht **0**, categorie-listingpagina's **0**.
- Balanced funnel: raw page hits **787**; `uniqueRelevantSKUs=436`; bestaande SKU's **380**; duplicaten **0**; ongeldige detailvalidaties **55**; technisch niet verwerkt **352**; geldige nieuwe kandidaten **0**; werkelijk toegevoegd **0**. De workflow eindigde met stopreden **`source_unavailable`**, één bronfout **HTTP 404**. Log koppelt de fout aan `catalog:root`, maar legt de exacte HTTP-request-URL niet vast. Het rootpad is `https://hoogvliet.nl/producten`.
- Legacy Intershop-discovery is niet gebruikt. Detailvalidatie, bestaande-SKU-dedupe en de persistente dagboekhouding bleven actief.

## Besluit en vervolg

- Dit is scenario C: de dagelijkse route levert geen dynamische categorieën op en eindigt met een tijdelijke 404-bronclassificatie. Een volledige catalogusdekkingmeting is daarom **niet betrouwbaar en niet uitgevoerd**. Geen importerwijziging in Work en geen wijziging aan ROADMAP.
- Kleinste Codex-opdracht: vergelijk de dagelijkse `import:daily`-collectorroute vanaf `catalog:root` met de bewezen PR #50 read-only cloudproof. Onderzoek waarom de run twee root-cursorstappen logt (`0`, `20`), nul dynamische categorieën produceert en als `source_unavailable` (HTTP 404) stopt. Maak de dagelijkse productie-intent-regressie aantonen dat root-hydration categorieën enqueue't en dat alleen categorieën listingpagination krijgen. Behoud v4 publieke Hoogvliet-bron, target 400, dedupe, detailvalidatie, retry/state-machine en verbod op Intershop-fallback.

---

# Checkpoint 33 — PR #51 migration, release en 06:00 scheduler — 6 oktober 2026

## Migration en runner

- PR #51 is via de normale squashstrategie gemerged. Pre-merge head: `bc581febcd50b0cfc46378854b01d1d5f0bedea2`; squashmergecommit: `ef3094aa2688ea8c51840336521419500a2682fa`.
- De begrensde runner op feature-head `541637b4a1b96be15406163758f3c8b180b1a1f3` voerde run **37417603096** uit. Verse exacte precheck en apply-job waren groen; Supabase CLI **2.119.0** paste uitsluitend `20261005230000_supersede_failed_daily_catalog_job.sql` toe. De runner-postcheck bevestigde lokale/remote migrationhistory als exacte match en RPC, SECURITY DEFINER/search_path, service_role-grants, auditvelden en indexes.
- Read-only postcheck: migrationversie `20261005230000` staat exact eenmaal; er is geen andere versie vanaf die timestamp. De RPC-signature met 13 argumenten en jsonb-return klopt, `search_path=public` en SECURITY DEFINER zijn actief; EXECUTE is beschikbaar voor service_role en niet voor anon/authenticated. Auditstructuur en alle vier indexes bestaan; audit heeft 0 rijen. Geen product-, prijs- of jobstate-mutatie door de migration.
- De runner is direct daarna via commit `bc581febcd50b0cfc46378854b01d1d5f0bedea2` weer op `MIGRATION_ARMED=false` gezet. Disarmed run **37417675986** faalde read-only bij de precheck omdat de checker na toepassing nog “exact één target local-only” verwacht; de apply-job werd **SKIPPED**. Dit was geen tweede apply of databasewrite. De remote Production-history en runnerconfig zijn afzonderlijk read-only op de toegepaste/disarmed toestand gecontroleerd.
- PR #51 bevat de bedoelde fresh-daily supersede/state-machinewijziging; de bestaande target **400** en PR #45–#50-functionaliteit zijn behouden.

## Merge en Production

- PR #51 releasegate op disarmed head: volledig core/regression/PostgreSQL/build-CI-run **37417680594** geslaagd, Vercel Preview `dpl_6deQk9vUWuF5ExCxb568QfV7Rigd` READY, mergeable. De disarmed migration-run hierboven was een aparte read-only precheck en geen verplichte core-CI-gate.
- Main-head na merge: `ef3094aa2688ea8c51840336521419500a2682fa`. Main-CI-run **37418053738** geslaagd.
- Automatische Vercel Production-deployment `dpl_A1msfMJgg5m2e3NYFejPnsrCPV5v`, exact gekoppeld aan mergecommit `ef3094aa2688ea8c51840336521419500a2682fa`, werd **READY**. Smoke op de deployment-URL: homepage HTTP **200**.
- Main bevat `catalog:root` met root `/producten`, actuele Hoogvliet root→categorie-discovery en strategy fingerprint `hoogvliet-public-catalog-api-pagination-v4`. Geen legacy Intershop-discovery.

## 06:00 daily scheduler — feitelijke uitkomst

- Voor **2026-10-06** is geen scheduled Actions-run zichtbaar; de workflowrunlijst had geen 6-oktober-schedule. Production heeft voor 6 oktober ook geen `catalog_daily_jobs`-rij.
- Oude job `53553be0-2158-47b1-92c3-2bc75cd7d0cc` (2026-10-05) blijft `failed_requires_attention`, **0/400**, attempt_count 3, recovery_count 1, geen actieve lock en geen next_retry. Geen recovery, supersede of daily import gestart; geen handmatige importdispatch uitgevoerd.
- De eerstvolgende normale 06:00-run is **2026-10-07 06:00 Europe/Amsterdam** (04:00 UTC, CEST-kandidaat). De normale schedule blijft actief; er is geen gemiste-run replay of tweede dispatch gestart. Die run gebruikt de gewone dagjob/state-machine op de nieuwe dag.

---

# Checkpoint 34 — PR #52 06:00 scheduler-watchdog geopend — 6 oktober 2026

- PR **#52** is geopend: `https://github.com/boodschappenmaatje/Boodschappenmandje-importer/pull/52`, branch `codex/fix-daily-scheduler-watchdog-20261006`, initial head `c1cb5f48a6669b1b4bb936cdec3d6e48d91043dc`, base `bf16eb18a7e2c334f25141dcf86282f4125b910e`.
- Dit is uitsluitend scheduler/watchdog/tests/documentatie. Geen migration, Production-write, daily import, supersede, merge of deploy uitgevoerd.

# Checkpoint 33 — 06:00 scheduler-watchdog voorbereid — 6 oktober 2026

## Bewijs van de gemiste trigger

- Actuele remote `main`: `bf16eb18a7e2c334f25141dcf86282f4125b910e`. De primaire workflow `.github/workflows/import-hoogvliet-poc.yml` staat op de default branch, is via GitHub API `active`, bevat geldige YAML en de kandidaten `0 4 * * *` (CEST) en `0 5 * * *` (CET). `workflow_dispatch` blijft aanwezig.
- Read-only workflowhistorie: op 5 oktober bestaat primary scheduled run **37286939920**, gestart om `2026-10-05T08:57:57Z` op main-code `d083651…`; op 6 oktober bestaat geen primary scheduled run. Er is dus categorie **A: GitHub maakte geen primary workflow-run aan**, niet een job-level `if`-skip. De andere scheduled run **37391772606** is de bestaande retry-workflow, niet de primary daily trigger.
- De workflow was niet disabled en `main` was de default branch; de cron/DST-gate is lokaal bewezen voor CEST en CET. De concrete storing is daarmee GitHub scheduled-event delivery/timing, niet importer-, parser- of discoverylogica. De 5-oktober-run die bijna vijf uur na de bedoelde UTC-kandidaat startte ondersteunt dezelfde reliability-observatie.

## Kleinste duurzame fix

- In `.github/workflows/retry-daily-catalog-import.yml` zijn vaste watchdog-events toegevoegd op `17 4 * * *` en `17 5 * * *`. Eén kandidaat valt buiten het lokale dagvenster en doet niets; de andere ligt rond 06:17 Europe/Amsterdam. Als de primary event ontbreekt, voert de watchdog dezelfde `inspect:daily` → `import:daily`-flow uit.
- De normale `claim_catalog_daily_attempt` blijft de enige daily-job/attempt-arbiter: een ontbrekende dagjob krijgt target 400, een bestaande/running/voltooide job wordt veilig overgeslagen. Geen nieuwe RPC, migration, importer- of discoverycode.
- `workflow_dispatch` van de primary workflow, target 400, remainingTarget, retries, recovery, supersede, locks en dedupe blijven ongewijzigd. `ROADMAP.md` is niet gewijzigd.

## Tests en grens

- `npm test`: **354/354**; `npm run check`: groen; `npm run test:postgres`: **28/28**; YAML/embedded Bash syntax en `git diff --check`: groen.
- Nieuwe regressies dekken CEST/CET, beide watchdog-crons, missing-day claim, dubbele watchdog-no-op, workflow dispatch, target 400 en bestaande retry/recovery/supersede-contracten. Geen Production import, databasewrite, migration, merge of deploy uitgevoerd.
- Codex-branch: `codex/fix-daily-scheduler-watchdog-20261006`. Volgende stap: push, PR openen en Work laat de normale scheduler-only releasegate uitvoeren; daarna kan Work controleren of 6 oktober nog geen job heeft en precies één verse daily run starten.

# Checkpoint 32 — main-sync afgerond, GitHub releasegate queued — 5 oktober 2026

- Oorzaak van `mergeable=false`: lokale `git merge-tree origin/main HEAD` vond exact één inhoudelijk conflict in `PROJECT_STATE.md`; er waren geen codeconflicten. De actuele main-root/categorie-wijzigingen zijn behouden en het document bevat nu beide historische lijnen.
- `origin/main` is `6cfcb01e02a82a7c0ed0fedbd33be01c1d520d2d`. De gesynchroniseerde PR-head is `741cd951ba9e4804a168cc5ce40f198dbc1b38d5`.
- Lokale volledige gate op de gesynchroniseerde tree: `npm test` **353/353**, `npm run check` groen, `npm run test:postgres` **28/28**, recovery guards **9/9**, history guards **8/8**, supersede-runner **3/3**, YAML/embedded shellsyntax groen, `git diff --check` groen.
- Oude runner-run **37367248965** was op head `5ec19fd` en eindigde `cancelled`; precheck was cancelled en apply was skipped. Hij is geen releasebewijs. Op de nieuwe head is exact één disarmed runner-run behouden: **37369019615**, status `queued`; de per ongeluk dubbel aangemaakte tweede run **37368978737** is cancelled.
- Vercel Preview voor `741cd951` rapporteert success (`F3XDTKpmmjHvEdCBpwByNCRpmZeu`). Volledige PR-CI **37368895170** (#257) staat nog `queued`; daardoor is de releasegate nog niet volledig groen.
- `MIGRATION_ARMED=false` blijft hard-coded; migration `20261005230000` is niet toegepast. Geen databasewrite, supersede, daily import, merge of Production-deploy uitgevoerd.
- Volgende stap: Work wacht op GitHub-run **37368895170** en disarmed runner **37369019615**; accepteert alleen een groene CI en succesvolle disarmed precheck op de actuele head. Daarna pas migration/merge volgens de expliciete Work-volgorde.

# Checkpoint 31 — PR #51 main-sync en releasegate voorbereid — 5 oktober 2026

## Main-sync

- `origin/main` is opnieuw gecontroleerd op `6cfcb01e02a82a7c0ed0fedbd33be01c1d520d2d`. PR #51 stond op `5ec19fdbcaffc133ded339d04c86ebc901cd68a1`; GitHub rapporteerde `mergeable=false`/`dirty`.
- Lokale `git merge-tree` vond exact één inhoudelijk conflict: `PROJECT_STATE.md`. Er waren geen codeconflicten. Het document is opgelost met behoud van de actuele main-checkpoints én de PR #51 supersede/migrationrunner-historie.
- De main-sync nam de actuele root→categorie Hoogvliet-wijzigingen mee; supersede-RPC, migration `20261005230000`, runner, target 400, retries, dedupe en bestaande PR #45–#50-functionaliteit zijn behouden.

## Disarmed releasegrens

- Run **37367248965** hoort bij de oude branch-head `5ec19fd` en stond bij controle nog `queued`; hij wordt niet als releasebewijs gebruikt. Er is geen tweede migrationprecheck gestart.
- `MIGRATION_ARMED=false` blijft hard-coded. De runner kent uitsluitend `20261005230000_supersede_failed_daily_catalog_job.sql`; er is geen migration, databasewrite, supersede, import, merge of deploy uitgevoerd.
- Na de merge-resolutie volgen opnieuw de volledige lokale gates, push naar dezelfde PR-branch, CI/Preview-controle en uitsluitend een nieuwe disarmed runnercontrole indien de oude run achterhaald is.

# Checkpoint 29 — PR #50 Production en dagjobstatus — 5 oktober 2026

## Merge en Production

- PR #50 is via squash gemerged. Pre-merge head: `a6fec52968f77cf7ab7047336bc6d674d6bd68da`; mergecommit en nieuwe main-head: `f030043e9158037b0f9d2164091dfb2b6d99eab3`.
- De PR-releasegate was groen: PR niet-Draft en mergeable, Vercel Preview READY en de nieuwste volledige core/regression/build workflowrun **37343581197** (#253) geslaagd. De workflow bevatte importerfixtures/seed consistency, PostgreSQL atomic rollback/concurrency, webflows, regressies, lint, TypeScript en build.
- Automatische Vercel Production deployment `dpl_HivcFWWAnzV6gyU7ejMCQXS8LgSp` op de nieuwe main-head is **READY**. Production homepage smoke: HTTP **200**. De main commitstatus rapporteert Vercel success; er werd geen afzonderlijke push-triggered main-CI-run teruggegeven door de workflow-runconnector.
- De nieuwe root→categorie-code en strategy fingerprint `hoogvliet-public-catalog-api-pagination-v4` staan op Production. PR #45–#49 zitten in de main-basis. Geen migration uitgevoerd.

## Read-only discoverybewijs en bestaande dagjob

- Read-only proof **37343193141** toonde root `/producten` → **20 dynamische categorieën**, **2 routes bezocht**, **2 listingpagina's**, **20 initiële kandidaten** en **41 unieke SKU-kandidaten**; legacy Intershop-discovery: **niet gebruikt**. Dit is een begrensde proof, geen volledige catalogusdekkingmeting en geen daily import.
- Actuele Production-job `53553be0-2158-47b1-92c3-2bc75cd7d0cc`, datum **2026-10-05**, target **400**, blijft **0/400**, status `failed_requires_attention`, attempt_count **3**, recovery_count **1**, `next_retry_at=null`, geen lock.
- Attempt #3 is `non_retryable_failure`: `discovery_incomplete_stalled_terms`; scanned/new/updated/unchanged/skipped/invalid **0**, source_errors **1**, remaining **400**. De vorige stop van de dagjob blijft leidend voor de state-machine.
- Er is geen veilige normale retry beschikbaar in deze jobstatus. Geen recovery of daily dispatch uitgevoerd; de guard is niet omzeild. Er is dus geen nieuwe daily funnel, geen importresultaat en geen nieuwe productcount om te rapporteren.
- Geen catalogusdekkingmeting uitgevoerd: de daily discovery kon door de state-machine niet opnieuw worden uitgevoerd en de begrensde 2-pagina proof is onvoldoende om volledigheid of een betrouwbare ontbrekende-SKU-lijst vast te stellen.
- Kleinste veilige vervolgstap: onderzoek/definieer in Codex een state-machine-goedgekeurde volgende dagjob na `failed_requires_attention` en `recovery_count=1`, zonder handmatige DB-statuswijziging. Start pas daarna een enkele normale daily attempt; verander target 400 of productstrategie niet zonder expliciete toestemming.

---

# Checkpoint 28 — root→categorie traversal hotfix — 5 oktober 2026

## Hotfix vanaf actuele main

- De actuele `origin/main` was vóór wijziging `8192dd4`; PR #49 is gemerged en Production READY. De featurebranch is `codex/fix-highvliet-root-discovery-20261005`, head `c783210c6b80210eb55bc80afe9dcee7a49b0b6a`. `ROADMAP.md` is niet gewijzigd.
- De oorzaak zat vóór de bestaande werkende categorieparser: `catalog:root`/`/producten` werd door `waitForCatalogSource` als klaar beschouwd op basis van alleen het root-pad, terwijl de categorieboom nog client-side/hydrationmatig moest verschijnen. Bovendien koos `extractCatalogCategoryLinks` één DOM-subset zodra die niet-leeg was; daardoor konden navigatielinks buiten `<main>` worden weggegooid. De aparte proof wachtte wel op rendering en verzamelde alle anchors, waardoor die niet dezelfde root-flow testte.
- De root werd in de collectorcode niet bewust als productlisting gepagineerd: na root-linkextractie bestond al een `continue`. De foutieve root-ready timing/route-extractie verhinderde die overgang; de oude geaggregeerde `load_more_stagnated`-melding maakte rootfalen daarnaast onterecht indistinct van listingfalen.

## Fix en stopredenen

- Root discovery wacht nu op actuele publieke categorie-links vóór extractie en gebruikt alle publieke anchors, waarna de bestaande `normalizeCatalogCategoryURL`-allowlist alleen actuele `https://hoogvliet.nl`-categorieën accepteert. `/producten` blijft uitsluitend navigatie; `collectCatalogListing` wordt alleen voor een categorie aangeroepen.
- Root zonder categorieën geeft `root_category_discovery_failed`. Een gewijzigde categoriepagina geeft `category_structure_changed`; HTTP 404 valt onder `source_unavailable`; listingstagnatie geeft `category_listing_stagnated`. Er is geen stille Intershop-fallback. Legacy `/INTERSHOP`-paden worden niet als catalogusroutes geaccepteerd; publieke `/INTERSHOP/static/...`-assets van de website zijn geen discoverybron.
- Dagtarget 400, remainingTarget, strategy fingerprint v4, scheduler 06:00/DST-gate, retries, locks, recovery, detailvalidatie, dedupe en importflow zijn behouden. Geen recovery, daily import, databasewrite, migration, merge of deploy uitgevoerd.

## Read-only root-flow proof

- GitHub Actions read-only proof **37343193141** op deze head gebruikte dezelfde collectorflow: `catalog:root → https://hoogvliet.nl/producten → actuele categorie → listing`. Resultaat: root HTTP **200**; **2 routes bezocht**; **20 dynamisch ontdekte categorieën**; **20 initiële kandidaten**; **41 unieke SKU-kandidaten**; **2 listingpagina's**; `legacy_discovery=none`. De 10 `/INTERSHOP/static/...`-requests waren uitsluitend statische assets. Geen import, Supabase, recovery, productwrite, databasewrite of Zyte.
- De proof overschreed aantoonbaar de eerste batch; SKU-voorbeelden uit dezelfde collector waren de eerder bewezen actuele Hoogvliet-SKU's, waaronder `064786000`, `081222000`, `729202000`, `000737000` en `060936000` in de categorieproef. Dit is geen volledige catalogusdekkingmeting en zegt niets over 7.540 Production-producten.

## Tests en vervolg

- Volledige lokale gate is groen: `npm run check`, `node --check scripts/probe-highvliet-current-catalog.mjs` en **348/348 tests**. Nieuwe fixtures/tests dekken vertraagde root-hydration, root zonder listing-pagination, root/categorie stopcodes, categorie-pagination, Intershop-routeblokkade, daily retrycodes en bestaande target/remaining/scheduler/recovery-regressies.
- PR wordt geopend vanaf deze branch/head. Work doet na merge alleen de releasegate, mergegoedkeuring en Production READY-controle; daarna de bestaande failed dagjob via de veilige state-machine behandelen en precies één geldige attempt volgen. Geen tweede recovery. Als discovery werkt maar weinig nieuwe SKU's vindt: meteen bereikbare unieke SKU's versus Production 7.540 meten.

---

# Checkpoint 27 — PR #49 Production en ene daily attempt — 5 oktober 2026

## Release

- PR #49 is via squash gemerged. Pre-merge head: `de63d1586bf63b9891321557f0fb263e78ddc5bc`; squash/nieuwe main-head: `e7caa107aa7694c66bdcfd7d462ec672f44f6205`.
- De finale releasegate was groen. Main-CI-run **37335295557** (#251) is groen. Vercel Production-deployment `dpl_9S9wB7csjEE5P3iXq1fHLj8WUkTY` op dezelfde main-head is **READY**. Homepage smoke gaf HTTP **200**.
- PR #49 zet de actuele discoverystrategy `hoogvliet-public-catalog-api-pagination-v4` op Production. PR #45–#48 blijven in de main-basis opgenomen. Geen migration of schemawijziging uitgevoerd.
- De eerdere read-only categorieproef blijft begrensd bewijs: Actions-run **37325662499**, 22 initiële kaarten en 41 unieke SKU-kandidaten over twee pagina's. Dit is geen volledige catalogusdekkingmeting.

## Eén normale daily attempt

- Vlak vóór dispatch read-only bevestigd: dezelfde job `53553be0-2158-47b1-92c3-2bc75cd7d0cc`, datum 2026-10-05, `retry_scheduled`, 0/400, attempt_count 2, recovery_count 1, nul actieve attempts en geen actieve lock; de twee eerdere attempts waren beëindigd.
- Exact één dispatch op main, run **#114 / 37336178828**, met `daily_import=true`, `recover_failed_daily=false`, groeimodus/batch en limiet 400. Geen tweede dispatch en geen tweede recovery.
- De run behield dezelfde dailyImportId, claimde attempt **#3** (`795a3342-fb3d-4add-917d-8b93afd90f71`) en eindigde `failed_requires_attention`; recovery_count bleef 1. Geen actieve attempt of lock na afloop.

## Discoveryfunnel en resultaat

- De run logde de nieuwe strategy fingerprint `hoogvliet-public-catalog-api-pagination-v4` en startte `catalog:root`; dynamische categorieën: **0**.
- Categorie/route geteld: **1** (alleen de root-route). De route liep vast met `load_more_stagnated`; er kwamen geen listing page hits of paginatiepagina's uit.
- Page hits **0**; unieke kandidaten **0**; bestaande SKU's onder kandidaten **0**; duplicaten **0**; ongeldig **0**; geldige nieuwe kandidaten **0**; werkelijk toegevoegd **0**.
- Importertelemetrie rapporteerde totaal **7.540 vóór en na**, werkelijke groei **0**, cumulatief **0/400**, resterend **400**. Stopreden: `discovery_incomplete_stalled_terms`.
- De runlog bevat de root-term als enige discoveryterm; de dagelijkse collector heeft dus niet de categoriepagina bereikt waarvan de begrensde read-only proef 41 SKU-kandidaten vond. De catalogusdekkingbeslissing is daarom **nog niet aan de orde**. Deze run bewijst niet dat de catalogus vrijwel compleet is.
- Supabase-state na de run: dezelfde job `failed_requires_attention`, attempt_count 3, recovery_count 1, geen actieve lock/attempt. Geen productinsert of productupdate gerapporteerd.

## Volgende stap

- Geen tweede recovery of daily dispatch voor deze dag.
- Onderzoek read-only waarom de dagelijkse collector bij `catalog:root` op `load_more_stagnated` eindigt en nul dynamische categorieën oplevert, terwijl de aparte expliciete categorieproef wel doorpagineerde. Vergelijk de root/category-discoveryroute en paginator.
- Pas na aantoonbaar werkende dagelijkse listingdiscovery een nieuwe release/attempt plannen. Catalogusdekking vergelijken met Production alleen wanneer de discovery eerst betrouwbare bereikbare SKU's oplevert.

---

# Checkpoint 26 — actuele Hoogvliet-catalogus geïmplementeerd — 5 oktober 2026

## Implementatie

- Remote `main` blijft `46ef60576543fc9b05f65fc0fdf8d508bd7139f9`. De releasebranch is `codex/implement-highvliet-catalog-discovery-20261005`; actuele head vóór deze checkpoint-update: `5a9986a2e0a75a62c1a120a81a70fead1a78c89c`.
- De primaire discoveryroute gebruikt nu `https://hoogvliet.nl/producten` en ontdekt publieke categorie-/subcategorielinks runtime uit de actuele catalogusstructuur. De voorbeeldcategorie is `/aardappelen-groente-fruit`; productroutes worden alleen als `https://hoogvliet.nl/product/...`-kandidaten toegelaten.
- De oude Intershop-route `ViewTWParametricSearch-SimpleOfferSearch` en `CategoryName=999999-100` zijn niet langer een geldige discoveryterm. Onbekende/legacy-termen falen met `source_unavailable`; er bestaat geen stille legacy-fallback.
- Listing discovery combineert actuele HTML/DOM-kaarten met de publieke `GET https://hoogvliet.nl/api/graphql`-`GetProducts`-hydratie die de website zelf gebruikt. De endpoint gebruikt de publieke queryparameters `operationName`, `query` en `variables`; SKU’s worden voor simple products uit `url_key` bevestigd. Detailvalidatie blijft leidend voor package, prijs en opslag.
- Pagination volgt uitsluitend de zichtbare publieke `Next`/`Volgende`-link. De bewezen vorm is `/aardappelen-groente-fruit/q/page/2`. Een echte load-moreknop wordt alleen gevolgd voor teksten als `Producten laden`, `Meer producten` of `Laad meer`; filter-/carouselknoppen zoals `Toon meer` en `Bekijk meer` worden niet aangeklikt. Visited-URL’s, SKU-dedupe, stagnatiedetectie en veiligheidslimieten blijven actief.
- Strategy fingerprint is verhoogd naar `hoogvliet-public-catalog-api-pagination-v4`, zodat oude exhausted-state niet de nieuwe catalogusstrategie blokkeert. Dagtarget 400, persistent restant, scheduler, retries, locks, recovery en downstream detail-/dedupe-/prijslogica zijn niet inhoudelijk vervangen.

## Read-only cloud proof

- Actions-run **37325662499** op head `5a9986a2e0a75a62c1a120a81a70fead1a78c89c` was succesvol. De actuele categorie gaf HTTP **200** en de production collector vond in een begrensde proof **22 initiële kaarten** en **41 unieke SKU-kandidaten over 2 listingpagina’s**. SKU-voorbeelden: `064786000`, `081222000`, `729202000`, `000737000`, `671474000`, `075080000`, `683144000`, `001427000`, `211990000`, `047519000`, `002499000`, `060936000`.
- De collector-proef eindigde bewust na 2 pagina’s met `sourceExhausted=false`; dit is bewijs dat de eerste batch wordt overschreden, geen uitspraak over de volledige catalogusomvang of over 7.540 Production-producten.
- De live netwerkregistratie bevatte de publieke `/api/graphql`-requests met `GetProducts` en SKU-filters. Geen Intershop-request werd gezien. De workflow was read-only: geen importer, Supabase, productwrite, databasewrite, migration, recovery, Zyte-request, merge of deploy.

## Tests en vervolg

- Lokale fixtures dekken actuele listingvelden, publieke GraphQL-hydratatie, meerdere categorieën, cross-category duplicates, bestaande SKU’s, detailvalidatie, load-more, `Next`-pagination, stagnatie, challenge, gewijzigde structuur, daily target 400, remainingTarget, retries/locks/recovery en strategy fingerprint.
- De kleine cloud-proof is geen volledige catalogusdekkingmeting. Na merge moet Work eerst de releasegate uitvoeren, daarna precies één veilige daily attempt. Alleen bij weinig nieuwe producten volgt een aparte vergelijking van bereikbare unieke Hoogvliet-SKU’s met Production (~7.540).

# Checkpoint 25 — één Zyte HTTP fallbacktest op bewezen 403-route — 5 oktober 2026

## Startbewijs

- Remote `main` bij start: `46ef60576543fc9b05f65fc0fdf8d508bd7139f9`. Onderzoeksbranch: `codex/fix-highvliet-parser-20261005`; deze branch is niet gemerged en er is geen PR geopend.
- Probe-run **37310940072** (branch-head `65b4f9370051707058ba866ff87786ef8f73910d`) bevestigde voor de normale publieke listing-fetch HTTP **403**, classificatie `CHALLENGE`, nul kandidaten en geen xhr/fetch-responses.
- Exacte URL uit die run, ongewijzigd gebruikt voor de ene Zyte-call:
  `https://www.hoogvliet.com/INTERSHOP/web/WFS/org-webshop-Site/nl_NL/-/EUR/ViewTWParametricSearch-SimpleOfferSearch?PageNumber=0&PageSize=16&SelectedSearchResult=SFProductSearch&SearchTerm=&SelectedItem=&SortingOption=Relevantie&CategoryName=999999-100&CategoryTitle=Producten--Aardappelen%2C%20groente%2C%20fruit&SearchTermKey=`

## Zyte-request en resultaat

- De goedkoopste HTTP-response-methode is gebruikt: één `POST https://api.zyte.com/v1/extract` met `httpResponseBody=true`; er is geen browserrendering aangevraagd. De API-key kwam alleen uit GitHub Secret `ZYTE_API_KEY` en is niet gelezen of gelogd.
- Actions-run **37312931721** op trigger-commit `6c9ada2ef2c2e67084c991a4279160a5c2018bbd` voerde exact **1** Zyte-request uit; geen retry en geen tweede Zyte-call.
- Zyte API-status **200**; upstream Hoogvliet-status **404**; responsegrootte **100.932 bytes**. Zyte volgde een redirect van `www.hoogvliet.com` naar:
  `https://hoogvliet.nl/INTERSHOP/web/WFS/org-webshop-Site/nl_NL/-/EUR/ViewTWParametricSearch-SimpleOfferSearch?PageNumber=0&PageSize=16&SelectedSearchResult=SFProductSearch&SearchTerm=&SelectedItem=&SortingOption=Relevantie&CategoryName=999999-100&CategoryTitle=Producten--Aardappelen%2C%20groente%2C%20fruit&SearchTermKey=`
- De eindpagina had titel `Pagina niet gevonden - Hoogvliet`. Classificatie: **UNKNOWN**. Geen challenge-signaturen gevonden. De HTML bevatte Intershop-/Hoogvliet-signalen, maar het upstream HTTP 404 en de 404-titel maken dit geen geldige listing.
- Listinganalyse: `.product-tile` **nee**; `#product-search-result` **nee**; productlinks **0**; SKU’s **0**; pagineringvelden leeg. Ingebedde JSON-scriptblokken: **22**, waarvan **2** parseerbaar; JSON-LD **0**; productachtige JSON-objecten/SKU-hints **0**. De parseerbare JSON had generieke Next.js-paginasleutels (zoals `buildId`, `page`, `props`), geen listingproducten. Scripts: **22**; statische xhr/fetch-vermeldingen **0**; publieke endpoint-hints **0**. Een HTTP-response toont geen werkelijk browser-XHR-verkeer.
- Bestaande importerparser in-memory uitgevoerd: **0 kandidaten**, **0 unieke SKU’s**, parsercompatibiliteit **nee** (de 404-body mist product- en betrouwbare pagineringstructuur).
- De twee eerdere onmiddellijke workflow-configuratiefailures (**37312736000**, **37312751176**) hadden nul jobs en stuurden geen Zyte-request. Tijdelijke runner, script en dispatchmarker zijn na de ene echte test van de onderzoeksbranch verwijderd.

## Besluit en volgende kleinste stap

- Challengefallback is **niet bewezen**: normale fetch gaf 403 CHALLENGE, maar Zyte kreeg na redirect een upstream 404 en geen listing.
- Geen `browserHtml`, tweede aanvraag, import, parserfix, Production-integratie, databasewrite, migration of recovery uitgevoerd. `main` en Production zijn niet gewijzigd.
- Volgende stap: vóór een nieuwe Zyte-test read-only vaststellen waarom de bestaande listing-URL na canonieke redirect op `hoogvliet.nl` 404 geeft en pas daarna een aantoonbaar geldige listing-URL vastleggen. Geen fallbackintegratie of parseraanpassing totdat dat bewijs bestaat.
- `ROADMAP.md` is niet gewijzigd: 1A.1 is hiermee niet beslist.

# Checkpoint 24 — Hoogvliet parser-onderzoek geblokkeerd door actuele source challenge — 5 oktober 2026

## Startpunt en onderzoek

- Actuele `origin/main` is gecontroleerd op `46ef60576543fc9b05f65fc0fdf8d508bd7139f9` (`docs: record PR48 recovery attempt`). De nieuwe branch is `codex/fix-highvliet-parser-20261005`; de branch startte exact vanaf deze main-head.
- Production-run **37306914670** (#113) blijft het relevante bewijs voor de applicatiestatus: discovery stopte op `parser_structure_changed` vóór paginahits en kandidaten. Er is in Codex geen Production-read, databasewrite, recovery, import, migration, merge of deploy uitgevoerd.
- De bestaande parser verwacht de Intershop-listingstructuur `.product-tile`, `#product-search-result` en de bijbehorende pagineringsmetadata. De huidige code classificeert een HTTP-200-document zonder product- of lege-resultaatstructuur terecht als `parser_structure_changed`; een XHR/API-fallback is nog niet aanwezig.

## Read-only live proof

- Directe Hoogvliet-egress vanuit Codex is door het runtimebeleid geblokkeerd. Daarom is één tijdelijke, strikt read-only GitHub Actions-probe gebouwd: `.github/workflows/probe-hoogvliet-source.yml` met `scripts/probe-hoogvliet-source.mjs`.
- Probe-run **37310940072** op exact branch-head **65b4f9370051707058ba866ff87786ef8f73910d** onderzocht uitsluitend één publieke groeicategorie-route (`category:999999-100`). Resultaat: HTTP **403**, classificatie **`CHALLENGE`**, **0 kandidaten**, geen DOM-producten en geen XHR/fetch-responses om als openbare catalogus-API te beoordelen.
- De probe verrichtte geen importer-, Supabase-, recovery-, product- of databaseactie. De workflow publiceert alleen beperkte veilige metadata; secrets en response-body’s worden niet gelogd.
- Eerder aangeleverde Zyte-evidence (HTTP 200, geen producttiles/productlinks, wel XHR/fetch-signalen) is hiermee niet zelfstandig reproduceerbaar. De actuele endpoint-URL en JSON-schema zijn daardoor nog niet bewezen.

## Besluit en volgende stap

- Er is bewust **geen parser- of discoveryfix** toegevoegd: een generieke XHR-parser zonder bewezen endpoint/schema zou productidentiteit, SKU, detailvalidatie en paginering kunnen gokken. De bestaande `parser_structure_changed`-classificatie blijft voor deze bewezen-onbekende 200-structuur behouden.
- De tijdelijke probe staat op branch-head `65b4f9370051707058ba866ff87786ef8f73910d`; er is nog geen PR geopend omdat de onderliggende oorzaak en duurzame fix niet bewezen zijn. `ROADMAP.md` is niet gewijzigd.
- Volgende Work-stap: voer dezelfde read-only broninspectie uit vanuit een runtime/proxy die de eerder bewezen publieke 200-response kan bereiken (zonder challenge-bypass), leg endpoint/schema en één actuele fixture vast, en implementeer pas daarna de minimale API/listing-adapter met bestaande detailvalidatie, dedupe, fingerprint, retry- en 400-state-machine-behoud. Daarna pas tests, PR en releasegate.

# Checkpoint 23 — PR #48 Production-release en één gecontroleerde recovery — 5 oktober 2026

## Release

- PR #48 is op pre-merge head `e1c0efda73cd64814a16392fe5edc73579a6ecc3` via squash gemerged; mergecommit en main-head: `edeebd496774879b520e3cda92c3ad62964f8004`. Geen checks zijn omzeild.
- PR releasegate: PR-CI en Preview groen; migrationbestand kwam overeen met de eerder officieel toegepaste Production-migration; `MIGRATION_ARMED=false`. PR #45 schedulerfix, PR #46 `daily_import=true` en PR #47 Playwrightfix bleven intact.
- Main-CI-run **37306392898** (#247) is groen, inclusief PostgreSQL concurrency-gate, web/core-flow regressies, lint, TypeScript en build. Automatische Vercel Production-deployment `dpl_DeBcpjZhkaQ1b66s9sFSXS3u2mF4` is READY en groen; Production-homepage opende en toonde de app.
- De reeds toegepaste migration blijft `20261005220000_recover_failed_daily_catalog_growth`; in dit checkpoint is geen migration, repair of ander schemawerk uitgevoerd.

## Verse recovery-precheck en ene dispatch

- Direct vóór recovery was dezelfde job read-only bevestigd: `dailyImportId=53553be0-2158-47b1-92c3-2bc75cd7d0cc`, datum `2026-10-05`, `failed_requires_attention`, target 400, 0/400, restant 400, attempt_count 1, recovery_count 0, geen lock/actieve attempt, en vorige attempt `d6d66511-e1de-4379-ba39-3b7e64094f0e` definitief beëindigd.
- De oude attempt had `non_retryable_import_error` met de bewezen Playwright-fout “Too many arguments…”. De codefix van PR #47 was op Production uitgerold.
- Exact één workflow_dispatch op main: Actions-run **37306914670** (#113), met `daily_import=true`, `recover_failed_daily=true`, `recovery_reason=software_fix_verified`. Geen tweede dispatch.
- RPC-audit `b8c3454c-91a1-44fa-ae54-aedef62b42fa`, recovery_count exact 0→1, dezelfde dailyImportId en voortgang behouden, dagtarget bleef 400. Nieuwe attempt `a7e52967-eea5-4efb-93aa-63526a86824f` (#2); vorige attempt-ID bleef in de audit staan. De recovery legde vóórstand 0 en remainingTarget 400 vast.

## Resultaat van poging 2

- Discovery werd gestart, maar de bron-/parsercontrole stopte vóór een eerste discoverysegment met `parser_structure_changed`: Hoogvliet-zoekpagina bevatte geen herkenbare product- of lege-resultaatstructuur.
- Funnel uit run #113: page hits **0**; unieke kandidaten **0**; bestaande SKU’s onder kandidaten **0**; duplicaten **0**; ongeldig **0**; geldige nieuwe kandidaten **0**; werkelijk toegevoegd **0**.
- Cumulatief: **0/400**, resterend 400; catalogustotaal in de run bleef **7.540**. Er zijn geen productupdates of inserts gerapporteerd.
- Poging 2 eindigde als `retryable_failure`, foutcode `parser_structure_changed`. De normale state machine zette de dagjob op `retry_scheduled`, `attempt_count=2`, `recovery_count=1`, zonder actieve/stale lock; `next_retry_at=2026-10-05 15:04:22.779+00 UTC`. Recovery is niet opnieuw gebruikt.
- Geen handmatige DB-statuswijziging, tweede recovery, tweede handmatige daily-dispatch, migration of discovery-codewijziging uitgevoerd.

## Volgende beslissing

- Laat alleen de bestaande retry/state-machine-flow zijn werk doen; start geen handmatige tweede run. Controleer daarna de normale uitkomst en nieuwe funnel read-only.
- Deze poging bereikte discoverycode maar de bronstructuur faalde vóór paginahits/kandidaten; er is dus nog geen bewijs dat normale discovery werkt met weinig unieke nieuwe producten. Geen nieuwe discoveryfix zonder nieuw bewijs. Als een volgende poging wel normaal discovert maar weinig/geen nieuwe SKU’s vindt, bepaal dan eerst volledige bereikbare Hoogvliet-catalogusdekking versus Production-catalogus (~7.540), inclusief ontbrekende SKU’s en dekkingspercentage.
- `ROADMAP.md` is niet gewijzigd.

# Checkpoint 22 — recovery-migration toegepast en runner disarmed — 5 oktober 2026

## Exacte Production migration

- Voor arming was PR #48 op head `67eea724d687eafef1e070aa32e155cf67bcc034`, remote `main` op `b901ff77e6181c15c521a4e70471c2bc52c2ce53`. DISARMED-run **37301751242** was SUCCESS op exact dezelfde PR-head; CLI 2.119.0, Production-ref en beide secrets zijn door de runner gevalideerd. De enige lokale pending migration was `20261005220000_recover_failed_daily_catalog_growth.sql`.
- De enige armingwijziging is commit `634f0d911d2a661337e8484386aec9138394ed36`. De verse precheck van Actions-run **37304326712** was SUCCESS. Daarna voerde de officiële Supabase CLI 2.119.0 `db push --db-url` uit.
- Production migrationhistory registreert exact één `20261005220000`, met naam `recover_failed_daily_catalog_growth`. De workflow's volledige post-migration local↔remote historycontrole kwam voorbij; daarna faalde zijn eigen RPC-inspectie. Oorzaak: de tijdelijke workflow filtert `pg_get_function_identity_arguments` alsof PostgreSQL alleen types retourneert, terwijl de geretourneerde signature ook parameter­namen bevat. Daardoor rapporteerde de workflow ten onrechte `function_count=0`. De migration is read-only onafhankelijk geverifieerd; dit was geen SQL-migrationfout.
- De runner is direct gedisarmd in commit `fd18b67cbf0c211bad01f2676a72e69374211c64`; de workflow bevat weer hard-coded `MIGRATION_ARMED=false`. Automatische disarmed-run **37304446843** deed alleen de read-only precheck en faalde gesloten omdat die precheck vóór toepassing precies één local-only migration verwacht. De apply-job is **skipped**; er was geen tweede apply.
- Read-only RPC-verificatie: exact één functie `public.recover_catalog_daily_attempt`, 11 argumenten, resultaat `jsonb`, `SECURITY DEFINER`, `search_path=public`; EXECUTE voor `service_role` **ja**, voor `anon` en `authenticated` **nee**. Recoverykolom en checkconstraint, RLS-auditabel en beide recovery-indexen zijn aanwezig. Auditrijen: 0.
- Geen tweede migration, repair, recovery, daily import, product-/prijswrite, PR-merge of app-deploy uitgevoerd.

## Dagjob onveranderd

- Dezelfde `dailyImportId` `53553be0-2158-47b1-92c3-2bc75cd7d0cc`, datum `2026-10-05`, state key `daily-catalog-growth`: `failed_requires_attention`, target 400, progress 0, remaining 400, attempt count 1, recovery_count 0, geen lock. `updated_at` bleef `2026-10-05T09:21:48.292+00:00`.
- Vorige attempt blijft `d6d66511-e1de-4379-ba39-3b7e64094f0e`, poging 1, `non_retryable_failure`, `non_retryable_import_error`, definitief beëindigd. Er is geen recovery audit aangemaakt.

## Volgende stap

- Work voert de aparte PR #48 releasegate uit: controleer de finale branch-head, disarmed toestand, PR-diff en CI; behandel de tijdelijke workflow-postcheck false negative expliciet. Pas na groen de PR-merge uitvoeren volgens de reeds gegeven toestemming. Daarna Production READY controleren en een verse recovery-precheck doen vóór exact één recovery + daily attempt. Funnel en cumulatieve `X/400` beoordelen.
- Bij werkende discovery maar weinig unieke nieuwe SKU's: bepaal eerst volledige bereikbare catalogusdekking versus Production-catalogus; geen nieuwe discoveryfix zonder die vergelijking.

# Checkpoint 21 — tijdelijke exacte Supabase migrationrunner — 5 oktober 2026

## PR #48 en veilige runner

- PR #48 blijft ongemergd op `codex/recover-failed-daily-attention-20261005`. De start-head was `d707f8cb14d8e919bdea347dc25bf474443413c9`; remote `main` was `b901ff77e6181c15c521a4e70471c2bc52c2ce53`.
- Tijdelijke workflow `.github/workflows/apply-recovery-migration.yml` is toegevoegd met uitsluitend `workflow_dispatch` en een smalle push-trigger op deze branch voor alleen het workflowbestand. De workflow gebruikt officiële Supabase CLI `2.119.0`, bestaande secrets `SUPABASE_ACCESS_TOKEN` en `SUPABASE_DB_PASSWORD`, project `pjcqxufvbkkjehituzxz` en de bewezen IPv4 Session pooler.
- `MIGRATION_ARMED=false` staat hard-coded. De disarmed job doet alleen een officiële `supabase migration list`; de apply-job wordt bovendien job-level geblokkeerd totdat de precheck-output én een expliciete `MIGRATION_ARMED=true` beide aanwezig zijn. De apply-stap herhaalt de exacte precheck vlak vóór de write.
- `scripts/check-recovery-migration-history.py` vereist vóór write dat alle bestaande repositoryversies remote matchen en uitsluitend `20261005220000_recover_failed_daily_catalog_growth.sql` local-only is. Na een toekomstige write vereist hij volledige local↔remote match. Tweede pending migration, remote-only history of een al remote aanwezige target faalt gesloten.
- De toekomstige armed route gebruikt alleen de officiële repositoryflow `supabase db push --db-url ... --workdir ...`; geen `apply_migration`, migration repair, reset, seed, `--include-all`, directe history-SQL, recovery-call, import of productwrite. Daarna volgen uitsluitend read-only RPC/grant/schema- en dagjobcontroles.

## Verificatie en volgende stap

- Lokale workflowtests dekken YAML, bash-syntax, disarmed write-gate, forbidden-command scan, exact één pending migration, tweede pending migration, onverwachte remote-only history, al remote aanwezige target en volledige postcheck-match.
- Codex heeft geen GitHub Actions-run gestart, geen Production migration toegepast, geen recovery/import/productwrite uitgevoerd, niets gemerged en geen deploy gestart. `ROADMAP.md` is niet gewijzigd.
- Volgende stap Work: controleer de disarmed Actions-run en bevestig exact één pending migration. Alleen daarna kan een afzonderlijk goedgekeurd Work-checkpoint `MIGRATION_ARMED=true` zetten voor exact één migration; disarm direct daarna opnieuw en controleer history, RPC/grants en dagjob vóór de PR-mergegate.

# Checkpoint 20 — veilige recovery van failed_requires_attention — 5 oktober 2026

## Startpunt en bewezen blokkade

- De actuele `origin/main` is gecontroleerd op `b901ff77e6181c15c521a4e70471c2bc52c2ce53`. PR #47 is gemerged en Production READY; PR #45 schedulerfix en PR #46 daily-dispatch zijn eveneens onderdeel van deze `main`. Deze wijziging staat op een nieuwe featurebranch en wordt niet naar `main` gemerged.
- Production-job `daily-catalog-growth`, datum `2026-10-05`, ID `53553be0-2158-47b1-92c3-2bc75cd7d0cc`: `failed_requires_attention`, poging 1, `0/400`, `remainingTarget=400`, geen stale lock. Run #112 / Actions-run `37289231212` faalde met `non_retryable_import_error` vóór discovery of productwrite door de bewezen Playwright `page.evaluate`-argumentenfout; PR #47 heeft die fout opgelost.
- De bestaande scheduler en `claim_catalog_daily_attempt` blijven correct weigeren: `shouldRunDailyImport` geeft `run=false` voor deze status en de normale claim heropent hem niet. Er is geen workflow-dispatch, statusedit, databasewrite, recovery, import of deploy uitgevoerd.

## Gekozen recoverymechanisme

- De nieuwe service-role RPC `recover_catalog_daily_attempt` voert recovery en precies één nieuwe daily-attemptclaim atomair uit. De normale scheduler/claim blijft onveranderd en kan `failed_requires_attention` niet zelfstandig heropenen.
- De workflow heeft twee expliciete inputs: `daily_import=true` én `recover_failed_daily=true`, met een beperkte redenkeuze `software_fix_verified` of `infrastructure_fix_verified`. Zonder de eerste input faalt de workflow vóór de importer; preflight/E2E-paden worden uitgesloten. De importer gebruikt geen directe REST-statusupdate.
- De recovery-RPC maakt een nieuwe attempt met lock en geeft dezelfde `dailyImportId`, `remainingTarget` en bestaande dagstand aan de bestaande `runDailyCatalogAttempt`-logica door. Daarna geldt de normale finish/state-machine-uitkomst. Een tweede expliciete recovery wordt door `recovery_count` en een unieke recovery-auditindex geweigerd; automatische schedulerretries krijgen geen speciale toegang tot de terminale status.

## Guards en statebehoud

- De RPC vereist exact: bestaand `dailyImportId`, dezelfde state key/datum, `failed_requires_attention`, `expected updated_at`/revision, verwacht attempt count, verwachte `new_products_collected` en `remainingTarget`, target exact 400, resterend doel groter dan 0, `recovery_count=0`, geen lock, geen running attempt en een definitief beëindigde laatste `non_retryable_failure`-attempt.
- De database `FOR UPDATE`-lock plus CAS-vergelijkingen voorkomt races; de tweede gelijktijdige recovery ziet de gewijzigde status/revision/recovery_count en faalt. De RPC accepteert alleen de twee gecontroleerde recoverycategorieën en is uitsluitend aan `service_role` verleend.
- Migration `20261005220000_recover_failed_daily_catalog_growth.sql` voegt additief `recovery_count` en de RLS-afgeschermde append-only tabel `catalog_daily_recoveries` toe. De audit bewaart recoverytijdstip, originele status/failure reason, recoverycategorie, vorige attempt-ID, nieuwe attempt-ID, dagstand vóór recovery, resterend doel en verwachte revision. Er worden geen products, prices, discovery-cursors, `exhaustedTerms` of bestaande counters gereset.
- Voor 0/400 blijft de job 0/400 met restant 400; voor bijvoorbeeld 137/400 blijft hij 137/400 met restant 263. De nieuwe poging start alleen met dat resterende doel.

## Tests en releasegate

- Gerichte daily/config/workflow-tests: **127/127 groen**. Volledige root-suite: **341/341 groen**. `npm run check`: groen. PostgreSQL atomic/concurrency-gate: **25/25 groen**. Workflow-YAML-validatie: groen.
- Regressies dekken 0/400 eligible, 137/400 behoud, running/completed/lock/attempt/revision guards, normale schedulerweigering, één recoveryclaim, dubbele recovery, statebehoud, target 400, audit/CAS-payload, PR #45 scheduler, PR #46 daily-import en PR #47 Playwright-contract.
- Supabase CLI was niet beschikbaar in deze Codex-omgeving; de migration is daarom expliciet voorbereid en lokaal via tekst-/contracttests gecontroleerd. Work moet de migration als afzonderlijke releasehandeling toepassen en de migration history/read-only schemaresultaten controleren vóór recovery. Geen live migration is uitgevoerd.
- `ROADMAP.md` is niet gewijzigd. Branch: `codex/recover-failed-daily-attention-20261005`.

## Exacte Work-volgorde na PR

1. Controleer PR + CI en review de migration/RPC-diff.
2. Pas uitsluitend migration `20261005220000_recover_failed_daily_catalog_growth.sql` veilig toe; verifieer column, audit table, function grants en migration history. Bij schema-/migrationfout: stoppen, geen recovery.
3. Controleer read-only dat job-ID/datum/status/0/400/restant400/geen lock nog exact kloppen.
4. Geef expliciete mergegoedkeuring; merge en controleer Production READY.
5. Dispatch exact één keer met `daily_import=true`, `recover_failed_daily=true`, `recovery_reason=software_fix_verified`; geen `daily_attempt_only`, `resume_source_challenge`, preflight of E2E-flags.
6. Controleer audit/recovery-ID, dezelfde `dailyImportId`, nieuwe attempt-ID, lock, funnel en `X/400`. Start geen tweede recovery of losse import.
7. Als discovery werkt maar weinig nieuwe SKU’s vindt: eerst bereikbare unieke Hoogvliet-SKU’s vergelijken met de Production-catalogus (~7.540); geen nieuwe discoveryfix bouwen zonder dat bewijs.

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
# Checkpoint 42 — gerichte expliciete-SKU catch-up voorbereid — 7 oktober 2026

## Keuze en scope

- Gestart vanaf actuele `origin/main` **3fc161a214bf35d9721d73a31312a004f801ff5d**.
- Draft PR #54 is open, mergeable en uitsluitend coverage/documentatie; daarom staat deze productiecode op een aparte branch **`codex/explicit-sku-catch-up-20261007`** met Draft PR **#55** tegen `main`. De actuele head wordt bij de PR/branch gecontroleerd; er is geen merge of deploy uitgevoerd.
- De normale daily growth-route is niet geschikt voor de bewezen 812 ontbrekende SKU's: die route scant brede catalogusdiscovery en kan tegen de runtimegrens stoppen zonder de gerichte set af te werken. De catch-up verandert alleen de kandidaatbron: expliciete CSV-SKU + gevalideerde product-URL.

## Implementatie

- Nieuwe command **`npm run import:skus -- --file <csv> --max 400 [--dry-run|--write]`** in `scripts/import-explicit-skus.mjs`; default is read-only dry-run en `--write` is verplicht voor writes.
- `src/explicit-sku-catch-up.mjs` valideert CSV-header/SKU/URL, behoudt leading zero's, dedupliceert input en verwerkt nooit buiten de expliciete lijst. Er is geen discovery-, search- of catalogusroute.
- Bestaande code blijft leidend voor detailnavigatie, product/prijs parsing, positieve-prijsvalidatie, foutclassificatie en product/prijs-upsert: respectievelijk `validateCandidate` en `upsertProducts`. Elke echte run gebruikt ook de bestaande `catalog_import_runs`-observability.
- Het safety contract is vastgelegd: bestaande SKU's worden vóór detailvalidatie `already_exists`, ongeldige prijs/productdata wordt niet geschreven, 404 wordt `not_found`, tijdelijke bronfout `temporary_error`, batchlimiet maximaal 400 en dry-run heeft nul writes.
- Concurrency gebruikt de bestaande shared `catalog_import_runs` unique running-lock plus een read-only controle op running `catalog_daily_jobs`; een actieve daily import of bezette cataloguslock weigert catch-up-write.

## Tests en bewijsgrens

- Nieuwe unit/regressietests in `test/explicit-sku-catch-up.test.mjs` dekken expliciete bron zonder discovery, 400-cap, dedupe/leading zero's, existing SKU, valid new SKU, invalid price/product, detail-404, tijdelijke fout, actieve lock en dry-run zonder writes. De bestaande daily-tests blijven onaangeroerd.
- De exacte missing CSV is niet aanwezig in de repository of het gedownloade coverage-artifact; dat artifact bevat alleen de 8.179 actuele SKU's. Daarom is nog geen eerlijke live dry-run op de bewezen 812-subset uitgevoerd en is geen Production-read/write gedaan.
- Lokale gates zijn groen: `npm test` **365/365**, `npm run check`, `npm run test:postgres` **28/28** en `git diff --check`. De read-only bounded live proof op de exacte missing CSV is nog niet uitgevoerd omdat die CSV niet in deze workspace/artifacts aanwezig is. ROADMAP.md is niet gewijzigd.

## Exacte Work-vervolgstap

Work controleert eerst Draft PR #55 en CI, levert/controleert daarna de originele missing CSV en voert uitsluitend `npm run import:skus -- --file hoogvliet-missing-production-2026-10-06.csv --max 10 --dry-run` uit tegen read-only Production en publieke Hoogvliet-details. Work bevestigt nul writes/brede discovery en rapporteert de per-SKU-classificaties. Daarna pas de normale releasegate; geen `--write`, merge of Production-import in deze Codex-stap.


# Checkpoint 43 — PR #55 exact-SKU dry-run releasegate — 7 oktober 2026

## Read-only Actions-proof

- PR #55 bleef Draft. De tijdelijke proof liep via Actions-run **37600168710** op PR-head **`8195415fe6ddcd7dbe2eb5824e4a90204b3c189e`**. De originele missing CSV is geverifieerd: **812 rijen, 812 unieke SKU's, 0 leeg**, SHA-256 `a24da369b15d4ddf0d8741f7aeb4d3fee2f733e74e2d448ec1ffcd1b8ab30246`.
- Precheck: Production had **7.543 producten**, **7.543 unieke Hoogvliet-SKU's**, **7.543 prijzen**, **53 catalog_import_runs** en **39 daily attempts**. Lopende catalog-imports, daily jobs en attempts: **0**. Er stonden **2** jobs op `retry_scheduled`; die zijn niet gestart of afgewacht. De proof gebruikte de bestaande gedeelde Actions-concurrencygroep `hoogvliet-supabase-update`.
- Exact uitgevoerd: `npm run import:skus -- --file hoogvliet-missing-production-2026-10-06.csv --max 10 --dry-run`. De inputbron was alleen de CSV. Geen rootdiscovery, categoriequeue, listingpagination of brede discovery. **10** kandidaten verwerkt en **802** buiten de batch als `skipped/max_batch_size` gelogd.
- Classificaties: **valid_new 0, already_exists 0, invalid 10, not_found 0, temporary_error 0**. Alle tien detailpagina's waren bereikbaar, maar de bestaande `validateCandidate` gaf `invalidProduct`; geen enkele kandidaat had daardoor een gevalideerde prijs. Importer-output bleef vóór/na op **7.543 producten en 7.543 prijzen**.
- Onafhankelijke read-only nacontrole Supabase: **7.543 productrecords, 7.543 product_prices, 53 catalog_import_runs, 39 daily attempts**; de tien geselecteerde SKU's waren nog afwezig. Productwrites **0**, prijswrites **0**, catalog_import_runs-writes **0**.
- De job stapte na de droge import alsnog rood uit door een fout in de tijdelijke report-helper: de JSON-extractie sneed de openingsaccolade van de CLI-uitvoer af. Daardoor is geen Actions-artifactrapport geüpload; de classificaties en tellingen zijn uit de Actions-logs en read-only nacontrole bevestigd.
- Releasegate: **FAIL**. De tien bereikbaar gevalideerde missing-set-producten eindigden allemaal als `invalidProduct` in plaats van `valid_new`/een specifieker stale/invalid resultaat. De huidige validator registreert voor deze uitkomst geen subreden; exact welke extractiecontrole faalt is dus nog niet bewezen. Codex moet de parser/validator tegen deze actuele productpagina's onderzoeken. Work heeft geen importer- of parserfix gedaan.
- De tijdelijke workflowjob, CSV-kopie en proof-helperbestanden zijn in de cleanup-commit verwijderd. Alleen dit bewijs blijft in de checkpoint. Geen merge, Production-deploy, product-/prijswrite, ROADMAP-wijziging, recovery of supersede uitgevoerd.

## Volgende stap

Codex onderzoekt waarom de tien bereikbare detailpagina's generiek `invalidProduct` opleveren en voegt waar passend nauwkeurige diagnostiek toe. Daarna kan Work de read-only 10-SKU-releasegate opnieuw uitvoeren. Pas na PASS een aparte release-opdracht voor PR #55; geen echte catch-upimport in deze releasegate.

# Checkpoint 44 — PR #55 invalidProduct-root-cause opgelost — 7 oktober 2026

## Exacte oorzaak

- De tien detailpagina's waren allemaal bereikbaar en leverden een geldige H1, een exact overeenkomende SKU uit de product-URL en JSON-LD met actuele productnaam, merk en positieve prijs. De oude detail-DOM-selectors voor verpakking én prijs waren op deze actuele pagina's niet aanwezig; JSON-LD bevatte voor deze producten geen verpakkingswaarde.
- De eerste concrete mislukte invariant was voor **alle 10/10** `missing_package`: de bestaande check `if (!name || !packageText) return fail("invalidProduct")` viel op `packageText`. SKU-leading-zero's, naam en pagina-bereikbaarheid waren niet de oorzaak; prijsvalidatie werd daardoor niet bereikt.
- Bewijs uit de eerste diagnose-run: Actions **37666811120**, GET-only guard, root `main`, `sku_from_path` gelijk aan de candidate voor alle tien, `package_candidates=[]`, JSON-LD-prijzen aanwezig. De run wijzigde geen database.

## Minimale fix en observability

- `validateCandidate` rapporteert nu concrete bestaande invariant-redenen: `parser_empty`, `missing_sku`, `sku_mismatch`, `invalid_sku`, `missing_name`, `missing_package`, `invalidPrice`, `unreliable_product` en bestaande `notFound`.
- De veilige parserdiagnostiek registreert alleen root/selectors, SKU-bronnen, kandidaatteksten, JSON-LD productvelden en prijs-/pakketwaarden; geen cookies, tokens of volledige HTML.
- Als alleen verpakking ontbreekt, hergebruikt de validator de bestaande `fetchPublicCatalogItems`/Hoogvliet GraphQL-parser met een exact geverifieerde SKU. Alleen `catalogAPIPackage` uit de bestaande `metadata.verpakking` wordt overgenomen. Een ontbrekende API-match of ontbrekende metadata blijft `missing_package`; er wordt geen prijs of pakket verzonnen en geen identity geforceerd.
- JSON-LD blijft de bestaande actuele detailbron voor naam/prijsfallback; `upsertProducts`, dedupe, locks, `catalog_import_runs` en de expliciete-SKU-route zijn verder ongewijzigd. De daily route houdt dezelfde validator en discoveryflow.

## Regressies en bounded proof

- Toegevoegd: regressietest voor actuele detail-JSON-LD + exact-SKU catalogus-API-pakket naar geldige prijsvalidatie; bestaande tests bevestigen SKU-mismatch, ontbrekend pakket en ongeldige prijs blijven blokkeren. De explicit-SKU-tests blijven expliciete bron, max-400, dedupe/leading-zero, existing SKU, invalid/not-found/error, locks en dry-run zonder writes afdekken.
- Tweede bounded read-only diagnose/proof: Actions **37667212603** op head **`72c0f9e31945eae219aad596eb3772852acc3034`**, exact dezelfde tien bewezen SKU's en product-URL's. Resultaat: **10/10 `valid_new`**, **0 invalid**, **0 not_found**, **0 temporary_error**, **0 already_exists**, alle 10 detailpagina's bereikbaar, alle 10 positieve prijzen gevalideerd. Prijzen: 000685000 1.99; 000958000 0.89; 000959000 1.02; 003026000 1.75; 003189000 1.13; 003191000 1.29; 004155000 2.87; 005291000 18.99; 008582000 1.70; 009681000 2.09.
- De proof verwerkte uitsluitend de expliciete tien SKU's, startte geen catalogusdiscovery/listingpagination en gebruikte een GET-only fetch guard. Runtime: **26.203 seconden**. Production bleef vóór/na **7.543 producten** en **7.543 prijzen**; productwrites, prijswrites en run-writes waren **0**.
- De tijdelijke diagnose-workflow en read-only guard zijn na het bewijs verwijderd; ze zijn geen product- of importpad. Geen `--write`, Production-import, deploy of merge uitgevoerd.

## Huidige branch/PR en Work-vervolgstap

- PR #55 blijft open, Draft en mergeable. Branch blijft **`codex/explicit-sku-catch-up-20261007`**; de actuele finale head wordt door de PR/branchcontrole vastgesteld. `ROADMAP.md` is niet gewijzigd.
- Work controleert eerst de nieuwe PR-head en CI. Daarna voert Work uitsluitend de releasegate voor de volledige bewezen CSV uit als read-only bounded catch-up, bijvoorbeeld `npm run import:skus -- --file hoogvliet-missing-production-2026-10-06.csv --max 400 --dry-run`, met dezelfde nul-write- en geen-discovery-controles. Alleen na review van die volledige dry-run is een afzonderlijke, expliciet goedgekeurde Work-opdracht voor `--write` toegestaan. Geen merge in deze stap.


# Checkpoint 45 — finale 400-SKU read-only dry-run — 8 oktober 2026

## Proof en Production-precheck

- PR #55 importerbron: `14008f4c0a0de784697a434fcd03c8ad4faef45c`. Tijdelijke proofcommit: `af01d515873806257c22fdbc231fefc194ee66d0`.
- Eén GitHub Actions-run: **37725393034**. Exacte opdracht: `npm run import:skus -- --file hoogvliet-missing-production-2026-10-06.csv --max 400 --dry-run`. Geen `--write`.
- Originele CSV geverifieerd met SHA-256 `a24da369b15d4ddf0d8741f7aeb4d3fee2f733e74e2d448ec1ffcd1b8ab30246`: 812 rijen, 812 unieke SKU's, geen lege/duplicate SKU's; de eerste SKU `000685000` behield de leading zero's.
- Precheck liet geen actieve catalog-importrun, daily-job of daily-attempt zien; daarom is de ene read-only proof uitgevoerd.
- De expliciete selectie was de eerste 400 rijen/SKU's (CSV-rijen 2–401). De overige 412 rijen zijn door de importer met `skipped / max_batch_size` gerapporteerd en niet gevalideerd of ontdekt.

## Werkelijke importresultaten

- Requested / processed: **400 / 400**.
- `valid_new`: **400**; `already_exists`: **0**; `invalid`: **0**; `not_found`: **0**; `temporary_error`: **0**; `skipped`: **412** (uitsluitend buiten de ingestelde max).
- Alle 400 geselecteerde SKU's kwamen één keer voor en detailvalidatie was bereikbaar voor 400/400. Gevalideerde prijzen: €0,34–€20,99; geen ontbrekende, nul- of negatieve prijs. De bestaande validator controleerde exacte SKU, productnaam, verpakking, positieve prijs en Hoogvliet-productbron/URL; er waren geen invalid reason codes.
- Importer runtime: **755.496 ms** (12:35,5; gemiddeld **1.888,74 ms per verwerkte SKU**). Proofcommand inclusief Production-snapshots: 764.263 ms.
- Discovery: **nee** — alleen de CSV-kandidaten; geen rootcategorie-/listingcrawl of listingpagination.
- Production vóór/na: **7.543 → 7.543** producten en **7.543 → 7.543** prijzen. `catalog_import_runs`: **54 → 54**. Volledige product-, prijs-, import-run-, daily-job- en attempt-snapshothashes bleven gelijk; geselecteerde SKU-membership bleef gelijk. Productwrites **0**, prijswrites **0**, geblokkeerde Node non-GET calls **0**.

## Gate-uitkomst en verifierafwijking

- De importer-dry-run zelf voldoet aan de inhoudelijke 400-SKU-criteria: 400/400 valid nieuw, zonder source/parserfout of write.
- De tijdelijke Actions-proofstap eindigde formeel **FAIL** door een fout in de tijdelijke proofverifier: die eiste ten onrechte exact 400 resultregels/klassificaties. De bestaande importer retourneert conform zijn contract ook de 412 niet-geselecteerde CSV-rijen als `skipped`; daardoor waren er 812 resultregels en rapporteerde de helper ten onrechte FAIL. Dit is een verifier false negative, geen importer- of bronfout. Normale release-gates in dezelfde run waren groen: `npm test && npm run check`, PostgreSQL gate en web core/regressions/build.
- Formele releasebeslissing blijft **FAIL / nog niet vrijgeven** totdat deze verifierafwijking is gecorrigeerd of expliciet is afgetekend. De 400-SKU-importerlogica hoeft hiervoor niet aangepast te worden. Er is geen tweede dry-run gestart.
- Proofartifact: `pr55-explicit-sku-400-readonly-proof` (Actions artifact 11527727986; run 37725393034; 7 dagen geldig vanaf 8 oktober 2026).

## Opruiming en vervolg

- Tijdelijke workflowwijziging, originele CSV-kopie en proofhelperbestanden zijn uit PR #55 verwijderd; de oorspronkelijke `.github/workflows/core-flows.yml` is hersteld. De PR blijft Draft/open en is niet gemerged of gedeployed. Alleen deze documentatie-update blijft als wijziging van deze proofrun over; `ROADMAP.md` is niet gewijzigd.
- Eerstvolgende actie: corrigeer uitsluitend de tijdelijke verifierassertie zodat `processed=400` en de 412 `max_batch_size`-skips buiten de batch worden verwacht. Geen nieuwe importer-dry-run of echte batch is door deze run gestart. Pas na een groene formele releasegate kan een aparte release-opdracht de Production-deploy en echte catch-up batch 1 beoordelen.


# Checkpoint 46 — PR #55 finale read-only releasegate — 8 oktober 2026

- Actuele basis is main `3fc161a214bf35d9721d73a31312a004f801ff5d`; PR #55 staat open, Draft en mergeable op branch `codex/explicit-sku-catch-up-20261007`. De dry-run-evidence uit Checkpoint 45 is de enige 400-SKU proof-run; er is geen tweede proof gestart.
- De actuele gewone PR-CI op head `dc359350bf9117fe4f3abac729d3d7f2d6b81f9f`, run **37726784830** (#299), is volledig groen: importer/seed consistency, PostgreSQL rollback/concurrency, web core flows, regressies, lint, TypeScript en build. Dagelijkse importer-/workflowregressies in deze suite zijn groen.
- Handmatige beoordeling van proof **37725393034** bevestigt de inhoudelijke gate: exact 400 expliciete CSV-SKU's verwerkt; 400 `valid_new`; overige classificaties 0; 412 extra rijen buiten de limiet met `max_batch_size`; geen source/parserfout of brede discovery. De run's FAIL was uitsluitend de tijdelijke proofverifier die ten onrechte 400 totaalresultaatrijen eiste, hoewel het importercontract 812 bronrijen rapporteert. Dit checkpoint tekent die bewezen false-negative expliciet af; importer- of scrapercode is niet aangepast.
- Production-read-only: proof-snapshots vóór/na waren gelijk (7.543 totale producten, 7.543 prijzen, 54 catalog_import_runs; volledige product-, prijs-, import-, daily-job- en attempt-hashes gelijk). Aparte actuele read-only controle: 7.543 totale producten/prijzen, 7.540 Hoogvliet-producten met 7.540 unieke SKU's, 0 dubbele SKU-groepen, 0 actieve catalogruns/daily-jobs/attempts/locks.
- **RELEASEGATE PASS.** PR #55 is technisch klaar voor release, daarna Production READY en een afzonderlijk expliciet geautoriseerde catch-up batch 1 van maximaal 400 SKU's. In deze gate zijn geen merge, deploy of Production-write uitgevoerd. `ROADMAP.md` is ongewijzigd.

# Checkpoint 47 — PR #55 release en Production catch-upbatch 1 geblokkeerd — 8 oktober 2026

## Release

- PR #55 is na verse controle van de ongewijzigde head `ec1c77d193858960bac9380aae4ceeae36694044` als squash gemerged. Mergecommit en main-head vóór deze documentatie-update: `776ef2d66d8289098c911f0a7511c17ac1c46d9c`.
- Main-CI-run **37728930581** (#301) is groen. Vercel Production-deployment `dpl_9qMMwHwvBnSR8Vi5P2jUftsdGgae` op die commit is **READY**; homepage-smoke HTTP **200**.
- De finale read-only proof blijft run **37725393034** (Checkpoint 46): requested/processed 400/400, valid_new 400, alle overige batchclassificaties 0, 412 buiten de cap overgeslagen; runtime 12:35,5; geen discovery of writes.

## Verse Production-precheck en stop vóór write

- Read-only momentopname: **7.543** producten, **7.543** unieke SKU's, **7.543** prijzen; Hoogvliet **7.540** producten / **7.540** unieke SKU's; duplicate-SKU-groepen **0**.
- Running daily jobs **0**, running daily attempts **0**, actieve catalog_import_runs **0**, actieve daily locks **0**.
- Batch 1 is **niet gestart**: repository-workflow `.github/workflows/import-hoogvliet-poc.yml` heeft geen expliciete CSV-SKU-runmodus; dispatch ervan zou de normale catalogus/discovery-import uitvoeren. Er is geen veilige Actions-runnerdispatch voor exact `npm run import:skus -- --file hoogvliet-missing-production-2026-10-06.csv --max 400 --write` beschikbaar. Daarom is geen batchrun-ID aangemaakt en zijn geen classificaties/runtime of after-counts voor een writebatch beschikbaar.
- Productwrites **0**, prijswrites **0**; Production bleef in de gecontroleerde precheck op **7.543 / 7.543**. Geen tweede run, batch 2, daily import, recovery, merge van een andere PR of handmatige databasewijziging gestart.

## Eerstvolgende veilige stap

- PR #55 is gereleased en de importercode staat op Production. Batch 1 blijft pending totdat een expliciete, exact-SKU runnerroute met de originele CSV beschikbaar is. Daarna opnieuw vlak vóór dispatch alle Production-concurrency/counts read-only controleren en uitsluitend één batch van maximaal 400 starten. Geen batch 2. `ROADMAP.md` is ongewijzigd.

## Actuele missing-setcontrole na release — 8 oktober 2026

- Na de beslissing om geen ongeschikte brede workflow te dispatchen is de originele CSV-set opnieuw exact gecontroleerd: **812/812** SKU's zijn nog afwezig in Hoogvliet Production. Production staat op **7.543 producten / unieke SKU's** en **7.543 prijzen**; geen duplicates of actieve importerlocks/jobs/attempts.
- Batch 1 heeft dus geen producten toegevoegd. De laatst betrouwbaar volledig berekende Hoogvliet-dekking blijft **7.367 / 8.179 = 90,07%**; er is geen nieuwe volledige bronsetvergelijking uitgevoerd in deze stap. De 812 ontbrekende CSV-SKU's zijn actueel opnieuw bevestigd.

# Checkpoint — finale catch-up batch 3 voorbereid — 8 oktober 2026

## Scope en vaste bron

- Gestart vanaf actuele `origin/main` **fc7eedaf1ac31d69521f2ff46667ec0ab9dfe183** op branch **`codex/final-catch-up-batch3-20261008`**. Geen merge, deploy of Production-write uitgevoerd.
- Nieuwe vaste bron: `data/hoogvliet-missing-production-2026-10-08-final.csv` met exact **12** unieke SKU's: `733574000, 733575000, 733741000, 770787000, 770809000, 777641000, 905631000, 921742000, 926108000, 926876000, 927082000, 927120000`.
- SHA-256: `d5c43b501d4dfbf2498d1765340b354b4b487d47806c0b8683dcfcb748025dd5`. `727643000` (Verspakket cajun kip) is bewust uitgesloten: actuele detailroute is not-found en er is geen vervangende match.
- De vaste source-enum bevat nu uitsluitend `original`, `residual_batch2` en `final_batch3`; `final_batch3` verwijst exact naar deze CSV. Er is geen vrije filepath-, URL- of shell-source-input toegevoegd.

## Safety en verificatie

- De bestaande `scripts/run-explicit-sku-catch-up.mjs` blijft de enige Actions-runner: hij controleert de allowlisted checksum/CSV-set en roept alleen `npm run import:skus` aan. Pull-request runs zijn vastgezet op `final_batch3`, `dry-run`, `max=12`; write blijft uitsluitend expliciete `workflow_dispatch` vanaf `main`, met Production-precheck en de gedeelde `hoogvliet-supabase-update` concurrencygroep.
- De vaste CSV is lokaal geverifieerd op 12 rijen, 12 unieke SKU's, geen lege/ongeldige rijen en geen `727643000`. Lokale gates zijn groen: `npm test` **373/373**, `npm run check`, `npm run test:postgres` **28/28** en `git diff --check`.
- De bounded read-only Actions-proof op `source=final_batch3`, `mode=dry-run`, `max=12` is uitgevoerd als Actions-run **37744489526**; deze eerste poging stopte vóór dependencies door EOF-whitespace in dit document. De herhaalde proof is nog pending in run **37744489526**'s opvolgende branch event; er is in geen van beide pogingen een importer gestart en product-/prijswrites zijn **0**.

## Exacte Work-vervolgstap

- Controleer Draft PR en groene Actions-proof. Voer pas daarna een verse Production read-only precheck uit. Alleen bij 0 actieve jobs/attempts/imports/locks en ongewijzigde bron: merge naar `main`, wacht op main-CI/Production readiness, herhaal de verse precheck, dispatch exact één keer `source=final_batch3`, `mode=write`, `max=12`, controleer per SKU de write- en Production-nacontrole en stop direct. Geen discovery, recovery, supersede, migration of automatische volgende batch.
# Checkpoint — planner-cache maintenance na finale batch 3 — 8 oktober 2026

## Onderzoek en root cause

- Actuele technische basis: remote `main` **8e02444**; actuele open PR's zijn #54, #42, #41 en #21. Geen daarvan raakt deze planner-cachefix. De werkbranch voor deze minimale wijziging is **`codex/fix-planner-cache-maintenance-config-20261008`**.
- Draft PR **#60** is geopend op actuele head **`c925c62`** (`c925c6281e8a0e38b4ed239fe048ea8a28c33c78`), base `main`, mergeable; de vereiste Actions-checks staan nog queued/in progress en Vercel Preview is nog `PENDING`. Er is niet gemerged.
- De finale 12-SKU write liep via `.github/workflows/import-explicit-skus.yml` met `source=final_batch3`, `mode=write`, `max=12`. De workflow gaf `SUPABASE_URL` en `SUPABASE_SECRET_KEY` door, maar niet de drie planner-maintenancevariabelen.
- `loadConfig()` leest de plannerinstellingen uitsluitend uit `PLANNER_CACHE_BASE_URL`, `PLANNER_CACHE_ADMIN_TOKEN` en optioneel `VERCEL_AUTOMATION_BYPASS_SECRET`. Zonder base-URL én admin-token retourneert `plannerMaintenanceSettings()` bewust `null`. De hook registreert dan `planner-maintenance-not-configured`, `notifiedProducts=0` en `pending_requires_attention`.
- Dit is dus een **repository/workflow-configuratieprobleem**, niet een parser-, endpoint-, auth- of databaseprobleem. De bestaande `upsertProducts`-flow roept onderhoud pas aan na bevestigde product- én prijsopslag, bewaart de import als geslaagd en rolt geen producten terug. Er was geen maintenance-HTTP-call en geen automatische importretry.
- De bestaande onderhoudsroute is beschikbaar: `POST /api/internal/planner-readiness/new-products`, met maximaal 20 exacte product-UUID's, `Authorization: Bearer <PLANNER_CACHE_ADMIN_TOKEN>` en bij beschermde Vercel-deployment `x-vercel-protection-bypass: <VERCEL_AUTOMATION_BYPASS_SECRET>`. De endpoint controleert product/prijs-readiness en gebruikt bestaande gerichte match-/readiness-CAS-updates.

## Minimale fix

- In `.github/workflows/import-explicit-skus.yml` zijn dezelfde plannerinstellingen toegevoegd als in de normale importerroute: `PLANNER_CACHE_BASE_URL=https://boodschappenmaatje-pwa.vercel.app`, `secrets.PLANNER_CACHE_ADMIN_TOKEN` en `secrets.VERCEL_AUTOMATION_BYPASS_SECRET`.
- De fix is generiek voor alle expliciete, begrensde SKU-runs; er is geen SKU-, batch- of product-ID-hardcode toegevoegd. De bestaande import-, dedupe-, prijs- en failure-isolationlogica is ongewijzigd.
- Een workflow-regressietest controleert nu dat de expliciete runner alle drie de instellingen doorgeeft. Bestaande planner-maintenance-tests dekken al correct geconfigureerde onderhoudsrequests, ontbrekende config, endpoint/auth-fouten zonder importrollback, responsevalidatie, batching en retrygedrag.
- Lokale gates: `npm test` groen, `npm run check` groen, `npm run test:postgres` **28/28**, `git diff --check` groen.

## Veilig herstelpad voor final batch 3

- Niet opnieuw importeren en geen prijsrefresh starten. Work controleert read-only in Production dat exact de 12 final-SKU's bestaan, elk één Hoogvliet-product-ID hebben en een positieve prijsrecord hebben; controleer tevens geen duplicates/locks/running imports.
- Work POST daarna één keer naar `/api/internal/planner-readiness/new-products` met uitsluitend die 12 product-ID's. De request blijft onder de bestaande limiet van 20; gebruik de Production admin-token en, indien Deployment Protection actief is, de bypass-secret. Geen redirect volgen en geen volledige backfill/rebuild.
- Bevestig de response met `productCount=12`, arrays `changedMatchKeys`/`affectedRecipeIds` en integer `refreshedReadinessCount`, plus read-only nacontrole dat alleen afhankelijke afgeleide cache/match/readiness-rijen zijn geraakt. Een succesvolle call is de onderhoudsbevestiging (`confirmed`); bij fout stoppen en exact rapporteren, zonder importretry.
- De 12 UUID's moeten door Work read-only uit Production op SKU worden opgehaald en niet uit aannames worden afgeleid. Handmatige gebruikersdata blijft buiten scope. Er is geen migration of destructive cache reset nodig.

## Configuratiegrens / Work-vervolgstap

- Vereist in GitHub Actions: repository/environment variable of vaste Production-origin `PLANNER_CACHE_BASE_URL` zoals hierboven, secret `PLANNER_CACHE_ADMIN_TOKEN`, en secret `VERCEL_AUTOMATION_BYPASS_SECRET` wanneer Vercel Deployment Protection dit vereist. De admin-token moet exact overeenkomen met de server-side `PLANNER_CACHE_ADMIN_TOKEN` van de Production-app; waarden niet loggen.
- Work moet eerst de secret/variable-aanwezigheid en Production-origin read-only controleren, daarna de fixbranch-PR-CI laten draaien en een Draft PR openen. Pas na review kan Work de branch releasen/mergen; Codex doet geen merge of Production-write.
- Daarna is een afzonderlijk begrensde live maintenance-call voor deze 12 nodig volgens bovenstaand herstelpad. Geen volledige cache rebuild en geen productimport zijn nodig. Dagelijkse prijsrefresh blijft een later checkpoint.

---

# Checkpoint — targeted planner-maintenance runner voorbereid — 8 oktober 2026

## Contract en scope

- Actuele technische waarheid is remote `main` **`2841b5220f761c708436e253ef9bbf33a6b07a88`**; PR #60 is daarop squash-gemerged. De bestaande endpointimplementatie is bevestigd: alleen `POST /api/internal/planner-readiness/new-products`, JSON `{ "productIds": [UUID] }`, 1–20 unieke UUID's, `Authorization: Bearer PLANNER_CACHE_ADMIN_TOKEN`, optioneel de bestaande `x-vercel-protection-bypass`-header, en response `{ productCount, changedMatchKeys, affectedRecipeIds, refreshedReadinessCount }`.
- De endpoint fail-closedt op ontbrekende/ongeldige auth, ontbrekende Supabase-client, ongeldige IDs of niet-prijs-ready producten. Hij werkt alleen bestaande afgeleide match/readiness-cache-rijen bij met bestaande compare-and-set guards; er is geen full-rebuildparameter. Herhaalde calls zijn idempotent voor al bevestigde matches/readiness-rijen, maar blijven een write-capability en worden daarom door deze runner tot exact één POST beperkt.
- Nieuw bestand: `.github/workflows/planner-maintenance-targeted.yml`. De workflow ondersteunt uitsluitend `workflow_dispatch` vanaf `main`, vaste `source=final_batch3` en exacte bevestiging `RUN_TARGETED_MAINTENANCE`. Er is geen schedule-, push- of PR-trigger, geen importercommand, geen discovery, geen prijsrefresh, geen migration en geen automatische retry.
- Runner: `scripts/run-targeted-planner-maintenance.mjs`. Hij leest en SHA-256-verifieert uitsluitend `data/hoogvliet-missing-production-2026-10-08-final.csv`, resolveert de 12 SKU's read-only via Production `products`/`product_prices`, vereist exact 12 unieke UUID's en positieve prijzen, en sluit `727643000` expliciet uit. UUID's zijn niet gehardcodeerd.

## Veiligheidsgrenzen

- Vóór POST worden read-only `catalog_daily_jobs`, `catalog_daily_attempts`, `catalog_import_runs` en actieve lockvelden gecontroleerd. Alleen een `retry_scheduled`-job van de huidige Amsterdamse datum die volgens dezelfde dagvenster-/due-logica claimbaar is, blokkeert; oudere retryrecords blokkeren niet.
- De runner controleert granted advisory locks via uitsluitend `SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND granted` over het bestaande Production Session-poolerpad. `SUPABASE_DB_PASSWORD` wordt alleen hiervoor gebruikt; alle foutpaden stoppen fail-safe. De bestaande GitHub Actions planner-secrets worden uitsluitend als headers gebruikt en nooit gelogd.
- Er wordt exact één planner-POST uitgevoerd, zonder retry-loop of redirect. De response wordt strikt tegen het bestaande contract gevalideerd; full-rebuildvelden, onverwachte recipe-UUID's, non-2xx of malformed JSON falen. Daarna volgen uitsluitend read-only catalogus-/prijs-/duplicate-/importer-/lock- en linked match/readiness-nacontroles.
- De workflow deelt de bestaande `hoogvliet-supabase-update` concurrencygroep met de importer. Er wordt geen lock verwijderd, job geannuleerd, retry gestart of status geforceerd.

## Branch, tests en releasegrens

- Werk vanaf actuele main op branch **`codex/targeted-planner-maintenance-runner-20261008`**. Draft PR **#61** is open/mergeable op code-head **`2d471d813f61985425506292c37c3f5eec3fea72`**; de bestaande PR-checks zijn nog queued/pending. Er is in Codex geen workflowdispatch, Production-call, import, prijsrefresh of merge uitgevoerd.
- Regressietests dekken manual-only/source/confirmation, exact 12 en uitsluiting `727643000`, UUID-/prijsvalidatie, actieve importer/advisory lock/current retry, ontbrekende secrets, non-2xx zonder retry, exact één POST, response/full-rebuildscope, geen importer-/writecode en secretredactie.
- Lokale resultaten: `npm test` groen, `npm run check` groen, `npm run test:postgres` **28/28**, targeted regressies **13/13**, workflow-YAML parse groen en `git diff --check` groen.
- `ROADMAP.md` blijft ongewijzigd. Work mag pas na Draft-PR-review en groene CI exact één handmatige run vanaf `main` starten, met de bevestigingstekst; bij enige precheckafwijking stopt de runner zonder POST.

---
