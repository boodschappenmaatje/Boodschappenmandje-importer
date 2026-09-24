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

## Actieve vervolgscope — ingrediënthoeveelheid −/+
- Branch: `feature/ingredient-quantity-controls`, vanaf remote `main` `5a085205`.
- Compacte bediening bij geschikte ingrediënten in Menu, Vrije keuze en eigen receptdetail.
- Gewenste hoeveelheid wordt apart van daadwerkelijk te kopen verpakkingen getoond; bestaande prijs-, budget-, override- en lijstsyncflow wordt hergebruikt.
- Handmatige hoeveelheden worden per dag/ingrediënt/recept met het bijbehorende personenaantal bewaard. Personen wijzigen schaalt die gekozen verhouding mee. Eigen recepten gebruiken hun bestaande hoeveelheden en portiebasis.
- Een wijziging in het weekgerecht wijzigt alleen dat weekgerecht; in Mijn recepten wordt de opgeslagen receptversie aangepast.
- Bestaande schema-6-opslag blijft leesbaar; geen databasewijziging.
- Preview en mobiele controle: nog te verifiëren vóór het iPhone-checkpoint.

## Volgende stap
Deze vervolgscope afronden tot **KLAAR VOOR FYSIEKE IPHONE-TEST**. Pas na de fysieke test en afzonderlijke releasetoestemming mag deze branch naar main. Daarna resterende eigen-receptverbeteringen prioriteren op basis van gebruikerstesten; zie `ROADMAP.md`.

## Release-regels
- Nieuwe ontwikkeling volgt de bestaande featurebranch → tests → Preview → iPhone-test → toestemming → merge → Production-flow.
- Geen merge of Production-actie zonder expliciete toestemming wanneer de opdracht bij Preview/iPhone-test hoort.
- Geen productimport, migratie of destructieve databaseactie buiten een expliciet geautoriseerde opdracht.
- Behoud werkende functionaliteit en gebruikersdata.
