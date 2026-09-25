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

## Functionele Preview — 24 september 2026

Codecommit `c4a0a2f50c959b23b589c94c027f15921b8e2e2a`, Vercel **success / Ready**. De aansluitende checkpointcommit bevat uitsluitend documentatie. Bestaande branch en Draft PR #28 behouden; de tussentijdse roadmapcommit `020b5d5d` is meegenomen.

Preview: https://boodschappenmaatje-pwa-git-feature-in-b0c398-dennisverkaik-4661.vercel.app

Echte browserinteracties met de bestaande lokale week voor 2 personen / 7 dagen / €100 weekbudget / €70 maaltijdbudget:

| Controle | Waargenomen resultaat |
| --- | --- |
| A — recept→lijst | Honig Italiaanse roerbakmix 1→2 verpakkingen, 400→800g; lijstproduct naar 2. |
| B — lijst→recept omlaag | Lijst 2→1; Menu toont 1 verpakking / 400g. Gerecht €14,95→€13,06; lijst €40,55→€38,66; geplande maaltijden €39,76→€37,87. |
| C — lijst→recept omhoog | Lijst 1→2; Menu 2 verpakkingen / 800g. Gerecht, maaltijd- en lijsttotalen keren terug. |
| D — onafhankelijke extra | Expliciet een losse verpakking toevoegen geeft lijst 3 = Honig 2 + los 1. Recept naar 1 geeft lijst 2; gerichte Honig-plus vanuit de lijst geeft weer 3. Los blijft telkens 1. Algemene plus opent alleen de herkomstkeuze. |
| Meerdere gerechten | Algemene spinazie-plus wijzigt niets en toont dag 2 en dag 4. Gerichte plus voor dag 2 geeft daar 2 verpakkingen / 1.600g. Dag 4 blijft 1 verpakking / oorspronkelijke 300g. Lijst koopt gezamenlijk 3 verpakkingen; gerecht op dag 4 blijft €5,32. |
| E — bewaren/heropenen | Volledige browserrefresh gevolgd door Lijst→Menu→Vrije keuze. Honig blijft 2 / 800g / €14,95, lijstbijdragen Honig 2 + los 1. Beide spinaziekeuzes blijven afzonderlijk behouden. |
| Veilige verwijderactie | Prullenbak bij Italiaanse roerbak toont uitleg over Menu/minimum; totaal 3 en beide bijdragen blijven behouden. |

De bestaande extra courgette van €0,79 bleef gedurende deze controles aanwezig. Na de extra roerbakverpakking en gerichte spinazieverhoging: maaltijden €41,66, lijst €44,34; verschil €2,68 = losse courgette €0,79 + losse roerbak €1,89. Oude positieve prijzen waren zichtbaar als laatst bekend en bedienbaar.

Automatisch vervangen van €1,79 door €1,99 is via regressiefixtures getest, met behoud van twee expliciete verpakkingen en de losse bijdrage. Geen live prijs of database gewijzigd. Personen-/dagenmatrix, assortiment en planner hierboven zijn herhaalde regressies op de bestaande read-only auditfixture; geen nieuwe productimport.

Work-browser ondersteunt geen telefoonviewport. Beschikbare functionele desktopbrowsercontrole geslaagd; touch, mobiele layout en PWA-hervatten blijven de fysieke iPhone-hertest.

**KLAAR VOOR FYSIEKE IPHONE-HERTEST.** Geen merge, Production-deployment, databasewijziging, migratie of import. De Preview is nog niet fysiek geaccepteerd.
