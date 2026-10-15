# BoodschappenMaatje — Roadmap

`PROJECT_STATE.md` bepaalt waar de ontwikkeling **nu technisch staat**. De actuele remote code/branch/PR is de hoogste technische bron van waarheid.

## Productdoel

BoodschappenMaatje helpt gebruikers vooral **geld besparen** en maakt boodschappen doen tegelijk sneller en eenvoudiger.

De **boodschappenlijst staat centraal**.

Vaste regels:
- rekenen met hele verpakkingen;
- geen fictieve €0-prijzen of hoeveelheden;
- geen geforceerde productmatches;
- handmatige gebruikerskeuzes beschermen;
- maaltijdbudget en totaal weekbudget blijven apart;
- actuele aanbiedingen meenemen in de echte kassaprijs;
- goedkoopste geschikte en betrouwbare optie wint;
- restvoorraad is geen strafpunt;
- Hoogvliet blijft voorlopig de ondersteunde prijsbron.

## Uitvoeringsregels

## Snelle kwaliteitscheck — standaard bij iedere ontwikkelstap

- **Kort en risicogericht:** controleer vooraf de relevante bestaande code, afhankelijkheden en één of twee waarschijnlijke foutscenario's; geen brede audit zonder aanleiding.
- **Passende tests:** draai gerichte tests en bestaande relevante checks. Valideer bij gewijzigde GitHub Actions YAML met actionlint; bij CLI's de echte exitcode en veilige resultaatuitvoer; bij API's auth, foutpad en timeout. Alleen wat voor de wijziging relevant is.
- **Echte keten alleen waar nodig:** bij wijzigingen met externe systemen of writes eerst Preview en een begrensde read-only/dry-run, uitsluitend met passende toestemming. Voor eenvoudige documentatie- of UI-wijzigingen geen onnodige live-probes.
- **Stopregel:** na maximaal twee mislukte fixpogingen geen derde gokpatch; rapporteer de aantoonbare oorzaak of blokkade en kies gericht vervolgonderzoek. Geen eindeloze retries of nieuwe PR's per symptoom.
- **Klaar betekent bewijs:** noteer compact welke checks groen zijn, wat niet is getest en of een iPhone-test of aparte Production-goedkeuring nog nodig is.
- **Tijdbudget:** streef naar een snelle check van circa 5–10 minuten bij normale kleine taken; verleng alleen bij aantoonbaar risico of een concrete fout, en meld waarom.

### Welke omgeving gebruik je?

- **Chat**: ideeën, productkeuzes, scope, UX-richting, prioriteiten, uitleg en het maken van een gerichte uitvoeringsprompt. Geen Work-credits verspillen aan alleen overleg.
- **Codex**: code onderzoeken, implementeren, refactoren, debuggen, tests schrijven en performancewerk. Gebruik Codex als het probleem hoofdzakelijk in de repository zit.
- **Work**: GitHub/PR, Supabase-live-data, Vercel Preview, browsercontrole, GitHub Actions, bounded live checks/writes, release en Production-smoke. Gebruik Work pas wanneer meerdere systemen of echte live-validatie nodig zijn.
- **Gecombineerde taken**: meestal **Chat → Codex → Work**. Beslis eerst kort in Chat, laat Codex bouwen/testen en gebruik Work alleen voor integratie, live-validatie en release.
- **Een Work-run behandelt bij voorkeur één technisch checkpoint** zodat een time-out minder credits en herhaalwerk kost.
- **Work implementeert alleen zelf** als de codewijziging klein is en direct onderdeel is van integratie/release.
- Geen merge of Production zonder expliciete goedkeuring wanneer een Preview/iPhone-acceptatie openstaat.

### Model- en creditstrategie

Gebruik niet automatisch het zwaarste model. De kolom **Model** in de roadmap is het aanbevolen startpunt.

- **Luna / Laag**: kleine voorspelbare documentatie-, configuratie- of UI-aanpassing met weinig risico.
- **Luna / Medium**: standaard voor normale features, afgebakende bugs, tests, UI/CSS en de meeste Codex/Work-stappen.
- **Luna / High**: eerste keuze voor moeilijker debuggingwerk, meerdere gekoppelde bestanden, planner/budget/readiness en duidelijk regressierisico.
- **Sol / Medium of High**: alleen gebruiken als Luna aantoonbaar vastloopt, onvoldoende betrouwbaar resultaat geeft of de taak meerdere complexe systemen tegelijk raakt.
- **Astra / High**: alleen als ook Sol aantoonbaar tekortschiet of bij uitzonderlijk complexe architectuur-/auth-/dataflowvraagstukken.
- **Astra / Max**: uitsluitend voor uitzonderlijk complexe of risicovolle architectuur-, migratie- of race-conditionproblemen.
- **Creditregel:** begin standaard met Luna, ook op High als dat voldoende is. Escaleer pas **Luna → Sol → Astra** wanneer de taak dat aantoonbaar nodig heeft. Gebruik Chat voor voorbereiding, Codex voor het grootste deel van het codewerk en Work alleen voor stappen die echt GitHub/Vercel/Supabase/browser/Production nodig hebben.

---

# Hoofdroadmap

| # | Onderdeel | Status | 💰 Bespaarimpact | Waarom | Vraag aan / omgeving | Model | Eerst nodig | Klaar als |
|---|---|---|---|---|---|---|---|---|
| 1A | Honig/Knorr NOT_READY | ✅ Afgerond | Hoog | Betrouwbare recepten zonder verkeerde producten/verpakkingen | Chat voor scope → Codex voor fixes/tests → Work voor live-validatie/release | Luna / Medium | — | Veilige fixes gereleased; AFTER-audit gedaan; alleen echte datablokkades blijven |
| 1A.1 | Externe scrapingfallback voor Hoogvliet | 🔵 Open — technische acceptatie bewezen; financiële check resteert | Middel | Minder storingen door source_challenge/Incapsula en minder afhankelijkheid van GitHub-runnerfetches | **Chat** voor provider-/kostenkeuze; **Work** voor controleerbare provider/live-data; Codex alleen bij nieuwe integratiecode | Luna / Medium; Sol alleen bij bewezen complexe integratieproblemen | 1A afronden | Zyte-proof 6/6; volledige Production-snapshot met 0 fallback-attempts. Leg nog een controleerbare Bright Data/Zyte-kostenvergelijking vast uit bestaande provider-/factuurgegevens; directe importer blijft primary en fallback geldt alleen voor bewezen eligible windows |
| 1B | Honig/Knorr NO_RECIPE | 🔵 Actief — 7 Knorr-links + readiness-refresh Production bevestigd; overige NO_RECIPE open | Hoog | Meer maaltijdmixen bruikbaar maken | Chat voor keuze/prioriteit → **Codex** voor parser/profile/readiness-fixes → **Work** voor bounded dry-run/write, GitHub en release | Luna / High; Sol alleen bij vastlopen | 1A + scrapingfallback-besluit | Veilige readiness-ondersteuning voor bewezen `needs_review` recipe-links staat in Production. 7 bewezen Knorr-koppelingen en 70 readinesscache-rijen zijn in Production bevestigd (6 READY, Japanse teriyaki NOT_READY); 1B blijft open voor brongebaseerde beoordeling van overige NO_RECIPE-profielen |
| 1B.1 | **Slim Zoeken 2.0** | ⭐ **Volgende stap na 1B** | Hoog | Producten veel sneller vinden en toevoegen, met supermarktkeuze als fundament voor latere multi-supermarkt zonder resultaten door elkaar te mengen | **Chat** voor UX/acceptatieregels → **Codex** voor provider-aware zoekflow, UI en tests → **Work** voor echte Hoogvliet-data, Preview, iPhone-test en release | **Luna / High**; Sol alleen als zoek-/providerintegratie aantoonbaar vastloopt | 1B afronden | Werkende iPhone-flow Home → supermarktkeuze → `Ontdek & bespaar` → categorieën → zoeken → product → +/- → bestaande lijst. Eerste supermarktkeuze wordt onthouden; compacte wisselaar; wisselen opent een aparte lijst per supermarkt; nooit gemengde productresultaten. Hoogvliet eerst met echte producten, prijzen, aanbiedingen en filters. Architectuur provider-aware voor later AH/Jumbo/Lidl/Dirk en aparte `Vergelijk supermarkten`-modus. Daarna polish: vloeiende Home→zoeken-overgang, skeleton loading, micro-interacties, slimme alternatieven, bespaarfeedback, favorieten en recente zoekopdrachten, in metallic-blauwe BoodschappenMaatje-stijl met mascotte. |
| 1C | Overige receptkwaliteit + Data Health (incl. product_type-classifier) | Daarna | Hoog | Minder plannerfouten en betere productmatching | Chat voor scope → **Codex** voor classifier/data-health code en tests → **Work** voor Production-audits/release | Luna / High; Sol alleen bij vastlopen | 1B.1 | Overige kritieke profiel-, package- en matchproblemen aantoonbaar beheerst |
| 2 | Budgetbewuste productselectie | ⭐ Hoge prioriteit | **Zeer hoog** | Altijd de goedkoopste geschikte kassacombinatie kiezen | Chat voor productregels/acceptatie → **Codex** voor algoritme en tests → **Work** voor echte prijsdata, Preview en release | Luna / High; Sol / High alleen als optimizerlogica aantoonbaar te zwaar blijkt | Receptkwaliteit betrouwbaar | Hele verpakkingen, aanbiedingen, huismerk en producthergebruik worden correct geoptimaliseerd binnen budget |
| 3 | Betrouwbare opslag + geschiedenis | Gepland | Middel | Geen verlies van week, lijst, recepten of keuzes | Chat voor UX/databeleid → **Codex** voor opslag/herstel/tests → **Work** voor Supabase/Preview/release | Luna / Medium | Stabiele kernflows | Week/lijst/herstel en weekhistorie betrouwbaar bewezen |
| 4 | Voorraadkast + terugkerende producten | Gepland | **Zeer hoog** | Eerst gebruiken wat echt thuis is en minder onnodig kopen | Chat voor regels en gebruikersflow → **Codex** voor voorraadlogica/sync/tests → **Work** voor live-data en release | Luna / High; Sol alleen bij vastlopen | Opslagfundament | Voorraad telt alleen na bevestiging; restverpakkingen kunnen veilig als vermoedelijke voorraad terugkomen |
| 5 | Eigen recepten — vervolg | Gepland | Middel | Meer flexibiliteit zonder budget-/lijstregressies | Chat voor UX/scope → **Codex** voor implementatie/tests → **Work** voor Preview/iPhone-check/release | Luna / Medium | Opslag stabiel | Eigen recepten robuust bewerken/bewaren en correct laten meedoen in prijs/lijst |
| 6 | Slimmere suggesties | Gepland | Hoog | Relevante aanvullingen zonder lijst te vervuilen | Chat voor suggestieregels → **Codex** voor ranking/logica/tests → **Work** voor echte-data-evaluatie en release | Luna / High; Sol alleen bij vastlopen | Voorraad + historie | Suggesties zijn relevant, uitlegbaar, budgetbewust en nooit automatisch dominant |
| 7 | Personalisatie | Gepland | Hoog | Minder handwerk en betere keuzes per huishouden | Chat voor privacy/productregels → **Codex** voor leer-/voorkeurslogica → **Work** voor dataflow, live-validatie en release | Luna / High; Sol alleen bij grote of vastgelopen architectuurvraag | Geschiedenis + suggesties | App leert voorkeuren/patronen zonder expliciete keuzes te overschrijven |
| 8 | **Interactieve 3D-Maatje** (was: Home-mascotte) | 🔵 Actief — naar voren gehaald op verzoek van Dennis (15 okt 2026); stap 1 in Preview | Middel | Leukere, persoonlijke app en sneller je lijst vullen door met Maatje te praten | **Codex** voor 3D/UI en assistentlogica → **Work** voor Preview, Gemini-sleutel in Vercel en iPhone-acceptatie | Luna / High | — | Stap voor stap met Dennis afgestemd: (1) tik op mascotte → 3D-Maatje verschijnt, reageert en draait rond; (2) praten met Maatje via Gemini (server-side sleutel), alleen zoeken in echte Hoogvliet-catalogus; (3) Maatje pakt het gekozen product zichtbaar en legt het in je kar, pas na bevestiging op de lijst; (4) spraak, polish en iPhone-acceptatie. Nooit verzonnen producten of prijzen. Gemini gratis laag alleen voor eigen gebruik; vóór publieke lancering betaalde laag. |
| 9 | Haptische feedback | Onderzoeken | Laag | Snellere/duidelijkere bediening waar iOS dit betrouwbaar ondersteunt | Chat voor gewenste momenten → **Codex** voor klein prototype → **Work** voor browser/fysieke iPhone-validatie | Luna / Medium | Fysieke iPhone-proef | Alleen behouden als echte PWA-ondersteuning bewezen is |
| 10 | Launch-polish | Voor publieke lancering | Middel | Snelle, betrouwbare en verzorgde eindervaring | Chat voor checklist/prioriteiten → **Codex** voor fixes/performance/a11y → **Work** voor volledige Preview/Production/smoke | Luna / High; Sol alleen bij hardnekkige regressies | Functionele kern gereed | Volledige iPhone-flow, performance, toegankelijkheid, juridische pagina's en Production-smoke groen |
| 11 | Accounts & synchronisatie | Na kern + launch-polish | Laag | Data tussen apparaten bewaren | Chat voor account-/privacyregels → **Codex** voor auth/sync/tests → **Work** voor Supabase auth, multi-device en release | Luna / High; Sol / High alleen bij complexe auth/syncproblemen | Opslag + launch-polish | Login en synchronisatie betrouwbaar zonder lokale data stil te verliezen |
| 12 | BoodschappenMaatje Plus | Na accounts | Laag | Verdienmodel met extra gemak | Chat voor gratis/Plus-grens en productkeuzes → **Codex** voor entitlement/paywalllogica → **Work** voor end-to-end betalingen/config/release | Luna / High; Sol alleen bij vastlopen | Accounts stabiel | Plus voegt waarde toe zonder gratis kern kunstmatig te beperken |

## Slim Zoeken 2.0 — vaste product- en UX-eisen

Deze eisen horen bij stap **1B.1** en worden niet stilzwijgend afgezwakt tijdens implementatie:

- **Supermarkt eerst:** bij eerste gebruik kiest de gebruiker eerst de supermarkt; die keuze wordt onthouden.
- **Compact wisselen:** daarna blijft een compacte supermarktselector beschikbaar om van winkel te wisselen.
- **Gescheiden lijsten:** wisselen van supermarkt opent/maakt de lijst voor die supermarkt; producten van verschillende supermarkten worden niet in één zoekresultaat of actieve lijst gemengd.
- **Provider-aware vanaf dag één:** technisch rekening houden met meerdere supermarktproviders, maar functioneel eerst Hoogvliet. De keuze voor Hoogvliet als huidige bron wordt niet heropend.
- **Kernflow op iPhone:** Home → supermarktkeuze → **Ontdek & bespaar** → categorieën → zoeken/filteren → productdetail → +/- hoeveelheid → toevoegen aan bestaande boodschappenlijst.
- **Echte data:** productnaam, verpakking, actuele prijs, aanbieding en relevante filters komen uit echte Hoogvliet-data; geen fictieve €0-prijzen of nepresultaten.
- **Zoekervaring:** snel mobiel zoeken, bruikbare categorieën en filters, duidelijke productkaarten en zo min mogelijk stappen tot `+ Voeg toe`.
- **Slimme alternatieven:** waar nuttig goedkopere/geschikte alternatieven tonen zonder de handmatige keuze van de gebruiker te overschrijven.
- **Bespaarfeedback:** zichtbaar maken wanneer een keuze goedkoper is of een aanbieding voordeel oplevert, zonder misleidende fictieve besparingen.
- **Na werkende kern pas polish:** Home→zoeken-overgang, skeleton loading, micro-interacties, favorieten en recente zoekopdrachten.
- **Vormgeving:** metallic-blauwe BoodschappenMaatje-stijl, vriendelijk/mobile-first en passend bij de bestaande mascotte; officiële supermarktlogo's waar toegestaan/passend.
- **Later uitbreidbaar:** AH, Jumbo, Lidl en Dirk kunnen later als aparte providers worden toegevoegd. Eerst altijd één gekozen supermarkt doorzoeken; supermarkt-overstijgend zoeken hoort later in een aparte **Vergelijk supermarkten**-modus.

---

# Later

| Onderdeel | 💰 Bespaarimpact | Vraag aan / omgeving | Model | Voorwaarde |
|---|---:|---|---|---|
| Meldingen | Laag | Chat voor welke meldingen nuttig zijn → Codex voor implementatie → Work voor echte notificatieflow/release | Luna / Medium | Alleen nuttige herinneringen |
| Offline/PWA-robuustheid | Middel | Chat voor offline-regels → Codex voor cache/sync/fallback → Work voor browser/netwerk-tests en release | Luna / High; Sol alleen bij vastlopen | Geen schijnbaar actuele onbetrouwbare prijsdata |
| Kassabon / werkelijke uitgaven | Hoog | Chat voor invoerflow → Codex voor herkenning/data-model → Work voor echte input/Production-validatie | Luna / High; Sol alleen bij complexe herkenning | Betrouwbare invoer/herkenning beschikbaar |
| Meerdere supermarkten | **Zeer hoog** | Chat voor providerkeuze/UX → Codex voor providerarchitectuur/matching → Work voor live bronnen, migratievrije rollout en release | Luna / High; Sol / High alleen bij bewezen complexe providerarchitectuur | Hoogvliet-kern en providerarchitectuur betrouwbaar |

---

# Afgerond / Production

| Onderdeel | Status |
|---|---|
| PWA-basis t/m PWA 14 | ✅ |
| Branding + Home Optie C | ✅ |
| PR #28 — verpakkingen/lijst/budget | ✅ |
| PR #29 — stabiliteit & kernflows | ✅ |
| Importer & maintenanceherstel | ✅ |
| PR #37 — Hoogvliet-productdekking | ✅ |

Historische commits, deployments, testtellingen en technische bewijsdetails horen in `PROJECT_STATE.md` of relevante docs, niet in deze roadmap.

---

# Roadmapbeheer

- Nieuwe ideeën worden alleen toegevoegd als ze productwaarde hebben; buiten-scope ideeën worden geparkeerd.
- `ROADMAP.md` bevat alleen richting, volgorde, waarde, afhankelijkheden en uitvoeringskeuze.
- `PROJECT_STATE.md` bevat het actuele technische checkpoint.
- `DESIGN.md` bevat vaste UX/UI-regels.
- Diepe technische historie en bewijs horen in relevante docs.
- Bij conflict met actuele remote code/PR: eerst remote toestand vaststellen en daarna documentatie corrigeren.
- Nieuwe roadmapregels krijgen voortaan altijd een **Vraag aan / omgeving**- en **Model**-advies zodat vooraf duidelijk is of Chat, Codex of Work de juiste plek is en onnodig Work-/Sol-/Astra-creditgebruik wordt vermeden. Standaard geldt **Luna eerst → Sol alleen indien nodig → Astra als laatste escalatie**.

---

# Helemaal later — App Store / cloud-Mac

| Idee | Status | Vraag aan / omgeving | Model | Voorwaarde / notitie |
|---|---|---|---|---|
| Cloud-Mac voor Xcode en App Store | 💡 Idee voor later | Chat voor platform-/kostenkeuze → Codex voor native code/Xcode-project → Work/cloud-Mac voor signing, TestFlight en release | Luna / Medium; Sol alleen bij complexe native problemen | Bij eventuele App Store-release een betaalbare cloud-Mac gebruiken in plaats van eerst eigen Mac-hardware te kopen. Pay-as-you-go heeft voorkeur voor incidenteel gebruik; code/Xcode-project blijft in GitHub en belangrijke certificaten/back-ups worden extern bewaard. Eerst pas activeren wanneer een native iOS/App Store-traject echt wordt gestart. |
