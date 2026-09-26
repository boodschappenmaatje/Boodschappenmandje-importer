# BoodschappenMaatje — Project State

> Dit bestand is het actuele technische checkpoint. Controleer bij ontwikkelwerk altijd ook de remote branch en PR; remote Git-status gaat voor verouderde tekst in dit bestand.

## Huidige milestone
**STABILITEIT & KERNFLOWS — in uitvoering op `feature/stability-core-flows`. PR #28 blijft afgerond/in Production.**

## Actief checkpoint — 26 september 2026
- Uitgangspunt remote main `ba4119677cc054039bebab7dd4424fef670caf25`, Vercel Production success; alleen historische Draft PR #21 stond nog open. Nieuwe featurebranch vanaf exact deze main, geen vervolgwijziging in PR #28.
- Compacte en uitgeklapte recepthoeveelheid gebruiken dezelfde bestaande dag-/verpakkingsberekening; generieke gram/ml/stuks-correctie, geen tweede quantity-state.
- Nieuwe route-/opslagintegratie vanaf lege Home; lees-/schrijffouten, navigatie, beide syncrichtingen en losse extra. Nieuwe 24-cellenmatrix voor vier recepttypen. Vijf productvervangingen testen beide hoeveelheidsweergaven.
- Vitest ontdekt ook bestaande TSX-tests; CI-releasecheck toegevoegd zonder DB/secrets/import. Snelle kernset: 248 tests / 14 bestanden groen. Volledige eindregressie en Preview volgen vóór het acceptatiepunt.
- Draft PR/Preview nog te publiceren; **nog niet klaar voor fysieke iPhone-test**. Volledig testplan en architectuurbevindingen: `docs/stability-core-flows.md`.
- Volgende funderingsstappen blijven Productdata & receptkwaliteit en Betrouwbare opslag + geschiedenis. Geen merge/Production/migratie/import binnen deze opdracht.

## Production — PR #28
- Repository: `boodschappenmaatje/Boodschappenmandje-importer`; branch `main`.
- Fysieke iPhone-hertest: **geslaagd**, door de gebruiker op 25 september 2026 expliciet geaccepteerd.
- PR **#28** via de bestaande squash-mergeflow gemerged; mergecommit/main-head `d7a234df5ac24ab6fec558413ff2c73649071584`. Voor de merge was de gecontroleerde PR-head `a886dd00f4756e6898d3c580cc6b0c0e088ff3f6`; sinds de geteste functionele code `2589161a9dcf4f47449ff97bb1ade4f7206445eb` volgden uitsluitend documentatiecommits.
- Vercel Production-check voor precies de mergecommit: **success**. Productie: https://boodschappenmaatje-pwa.vercel.app/
- Gerichte Production-smoke test: **geslaagd in een schone browsersessie**. Home, Menu, Lijst, Budget en Vrije keuze openen. Een 2p/2d-week met €100 week-/€70 maaltijdbudget plande twee geldige maaltijden voor €8,50. Zeven productbijdragen synchroniseerden naar de compacte lijst.
- Categorie onafhankelijk inklappen, Alles/Maaltijden en Afgevinkt, checkbox en normale Productdetails gecontroleerd. Lijstplus spinazie 1→2 gaf in Menu 800→1.600 g, gerecht €4,43→€5,38 en lijst/maaltijden €8,50→€9,45; receptmin bracht alles terug. Een losse extra bleef apart (€0,95 lijstbovenop maaltijd). Trash op gekoppelde courgette verwijderde direct zonder dialoog, categorie-/productteller 7→6, ook na browserrefresh; manual-only spinazie is later eveneens direct verwijderd.
- Expliciete productwissel spinazie→G'woon Broccoli maakte ingrediëntnaam, foto, verpakkingsinhoud, receptprijs (€5,45), lijst en budget actueel en bleef na heropenen bestaan. Bij maaltijdgrens €9 waarschuwde een handmatige plus vooraf voor €10,70; Annuleren wijzigde niets, Toch verhogen rekende maaltijdoverschrijding €1,70 en lijst €11,65 correct uit, en min herstelde direct de lagere waarde.
- Deze rooktest gebruikte uitsluitend lokale browserstate. Geen migratie, productimport of destructieve databaseactie. In de uitgeklapte bewerkingslijst staat na de broccoliwissel “1 stuk nodig”, terwijl het compacte recept de gekochte 800 g vermeldt; dit verschil in tekstpresentatie hoort als gericht onderzoek bij Stabiliteit & kernflows. De verpakkingskeuze, prijs en lijst zijn in de smoke consistent.
- Deze releasedocumentatie volgt in een afzonderlijke documentatiecommit op `main`; de bijbehorende Production-status wordt op die commit gecontroleerd.

## Historische Production — PWA 14
- PR #27, releasecommit `b233b65910121fe998b4ac913d1999afbef3f20d`; fysieke iPhone-test en Production-smoke destijds geslaagd.

## PWA 14 geleverd
- eigen recepten maken, bewaren, bekijken en bewerken op dit apparaat;
- echte producten zoeken, prijzen en verpakkingen tonen en hoeveelheden schalen;
- compact receptdetail voor gegenereerde gerechten, mixen en eigen recepten;
- aparte editor, 2×2 acties in Vrije keuze en dynamische weekcapaciteit;
- maaltijd- en weekbudgetvalidatie, expliciete override waar toegestaan;
- lijstsync met bescherming van handmatige gebruikerswijzigingen.

## Laatste geverifieerde regressies
PR #28: **687/687 webtests (57 bestanden), 189/189 importerfixtures, lint, TypeScript en lokale Production-build groen** op de laatste functionele code. De aansluitende PR-heads veranderden alleen documentatie. GitHub/Vercel-checks op de geaccepteerde PR-head en mergecommit zijn success. Geen zware testrun herhaald na documentatie-only wijzigingen.

## Historische PR #28-checkpoints
Onderstaande secties bewaren de eerdere test- en feedbackresultaten. Hun oude “nog niet geaccepteerd”-stoppunten beschrijven de toestand van destijds; het actuele releasecheckpoint staat bovenaan.

## Historische vervolgscope — PR #28 functionele prijs-/verpakkingsfix
- Branch `feature/ingredient-quantity-controls`, bestaande Draft PR **#28**. De functionele fix hervatte vanaf gecontroleerde remote `2789063240adf3ed1b4cbbdb191253b1cdc95c97`; alle 35 PR-bestanden kwamen overeen.
- Eerdere fysieke iPhone-Preview was afgekeurd. Nu functionele codefix: centrale positieve-prijsregel vervangt conflicterende freshness-gates in −/+, Vrije keuze, eigen recepten, matching en bevestiging.
- **Vaste productregel:** Gebruik de nieuwste betrouwbare positieve prijs. Als die niet beschikbaar is, gebruik de laatst bekende betrouwbare positieve catalogusprijs als fallback. Zodra een nieuwere geldige prijs beschikbaar komt, wordt die automatisch actief.
- Oudere prijs blijft herkenbaar als laatst bekend. Geen €0, verzonnen prijzen, vervalste datums of geforceerde matches.
- −/+ verandert 1 verpakking (1–99); recepthoeveelheid = verpakkingen × betrouwbare inhoud. Bestaande opslag, budgetpoort en lijstbescherming blijven leidend.
- Automatische prijscontrole bij openen/hervatten/focus/netwerkherstel en iedere minuut zichtbaar gebruik; gerichte productafhankelijke cache-invalidatie. Prijsupdates wijzigen geen gekozen aantallen/producten/recepten of handmatige lijstbijdragen.
- Nieuwe echte DOM-clicktests voor Menu, bestaande Vrije keuze en zoekresultaat → detail → toevoegen; 1→2→1, 400→800→400g, prijs/budget/lijst en heropenen getest. €1,79→€1,99 update behoudt 2 gekozen verpakkingen plus handmatige lijstverpakking.
- Read-only audit van 5.184 producten: **Honig 19 aangeboden / 10 READY / 10 selecteerbaar / 9 resterend**; **Knorr 43 / 23 / 23 / 20**. Varianten, niet unieke SKU's. Resterende exacte datablokkades en softwareherstel: `docs/pr28-functional-fix-2026-09-24.md`.
- Personen **1/2/4/6/10/12** × dagen **1/3/5/7**: volledige servicematrix geslaagd voor normaal recept, alle aangeboden Honig/Knorr-varianten en gekoppeld eigen recept. Weeklengte verandert geen individuele selecteerbaarheid.
- Planner **4p / 5d / €100 / €70**: geldige gemengde week voor **€39,44**, met harde budgetpoort. €70 is dus niet principieel onvoldoende. Afzonderlijke onvoldoende-budgetfixture wordt veilig afgewezen.
- Reguliere importerfixtures: **189/189** en seed/syntaxchecks groen. **608/608 webtests**, lint, TypeScript en lokale Production-build groen.
- Preview-writebeveiliging: de publieke readiness-refreshroute schrijft niet naar de gedeelde database wanneer VERCEL_ENV=preview; lokale/cold readiness blijft werken. Geen Production-databaseactie, import of migratie uitgevoerd.

## Vorig checkpoint — fysieke iPhone-test inmiddels afgekeurd
De eerder geteste recept→lijst-flow werkte, maar lijst→recept ontbrak. Onderstaande eerdere resultaten blijven historische regressiebewijzen; zij vormen geen acceptatie van de huidige opdracht.
- Functionele codecommit: `4f8d4d9edc872d82e099ee71e555c168b8189d2a`, remote opnieuw gecontroleerd na Work-time-out. Bestaande branch en Draft PR #28 behouden. De aansluitende checkpointcommit bevat alleen documentatie; de actuele remote PR-head is de exacte referentie voor hervatten.
- Vercel Preview-check op de codecommit: **success**. Echte browserclicks in Menu én Vrije keuze geslaagd: 1→2→1, 400→800→400g, ingrediënt-/gerecht-/persoonprijs, budget en lijst.
- Reload en navigeren behouden keuzes. Handmatige extra courgette blijft behouden bij receptvermindering en plannerrefresh. Oudere positieve ingrediëntprijs is daadwerkelijk bedienbaar.
- Honig 19/10 selecteerbaar en Knorr 43/23 selecteerbaar ook in de Preview-zoeklijsten bevestigd; beide merken toegevoegd en aangepast.
- Live planner **4p/5d/€100/€70: €37,01** voor vijf geldige maaltijden. De auditfixture €39,44 blijft een afzonderlijke geldige combinatie. Uitkomst **B**; harde budgetpoort blijft intact.
- Aanvullend in Preview **2p/7d**: 4 vrije plekken, 2 gekozen mixen behouden; Honig houdt 2 expliciete verpakkingen / 800g. Maaltijden €39,76, lijst €40,55 met handmatige extra courgette. Volledige servicematrix: 1/2/4/6/10/12 × 1/3/5/7 groen.
- **608/608 webtests, 189/189 importerfixtures, lint, TypeScript en lokale Production-build groen.** Na deze codecommit zijn alleen documentatieresultaten toegevoegd, geen ongeteste codewijziging.
- Nieuwe prijs €1,79→€1,99 en behoud van aantallen zijn met fixtures getest; geen live prijs gewijzigd. Automatisch bij openen/hervatten/focus/netwerkherstel en iedere minuut zichtbaar gebruik.
- Work-browser ondersteunt geen telefoonviewport; beschikbare functionele desktopbrowsercontrole uitgevoerd. Fysieke iPhone-touch/layout/PWA-hervatten volgen nu, nog niet als geslaagd beschouwd.
- Volledige bewijzen en resterende datablokkades: `docs/pr28-functional-fix-2026-09-24.md` en `docs/pr28-validation-2026-09-24.json`.

Branch-Preview: https://boodschappenmaatje-pwa-git-feature-in-b0c398-dennisverkaik-4661.vercel.app

## Historische herstelscope — recept ⇄ lijst
- Nieuwe fysieke iPhone-feedback: Preview **niet geaccepteerd**. Hervat vanaf remote `34666ad7d6b92e684fd4772b3a6f1cc36aa93ce9`, dezelfde branch/Draft PR #28.
- Oorzaak: lijst-plus verhoogde altijd de losse bijdrage; lijst-min kon de geaggregeerde weekbijdrage verlagen zonder receptmutatie. Exacte ingrediëntadressen ontbraken.
- Canonieke verpakkingskeuze blijft in het geplande ingrediënt. Lijstbijdragen bewaren week/dag/recept/ingrediënt/product/SKU-adressen en worden uit diezelfde keuze afgeleid. Geen tweede zelfstandig bewerkbare recepthoeveelheid in de lijst.
- Eén gedeelde mutatie- en budgetroute voor beide UI's. Bij één receptbijdrage werkt lijst −/+ direct. Bij meerdere herkomsten kiest de gebruiker de receptbijdrage of het losse deel. “Losse verpakking toevoegen” maakt alleen een onafhankelijke bijdrage.
- Minimum 1 voor receptbijdragen; verwijderen geeft uitleg en verwijzing naar Menu. Manual-only items blijven normaal bedienbaar en verwijderbaar. Gedeelde automatische verpakkingsberekening blijft intact.
- Geplande receptingrediënten en hun boodschappenlijstbijdragen zijn tweerichtings gekoppeld. Een expliciete verpakkingswijziging vanuit recept of lijst synchroniseert naar de andere kant, terwijl onafhankelijke handmatige bijdragen beschermd blijven.
- Tests: nieuwe echte lijstflow-interacties, 400→800→400g, normale/eigen/mixrecepten, twee recepten, manual-extra, minimum/verwijderen, heropenen, personenwijziging, budgetannulering en automatische €1,79→€1,99. **630/630 webtests, 189/189 importerfixtures, lint, TypeScript en Production-build groen.** De 24-cellenmatrix en plannerfixture (€39,44 binnen €70) zijn opnieuw geslaagd.
- Functionele codecommit: `c4a0a2f50c959b23b589c94c027f15921b8e2e2a`; Vercel Preview **success / Ready**. De tussentijdse roadmapcommit `020b5d5d` is behouden. De aansluitende checkpointcommit wijzigt alleen documentatie; controleer remote voor de actuele PR-head.
- Echte Preview A–C: recept→lijst 1→2; lijst→recept 2→1→2. Italiaanse roerbakmix 400→800→400g, gerecht €13,06↔€14,95, lijst €38,66↔€40,55 en maaltijdbudget bewegen mee.
- Preview D: losse verpakking toegevoegd; lijst 3 = Honig 2 + los 1. Recept naar 1 geeft lijst 2; gericht terug naar 2 geeft lijst 3. Algemene lijstknoppen openen bij gemengde herkomst alleen de keuze. De losse extra blijft 1.
- Gedeeld product in Preview: spinazie dag 2 naar 2 verpakkingen / 1.600g; dag 4 blijft 1 verpakking met zijn oorspronkelijke 300g. Geen ander recept aangepast. Bestaande gezamenlijke automatische aankoopberekening blijft behouden.
- Preview E: volledige browserrefresh, navigatie Lijst→Menu→Vrije keuze en heropenen behouden Honig 2 / 800g, de losse extra 1 en afzonderlijke spinaziekeuzes. Prullenbak verwijdert geen gekoppeld ingrediënt; uitleg verschijnt en lijst blijft gelijk.
- Work-browser biedt geen telefoonviewport; functionele desktopbrowsercontrole voltooid. Fysieke iPhone-touch/layout/PWA-hervatten zijn nog te accepteren.
- Geen databasewijziging of migratie nodig: optionele adresmetadata in het bestaande lokale lijstformaat; oudere lijsten worden veilig vanuit hun bekende week gekoppeld.
- Uitgebreid verslag: `docs/pr28-bidirectional-sync.md`.

Deze functionele hertest is opgevolgd door onderstaande feedback over de compacte lijst. Nog geen fysieke acceptatie van PR #28.

## Historische vervolgscope — compacte boodschappenlijst
- Hervat vanaf gecontroleerde remote `3609823c70bc010a4134483a81aed368e2b73467`; dezelfde branch en Draft PR #28. Bestaande bidirectionele implementatie en roadmap behouden.
- Fysieke feedback: lijst te hoog/ruim. De goedgekeurde conceptafbeelding bepaalt de presentatie: compacte categorieblokken en productregels, details op aanvraag, subtiele menu/eigen-recept/los-iconen.
- Bestaande ShoppingListItemCard en LinkedShoppingListItem aangepast; gedeelde ShoppingListQuantity-presentatie, ShoppingListDetails en ShoppingListOrigins toegevoegd. Geen nieuwe hoeveelheid- of contribution-state; beide UI's blijven dezelfde bestaande usePackageMutation-route gebruiken.
- Rij toont checkbox, kleine foto, naam, inhoud/prijs, herkomstsamenvatting en −/+. Herkomstkeuze, losse verpakking, prijsdatum, volledige productinformatie en veilige verwijderactie staan in het detailpaneel.
- Alles/Maaltijden/Overig filteren alleen de weergave; gemengde items kunnen in beide herkomstfilters voorkomen. Nog te halen/Afgevinkt blijft als compacte keuzelijst behouden. Categorieën houden hun echte catalogusnamen en krijgen een teller.
- Menu gebruikt het bestaande maaltijdicoon; eigen recept de koksmuts, uitsluitend op basis van de gekoppelde customDish; losse bijdrage plus/groen. Suggestie en recurring houden hun bestaande herkomst. Geen afleiding uit naam of SKU.
- Functionele code `794d250f2b5dce774f6bf7bb23b3add797092882` (eerste compacte commit `1fcc3086`), Vercel **success / Ready**. Aansluitende checkpointcommit bevat alleen documentatie; actuele remote head controleren bij hervatten.
- Preview-meting: normale regels **100–101px** tegenover **227,9px** voorheen, circa **56% lager**. Vier volledige producten + een vijfde deels zichtbaar met categoriekoppen in de eerste desktopweergave. Vijf aaneengesloten regels circa 505px; bij lange namen meer. Ook smalle 500×856-weergave gecontroleerd: geen horizontale overflow, 44×44px bediening. Fysieke iPhone-layout/touch blijft te accepteren.
- Echte Preview: lijst-min Honig 2→1 geeft 800→400g/€14,95→€13,06; recept-plus geeft lijst weer 2. Los toevoegen en gerichte receptwijziging behouden los 1. Meerdere spinaziebijdragen blijven per gerecht gescheiden.
- Eigen recept via bestaande editor toegevoegd met Broccoli 400g à €2,29: koksmuts/Eigen recept in rij en detail. Lijst-plus geeft 800g/€4,58 in Menu; min vanuit Vrije keuze geeft lijst 1/400g/€2,29.
- Herkomstfilters, afvinken, veilige verwijderuitleg, volledige refresh, sluiten/heropenen en Menu↔Lijst↔Vrije keuze geslaagd. Eindbudget: maaltijden €41,11 + losse bijdragen €2,68 = lijst €43,79.
- **636/636 webtests, 189/189 importerfixtures, lint, TypeScript en Production-build groen.** Volledige bestaande PR #28-suite behouden, aangevuld met detail-/herkomst-/filter-/opslaginteracties. Bewijzen: `docs/pr28-compact-list.md`.
- Geen databasewijziging, migratie of productimport.

**Stoppunt: KLAAR VOOR FYSIEKE IPHONE-HERTEST. Compacte Preview nog niet fysiek geaccepteerd; Draft PR #28 blijft open.**

## Volgende stap — iPhone-feedbackronde bewaren voor 25 september 2026
De compacte Preview van PR #28 is nog niet fysiek geaccepteerd. Volgende ontwikkelronde verwerkt vier expliciete punten uit de iPhone-test:
1. **Meer alternatieven / Zelf zoeken:** duidelijk herkenbare compacte knoppen met goede touch states.
2. **Generieke ingrediëntvervanging:** bij inhoudelijk andere productvervanging moet de actuele ingrediëntnaam overal logisch mee veranderen (voorbeeld kipfilet → boomstammetjes), inclusief recept, lijst, prijs/budget en persistence.
3. **Alle lijstcategorieën inklapbaar:** onafhankelijk in-/uitklappen met teller en chevron; puur presentatie, zonder data/state-mutatie.
4. **Hard maaltijdbudget voor automatische planner:** automatisch geplande maaltijden blijven altijd binnen het ingestelde maaltijdbudget. De planner zoekt actief naar goedkopere geldige combinaties; een onhaalbaar budget mag geen dood “geen resultaten”-scherm opleveren maar toont het goedkoopste haalbare resultaat en bruikbare vervolgstappen. Alleen expliciete handmatige keuze mag via bestaande bevestigde override boven budget.

Behoud alle PR #28-fundamenten: compacte lijst, recept ⇄ lijst-sync, manual contributions, nieuwste-prijs/fallbackregel, personen/dagen, Honig/Knorr-readiness en bestaande harde betrouwbaarheidseisen. Volgende run hervat dezelfde branch/Draft PR, voert regressies + Preview uit en stopt opnieuw bij **KLAAR VOOR FYSIEKE IPHONE-HERTEST**. Geen merge/Production/import/migratie zonder aparte toestemming.

## Release-regels
- Bestaande featurebranch → tests → Preview → fysieke iPhone-test → expliciete toestemming → merge → Production → smoke test.
- PR #28 is na expliciete fysieke acceptatie en toestemming gemerged en automatisch uitgerold. Database-migratie, destructieve actie en productimport zijn niet uitgevoerd.
- Behoud werkende functionaliteit en gebruikersdata.

## Historische iPhone-feedbackronde — 25 september 2026
- Hervat vanaf gecontroleerde remote `7faf0ffdfc28c136360b94a8fe75b0b5e2313cf3`; dezelfde featurebranch en Draft PR #28. Remote documentatiecommit met de vier feedbackpunten behouden; lokale uitgangsboom exact `9576a229eba845793b9f982f55d679556b6e75ce`.
- Meer alternatieven/Zelf zoeken zijn nu herkenbare compacte 44px-knoppen met bestaande huisstijltokens en touch/focus/disabled-states.
- Vervangingsfout hersteld in de centrale producttoepassing: actuele ingrediëntnaam volgt expliciet gekozen product; oorspronkelijke receptdefinitie/ingrediënt-ID blijft behouden. Heropenen past dezelfde route toe, ook voor expliciet bevestigde alternatieven. Verschillende dagbijdragen worden niet samengevoegd op alleen hetzelfde vervangende product.
- Alle categorieën onafhankelijk inklapbaar, teller/chevron, optionele lokale opslag; uitsluitend presentatie. Bestaande compacte rijen, herkomst, details en tweerichtingssync behouden.
- Budgetoorzaak: behouden expliciete gerechten werden pas na de automatische zoekactie bijgeteld; categorie wijzigen controleerde alleen de losse dag en synchroniseerde daarna zonder harde eindcontrole. Beide routes evalueren nu de volledige combinatie inclusief behouden keuzes en gezamenlijk te kopen verpakkingen. Automatische sync accepteert geen handmatige budgetoverride als vrijbrief.
- Het ingestelde maaltijdbudget is een harde grens voor automatische weekplanning. De planner zoekt actief naar een volledige geldige combinatie binnen deze grens. Alleen een expliciete handmatige gebruikerskeuze mag via de bestaande bevestigde override boven budget gaan.
- Mislukte planning schrijft de bestaande opgeslagen week niet leeg en wijzigt de lijst niet. Herstel toont minimum/goedkoopste gevonden combinatie met juiste zekerheid, instellingen en handmatige keuzes. Lege dagen zijn expliciet om te zetten naar Vrije keuze; bestaande maaltijden blijven staan.
- Tests: drie echte vervangingsflows (kipfilet→boomstammetjes, spaghetti→rijst, melk→havermelk), foto/hoeveelheid/prijzen/lijst/heropenen/terugsync; vier onafhankelijke categorieën met filters/afvinken/opslag; €70,00/€70,01, behouden €60 + gevonden €10, onhaalbaar €70,01; 24 personen/dagen-combinaties; bestaande week/lijst behouden en expliciete handmatige override via herstelroute.
- Eindregressie: **676/676 webtests, 189/189 importerfixtures, lint, TypeScript en Production-build groen**. Inclusief defensieve controle op onvolledige behouden gerechten en onderstaande matchcorrectie.
- Preview-publicatie en echte browsercontrole zijn afgerond; zie het definitieve checkpoint hieronder. Geen merge, Production-deployment, databasewijziging, migratie of import.

- Preview vond een bestaande onbetrouwbare automatische match: Bonbébé maaltijd bij gewone zoete aardappel. De bestaande babyvoedingbescherming is uitgebreid naar alle automatische recepten op basis van cataloguscategorie (verse “baby spinazie” blijft geldig); matcher/readinessversies verhoogd zodat oude caches geen vrijbrief blijven. Geen catalogusdata gewijzigd of vervangende SKU geforceerd. Codecommit `93d0e8a6dc9e3b0dd5835dd3bb20d1deea00d658`, opvolger van de vierpuntsfix `9dea73ae`.

- Aanvullende code `450bde1133b64eb710a6009bf3e955036b04c010`: voorbereiding van budgetherpogingen behoudt ook expliciete normale receptkeuzes; productwissel wist oude alternatiefpresentatie. Vercel success; volledige check 674 tests/lint/TypeScript/build groen. Live drie vervangingen en beide syncrichtingen met losse bijdrage gecontroleerd; goedkopere en onhaalbare budgetscenario’s daarna afgerond; zie hieronder.


## Definitief checkpoint iPhone-feedbackronde — 25 september 2026
- **KLAAR VOOR FYSIEKE IPHONE-HERTEST.** De Preview is nog niet fysiek geaccepteerd; Draft PR #28 blijft open op `feature/ingredient-quantity-controls`.
- Laatste functionele code: `d4b29d153da6ee475c6e0378b26b07a56e6bb85b`; Vercel **success / Ready**. Aansluitende checkpointcommit bevat alleen documentatie; actuele remote PR-head blijft technische bron van waarheid.
- Vier feedbackpunten functioneel voltooid: compacte herkenbare alternatieven/zoekknoppen, generieke consumentennaam bij vervanging, alle categorieën onafhankelijk inklapbaar, harde automatische maaltijdbudgetpoort met goedkopere selectie en bruikbaar herstel.
- Live vervangingen: kipfilet→boomstammetjes (200g/€2,49), basmatirijst→couscous (275g/€1,35), maïs→broccoli (400g/€2,29). Naam, foto, inhoud, prijs, lijst, budget en reload gecontroleerd; oude alternatiefpresentatie vervalt bij productwissel.
- Beide syncrichtingen: broccoli lijstbijdrage 1→2 geeft 400→800g; recept-min geeft lijstbijdrage terug 1/400g. Losse bijdrage blijft steeds 1. Meerdere pennebijdragen openen alleen herkomstkeuze; algemene plus wijzigt geen willekeurig gerecht. Filters/afvinken/categorieën en navigatie behouden gegevens.
- Werkelijke 4p/5d/€100/€70-week: vijf geldige maaltijden €35,58. Met expliciete vervangingen €34,47. Budget bewust naar €30: planner vindt **€25,97**, lijst **€28,26** inclusief losse €2,29; expliciete productkeuzes blijven behouden. Dagen kunnen volgens dezelfde categorie opnieuw verdeeld worden; bijdragen worden exact meeverplaatst.
- Budget bewust naar €1: geen automatische commit/overschrijding. Bestaande vijf gerechten €25,97 en lijst €28,26 blijven staan. Herstel noemt €19,85 als goedkoopste **gevonden** complete combinatie, met juiste onzekerheid en werkende instellingen/handmatige aanpassing. Bij gevulde week leidt handmatig aanpassen naar Menu; lege plekken blijven via Vrije keuze invulbaar.
- Handmatige budgetpreview telt nu exact dezelfde bijdragen als lijstsync: €28,46 maaltijden + €2,29 los = €30,75 week. Nieuw regressiegeval weigert een wijziging die uitsluitend door een losse extra boven het weekbudget komt zonder expliciete bevestiging.
- **676/676 webtests (57 bestanden), 189/189 importerfixtures, lint, TypeScript en Production-build groen.** Inclusief €70,00/€70,01, goedkopere tweede combinatie, objectief onhaalbare fixture, 24 personen/dagen-combinaties, prijsfallback/verversing, Honig/Knorr, sync/origins/manual extras en PWA.
- PROJECT_STATE, ROADMAP en DESIGN bijgewerkt. Gedetailleerd bewijs en iPhone-checklist: `docs/pr28-iphone-feedback-2026-09-25.md`.
- Work-browsercontrole uitgevoerd in beschikbare desktopweergave, zonder telefoonviewport. Fysieke iPhone-touch/layout/PWA-hervatten blijven te accepteren. Cold plannercontrole in Work kan merkbaar wachten op catalogus/readiness; geen prestatiebenchmark geclaimd.
- Geen merge, Production-deployment, databasewijziging, migratie of productimport.

- Slotcontrole: Toch gebruiken past de handmatige wijziging pas na bevestiging toe: boomstammetjes 2 verpakkingen/400g, maaltijdentotaal €28,46 en lijst €30,75 inclusief los €2,29. Testbudget daarna terug naar €70 bij 4 personen/5 dagen/€100.
- Periodieke cataloguscontrole zonder gewijzigde product-/prijsgegevens behoudt nu lijst- en itemidentiteit. Geen vals conflict tijdens een lopende bevestiging door uitsluitend een nieuw controletijdstip. Echte prijswijziging behoudt de veilige herbevestigingscontrole. Code `d4b29d15`, regressie expliciet getest; volledige check 676 tests groen.

## Historische laatste iPhone-feedback — prullenmand en handmatig budget
- Hervat vanaf opnieuw gecontroleerde remote `209c716dca3d067f40eb307372641349f488abc8`, dezelfde branch/Draft PR #28. De voorgaande vierpuntsronde blijft behouden; fysieke acceptatie is nog open.
- Lijstbediening bij 1 toont trash op dezelfde 44px-positie; bij >1 min. Manual-only verwijdert via bestaande herstelbare lijstactie. Gekoppeld ingrediënt blijft minimaal 1; trash opent bestaande herkomst/uitleg. Meerdere/gemengde bijdragen blijven exact gescheiden.
- Bestaande verhogingsbevestiging heet nu “Toch verhogen”, meldt beide budgetten afzonderlijk en krijgt focus/scroll zodat zij op mobiel niet buiten beeld blijft.
- Oorzaak verlaging: budgetImpact vroeg bevestiging voor iedere overschreden eindsituatie, ook bij lagere kosten. Handmatige niet-kostenverhogende mutaties vragen nu geen budgetoverride. Een begrensde `userReducedCosts`-snapshot bewaart de nieuwe, lagere kostengrens bij heropenen, zonder toestemming voor latere verhogingen of automatische planning te suggereren.
- Losse verhogingen controleren het weekbudget met dezelfde waarschuwing; losse min/delete blijven direct. Bevestiging controleert of de lijst/prijs/budget nog overeenkomen.
- Functionele code `05f60bd0ea0ee1afca43b1292d362d7049cc6006`, Vercel success; 683/683 webtests (57 bestanden), 189/189 importerfixtures, lint, TypeScript en Production-build groen, inclusief hercontrole van de laatste weergavecorrectie.
- Live Preview: exact budget direct; bevestigde recept- en lijstverhogingen; annuleren zonder hoeveelheidsmutatie; verlagen terwijl nog boven budget; trash bij manual-only/gekoppeld; gemengde en gedeelde bijdragen; afvinken, filters, categorieteller en heropenen. Uitgebreid bewijs en hertestchecklist: `docs/pr28-trash-budget-2026-09-25.md`.
- **KLAAR VOOR FYSIEKE IPHONE-HERTEST** zodra de bijbehorende documentatiehead eveneens Vercel success heeft. Desktopfunctionele controle uitgevoerd; fysieke iPhone-acceptatie blijft open. DESIGN.md niet als geaccepteerd aangepast. Geen merge/Production/databaseactie/import.

## Historische correctie — trash verwijdert direct
- Fysieke iPhone-test afgekeurd: trash bij gekoppeld ingrediënt opende bewust Productdetails. Hervat vanaf remote `6c90f3a0946e750ac7060fb82ef756618fe73ed7`; dezelfde Draft PR #28/branch. Nieuwe Home-mascotte-roadmapnotitie behouden, niet geïmplementeerd.
- Directe centrale verwijderroute: exacte week/dag/recept/ingrediënt/product-koppeling gecontroleerd, expliciete `excludedIngredients`-keuze in de bestaande lokale customization, geen quantity 0 of databasewijziging. De afgeleide recept- en lijstbijdragen worden samen herberekend.
- Manual-only blijft direct verwijderen met bestaande undo. Ambigue/gedeelde totale bijdrage toont geen trash; gerichte bijdrage wel. Trash-event stopt propagation; product/chevron blijft details openen.
- Recept benoemt verwijderde ingrediënten. Uitsluiting blijft bestaan bij opslag, personenwijziging en prijs-/plannerrefresh; originele receptdefinitie behouden. Leeggekocht gerecht is geen automatische gratis READY-maaltijd.
- Functionele code `2589161a9dcf4f47449ff97bb1ade4f7206445eb`; Vercel success/Ready. **687/687 webtests (57 bestanden), 189/189 importerfixtures, lint, TypeScript en Production-build groen.** Directe verwijdering rekent lokaal met bestaande betrouwbare gegevens en gebruikt dezelfde centrale synchronisatie; geen nieuwe cataloguszoekactie nodig voor trash.
- Echte Preview: 2→1→trash verwijdert gekoppelde Boomstammetjes zonder dialoog, lijst €28,26→€25,77; gerecht €2,61, maaltijden €23,48 bij testgrens €20. Gemengde Broccoli: receptdeel weg, los 1 beschermd; daarna afgevinkte losse bijdrage direct verwijderd. Gedeelde penne dag 3 weg, dag 1 blijft 400g/1. Volledige refresh behoudt verwijderingen; product/chevron opent details nog normaal.
- **KLAAR VOOR FYSIEKE IPHONE-HERTEST** na success van het aansluitende documentatiecheckpoint. Beschikbare desktopbrowser gebruikt, geen telefoonviewport; fysieke acceptatie blijft open. Volledige bewijzen: `docs/pr28-direct-trash-2026-09-25.md`. Geen merge/Production/database/migratie/import.

## Release-acceptatie PR #28 — 25 september 2026
- De fysieke iPhone-hertest van de Preview op PR-head `1dbf62538a9cf7717d555726f434ed8e827ed821` is door de gebruiker **geslaagd** verklaard.
- Sinds de geteste functionele commit `2589161a9dcf4f47449ff97bb1ade4f7206445eb` volgde op die head alleen documentatie (`PROJECT_STATE.md`, `ROADMAP.md`, `docs/pr28-direct-trash-2026-09-25.md`).
- De gebruiker heeft expliciet toestemming gegeven voor merge van PR #28 naar `main`, automatische Production-deployment, gerichte Production-smoke test en noodzakelijke releasedocumentatie. Merge en Production-smoke zijn afgerond; het actuele checkpoint staat bovenaan.
