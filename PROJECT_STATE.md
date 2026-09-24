# BoodschappenMaatje — Project State

> Dit bestand is het actuele technische checkpoint. Controleer bij ontwikkelwerk altijd ook de remote branch en PR; remote Git-status gaat voor verouderde tekst in dit bestand.

## Huidige milestone
**PWA 14 — Eigen recepten / Vrije keuze: afgerond en in Production.**

## Production
- Repository: `boodschappenmaatje/Boodschappenmandje-importer`
- Branch: `main`
- Gemergede PR: **#27**
- Releasecommit: `b233b65910121fe998b4ac913d1999afbef3f20d`
- Vercel Production-check op de releasecommit: **success** (23 september 2026).
- Fysieke iPhone-test: **geslaagd**, met expliciete toestemming voor de release.
- Production-smoke test: **geslaagd** in een schone browsersessie. Een week voor 2 personen en 2 dagen met afzonderlijk week- en maaltijdbudget werd aangemaakt; Vrije keuze toonde 2 plekken. Een eigen recept met een actueel geprijsd product werd bewaard, aan de eerste dag toegevoegd en compact binnen Menu geopend. De boodschappenlijst, het maaltijdtotaal en de budgetruimte toonden dezelfde € 0,48. Producten zonder actuele prijs waren niet selecteerbaar.
- De rooktest gebruikte alleen lokale browsergegevens; geen database-migratie, productimport of destructieve databaseactie.

## PWA 14 geleverd
- eigen recepten maken, bewaren, bekijken en bewerken op dit apparaat;
- echte producten zoeken, prijzen en verpakkingen tonen en hoeveelheden schalen;
- compact receptdetail voor gegenereerde gerechten, mixen en eigen recepten;
- aparte editor, 2×2 acties in Vrije keuze en dynamische weekcapaciteit;
- maaltijd- en weekbudgetvalidatie, expliciete override waar toegestaan;
- lijstsync met bescherming van handmatige gebruikerswijzigingen.

## Laatste geverifieerde regressies
Volgens PR #27: lint en TypeScript geslaagd, 539/539 webtests, 189/189 importerfixtures en lokale Production-build geslaagd. Na deze checks veranderde de code alleen in de weergave van het aantal personen bij een opgeslagen recept; verdere commits tot de merge betroffen documentatie. De actuele Preview-check en Production-check waren groen.

## Actieve vervolgscope — PR #28 functionele prijs-/verpakkingsfix
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

## Actieve herstelscope — recept ⇄ lijst
- Nieuwe fysieke iPhone-feedback: Preview **niet geaccepteerd**. Hervat vanaf remote `34666ad7d6b92e684fd4772b3a6f1cc36aa93ce9`, dezelfde branch/Draft PR #28.
- Oorzaak: lijst-plus verhoogde altijd de losse bijdrage; lijst-min kon de geaggregeerde weekbijdrage verlagen zonder receptmutatie. Exacte ingrediëntadressen ontbraken.
- Canonieke verpakkingskeuze blijft in het geplande ingrediënt. Lijstbijdragen bewaren week/dag/recept/ingrediënt/product/SKU-adressen en worden uit diezelfde keuze afgeleid. Geen tweede zelfstandig bewerkbare recepthoeveelheid in de lijst.
- Eén gedeelde mutatie- en budgetroute voor beide UI's. Bij één receptbijdrage werkt lijst −/+ direct. Bij meerdere herkomsten kiest de gebruiker de receptbijdrage of het losse deel. “Losse verpakking toevoegen” maakt alleen een onafhankelijke bijdrage.
- Minimum 1 voor receptbijdragen; verwijderen geeft uitleg en verwijzing naar Menu. Manual-only items blijven normaal bedienbaar en verwijderbaar. Gedeelde automatische verpakkingsberekening blijft intact.
- Geplande receptingrediënten en hun boodschappenlijstbijdragen zijn tweerichtings gekoppeld. Een expliciete verpakkingswijziging vanuit recept of lijst synchroniseert naar de andere kant, terwijl onafhankelijke handmatige bijdragen beschermd blijven.
- Tests: nieuwe echte lijstflow-interacties, 400→800→400g, normale/eigen/mixrecepten, twee recepten, manual-extra, minimum/verwijderen, heropenen, personenwijziging, budgetannulering en automatische €1,79→€1,99. **630/630 webtests, 189/189 importerfixtures, lint, TypeScript en Production-build groen.** De 24-cellenmatrix en plannerfixture (€39,44 binnen €70) zijn opnieuw geslaagd. Preview-verificatie volgt.
- Geen databasewijziging of migratie nodig: optionele adresmetadata in het bestaande lokale lijstformaat; oudere lijsten worden veilig vanuit hun bekende week gekoppeld.
- Uitgebreid verslag: `docs/pr28-bidirectional-sync.md`.

**Stoppunt: implementatie en regressies afgerond; nieuwe Preview moet nog functioneel worden gecontroleerd. Nog niet klaar voor iPhone-hertest.**

## Release-regels
- Bestaande featurebranch → tests → Preview → fysieke iPhone-test → expliciete toestemming → merge → Production → smoke test.
- Binnen deze opdracht: **geen merge, Production-deployment, Production-databasewijziging, migratie, destructieve actie of productimport**.
- Behoud werkende functionaliteit en gebruikersdata.
