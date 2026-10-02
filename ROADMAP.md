# BoodschappenMaatje — Roadmap

Dit document bevat de productroadmap. `PROJECT_STATE.md` bepaalt waar de ontwikkeling **nu** staat. De actuele remote code/branch/PR is technisch de hoogste bron van waarheid.

## Productdoel

BoodschappenMaatje helpt gebruikers vooral **geld besparen** en maakt boodschappen doen tegelijk sneller en eenvoudiger.

De **boodschappenlijst staat centraal**. Weekmenu, recepten, prijzen, budget en suggesties ondersteunen die lijst.

Vaste productregels:
- rekenen met hele verpakkingen;
- geen fictieve €0-prijzen;
- geen geforceerde productmatches;
- handmatige gebruikerskeuzes beschermen;
- maaltijdbudget en totaal weekbudget blijven apart;
- Hoogvliet blijft voorlopig de ondersteunde prijsbron;
- slimme functies mogen bestaande betrouwbare werking niet breken.

---

# Werkwijze — Codex / Work

## Codex
Gebruik standaard voor:
- codeonderzoek;
- bugs en root-cause analyse;
- refactors;
- nieuwe logica en algoritmes;
- matcher/readiness/package-logica;
- tests;
- performance;
- technische cleanup.

Codex werkt bij voorkeur in kleine, afgebakende checkpoints.

## Work
Gebruik wanneer meerdere systemen gecombineerd moeten worden:
- GitHub-status / PR;
- Supabase live-data;
- Vercel Preview;
- browsercontrole;
- live maintenance;
- release;
- Production smoke;
- projectdocumentatie.

Work-opdrachten blijven bewust klein.

Dus liever niet:
analyse → implementatie → CI → Preview → live write → release
allemaal in één Work-run.

Wel:
Codex implementatie → Work verificatie → eventueel Codex fix → Work release.

---

# Afgerond

| Onderdeel | Status |
|---|---|
| PWA-basis t/m PWA 14 | ✅ Afgerond / Production |
| Branding + Home Optie C | ✅ Afgerond / Production |
| PR #28 — verpakkingen/lijst/budget | ✅ Afgerond / Production |
| PR #29 — stabiliteit & kernflows | ✅ Afgerond / Production |
| Importer & maintenanceherstel | ✅ Afgerond / Production |
| PR #37 — Hoogvliet-productdekking | ✅ Afgerond / Production |

Technische details, commits, deployments en historische acceptatiebewijzen staan in `PROJECT_STATE.md` en relevante docs.

---

# 1. Productdata & receptkwaliteit
**Status: ACTIEF**

Doel:
alle recepten alleen READY maken wanneer product, hoeveelheid, verpakking en prijs betrouwbaar zijn.

Omvat:
- betrouwbare SKU's en productmatches;
- hoeveelheden, eenheden en verpakkingsomrekeningen;
- readiness-/match-cache en gerichte invalidatie;
- Data Health;
- cataloguskwaliteit en prijsbetrouwbaarheid;
- duidelijke blokkades in plaats van geforceerde READY-status.

## 1A. Honig/Knorr NOT_READY
**Status: bezig — PR #39**

Bekende probleemgroepen:
- tomaten per stuk;
- hacheevlees;
- pitabroodjes;
- verse basilicum;
- rookworst;
- lasagnebladen;
- magere yoghurt;
- volkorenbrood/sneetjes;
- Provençaalse wokgroenten.

**Codex**
- matcher/package/readiness-code;
- bounded maintenance;
- regressietests;
- failure/race-condition tests;
- technische fixes.

**Work**
- live audit;
- Preview;
- CI;
- dry-run;
- begrensde live herberekening;
- releasegate en release.

**Klaar wanneer:**
- veilige fixes gereleased zijn;
- live AFTER-audit is uitgevoerd;
- resterende NOT_READY-profielen uitsluitend echte, aantoonbare datablokkades hebben.

## 1B. Honig/Knorr NO_RECIPE
**Status: volgende stap**

Huidige basis:
- Honig: 1 zonder receptprofiel;
- Knorr: 14 zonder receptprofiel.

**Codex eerst**
- receptprofielen;
- validator/matcher;
- hoeveelheden;
- tests.

**Work daarna**
- actuele catalogus-/broncontrole;
- Preview;
- acceptatie;
- release.

## 1C. Overige receptkwaliteit
**Status: daarna**

Omvat:
- overige receptprofielen;
- package parsing;
- Data Health;
- catalogusafwijkingen;
- gerichte rematch/readiness;
- bekende dataproblemen herleidbaar maken.

**Uitvoering:** Codex → Work.

---

# 2. Betrouwbare opslag + geschiedenis
**Status: gepland**

Doel:
geen verlies van week, lijst, eigen recepten of handmatige keuzes.

Omvat:
- actieve week duurzaam bewaren;
- herstel na refresh/heropenen;
- weekgeschiedenis als snapshots;
- eerdere weken terugzien;
- basis voor later account-sync;
- duidelijke migratiestrategie naar accountopslag.

**Codex eerst:** opslagmodel, state-logica en tests.  
**Work daarna:** Supabase/integratie/Preview/release.

---

# 3. Budgetbewuste productselectie
**Status: gepland — hoge prioriteit**

Doel:
standaard de goedkoopste **geschikte en betrouwbare** productcombinatie kiezen.

Belangrijk:
- hele verpakkingskosten vergelijken;
- huismerk mag winnen;
- actuele aanbiedingen altijd meenemen in de prijsvergelijking;
- een aanbieding wint alleen wanneer de werkelijke kassaprijs lager is dan geschikte alternatieven;
- geen multibuy-optimalisatie puur om extra voorraad te kopen;
- receptspecifieke eisen blijven hard;
- producten tussen gerechten slim kunnen hergebruiken;
- restvoorraad is geen strafpunt: goedkoopste geschikte kassacombinatie wint ook als er product overblijft;
- prijs mag nooit een verkeerde match rechtvaardigen;
- gebruikerskeuze heeft altijd voorrang.

**Codex eerst**
- optimalisatie-engine;
- verpakking-/prijslogica;
- producthergebruik;
- tests.

**Work daarna**
- echte Hoogvliet-data;
- budgetcontrole;
- Preview;
- end-to-end verificatie.

---

# 4. Eigen recepten — vervolg
**Status: gepland**

Mogelijke verbeteringen:
- bestaand recept sneller dupliceren/aanpassen;
- betere fout- en lege staten;
- robuust bewaren;
- betrouwbare foto/fallback;
- geen regressie in prijs-, budget- of lijstlogica.

**Uitvoering:** Codex → Work.

---

# 5. Voorraadkast + terugkerende producten
**Status: gepland**

Doel:
een eenvoudig voorraadoverzicht combineren met herkenning van terugkerende producten, zodat de planner eerst gebruikt wat echt thuis is en alleen koopt wat nodig is.

Voorraadregels:
- voorraad telt pas mee nadat de gebruiker het expliciet bevestigt;
- mogelijke voorraad mag nooit stil als aanwezig worden aangenomen;
- restverpakkingen uit eerdere weken mogen als **waarschijnlijk nog aanwezig** worden voorgesteld;
- de gebruiker bevestigt dit telkens via afvinken voordat de planner ermee rekent;
- toon een overzichtelijke voorraadkast met product, bekende hoeveelheid en status;
- handmatige correcties blijven leidend.

Terugkerende producten:
- producten herkennen die vaak terugkomen, bijvoorbeeld melk, brood of fruit;
- herkomst behouden;
- gebruiker houdt altijd controle;
- suggesties overschrijven geen handmatige wijzigingen;
- nooit automatisch toevoegen zonder duidelijke toestemming.

**Codex eerst:** voorraadmodel, resthoeveelheid-logica, bevestigingsregels en tests.  
**Work daarna:** echte week-/lijstintegratie, Preview en acceptatie.

---

# 6. Slimmere suggesties
**Status: gepland**

Suggesties op basis van:
- boodschappenpatronen;
- recepten;
- budget;
- terugkerende producten.

Gebruiker houdt altijd controle.

**Uitvoering:** Codex → Work.

---

# 7. Personalisatie
**Status: gepland**

Leren van:
- favoriete gerechten;
- favoriete producten;
- gebruikelijke hoeveelheden;
- weekpatronen;
- budgetgedrag.

Geen expliciete gebruikerskeuze overschrijven.

**Uitvoering:** Codex → Work.

---

# 8. UX & uitstraling

## Home-mascotte vernieuwen
**Status: later**

Gekozen richting:
Optie 2 — vriendelijk en expressief.

**Uitvoering:** Work.

## Gerechtfoto's
**Status: later**

- rechtenvrije/eigen/AI-beelden;
- inhoudelijk passend bij gerecht;
- betrouwbare fallback;
- geen verkeerde foto tonen om lege ruimte te vullen.

**Uitvoering:** Work.

## Haptische feedback
**Status: onderzoeken**

Eerst fysieke iPhone/PWA-haalbaarheid bewijzen. Alleen daarna implementeren als ondersteuning betrouwbaar genoeg is.

**Uitvoering:** Work eerst, Codex alleen bij afgebakende codewijziging.

---

# 9. Launch-polish
**Status: vóór publieke lancering**

Omvat:
- volledige fysieke iPhone-flow;
- Home, weekvoorbereiding, Menu, Vrije keuze, eigen recepten en lijst als geheel;
- loading/error/empty states;
- performance;
- PWA-installatie en icoon;
- toegankelijkheid;
- privacy/voorwaarden;
- bronvermelding Hoogvliet;
- Production smoke.

**Uitvoering:** Work.

---

# 10. Accounts & synchronisatie
**Status: na functionele kern en launch-polish**

Doel:
- eenvoudige accountflow;
- Google-login als eerste gewenste optie;
- data synchroniseren tussen apparaten;
- recepten, voorkeuren, lijst-/weekdata koppelen;
- bestaande lokale data behouden waar praktisch mogelijk.

**Codex eerst:** auth/data-architectuur en tests.  
**Work daarna:** Supabase-configuratie, integratie, Preview en end-to-end verificatie.

---

# 11. BoodschappenMaatje Plus
**Status: na accounts**

Gratis kern blijft bruikbaar.

Plus richt zich op:
- extra gemak;
- meer automatisering;
- uitgebreidere personalisatie;
- geavanceerdere slimme functies.

**Uitvoering:** Codex → Work.

---

# Later

| Onderdeel | Uitvoering |
|---|---|
| Meldingen | Codex → Work |
| Offline/PWA-robuustheid | Codex → Work |
| Kassabon / werkelijke uitgaven | Codex → Work |
| Voorraad / waarschijnlijk nog thuis | Codex → Work |
| Meerdere supermarkten | Codex → Work |

Meerdere supermarkten pas wanneer de Hoogvliet-kern betrouwbaar staat.

---

# Prioriteitsvolgorde

1. Productdata & receptkwaliteit
2. Honig/Knorr NO_RECIPE
3. Betrouwbare opslag + geschiedenis
4. Budgetbewuste productselectie
5. Eigen recepten — vervolg
6. Voorraadkast + terugkerende producten
7. Slimmere suggesties
8. Personalisatie
9. Launch-polish
10. Accounts & synchronisatie
11. BoodschappenMaatje Plus

---

# Releaseproces

Normale flow:
1. feature branch / bestaande geschikte branch;
2. Codex voor afgebakend codewerk;
3. geautomatiseerde tests;
4. Work voor GitHub/CI/Preview;
5. fysieke iPhone-test wanneer relevant;
6. expliciete goedkeuring;
7. merge naar `main`;
8. automatische Production deployment;
9. Production smoke test;
10. `PROJECT_STATE.md` en deze roadmap bijwerken.

Geen merge of Production zonder expliciete toestemming wanneer de opdracht bij Preview/iPhone-test hoort.

---

# Roadmapbeheer

- Nieuwe ideeën buiten de huidige scope worden hier geparkeerd in plaats van direct meegebouwd.
- `PROJECT_STATE.md` bevat het actuele technische checkpoint.
- `ROADMAP.md` bevat alleen richting, volgorde en uitvoeringskeuze.
- `DESIGN.md` bevat vaste UX/UI-regels.
- Diepe technische historie en bewijs horen in relevante docs.
- Bij conflict met actuele remote code/PR: eerst remote toestand vaststellen en daarna documentatie corrigeren.
