# PR #28 — prullenmand verwijdert direct

## Hervatting en oorzaak
Remote `6c90f3a0946e750ac7060fb82ef756618fe73ed7`, dezelfde featurebranch/Draft PR. De extra roadmapnotitie over Home-mascotte Optie 2 is behouden; geen brandingwerk uitgevoerd.

De gekoppelde `remove()`-handler opende expliciet Productdetails en de minimum-1-uitleg. De trash-knop was daardoor geen echte verwijderactie. De productknop was al afzonderlijk; dit was geen uitsluitend event-bubblingprobleem.

## Oplossing
- Eén eenduidige gekoppelde bijdrage: centrale `removeLinkedIngredientContribution`, met verificatie van week/dag/recept/ingrediënt/product/SKU. Geen selectie op alleen SKU.
- Optionele `excludedIngredients` in de bestaande geplande customization. Geen quantity 0, wijziging van de originele receptdefinitie of database-migratie. Uitsluiting wordt bij normale revalidatie opnieuw toegepast en in het recept benoemd.
- Afgeleide verpakkingen en bedragen lopen via dezelfde quantity-/budgethelpers en bestaande `syncValidatedCustomization`. Verwijderen gebruikt de al bekende betrouwbare prijzen en hoeft niet op een nieuwe cataloguszoekactie te wachten. Er wordt geen prijs gemaakt of op €0 gezet.
- Manual-only gebruikt de bestaande directe lijstverwijdering met undo. Recept + manual houdt beide bijdragen gescheiden. Meerdere gedeelde bijdragen hebben geen totale trash; gerichte trash verwijdert uitsluitend de gekozen bijdrage.
- Trash/stepper stopt click-propagation; productnaam/chevron blijft Productdetails openen. Geen extra hoogte of nieuw scherm.
- Verwijderen boven budget vraagt geen override. Begrensde bestaande `userReducedCosts` bewaart de keuze; nieuwe verhogingen vragen ongewijzigd toestemming. Automatische planner blijft hard en accepteert een volledig leeggekocht gerecht niet als gratis geldige maaltijd.

## Tests
- 687/687 webtests in 57 bestanden, 189/189 importerfixtures, lint, TypeScript en Production-build groen.
- Echte DOM-interactie: 2→1→trash; geen dialoog; manual-only, normaal recept, eigen recept, Honig, Knorr; gemengde en gedeelde bijdragen; afvinken/filters/tellers; prijs/maaltijd/week; heropenen en personenwijziging.
- Verwijderen terwijl beide budgetten nog overschreden zijn; verwijderde bijdrage blijft weg na prijsrefresh. Vervalste/verouderde exacte adressen worden afgewezen.
- Volledig verwijderd gerecht blijft een expliciete gebruikersaanpassing, maar kan niet via automatische planning als complete gratis maaltijd worden ingezet.
- Bestaande €70,00/€70,01, budgetoverride, goedkopere plannercombinaties, 24 personen/dagen, prijsfallback, vervangingen, PWA en lijstsync-regressies groen.

## Preview
Functionele code `2589161a9dcf4f47449ff97bb1ade4f7206445eb`, Vercel success/Ready. Beschikbare desktopbrowser; fysieke iPhone-acceptatie nog open.
- 4p/5d/€100, tijdelijk maaltijdbudget €20: Boomstammetjes lijst 2→1, trash verschijnt. Eén trash-click verwijdert direct zonder dialoog (`dialog=0`, productregel=0); lijst €28,26→€25,77 en productteller 16→15.
- Menu toont “Door jou verwijderd uit dit gerecht: Boomstammetjes”, twee resterende ingrediënten, gerecht €2,61 en €0,65 per persoon. Maaltijden €23,48 en €3,48 boven budget; weekruimte €74,23. Geen budgetbevestiging bij verwijderen.
- Gemengde Broccoli 2 = recept 1 + los 1: specifieke recepttrash verwijdert alleen dag 2, behoudt los 1 en verlaagt lijst €25,77→€23,48. Daarna Overig + Afgevinkt: compacte trash verwijdert de resterende losse bijdrage direct, geen dialoog; lijst €21,19, 14 producten, undo beschikbaar.
- Gedeelde penne: totale min opent uitsluitend de herkomstkeuze. Gerichte trash dag 3 verwijdert alleen Penne arrabbiata; Vegetarische pasta dag 1 houdt 400g/1 verpakking. Lijst €21,19→€20,47.
- Volledige browserrefresh: Boomstammetjes en verwijderde Broccoli blijven weg. Productnaam/chevron bij penne opent nog normaal Productdetails en toont uitsluitend de behouden bijdrage van dag 1.
- Testbudget teruggezet naar 4 personen/5 dagen/€100 week/€70 maaltijden. Alleen lokale Preview-testbijdragen verwijderd; geen catalogus- of Production-data. Gewone losse verwijdering heeft undo; geplande uitsluiting bewaart de oorspronkelijke receptdefinitie.

## iPhone-hertest
1. Gekoppeld product 2→1→trash: één tik, meteen weg, geen Productdetails. Open Menu en controleer verwijderde ingrediëntnaam en lagere prijzen.
2. Los product bij 1 verwijderen, ook afgevinkt/onder Overig. Controleer teller, totaal en eventuele undo.
3. Gemengd/gedeeld product: kies de herkomst en verwijder die specifieke bijdrage; overige bijdragen blijven staan.
4. Herhaal boven maaltijdbudget; verwijderen vraagt geen toestemming. Controleer maaltijd- én weekbudget.
5. Refresh/heropen Menu/Lijst/Vrije keuze; geen terugkerende verwijderde bijdrage. Tik product/chevron: details blijven beschikbaar.

Geen merge, Production-deployment, databasewijziging/migratie of productimport.
