# BoodschappenMaatje — Roadmap

Dit document bevat de productroadmap. `PROJECT_STATE.md` bepaalt waar de ontwikkeling **nu** staat. De actuele code, remote branch en PR blijven de technische bron van waarheid.

## Productvisie
BoodschappenMaatje is de boodschappenlijst die steeds beter weet wat je nodig hebt: een persoonlijke boodschappenassistent die de week voorbereidt, helpt binnen budget te blijven en steeds meer terugkerend werk uit handen neemt.

De **boodschappenlijst staat centraal**. Weekmenu, recepten, prijzen, budget en suggesties ondersteunen die lijst.

Belangrijke productprincipes:
- rekenen met wat de gebruiker daadwerkelijk moet kopen: hele verpakkingen, geen fictieve deelprijzen;
- ontbrekende of onbetrouwbare prijzen nooit als €0 presenteren;
- geen geforceerde productmatches;
- handmatige gebruikerskeuzes beschermen;
- maaltijd- en totaal weekbudget blijven afzonderlijke concepten;
- kernfuncties blijven gratis;
- prijsbron modulair houden zodat BoodschappenMaatje niet technisch aan één bron vastzit.

## Afgeronde hoofdmijlpalen

| Mijlpaal | Status | Kern |
|---|---|---|
| PWA-basis | Afgerond / Production | Next.js PWA, Vercel, Supabase en iPhone-installatie |
| PWA 9 | Afgerond / Production | Budgetmotor, cent-nauwkeurig, quantity × prijs, cacheprijzen |
| PWA 10 | Afgerond / Production | Slimme weekvoorbereiding op personen, dagen, budget en bestaande lijst |
| PWA 11 | Afgerond | Recepten, ingrediënten, productmatching, actuele prijzen en weekoverzicht |
| PWA 11 Fix 1 | Afgerond | Data Health, Match Repair en Recipe Readiness Gate |
| PWA 11 Fix 2 | Afgerond | Maaltijdbudget, alternatieven en harde maaltijdvalidatie |
| PWA 12 | Afgerond | Menu aanpassen, gerecht/product/ingrediënt vervangen en expliciete budgetoverride |
| Planner-cache | Afgerond | Persistent readiness/match-cache, people_count 1–10 en automatisch onderhoud |
| Productonderhoud | Afgerond | Gerichte rematch en readiness-invalidatie bij nieuwe producten |
| PWA 13 | Afgerond / Production | Vrije keuze en maaltijdmixen, waaronder Honig/Knorr |
| Branding | Afgerond / Production | Metallic blauwe huisstijl en officieel app-icoon |
| UX simplification | Afgerond / Production | Rustiger Home, begeleide flows en duidelijkere mobiele UX |
| PWA 14 | Afgerond / Production | Eigen recepten, compact detail, dynamische Vrije keuze, actuele prijzen, budget en lijstsync |

## Volgende stap

### Eigen recepten — vervolg: scope bepalen
PWA 14 is op 23 september 2026 op iPhone geaccepteerd en via PR #27 in Production gezet. Bepaal op basis van gebruikerstesten welke verbeteringen aan lokaal bewaren, fout- en lege staten en foto/fallback het eerst nodig zijn. Leg de scope vast voordat de volgende feature wordt gebouwd. Er is nog geen nieuwe featurebranch of PWA-nummer toegekend.

---

# Na PWA 14 — functies eerst compleet maken

De volgende productstappen worden vóór accounts/Plus en vóór publieke lancering uitgewerkt. Exacte PWA-nummers worden pas toegekend wanneer de vorige milestone is afgerond, zodat de roadmap niet onnodig vastloopt.

## Eigen recepten — vervolg
Na gebruikerstesten bepalen welke uitbreidingen nodig zijn, bijvoorbeeld:
- sneller bestaand recept dupliceren/aanpassen;
- betere fout- en lege staten;
- receptgegevens robuust bewaren en later geschikt maken voor accounts/synchronisatie;
- betrouwbare foto/fallback-flow;
- geen regressie in prijs-, budget- of lijstlogica.

## Recepten & maaltijdmixen uitbreiden
- Honig/Knorr-dekking verder uitbreiden wanneer betrouwbare verpakkingsinformatie beschikbaar is;
- juiste mix-SKU en merkconsistentie;
- correcte ingrediënten en hoeveelheden per aantal personen;
- dubbele of verkeerde varianten voorkomen;
- recepten alleen READY maken wanneer benodigde data betrouwbaar is;
- receptenbibliotheek verder laten groeien via de bestaande validator/matcher in plaats van handmatige shortcuts.

## Productcatalogus & datakwaliteit
Doel: een brede, actuele Hoogvliet-catalogus die de slimme functies betrouwbaar voedt.

Blijvende eisen:
- dagelijkse automatische product-/prijsimport;
- nieuwe producten toevoegen en bestaande producten bijwerken;
- geen duplicaten;
- actuele prijzen;
- importer fail-fast bij blokkades/lege pagina's;
- retry/back-off en checkpoints;
- gerichte rematch/readiness-invalidatie bij nieuwe of gewijzigde producten;
- monitoring van mislukte runs;
- doorgroeien naar **5000+ producten**;
- zichtbaar kunnen maken hoeveel producten zijn toegevoegd/bijgewerkt;
- geen fictieve prijs of match gebruiken om een planner toch te laten slagen.

## Gerechtfoto's
- rechtenvrije of eigen/AI-beelden kunnen gebruiken;
- afbeelding moet inhoudelijk bij het gerecht en de ingrediënten passen;
- consistente fallback wanneer geen betrouwbare foto beschikbaar is;
- geen verkeerde foto tonen alleen om altijd een afbeelding te hebben;
- generatie/import mag later geautomatiseerd worden zonder de planner afhankelijk te maken van een foto.

## Terugkerende producten
BoodschappenMaatje moet patronen in de boodschappenlijst kunnen herkennen:
- producten die vaak terugkomen herkennen;
- herkomst per item behouden, bijvoorbeeld manual / mealPlan / suggestion / recurring;
- gebruiker houdt altijd controle;
- suggesties mogen handmatige wijzigingen niet overschrijven;
- terugkerende producten kunnen helpen bij “Maak mijn lijst compleet”.

## Slimmere suggesties
- suggesties baseren op echte lijst- en gebruikspatronen;
- relevante aanvullingen voorstellen zonder de lijst automatisch vol te gooien;
- rekening houden met weekbudget;
- duidelijk onderscheid tussen suggestie en daadwerkelijk toegevoegd product;
- suggesties moeten uitlegbaar en makkelijk te verwijderen zijn.

## Personalisatie
BoodschappenMaatje mag geleidelijk leren wat bij een huishouden past:
- voorkeuren en terugkerende keuzes;
- gebruikelijke hoeveelheden;
- favoriete gerechten/producten;
- weekpatronen;
- budgetgedrag;
- personalisatie blijft ondersteunend en overschrijft geen expliciete gebruikerskeuze.

## Geschiedenis & budgetgeheugen
Later uitwerken:
- eerdere boodschappen/weken terugzien;
- nuttige patronen uit geschiedenis gebruiken;
- budgetten en werkelijke uitgaven over tijd vergelijken waar betrouwbare data beschikbaar is;
- eerdere week niet stil aanpassen wanneer een nieuwe week wordt gestart.

## Voorraad / “waarschijnlijk nog thuis”
Later onderzoeken:
- aangeven welke producten mogelijk nog aanwezig zijn;
- gebruiker laat bevestigen wat echt op voorraad is;
- nooit automatisch aannemen dat iets thuis is als dat de boodschappenlijst of het budget onbetrouwbaar maakt.

---

# Gebruikservaring vóór publieke lancering

## Onboarding & positionering
Vóór publieke lancering expliciet maken:
- “BoodschappenMaatje gebruikt momenteel Hoogvliet voor product- en prijsinformatie”;
- BoodschappenMaatje is een **onafhankelijke boodschappenassistent** en geen officiële Hoogvliet-app;
- supermarktinstelling toont: “Supermarkt: Hoogvliet” en “Momenteel ondersteund”;
- prijsinformatie krijgt compacte bronvermelding, bijvoorbeeld “Gebaseerd op beschikbare Hoogvliet-prijzen”;
- uitleg blijft vriendelijk en compact, niet juridisch/technisch op hoofdschermen.

## Gebruikstest & launch-polish
Voor accounts/Plus en publieke uitrol:
- volledige fysieke iPhone-flow testen;
- Home, Weekvoorbereiding, Menu, Vrije keuze, eigen recepten en boodschappenlijst als één geheel testen;
- nieuwe-week lifecycle testen;
- “Verder met mijn lijst” en “Maak mijn lijst compleet” duidelijk gescheiden houden;
- fout-, loading- en lege staten nalopen;
- PWA-installatie en app-icoon controleren;
- performance op mobiel controleren;
- toegankelijkheid/contrast/touch targets nalopen;
- regressietests en Production smoke tests;
- privacy-/voorwaardenpagina's en noodzakelijke juridische informatie afronden.

---

# Accounts & synchronisatie

Accounts komen **na de functionele kern en launch-polish**, niet eerder.

Doel:
- eenvoudige accountflow;
- Google-login als gewenste eerste loginoptie;
- gebruikersdata veilig synchroniseren tussen apparaten;
- recepten, voorkeuren, lijst-/weekdata en relevante personalisatie aan account kunnen koppelen;
- migratiepad voor bestaande lokale data waar praktisch mogelijk;
- privacy en dataminimalisatie als ontwerpvoorwaarde.

De app moet bruikbaar blijven zonder dat accountcomplexiteit de kernervaring overneemt.

---

# BoodschappenMaatje Plus

Plus komt pas nadat accounts stabiel zijn.

## Gratis kern
De kern blijft gratis, waaronder in ieder geval:
- boodschappenlijst;
- weekvoorbereiding;
- basisbudget;
- ondersteunde product-/prijsinformatie;
- essentiële recept/menu-functionaliteit.

## Plus-richting
Plus mag extra waarde bieden via:
- extra gemak;
- meer automatisering;
- uitgebreidere personalisatie;
- geavanceerdere slimme functies.

Definitieve Plus-features en prijs worden pas later bepaald op basis van de dan werkende app. Geen paywall bouwen die de gratis kern kunstmatig onbruikbaar maakt.

## Betaling
Omdat BoodschappenMaatje een PWA/webapp is, kan een webbetalingsflow later worden ontworpen wanneer Plus daadwerkelijk wordt gebouwd.

---

# Verdere toekomst

## Meldingen
Later onderzoeken:
- nuttige herinneringen rond weekvoorbereiding of boodschappen;
- alleen meldingen met duidelijke gebruikerswaarde;
- geen onnodige notificaties.

## Offline/PWA robuustheid
Later verbeteren waar nodig:
- belangrijke schermen bruikbaar houden bij tijdelijke verbindingsproblemen;
- duidelijke status bij verouderde prijsdata;
- geen schijnbaar actuele prijzen tonen wanneer data niet betrouwbaar is.

## Kassabon / werkelijke uitgaven
Later onderzoeken:
- kassabon of aankoopgegevens gebruiken om geplande versus werkelijke uitgaven te vergelijken;
- alleen bouwen wanneer dit betrouwbaar en gebruiksvriendelijk kan.

## Meerdere supermarkten
**Niet voor de huidige kernfase.**

Later:
- supermarktkeuze uitbreiden;
- prijsbronnen via een modulaire providerlaag aansluiten;
- bestaande Hoogvliet-functionaliteit niet breken;
- per bron duidelijk maken hoe actueel/betrouwbaar prijzen zijn;
- supermarktvergelijking alleen wanneer databronnen dit betrouwbaar toelaten.

Hoogvliet blijft voorlopig de ondersteunde supermarkt en huidige prijsbron.

---

# Technische en productregels

## Budget & prijzen
- Budget rekent met daadwerkelijk te kopen verpakkingen.
- Geen fictieve deelprijzen als eindtotaal.
- Ontbrekende prijs mag geen definitief betrouwbaar totaal opleveren.
- Maaltijdbudget en totaal weekbudget blijven afzonderlijk.
- Gebruiker mag alleen expliciet een budgetoverschrijding accepteren waar de flow dit ondersteunt.

## Data & matching
- Geen geforceerde productmatches.
- READY betekent dat de benodigde data voor die flow betrouwbaar genoeg is.
- Nieuwe producten mogen gericht rematchen; vermijd onnodige volledige herberekeningen.
- Cache/performance mag correctheid niet veranderen.

## Gebruikersdata
- Manual wijzigingen beschermen.
- Herkomst van lijstitems behouden.
- Nieuwe week heeft een expliciete lifecycle.
- Geen stil verlies van eigen recepten, gekozen maaltijden of handmatige hoeveelheden.

## Releaseproces
Normale flow:
1. feature branch;
2. implementeren;
3. geautomatiseerde tests;
4. Preview;
5. fysieke iPhone-test wanneer relevant;
6. expliciete goedkeuring;
7. merge naar `main`;
8. automatische Production deployment;
9. Production smoke test;
10. `PROJECT_STATE.md` en deze roadmap bijwerken.

Geen merge of Production-actie zonder expliciete toestemming wanneer de opdracht bij Preview/iPhone-test hoort.

# Roadmapbeheer
- Nieuwe ideeën die niet bij de huidige scope horen worden hier geparkeerd in plaats van direct meegebouwd.
- Geen grote nieuwe feature midden in een acceptatie- of releasefase.
- `PROJECT_STATE.md` bevat alleen het actuele checkpoint; deze roadmap bevat de langere lijn.
- `DESIGN.md` bevat vaste visuele/UX-regels.
- Bij conflict tussen documentatie en actuele code/remote PR: eerst remote toestand vaststellen en daarna documentatie corrigeren.
- Als een roadmaponderdeel wordt gebouwd, maak de scope concreet voordat implementatie start.
