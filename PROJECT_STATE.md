# BoodschappenMaatje — Project State

## Actueel — primaire 06:07-dagimport ontbreekt — 1 oktober 2026

- Controle om **07:42 Europe/Amsterdam**: voor de primaire workflow `Hoogvliet import proof of concept` is geen schedule-run voor de `7 6 * * *` / `Europe/Amsterdam`-trigger van 1 oktober aangemaakt. Er staat ook geen Actions-run queued of in progress. De laatste zichtbare scheduled run van deze workflow op 30 september was aantoonbaar de aparte prijsdeelbatch (`mode=prices`), niet de dagelijkse growth-import.
- Actuele main-head: **`b202d19f874d0ace293c6ef76c57529b6e3e79eb`**. `main` is de default branch. Op main staat de primaire cron correct op `06:07 Europe/Amsterdam`, de monitor op `08:30 Europe/Amsterdam` en de retryworkflow later op de dag. Deze timezone-configuratie kwam via releasecommit `93435b36679a90c4814830d8690d86aa1dec1a71` op 30 september na het ochtendvenster; 1 oktober is de eerste volledige natuurlijke 06:07-controle.
- Er is **geen bewezen configuratiefout** en geen bewezen concurrencyblokkade. De beschikbare GitHub-metadata geeft geen concrete reden waarom de 06:07-trigger niet is aangemaakt. Ook de aparte `17 2 * * *`-prijscron van dezelfde primaire workflow heeft op 1 oktober om 07:46 CEST nog geen schedule-run opgeleverd. GitHub documenteert als algemeen platformgedrag dat scheduled workflows bij hoge belasting vertraagd kunnen worden en dat sommige queued jobs kunnen wegvallen; de repositorymetadata bewijst niet dat dit hier de concrete oorzaak was. GitHub Status meldde Actions op 1 oktober als operationeel zonder actueel incident. Classificatie blijft: **onverklaarde ontbrekende schedule-trigger**; niet als bewezen “gedropt door GitHub” rapporteren.
- De workflow-stateflag enabled/disabled is via de beschikbare GitHub-connector niet rechtstreeks uitleesbaar. Er is geen aanwijzing dat de workflow disabled is; dezelfde primaire workflow had op 30 september nog een scheduled prijsrun en de retryworkflow draaide op 1 oktober om 00:13 CEST. Die vertraagde retry deed geen import: `run_attempt=0`, `reason=outside_daily_window`.
- Supabase opnieuw gecontroleerd om **07:46 Europe/Amsterdam**: geen `catalog_daily_jobs`-record voor 1 oktober, geen actieve daily lock, geen running attempt en geen running catalogusrun. Catalogus blijft **6359 producten / 6359 prijsregels**; vandaag 0 product- en 0 prijswrites. Maintenance v4 blijft `confirmed`, `pendingProductIds=[]`, `failures=[]`, `notifiedProducts=304`.
- De dag is daarmee inhoudelijk veilig claimbaar en het dagdoel 0/400 is nog niet verbruikt. De bestaande transactionele daily claim, unieke dagjob en gedeelde Actions-concurrency beschermen tegen een tweede gelijktijdige import als een vertraagde schedule-trigger alsnog verschijnt.
- **Handmatige fallback niet uitgevoerd in deze controle.** De gekoppelde GitHub-interface kan Actions-runs lezen en rerunnen, maar biedt geen `workflow_dispatch`-actie. Omdat uitsluitend de bestaande `workflow_dispatch` met `daily_attempt_only=true` was toegestaan, is geen rerun, alternatieve trigger, claimomzeiling of directe importer-run gebruikt.
- Monitor: de `08:30 Europe/Amsterdam`-schedule staat correct op main en was om 07:42 nog niet verschuldigd. Bij een ontbrekende dagjob maakt de monitor uitsluitend de dagjob veilig aan; hij start zelf geen productimport. De eerstvolgende normale importkans daarna is de retry om **10:17 CEST**, mits de dagjob nog claimbaar/verschuldigd is. De volgende primaire schedule is **2 oktober 06:07 Europe/Amsterdam**.
- Geen code/configwijziging, geen database-reset/migratie, geen productimport en geen wijziging aan PR #37/#38/#39/#40. ROADMAP.md blijft ongewijzigd.

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
