# PR #28 — recept ⇄ lijst

Hervat op 24 september 2026 vanaf remote 34666ad7. De fysieke iPhone-test is afgekeurd; eerdere gereedmelding is geen acceptatie.

## Oorzaak
Lijst-plus maakte altijd een onafhankelijke hoeveelheid aan; lijst-min kon een geaggregeerde weekhoeveelheid verlagen zonder het recept te wijzigen. De lijstbijdrage bevatte uitsluitend week-ID en receptnamen.

## Structurele oplossing
Het geplande ingrediënt en zijn bestaande expliciete packageCount-override blijven canoniek. Een lijstbijdrage bewaart nu adressen met week-ID, dag, recept-ID, ingrediënt-ID, product-ID en SKU. De hoeveelheden in de lijst zijn een berekende projectie van de week; beide UI's sturen via usePackageMutation dezelfde gevalideerde preview/commit/budgetpoort aan. Een actuele lijstgetter en controles op gewijzigde week/lijst beschermen tegen achterhaalde asynchrone mutaties.

De projectie wordt bij heropenen/nieuwe geldige weekgegevens opnieuw afgeleid. Onafhankelijke persistentQuantity en andere weekbijdragen worden behouden. Onvolledige of onbevestigde boven-budgetgegevens mogen de lijst niet overschrijven. Geen databaseactie of schemamigratie; oude lokale lijsten zonder adresmetadata blijven leesbaar en worden alleen vanuit hun werkelijk gekoppelde week opgelost.

## Bediening
- Eén duidelijke receptbijdrage zonder los deel: lijst −/+ wijzigt dat ingrediënt direct.
- Meerdere recepten/ingrediënten of een los deel: totale −/+ opent herkomstkeuze. Per gerecht staan naam, dag en ingrediënt; geen wijziging voordat een bijdrage is gekozen.
- Losse verpakking toevoegen verhoogt uitsluitend het onafhankelijke deel. Voorbeeld: recept 1 + los 1; recept naar 2 geeft lijst 3.
- Receptbijdrage minimum 1. Prullenbak geeft uitleg/route naar Menu, zonder receptingrediënt of gekoppelde lijstbijdrage te verwijderen. Het losse deel mag wel naar 0; manual-only verwijderen en undo blijven werken.
- Automatisch gedeelde verpakkingen blijven via de bestaande gezamenlijke aankoopberekening lopen. Bij gedeelde hoeveelheden wordt dat in de herkomstkeuze uitgelegd.

## Validatie
Gerichte en volledige tests controleren echte Menu/Vrije-keuze/Lijst-componenten met echte providers: beide richtingen 1→2→1 en 400→800→400g; ingrediënt/gerecht/persoon/budget/lijst; opslag/heropenen; gekoppeld eigen recept; Honig en Knorr; manual-only, extra manual en twee recepten; exact adres en afwijzing van een verkeerde dag/recept/product/SKU; minimum/verwijderen; budgetannulering; automatische prijsupdate met behoud van aantallen.

De bestaande auditfixture met 5.184 producten blijft de regressiebron voor de volledige personen-/dagenmatrix en planner. Dit is een herhaalde regressie, geen nieuwe productimport of gemanipuleerde live prijs.

Regressieresultaat: **630/630 webtests, 189/189 importerfixtures, lint, TypeScript en Production-build groen**. Personen 1/2/4/6/10/12 × dagen 1/3/5/7 geslaagd; Honig 10/19, Knorr 23/43 selecteerbaar; planner 4p/5d/€100/€70 opnieuw €39,44.

Preview-bewijzen en definitieve head volgen na de codecommit.
