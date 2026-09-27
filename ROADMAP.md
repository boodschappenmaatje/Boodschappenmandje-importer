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
| PR #28 — verpakkingen/lijst/budget | Afgerond / Production | Compacte lijst, recept ⇄ lijst, veilige trash, prijsfallback, handmatige override en harde automatische maaltijdgrens |
| PR #29 — Stabiliteit & kernflows | Afgerond / Production | Kernflow-integraties, centrale hoeveelheidspresentatie en actieve CI-releasegate |

## Afgeronde release — PR #28
PR #28 is na geslaagde fysieke iPhone-hertest gemerged naar `main` (`d7a234df5ac24ab6fec558413ff2c73649071584`) en in Production uitgerold. Gerichte Production-smoke geslaagd. De verpakkingen-, lijst- en budgetronde is afgerond: compacte inklapbare lijst, oorsprong, directe veilige prullenmand, recept ⇄ lijst-sync, productvervanging, prijsfallback en handmatige bevestiging boven het maaltijdbudget. De automatische planner behoudt de harde grens. Volledige regressie: 687 webtests, 189 importerfixtures, lint, TypeScript en build groen. Echte assortimentsdatablokkades blijven als datawerk apart gedocumenteerd.

## Afgerond / Production: STABILITEIT & KERNFLOWS
PR #29 is na geslaagde fysieke iPhone-test gemerged naar `main` (`373f1542e43e4eef3794dca17e07cc9eeee287d1`) en succesvol in Production uitgerold. De gerichte Production-smoke is geslaagd. De presentatie van vervangingshoeveelheden is generiek gelijkgetrokken en de kritieke kernflows worden voortaan door de CI-releasegate bewaakt.

## Stabiliteit & kernflows
Doel: de belangrijkste gebruikersflows automatisch van begin tot eind bewaken, zodat nieuwe wijzigingen bestaande kernfunctionaliteit niet stil breken.

Minimaal bewaken:
- week instellen en genereren;
- maaltijd/recept kiezen;
- ingrediëntverpakkingen aanpassen;
- recept ⇄ boodschappenlijst tweerichtingssync;
- prijs- en budgetherberekening;
- handmatige lijstbijdragen beschermen;
- opslaan, heropenen en navigeren;
- representatieve personen-/dagencombinaties;
- Honig/Knorr en eigen recepten;
- vaste planner-scenario's.

Afgerond via `feature/stability-core-flows` en PR #29: automatische route-/opslagintegraties, personen-/dagenmatrix voor vier recepttypen, gedeelde hoeveelheidspresentatie en CI-releasecheck. Eindcheckpoint: 733 webtests, 248 kernsettests en 189 importerfixtures groen; lint, TypeScript en Production-build groen. Preview, fysieke iPhone-acceptatie en Production-smoke zijn geslaagd. Technische dekking: `docs/stability-core-flows.md`. Geen nieuwe consumentenfeature toegevoegd.

## E2E-kernflows + centrale recept ⇄ lijst-logica
Doel: receptingrediënten en hun boodschappenlijstbijdragen gebruiken één consistente gekoppelde contribution/state-logica.

Eisen:
- receptwijziging werkt direct door naar de gekoppelde lijstbijdrage;
- wijziging van een eenduidig gekoppelde lijstbijdrage werkt terug naar het juiste recept;
- hetzelfde product in meerdere recepten blijft per bijdrage herleidbaar;
- manual / mealPlan / suggestion / recurring blijven onderscheidbaar;
- losse handmatige extra's worden niet stil door receptsync overschreven;
- hoeveelheid, verpakkingen, prijs en budget blijven overal consistent;
- kernflows worden automatisch end-to-end getest.

PR #28 leverde de noodzakelijke tweerichtingssync; deze funderingsstap consolideert en bewaakt het model daarna structureel.

**Status:** het stabiliteits- en bewakingsdeel is afgerond in PR #29. De centrale contribution/state-logica en bijbehorende kernflows worden op toekomstige PR's automatisch gecontroleerd.

## Volgende funderingsstap: PRODUCTDATA & RECEPTKWALITEIT
Doel: productmatching, receptprofielen, verpakkingsinformatie en readiness systematisch betrouwbaar maken.

Omvat:
- Honig/Knorr-dekking en overige receptprofielen;
- juiste SKU's en betrouwbare productmatches;
- hoeveelheden, eenheden en verpakkingsomrekeningen;
- readiness-/match-cache en gerichte invalidatie;
- automatische Data Health-bewaking;
- cataloguskwaliteit en prijsbetrouwbaarheid;
- duidelijke audit van echte datablokkades;
- bekende catalogusafwijkingen zoals “Rode uien net 3 stuks” tegenover catalogusinhoud “1 stuk” herleidbaar onderzoeken;
- geen €0, fictieve hoeveelheden of geforceerde matches.

Deze mijlpaal volgt na de expliciet gekozen visuele Home-tussenstap en is nog **niet gestart**.

Bestaande onderdelen “Recepten & maaltijdmixen uitbreiden” en “Productcatalogus & datakwaliteit” blijven hieronder inhoudelijke werkstromen en hoeven niet dubbel als losse prioriteitsfase behandeld te worden.

## Betrouwbare opslag + geschiedenis
Doel: gebruikersdata duurzaam bewaren en een betrouwbaar fundament leggen voor later leren/personaliseren.

Omvat:
- actieve week, lijst, eigen recepten en expliciete gebruikerskeuzes robuust bewaren;
- herstel na heropenen/refresh binnen de ondersteunde opslagarchitectuur;
- voorkomen dat browser-/cachegedrag stil belangrijke data verliest;
- weekgeschiedenis als afzonderlijke snapshots bewaren;
- eerdere weken kunnen terugzien zonder ze stil te muteren;
- basis voor terugkerende producten, favorieten, budgetgeheugen en latere accounts/synchronisatie;
- duidelijke migratiestrategie van lokale opslag naar accountopslag wanneer accounts worden toegevoegd.

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

## Budgetbewuste productselectie voor recepten
Later toevoegen als aparte optimalisatiestap; niet meenemen in de huidige PR #28.

Doel: bij automatisch gegenereerde recepten kiest BoodschappenMaatje standaard de goedkoopste **geschikte en betrouwbare** productcombinatie voor de benodigde ingrediënten, gerekend op wat daadwerkelijk gekocht moet worden.

Uitgangspunten:
- eerst semantisch bepalen welke productvarianten culinair/functioneel geschikt zijn; prijs mag nooit een verkeerde match rechtvaardigen;
- vergelijk de werkelijke kosten van benodigde hele verpakkingen, niet alleen prijs per kilo/liter;
- huismerk mag automatisch winnen van A-merk als beide geschikt zijn;
- alternatieve vormen mogen alleen als het recept dit toestaat, bijvoorbeeld diepvries-spinazie in plaats van verse spinazie;
- generieke ingrediënten mogen goedkopere geschikte varianten toelaten, bijvoorbeeld half-om-half gehakt wanneer het recept niet specifiek rundergehakt vereist;
- specifieke recepteisen blijven hard: bijvoorbeeld kip blijft kip en verse basilicum wordt niet automatisch gedroogde basilicum;
- gebruik de bestaande prijsregel: nieuwste betrouwbare positieve prijs, anders laatst bekende betrouwbare positieve prijs als fallback;
- geen €0-prijzen, fictieve hoeveelheden of geforceerde matches;
- optimaliseer op totale boodschappen-/verpakkingskosten voor het recept;
- een expliciete productkeuze van de gebruiker heeft altijd voorrang op automatische prijsoptimalisatie;
- gekozen SKU, verpakking, receptprijs, budget en boodschappenlijst moeten daarna consistent dezelfde selectie gebruiken.

Voorbeeld: als 500 g nodig is, kan 1 verpakking van 600 g à €2,40 goedkoper zijn dan 2 verpakkingen van 400 g à €1,50. Kies dan €2,40, ook als de andere variant per gram goedkoper lijkt.

## Actieve visuele tussenstap — Home Optie C
De gebruiker koos op 27 september 2026 definitief de **rechter Optie C — Speels & persoonlijk**. Uitvoering via `feature/home-option-c`, Draft PR #30; **klaar voor fysieke iPhone-test**, nog geen fysieke acceptatie of release.

Scope: Home-compositie nauwkeurig volgen met lichte blauwe achtergrond, grote vriendelijke hero, los officieel 3D-bonnetje en “Samen binnen budget!”, blauwe budgetbon met afzonderlijke echte week-/maaltijdbedragen, eerstvolgende maaltijd en lijst-/weekactie. Alle werkende kernflows en overige schermen blijven behouden.

De eerdere **mascotte Optie 2 — vriendelijk en expressief** is hierin opgenomen als karakterrichting, niet als afzonderlijke latere Home-stap. Het officiële app-icoon blijft ongewijzigd.

Stoppunt: gecontroleerde Preview → fysieke iPhone-test → expliciete mergegoedkeuring. Productdata & receptkwaliteit niet tegelijk starten.

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
- voeg een aparte pagina **“Over onze gegevens”** toe met een transparante, begrijpelijke uitleg over herkomst en actualiteit van product- en prijsinformatie;
- leg daar uit dat productafbeeldingen via externe afbeeldings-URL’s rechtstreeks vanaf externe/winkelservers kunnen worden geladen en niet door BoodschappenMaatje als eigen productfoto’s worden geclaimd;
- vermeld dat rechten op productafbeeldingen, merken en andere beschermde materialen bij de betreffende rechthebbenden blijven;
- bewaar de correspondentie met Hoogvliet over toestemming, afbeeldingen en scraping als onderdeel van het project-/compliancedossier; behandel deze correspondentie niet als een formele licentie of toestemming;
- huidige technische werkwijze blijft voor deze roadmapstap ongewijzigd: geen migratie van afbeeldingen en geen wijziging aan de scraper uitsluitend vanwege deze transparantie-/positioneringsstap;
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
- Gebruik de nieuwste betrouwbare positieve prijs. Als die niet beschikbaar is, gebruik de laatst bekende betrouwbare positieve catalogusprijs als fallback. Zodra een nieuwere geldige prijs beschikbaar komt, wordt die automatisch actief.
- Prijsleeftijd alleen is geen reden om een verder geldig recept, mix of verpakkingsbediening te blokkeren. Oudere prijzen blijven herkenbaar; expliciete gebruikerskeuzes blijven behouden bij prijsverversing.
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
- Geplande receptingrediënten en hun boodschappenlijstbijdragen zijn tweerichtings gekoppeld. Een expliciete verpakkingswijziging vanuit recept of lijst synchroniseert naar de andere kant, terwijl onafhankelijke handmatige bijdragen beschermd blijven.
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
