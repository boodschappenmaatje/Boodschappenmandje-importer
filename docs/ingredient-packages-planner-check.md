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
592 webtests: pakketstappen/minimum/enkelvoud/meervoud, gram/ml/stuks en onbekende inhoud; directe afgeleide hoeveelheid; hele-verpakkingsprijzen en maaltijd/weekbudget; expliciete commit en budgetoverride; lijstsync met handmatige bijdrage; heropenen; personen wijzigen met vaste pakketkeuze; oude hoeveelheidskeuzes; eigen recepten; Honig/Knorr; plannerrefresh; kandidaatpaginering/deduplicatie/verval/foutafhandeling; vijfdaagse echte-data-case en gescheiden eenheden. Bestaande recept-, matching-, readiness-, PWA-, budget- en lijstsuites blijven groen.

189 importerfixtures, seed/syntaxchecks, lint, TypeScript en Production-build geslaagd. Er is geen productimport uitgevoerd.

## Live Preview
Te verifiëren na publiceren op dezelfde branch. Mobiele verificatie is nog niet geclaimd: de beschikbare browser kon eerder geen telefoonviewport instellen; de alternatieve mobiele testweergave werd door browserbeleid geblokkeerd.
