# PR #28 — veilige prullenmand en handmatig budget

## Hervatting en oorzaken
Hervat vanaf remote `209c716d` op dezelfde Draft PR/branch. Geen eerdere implementatie vervangen.

- Bij quantity 1 werd de minknop alleen disabled. De bestaande trash-presentatie bedient nu de bestaande veilige origin-route, zonder extra hoogte: manual-only verwijderen met undo, gekoppeld minimum 1 met herkomst/uitleg, afzonderlijke losse bijdrage verwijderen zonder receptmutatie.
- De bestaande budgetbevestiging bleef soms buiten beeld; tijdens wachten op toestemming stonden de knoppen disabled. De waarschuwing krijgt nu focus/scroll en heet expliciet “Toch verhogen”. Annuleren bewaart alle state. De receptweergave blijft de bevestigde hoeveelheid tonen; de waarschuwing toont uitsluitend de voorgestelde bedragen.
- `budgetImpact` beoordeelde alleen de overschreden eindsituatie. Ook een verlaging boven budget vroeg daardoor toestemming. Een handmatige mutatie die maaltijd- én weekkosten niet verhoogt vraagt geen override. Een begrensde `userReducedCosts`-beslissing bewaart de lagere kostensnapshot en exacte mutatie bij heropenen. Dit is geen toestemming voor nieuwe verhogingen; een nieuwe prijsstijging buiten die grenzen vereist hercontrole.
- Losse verhogingen gebruiken de bestaande contribution-mutatie met voorafgaande weekbudgetcontrole en dezelfde waarschuwing. Losse min/delete blijven direct. Bij gewijzigde lijst/prijs/budget tussen waarschuwing en bevestiging wordt opnieuw gecontroleerd.
- Automatische planning gebruikt ongewijzigd de harde centgrens, met alle behouden keuzes in de volledige combinatie. Handmatige beslissingen geven nooit automatische toestemming boven budget.

## Validatie
- 683 webtests in 57 bestanden; 189 importerfixtures; lint, TypeScript en lokale Production-build groen. De volledige webcheck is opnieuw groen op functionele code `05f60bd0`, inclusief de aanvullende weergavecorrectie.
- Echte DOM-interacties in Menu, bestaande Vrije keuze en Lijst: + binnen/exact budget, één cent erboven, annuleren, twee bevestigde verhogingen, verlagen terwijl maaltijd- én weekbudget nog overschreden zijn, heropenen en exacte recept/lijst/losse verdeling.
- Manual-only afgevinkt item: 2→1→trash, filters, totaal en heropenen; geen ghost item. Gekoppeld trash maakt nooit ingredient 0. Meerdere recepten en gemengde bijdragen blijven gescheiden.
- Expliciete servicecontrole: bewaarde kostenverlaging laat geen nieuwe prijsstijging door en geeft automatische planning geen toestemming boven budget. Bestaande €70,00/€70,01 en goedkopere-combinatietests blijven groen.
- Bestaande Honig/Knorr, 24 personen/dagen-combinaties, prijsfallback/verversing, vervangingsnamen, categorieën, PWA, eigen recepten en bidirectionele regressies behouden.

## Preview
Functionele code `05f60bd0ea0ee1afca43b1292d362d7049cc6006` heeft Vercel success. Getest op de bestaande PR-Preview; beschikbare desktopbrowser, geen fysieke iPhone of telefoonviewport.
- 4 personen/5 dagen, week €100, testmaaltijdgrens €30,95. Boomstammetjes 2→3 geeft 400→600g, gerecht €7,59→€10,08 en maaltijden €28,46→€30,95 zonder waarschuwing. Lijst €30,75→€33,24 inclusief beschermde losse broccoli €2,29.
- Volgende + meldt maaltijden €33,44 en week €35,73, €2,49 boven maaltijdbudget. Annuleren houdt 3 verpakkingen/600g. Toch verhogen is vervolgens expliciet uitgevoerd; lijst 4 en overschrijding eerlijk zichtbaar.
- Vanuit Lijst 4→5: waarschuwing maaltijden €35,93/week €38,22; expliciete bevestiging geeft 5 verpakkingen. Verlagen 5→4 zonder bevestiging geeft lijst €35,73 en maaltijd €33,44, nog steeds boven de grens €30,95. Menu toont dezelfde 4 verpakkingen/800g, gerecht €12,57 en €3,14 per persoon.
- Gekoppelde Uien bij 1: trash geeft minimum-/herkomstuitleg en maakt geen ingredient 0. Penne uit twee gerechten: min opent beide afzonderlijke bijdragen en kiest niet stil een gerecht.
- Gemengde Broccoli: gerichte losse verwijdering verlaagt lijst €35,73→€33,44 en behoudt recept 1×400g. Losse extra weer toegevoegd: recept 1 + los 1 = totaal 2, lijst terug €35,73.
- Tijdelijk manual-only Komkommer (€0,69): 1→2 toont min; 2→1 toont trash. Afgevinkt, Overig + Afgevinkt-filter, categorie dicht/open: status behouden. Trash verwijdert zonder budgetwaarschuwing, ook boven maaltijdbudget; teller 17→16, lijst €36,42→€35,73, herstelactie beschikbaar. Alleen dit tijdelijke testproduct verwijderd.
- Nieuwste Preview: voorgestelde 4→5 houdt vóór toestemming het recept op 4/800g/€12,57; alleen de waarschuwing toont de projectie. Annuleren verandert niets. Recept-min 4→3 wordt vervolgens zonder bevestiging opgeslagen.

## iPhone-hertest
1. Los product 2→1: min wordt trash; vink af en verwijder. Controleer teller/totaal, herstelactie en heropenen.
2. Gekoppeld product bij 1: trash geeft veilige uitleg, geen hoeveelheid 0. Bij gemengde/gedeelde producten eerst de juiste herkomst kiezen.
3. Recept+ en lijst+: binnen/exact budget direct; boven budget eerst Annuleren, daarna opnieuw en Toch verhogen. Controleer hoeveelheid, recept, lijst en beide budgetten.
4. Terwijl boven budget: min zonder waarschuwing; losse bijdrage verwijderen zonder budgetblokkade. Heropen Menu/Lijst/Vrije keuze en ververs.
5. Automatische planning 4p/5d/€100/€70 blijft binnen €70; fysieke touch/layout/PWA-hervatten beoordelen.

Geen merge, Production-deployment, databasewijziging/migratie of productimport. Fysieke iPhone-acceptatie blijft afzonderlijk vereist.
