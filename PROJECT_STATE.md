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

## Actieve vervolgscope — verpakkingen −/+ en plannercontrole
- Bestaande branch: `feature/ingredient-quantity-controls`, Draft PR **#28**. Hervat vanaf remote `4375b5b512191c50155125c48873822ca4a36e2b`; de voorbereidende lokale wijzigingen uit de vorige run zijn afgemaakt.
- −/+ verandert exact één werkelijk te kopen verpakking, minimum 1, maximum 99. Nul zou een nieuwe verwijderfunctie introduceren en wordt niet ondersteund.
- Na een expliciete keuze is het verpakkingsaantal leidend: aantal × betrouwbare huidige productinhoud bepaalt de recepthoeveelheid. Compact detail toont totaal voor recept, verpakkingen en volledige aankoopprijs.
- Ondersteunt betrouwbare gram/ml/stuks-inhoud, bestaande recepten, Honig/Knorr-mixen en eigen recepten. Bij onbekende inhoud geen misleidende bediening; bij ontbrekende actuele prijs geen wijziging of fictieve €0-prijs.
- Bewaart de keuze per dag/recept/ingrediënt met het gekozen product. Bij personen wijzigen blijft het expliciet gekozen verpakkingsaantal vast; niet-aangepaste ingrediënten blijven via de bestaande personenlogica schalen. Oude hoeveelheidsoverrides blijven leesbaar en behouden hun oude verhouding totdat de gebruiker opnieuw −/+ gebruikt.
- Eigen recepten bewaren het aantal in de bestaande ingrediëntrij; afgeleide hoeveelheid volgt dezelfde productinhoud. In een weekgerecht verandert alleen die weekversie. Structurele hoeveelheid-/product-/eenheidwijziging in de eigen-recepteditor vervangt de eerdere pakketkeuze.
- Bestaande commit-, budgetoverride- en lijstsyncflow blijft leidend; losse handmatige lijstbijdragen blijven behouden. Geen nieuw opslagschema of databasewijziging.
- Planner: live reproductie 4 personen / 5 dagen / €100 week / €70 maaltijden vond time-outs bij herhaald rangschikken van cataloguszoekpagina's en een exception bij verschillende eenheden voor hetzelfde ingrediënt. Kandidaten worden nu via één gedeelde, kort bewaarde catalogussnapshot gelezen; verschillende eenheden worden afzonderlijk berekend. Geen budget/readiness/matchingpoort versoepeld.
- Dezelfde gemengde vijfdaagse case slaagt met actuele echte data voor **€41,52**; vijf Hollandse maaltijden **€40,49**, vijf snelle maaltijden **€38,20**. Dit was een technische fout, geen aangetoonde €70-budgetgrens. Zie `docs/ingredient-packages-planner-check.md`.
- Geautomatiseerd: **594/594 webtests**, **189/189 importerfixtures**, seed/syntaxchecks, lint, TypeScript en lokale Production-build groen.
- Implementatiecommits: `e07c15d8` (verpakkingen/planner) en `7d0a78aa` (mixinhoud en opgeslagen recepten).
- Preview `e07c15d8` en `7d0a78aa`: **Ready / success**; live desktopflow geslaagd. Browserplanner-case kostte **€43,80**; zuurkool 3 → 2 → 1 gaf 1.500 → 1.000 → 500 g met correcte prijzen/budgetten; extra handmatige lijstverpakking bleef behouden. Knorr Siam: mix 3 × 300 g = 900 g, kip 2 × 400 g = 800 g en terug 400 g; bewaren/heropenen en Menu/Vrije keuze behouden keuzes.
- Op laatste functionele Preview `7d0a78aa` na volledige refresh: kip 400 g en mix 900 g behouden; mix 3 → 2 geeft 600 g en gerecht €16,83.
- Branch-URL: https://boodschappenmaatje-pwa-git-feature-in-b0c398-dennisverkaik-4661.vercel.app
- Mobiele Preview-gate blijft expliciet open totdat werkelijk op telefoonformaat gecontroleerd. De eerder beschikbare browser ondersteunt geen viewport-resize; een alternatieve mobiele testweergave werd door het browserbeleid geblokkeerd.
- Geen merge, Production-deployment, database-migratie, destructieve databaseactie of productimport.

## Volgende stap
De functionele desktopcontrole is geslaagd. Mobiele Preview-verificatie staat nog open; daarna: **KLAAR VOOR FYSIEKE IPHONE-TEST**. Daarna fysieke iPhone-test en afzonderlijke releasetoestemming; geen merge binnen deze opdracht.

## Release-regels
- Nieuwe ontwikkeling volgt de bestaande featurebranch → tests → Preview → iPhone-test → toestemming → merge → Production-flow.
- Geen merge of Production-actie zonder expliciete toestemming wanneer de opdracht bij Preview/iPhone-test hoort.
- Geen productimport, migratie of destructieve databaseactie buiten een expliciet geautoriseerde opdracht.
- Behoud werkende functionaliteit en gebruikersdata.
