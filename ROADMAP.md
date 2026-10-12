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

- **Codex** doet standaard codeonderzoek, implementatie, refactors, algoritmes, tests en performancewerk.
- **Work** doet GitHub/PR, Supabase-live-data, Vercel Preview, browsercontrole, live maintenance, release en Production-smoke.
- **Een Work-run behandelt maximaal één technisch checkpoint.**
- **Modelstrategie:** begin standaard met **GPT-5.6 Luna** om credits te besparen.
  - **Luna + High** voor normaal ontwikkelwerk, afgebakende bugs, tests, UI/CSS, documentatie en bestaande patronen volgen.
  - **Luna + Extra High** voor lastigere bugs, meerdere gekoppelde bestanden of zwaardere logica.
  - Schaal pas op naar **GPT-5.6 Sol + High** als Luna aantoonbaar vastloopt, onvoldoende resultaat geeft of de taak meerdere complexe systemen tegelijk raakt.
  - Gebruik **GPT-6 Astra + High/Max** alleen als laatste escalatie voor uitzonderlijk complexe of risicovolle architectuur-, race-condition-, migratie- of refactortaken.
  - Voor uitvoeringsprompts geldt dus standaard: **Luna eerst → Sol indien nodig → Astra als laatste escalatie**.
- Bij gecombineerde taken: **Codex eerst → Work daarna**.
- Work implementeert alleen zelf als een wijziging klein is en direct onderdeel is van integratie/release.
- Geen merge of Production zonder expliciete goedkeuring wanneer een Preview/iPhone-acceptatie openstaat.

---

# Hoofdroadmap

| # | Onderdeel | Status | 💰 Bespaarimpact | Waarom | Uitvoering | Eerst nodig | Klaar als |
|---|---|---|---|---|---|---|---|
| 1A | Honig/Knorr NOT_READY | ✅ Afgerond | Hoog | Betrouwbare recepten zonder verkeerde producten/verpakkingen | Codex → Work | — | Veilige fixes gereleased; AFTER-audit gedaan; alleen echte datablokkades blijven |
| 1A.1 | Externe scrapingfallback voor Hoogvliet | 🔵 Open — technische acceptatie bewezen; financiële check resteert | Middel | Minder storingen door source_challenge/Incapsula en minder afhankelijkheid van GitHub-runnerfetches | Codex → Work | 1A afronden | Zyte-proof 6/6; volledige Production-snapshot met 0 fallback-attempts. Leg nog een controleerbare Bright Data/Zyte-kostenvergelijking vast uit bestaande provider-/factuurgegevens; directe importer blijft primary en fallback geldt alleen voor bewezen eligible windows |
| 1B | Honig/Knorr NO_RECIPE | 🔵 Actief — 7 Knorr-links + readiness-refresh Production bevestigd; overige NO_RECIPE open | Hoog | Meer maaltijdmixen bruikbaar maken | Codex → Work | 1A + scrapingfallback-besluit | Veilige readiness-ondersteuning voor bewezen `needs_review` recipe-links staat in Production. 7 bewezen Knorr-koppelingen en 70 readinesscache-rijen zijn in Production bevestigd (6 READY, Japanse teriyaki NOT_READY); 1B blijft open voor brongebaseerde beoordeling van overige NO_RECIPE-profielen |
| 1C | Slim Zoeken 2.0 — premium ontdekken, vergelijken en direct toevoegen | ⭐ **Volgende — werkende fysieke boodschappentest prioriteit** | **Hoog** | Producten snel vinden, visueel door categorieën bladeren, actuele aanbiedingen zien en betrouwbare goedkopere alternatieven direct aan de lijst toevoegen | Codex → Work | 1B afronden; bestaande Hoogvliet-catalogus/prijzen bruikbaar | Eerst een echt werkende shopping-flow op iPhone: Home→Zoeken, categorieën, echte productresultaten/prijzen, filter Goedkoopste/Aanbiedingen, +/− naar bestaande lijst en veilige persistence. Daarna premium wow-polish. Preview + fysieke iPhone-boodschappentest akkoord |
| 1D | Overige receptkwaliteit + Data Health (incl. product_type-classifier) | Daarna | Hoog | Minder plannerfouten en betere productmatching | Codex → Work | 1B | Overige kritieke profiel-, package- en matchproblemen aantoonbaar beheerst |
| 2 | Budgetbewuste productselectie voor menu's | ⭐ Hoge prioriteit — **na Slim Zoeken 2.0** | **Zeer hoog** | Altijd de goedkoopste geschikte kassacombinatie kiezen | Codex → Work | Slim Zoeken 2.0 functioneel + receptkwaliteit betrouwbaar | Hele verpakkingen, aanbiedingen, huismerk en producthergebruik worden correct geoptimaliseerd binnen budget |
| 3 | Betrouwbare opslag + geschiedenis | Gepland | Middel | Geen verlies van week, lijst, recepten of keuzes | Codex → Work | Stabiele kernflows | Week/lijst/herstel en weekhistorie betrouwbaar bewezen |
| 4 | Voorraadkast + terugkerende producten | Gepland | **Zeer hoog** | Eerst gebruiken wat echt thuis is en minder onnodig kopen | Codex → Work | Opslagfundament | Voorraad telt alleen na bevestiging; restverpakkingen kunnen veilig als vermoedelijke voorraad terugkomen |
| 5 | Eigen recepten — vervolg | Gepland | Middel | Meer flexibiliteit zonder budget-/lijstregressies | Codex → Work | Opslag stabiel | Eigen recepten robuust bewerken/bewaren en correct laten meedoen in prijs/lijst |
| 6 | Slimmere suggesties | Gepland | Hoog | Relevante aanvullingen zonder lijst te vervuilen | Codex → Work | Voorraad + historie | Suggesties zijn relevant, uitlegbaar, budgetbewust en nooit automatisch dominant |
| 7 | Personalisatie | Gepland | Hoog | Minder handwerk en betere keuzes per huishouden | Codex → Work | Geschiedenis + suggesties | App leert voorkeuren/patronen zonder expliciete keuzes te overschrijven |
| 8 | Home-mascotte / gerechtfoto's | Later | Laag | Meer herkenning en aantrekkelijkere app | Work | Kernfunctionaliteit stabiel | Visueel goedgekeurd op iPhone zonder functionele regressies |
| 9 | Haptische feedback | Onderzoeken | Laag | Snellere/duidelijkere bediening waar iOS dit betrouwbaar ondersteunt | Work eerst | Fysieke iPhone-proef | Alleen behouden als echte PWA-ondersteuning bewezen is |
| 10 | Launch-polish | Voor publieke lancering | Middel | Snelle, betrouwbare en verzorgde eindervaring | Work | Functionele kern gereed | Volledige iPhone-flow, performance, toegankelijkheid, juridische pagina's en Production-smoke groen |
| 11 | Accounts & synchronisatie | Na kern + launch-polish | Laag | Data tussen apparaten bewaren | Codex → Work | Opslag + launch-polish | Login en synchronisatie betrouwbaar zonder lokale data stil te verliezen |
| 12 | BoodschappenMaatje Plus | Na accounts | Laag | Verdienmodel met extra gemak | Codex → Work | Accounts stabiel | Plus voegt waarde toe zonder gratis kern kunstmatig te beperken |

## Definitief productplan — Slim Zoeken 2.0

**Doel:** zoeken moet aanvoelen als een exclusieve BoodschappenMaatje-ervaring: snel, visueel en aantoonbaar behulpzaam. Het wow-effect komt uit kwaliteit en vloeiende interactie, niet uit onnodige functies.

### Vaste schermflow

1. **Home-ingang** — grote afgeronde zoekbalk direct onder de bestaande metallic-blauwe Home-header en mascotte: `Zoek producten, merken of recepten…`.
2. **Ontdek & bespaar** — aparte ontdekpagina met originele mascotte, zoekbalk, Aanbiedingen, Voordelig kiezen, Alle categorieën en Favoriete producten.
3. **Categorieën** — visueel 2-koloms grid met productcollages, geïnspireerd op een moderne supermarktindeling maar volledig in BoodschappenMaatje-stijl. Hoofdcategorieën omvatten onder meer groente/fruit, vlees/vis/vega, zuivel, bakkerij, ontbijt/beleg, pasta/rijst/wereldkeuken, diepvries, dranken, snacks, huishoudelijk, drogisterij, baby/kind en huisdier.
4. **Categorie-detail** — subcategoriechips, populaire producten en daarna alle producten; zoeken binnen de gekozen categorie blijft mogelijk.
5. **Zoekresultaten** — compacte echte productresultaten met foto, naam, verpakking, actuele betrouwbare prijs, eenheidsprijs waar betrouwbaar, en directe plusknop. Filters: Relevant, Goedkoopste, Aanbiedingen, Merk en waar nuttig Categorie.
6. **Slim vergelijken** — alleen bij betrouwbare vergelijkbare producten een uitklapbaar goedkoper alternatief tonen met echte prijs/eenheidsprijs en direct toevoegen.
7. **Boodschappenlijst** — toevoegen gebruikt bestaande lijst-/budgetservices; `+` verandert naar compacte `− aantal +`; handmatige bestaande bijdragen blijven beschermd.

### Wow-momenten

- Home→Zoeken krijgt een korte vloeiende overgang waarbij de zoekbalk visueel doorloopt naar `Ontdek & bespaar`.
- Categoriekaarten gebruiken rustige hoogwaardige productbeelden, zachte diepte en bestaande metallic-blauwe tokens; geen kopie van Hoogvliet-UI.
- Resultaten laden met stabiele skeletons in plaats van een springende spinnerlayout.
- Toevoegen geeft subtiele micro-interactie; geen overdadige effecten.
- Bij een echte expliciete productvergelijking mag `Maatje bespaart je €…` worden getoond, uitsluitend berekend uit aantoonbaar gekozen/vergeleken producten; nooit een fictieve besparing.
- Lege staten gebruiken Maatje en geven altijd een bruikbare vervolgstap (`Zoek opnieuw` / `Bekijk categorieën`).

### Uitvoering binnen 1C — functioneel eerst

**1C-A — werkende boodschappentest (eerste acceptatie):**
- Home-zoekingang werkt op iPhone;
- `Ontdek & bespaar` en categorieën zijn navigeerbaar;
- zoeken gebruikt echte bestaande Hoogvliet-catalogusdata;
- alleen betrouwbare positieve prijzen worden getoond;
- `Goedkoopste` en `Aanbiedingen` werken op echte data en geven geen nepclaims;
- product toevoegen/verlagen werkt daadwerkelijk in de bestaande boodschappenlijst en overleeft normale navigatie/heropenen volgens de bestaande opslaglogica;
- handmatige lijstwijzigingen worden niet overschreven;
- geen scanner, AI-chat, spraakzoeken of andere supermarkt in deze eerste testscope;
- passende regressietests, Vercel Preview en fysieke iPhone-test vóór merge/Production.

**1C-B — premium wow-polish binnen dezelfde roadmapstap:**
- vloeiende Home→Zoeken-transitie;
- hoogwaardige categoriecollages en categorie-detail;
- recent gezocht/favorieten waar betrouwbare opslag aanwezig is;
- skeleton loading en subtiele micro-interacties;
- vergelijkbare alternatieven en besparingsfeedback alleen wanneer de bestaande prijs-/matchdata dit betrouwbaar bewijst;
- toegankelijkheid, reduced motion en performancecontrole.

### Vast besluit — toekomstige multi-supermarktwerking

- **Eerste keuze:** bij eerste gebruik van Zoeken kiest de gebruiker verplicht één supermarkt; BoodschappenMaatje onthoudt die keuze.
- **Actieve supermarkt zichtbaar:** boven `Ontdek & bespaar` staat compact `Boodschappen bij [ supermarkt ▾ ]`; wisselen gebeurt vanuit die selector.
- **Geen gemengde zoekresultaten:** zoeken, categorieën, aanbiedingen, prijzen en alternatieven zijn altijd begrensd tot de actieve supermarkt. Zoekresultaten van verschillende ketens worden nooit standaard door elkaar getoond.
- **Lijst per supermarkt:** wisselt de gebruiker terwijl een actieve lijst al producten bevat, dan volgt een waarschuwing en wordt voor de nieuwe supermarkt een aparte lijst gestart. Er vindt geen stille vermenging of automatische productomzetting plaats.
- **Vormgeving:** supermarktkeuze blijft in BoodschappenMaatje-stijl met officiële supermarktlogo's; de huisstijl van de keten neemt het scherm niet over.
- **Keuzeniveau:** in de eerste multi-supermarktversie kiest de gebruiker een keten, niet verplicht een specifieke vestiging.
- **Toekomstige ketens:** architectuur voorbereiden op **Albert Heijn, Jumbo, Lidl en Dirk** naast Hoogvliet. Deze ketens worden nu nog niet als product-/prijsbron aangesloten; eerst wordt Hoogvliet functioneel bewezen.
- **Providerarchitectuur:** 1C mag Hoogvliet niet diep hardcoden in zoek-/filter-/lijstlogica. Producten, prijzen, categorieën, aanbiedingen en lijstcontext krijgen een expliciete supermarkt/provider-context zodat een nieuwe keten later zonder tweede zoek- of winkelwagenimplementatie kan aansluiten.
- **Vergelijken tussen winkels:** later komt een aparte functie `Vergelijk supermarkten`; normaal zoeken blijft altijd binnen één actieve supermarkt.
- Een nieuwe supermarkt wordt pas actief nadat bron, productidentiteit, actuele prijsbetrouwbaarheid, aanbiedingen, juridische randvoorwaarden en veilige lijst-/budgetintegratie afzonderlijk zijn bewezen.

### Data- en veiligheidsregels

- Hoogvliet blijft de enige prijs-/productbron in de huidige 1C-A testscope, maar de zoekarchitectuur wordt provider-aware voorbereid op meerdere supermarkten.
- Geen fictieve €0-prijzen, nepaanbiedingen, nepresultaataantallen, geforceerde matches of misleidende afbeeldingen.
- Maaltijdbudget en totaal weekbudget blijven afzonderlijk.
- Zoeken en ontdekken mogen de boodschappenlijst niet vervangen: de lijst blijft het centrale eindpunt.
- Gebruik bestaande componenten, product-/prijsservices en lijstmutaties waar mogelijk; geen tweede parallelle winkelwagenlogica.

---

# Later

| Onderdeel | 💰 Bespaarimpact | Uitvoering | Voorwaarde |
|---|---:|---|---|
| Meldingen | Laag | Codex → Work | Alleen nuttige herinneringen |
| Offline/PWA-robuustheid | Middel | Codex → Work | Geen schijnbaar actuele onbetrouwbare prijsdata |
| Kassabon / werkelijke uitgaven | Hoog | Codex → Work | Betrouwbare invoer/herkenning beschikbaar |
| Meerdere supermarkten — AH / Jumbo / Lidl / Dirk naast Hoogvliet | **Zeer hoog** | Codex → Work | Slim Zoeken provider-aware; Hoogvliet-flow bewezen; elke nieuwe bron afzonderlijk gevalideerd |

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

---

# Helemaal later — App Store / cloud-Mac

| Idee | Status | Uitvoering | Voorwaarde / notitie |
|---|---|---|---|
| Cloud-Mac voor Xcode en App Store | 💡 Idee voor later | Work / cloud-Mac | Bij eventuele App Store-release een betaalbare cloud-Mac gebruiken in plaats van eerst eigen Mac-hardware te kopen. Pay-as-you-go heeft voorkeur voor incidenteel gebruik; code/Xcode-project blijft in GitHub en belangrijke certificaten/back-ups worden extern bewaard. Eerst pas activeren wanneer een native iOS/App Store-traject echt wordt gestart. |