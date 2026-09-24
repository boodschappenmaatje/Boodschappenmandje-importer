# Verpakkingen en vijfdaagse planner — validatie 24 september 2026

## Hervatting
Bestaande Draft PR #28 en branch `feature/ingredient-quantity-controls`, remote basis `4375b5b5`. Voor het hervatten waren 567 webtests en de hoeveelheid-in-g/ml-bediening gepubliceerd. De verpakkingsoverrides en catalogusoptimalisatie stonden alleen lokaal en waren nog niet volledig aangesloten/getest.

## Live planneronderzoek (uitsluitend lezen)
Input: 4 personen, 5 dagen, €100 weekbudget, €70 maaltijdbudget. Omdat de oorspronkelijke categorie-verdeling niet was opgegeven, gereproduceerd met 2 Hollandse, 1 pasta, 1 rijst en 1 snel gerecht. De oude Preview toonde “Gerechten kiezen lukte niet” en behield de bestaande lijst van €18,26.

Het echte Supabase-cataloguspad gaf HTTP 500 / PostgreSQL 57014 (statement timeout) tijdens `search_catalog_products_v2`, o.a. bij rijst, melk, pasta en aardappel. De planner vroeg alle zoekpagina's van twintig producten op, waarbij telkens de catalogus opnieuw gerangschikt werd. Na vervanging door gedeelde gewone catalogusleesbatches kwam een tweede exception aan het licht: `incompatible-ingredient-units` bij weekaggregatie. Hetzelfde ingrediënt kan per recept in verschillende eenheden voorkomen. Die worden nu afzonderlijk gematcht/berekend; de bestaande product-verpakkingsaggregatie bepaalt daarna de koophoeveelheid.

Na beide reparaties, met ongewijzigde budget-/readiness-/matchingregels:

| Verdeling | Uitkomst | Maaltijdtotaal |
|---|---|---:|
| 2 Hollands / 1 pasta / 1 rijst / 1 snel | 5 gerechten, generated, volledig geprijsd | €41,52 |
| 5 Hollands | 5 gerechten, generated, volledig geprijsd | €40,49 |
| 5 snel | 5 gerechten, generated, volledig geprijsd | €38,20 |

Gemengde week: Vegetarische aardappelschotel met courgette; Vegetarische pasta met courgette; Zuurkoolstamppot met rookworst; Gebakken rijst met ei en groente; Couscous met kikkererwten en groente. De controle deed 51 succesvolle leesrequests, geen HTTP-fouten. Geen databasewrites, migratie of import. Dit bewijst een technische fout, geen onmogelijkheid van vijf geldige maaltijden binnen €70. Andere voorkeuren/verdelingen kunnen uiteraard andere uitkomsten geven.

Een opgenomen selectie van echte recepten/producten/prijzen staat in `fixtures/planner-five-days.json`. De offline regressie zet de klok op het opnamemoment en doorloopt de echte generatie met alle poorten. Deze fixture is testdata, geen prijsbron voor de app.

## Regressiedekking
594 webtests: pakketstappen/minimum/enkelvoud/meervoud, gram/ml/stuks en onbekende inhoud; directe afgeleide hoeveelheid; hele-verpakkingsprijzen en maaltijd/weekbudget; expliciete commit en budgetoverride; lijstsync met handmatige bijdrage; heropenen; personen wijzigen met vaste pakketkeuze; oude hoeveelheidskeuzes; eigen recepten; Honig/Knorr; plannerrefresh; kandidaatpaginering/deduplicatie/verval/foutafhandeling; vijfdaagse echte-data-case en gescheiden eenheden. Bestaande recept-, matching-, readiness-, PWA-, budget- en lijstsuites blijven groen.

189 importerfixtures, seed/syntaxchecks, lint, TypeScript en Production-build geslaagd. Er is geen productimport uitgevoerd.

## Live Preview
Implementatie `e07c15d8` is Ready en in de echte Preview-browser gecontroleerd. Vervolgcommit `7d0a78aa` toont ook de echte mixinhoud vóór aanpassen en voegt bewaar-/heropenregressies toe. Ook `7d0a78aa` is Ready; na volledige paginavernieuwing bleven kip 400 g en mix 900 g behouden. Mix 3 → 2 gaf 600 g, €7,98 ingrediëntprijs en €16,83 gerechtprijs. De oude hoeveelheidbesturing is niet opnieuw gebouwd; de bestaande flow is afgemaakt.

- De eerder mislukte browserweek slaagde via “Opnieuw proberen”: 4 personen / 5 dagen / €100 / €70, vijf gerechten, maaltijdkosten **€43,80**, maaltijdbudgetruimte **€26,20**. De concrete gerechten verschillen van de los uitgevoerde diagnostiek doordat de weekselectie ook de bestaande weekcontext gebruikt. Beide geldige uitkomsten liggen ruim onder €70.
- Zuurkool à €0,94 per 500 g: **3 → 2 → 1** verpakkingen gaf direct **1.500 → 1.000 → 500 g**. Gerecht **€7,99 → €7,05 → €6,11**, per persoon **€2,00 → €1,76 → €1,53**, maaltijdbudgetruimte **€25,26 → €26,20 → €27,14**. Minknop uitgeschakeld bij 1.
- Lijst na verhogen: drie zuurkoolverpakkingen. Daarna één extra verpakking handmatig toegevoegd. Recept verlaagd naar één; lijst behield **twee** (één recept + één handmatig). Bestaande extra roerbakgroente bleef eveneens behouden.
- Menu → Vrije keuze → Menu en heropenen behielden **1 verpakking / 500 g**.
- Knorr Siam vanuit Vrije keuze: mix **2 → 3 verpakkingen van 300 g** gaf **900 g**, mixprijs **€11,97**, gerecht **€20,82**, per persoon **€5,21**. Kipfilet **1 → 2 → 1 verpakkingen van ca. 400 g** gaf **800 → 400 g**. Toevoegen en heropenen in Vrije keuze behielden de keuzes.
- Gramflow daadwerkelijk bediend. Eieren en sojasaus waren in de geteste rijstmaaltijd zichtbaar met stuks/ml, maar met laatst bekende/verouderde prijzen: wijzigen werd veilig geweigerd. Ml/stuks en bewaren/heropenen worden daarnaast met actueel geprijsde fixtures door de echte berekeningsflow getest.
- Alle zichtbare −/+ knoppen gemeten op **44 × 44 px**. Geen horizontale overflow in de beschikbare desktopviewport (1363 px).

**Open gate: mobiele Preview-controle.** De beschikbare browser heeft geen viewport-resize of mobiele emulatie. Dit is bij hervatten opnieuw vastgesteld. De eerdere alternatieve mobiele testweergave was door automatische goedkeuringscontrole/browserbeleid geblokkeerd; geen omweg gebruikt. Desktopmetingen vervangen geen telefooncontrole. Daarom nog niet de volledige status “KLAAR VOOR FYSIEKE IPHONE-TEST”.

## iPhone-checklist
1. Open de nieuwste Preview en een actueel geprijsde maaltijdmix, bijvoorbeeld Knorr Siam.
2. Kipfilet van 400 g: 1 → 2 → 3 → 2 → 1; controleer 400 → 800 → 1.200 → 800 → 400 g, prijs en budget.
3. Controleer de lijst. Voeg daar één verpakking handmatig toe; verlaag daarna het recept. De extra lijstverpakking moet blijven staan.
4. Sluit/heropen, wissel Menu/Vrije keuze en vernieuw de pagina; keuzes blijven staan. Wijzig personen: expliciete aantallen blijven vast.
5. Test een betrouwbaar geprijsd ml/stuks-product indien beschikbaar; geen bediening bij onbekende inhoud, geen negatieve/nul-aantallen.
6. Plan 4 personen / 5 dagen / €100 week / €70 maaltijden. Controleer vijf gerechten binnen budget en behoud van handmatige lijstitems.
7. Controleer duimbediening, leesbaarheid en horizontale overflow op de iPhone.
