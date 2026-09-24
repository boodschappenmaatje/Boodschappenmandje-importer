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
- Branch `feature/ingredient-quantity-controls`, bestaande Draft PR **#28**. Deze run hervat vanaf gecontroleerde remote `2789063240adf3ed1b4cbbdb191253b1cdc95c97`; alle 35 PR-bestanden kwamen overeen.
- Eerdere fysieke iPhone-Preview was afgekeurd. Nu functionele codefix: centrale positieve-prijsregel vervangt conflicterende freshness-gates in −/+, Vrije keuze, eigen recepten, matching en bevestiging.
- **Vaste productregel:** NIEUWSTE betrouwbare positieve prijs gebruiken; laatst bekende betrouwbare positieve catalogusprijs als fallback. Zodra een nieuwere geldige prijs beschikbaar is, wordt die automatisch actief.
- Oudere prijs blijft herkenbaar als laatst bekend. Geen €0, verzonnen prijzen, vervalste datums of geforceerde matches.
- −/+ verandert 1 verpakking (1–99); recepthoeveelheid = verpakkingen × betrouwbare inhoud. Bestaande opslag, budgetpoort en lijstbescherming blijven leidend.
- Automatische prijscontrole bij openen/hervatten/focus/netwerkherstel en iedere minuut zichtbaar gebruik; gerichte productafhankelijke cache-invalidatie. Prijsupdates wijzigen geen gekozen aantallen/producten/recepten of handmatige lijstbijdragen.
- Nieuwe echte DOM-clicktests voor Menu, bestaande Vrije keuze en zoekresultaat → detail → toevoegen; 1→2→1, 400→800→400g, prijs/budget/lijst en heropenen getest. €1,79→€1,99 update behoudt 2 gekozen verpakkingen plus handmatige lijstverpakking.
- Read-only audit van 5.184 producten: **Honig 19 aangeboden / 10 READY / 10 selecteerbaar / 9 resterend**; **Knorr 43 / 23 / 23 / 20**. Varianten, niet unieke SKU's. Resterende exacte datablokkades en softwareherstel: `docs/pr28-functional-fix-2026-09-24.md`.
- Personen **1/2/4/6/10/12** × dagen **1/3/5/7**: volledige servicematrix geslaagd voor normaal recept, alle aangeboden Honig/Knorr-varianten en gekoppeld eigen recept. Weeklengte verandert geen individuele selecteerbaarheid.
- Planner **4p / 5d / €100 / €70**: geldige gemengde week voor **€39,44**, met harde budgetpoort. €70 is dus niet principieel onvoldoende. Afzonderlijke onvoldoende-budgetfixture wordt veilig afgewezen.
- Reguliere importerfixtures: **189/189** en seed/syntaxchecks groen. **608/608 webtests**, lint, TypeScript en lokale Production-build groen.
- Preview-writebeveiliging: de publieke readiness-refreshroute schrijft niet naar de gedeelde database wanneer VERCEL_ENV=preview; lokale/cold readiness blijft werken. Geen Production-databaseactie, import of migratie uitgevoerd.

## Actueel stoppunt
**Codefix in verificatie; nog geen nieuwe iPhone-gereedmelding.**
Resterend: definitieve regressies, nieuwe Vercel Preview Ready en functionele browsercontrole. De beschikbare Work-browser heeft geen telefoonviewport; de gebruiker heeft voor deze run expliciet beschikbare browsercontrole toegestaan, met fysieke iPhone-test erna. Geen alternatieve mobiele viewport omzeilen.

Branch-Preview: https://boodschappenmaatje-pwa-git-feature-in-b0c398-dennisverkaik-4661.vercel.app

## Release-regels
- Bestaande featurebranch → tests → Preview → fysieke iPhone-test → expliciete toestemming → merge → Production → smoke test.
- Binnen deze opdracht: **geen merge, Production-deployment, Production-databasewijziging, migratie, destructieve actie of productimport**.
- Behoud werkende functionaliteit en gebruikersdata.
