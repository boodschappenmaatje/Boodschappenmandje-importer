# PR #28 — veilige prullenmand en handmatig budget

## Hervatting en oorzaken
Hervat vanaf remote `209c716d` op dezelfde Draft PR/branch. Geen eerdere implementatie vervangen.

- Bij quantity 1 werd de minknop alleen disabled. De bestaande trash-presentatie bedient nu de bestaande veilige origin-route, zonder extra hoogte: manual-only verwijderen met undo, gekoppeld minimum 1 met herkomst/uitleg, afzonderlijke losse bijdrage verwijderen zonder receptmutatie.
- De bestaande budgetbevestiging bleef soms buiten beeld; tijdens wachten op toestemming stonden de knoppen disabled. De waarschuwing krijgt nu focus/scroll en heet expliciet “Toch verhogen”. Annuleren bewaart alle state. De receptweergave blijft de bevestigde hoeveelheid tonen; de waarschuwing toont uitsluitend de voorgestelde bedragen.
- `budgetImpact` beoordeelde alleen de overschreden eindsituatie. Ook een verlaging boven budget vroeg daardoor toestemming. Een handmatige mutatie die maaltijd- én weekkosten niet verhoogt vraagt geen override. Een begrensde `userReducedCosts`-beslissing bewaart de lagere kostensnapshot en exacte mutatie bij heropenen. Dit is geen toestemming voor nieuwe verhogingen; een nieuwe prijsstijging buiten die grenzen vereist hercontrole.
- Losse verhogingen gebruiken de bestaande contribution-mutatie met voorafgaande weekbudgetcontrole en dezelfde waarschuwing. Losse min/delete blijven direct. Bij gewijzigde lijst/prijs/budget tussen waarschuwing en bevestiging wordt opnieuw gecontroleerd.
- Automatische planning gebruikt ongewijzigd de harde centgrens, met alle behouden keuzes in de volledige combinatie. Handmatige beslissingen geven nooit automatische toestemming boven budget.

## Validatie
- 683 webtests in 57 bestanden; 189 importerfixtures; lint, TypeScript en lokale Production-build groen op functionele code `897e4c1b`. De kleine aanvullende weergavecorrectie krijgt opnieuw de volledige webcheck.
- Echte DOM-interacties in Menu, bestaande Vrije keuze en Lijst: + binnen/exact budget, één cent erboven, annuleren, twee bevestigde verhogingen, verlagen terwijl maaltijd- én weekbudget nog overschreden zijn, heropenen en exacte recept/lijst/losse verdeling.
- Manual-only afgevinkt item: 2→1→trash, filters, totaal en heropenen; geen ghost item. Gekoppeld trash maakt nooit ingredient 0. Meerdere recepten en gemengde bijdragen blijven gescheiden.
- Expliciete servicecontrole: bewaarde kostenverlaging laat geen nieuwe prijsstijging door en geeft automatische planning geen toestemming boven budget. Bestaande €70,00/€70,01 en goedkopere-combinatietests blijven groen.
- Bestaande Honig/Knorr, 24 personen/dagen-combinaties, prijsfallback/verversing, vervangingsnamen, categorieën, PWA, eigen recepten en bidirectionele regressies behouden.

## Preview
Code `897e4c1b038ef22ab50441acfea498e4f899fd2a` heeft Vercel success. Live controle van deze aanvulling is nog in uitvoering.
- 4 personen/5 dagen, week €100, testmaaltijdgrens €30,95. Boomstammetjes 2→3 geeft 400→600g, gerecht €7,59→€10,08 en maaltijden €28,46→€30,95 zonder waarschuwing. Lijst €30,75→€33,24 inclusief beschermde losse broccoli €2,29.
- Volgende + meldt maaltijden €33,44 en week €35,73, €2,49 boven maaltijdbudget. Annuleren houdt 3 verpakkingen/600g. Toch verhogen is vervolgens expliciet uitgevoerd; lijst 4 en overschrijding eerlijk zichtbaar.

Geen merge, Production-deployment, databasewijziging/migratie of productimport. Fysieke iPhone-acceptatie blijft afzonderlijk vereist.
