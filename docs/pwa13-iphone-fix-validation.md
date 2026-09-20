# PWA 13 — iPhone-fixronde op Draft PR #25

Werkbranch: `codex/pwa-13-vrije-keuze`. Geen merge naar main of production-deploy.

## Home en gerechtinformatie

Home sloeg image-resolutie over zodra een dag categorie `freeChoice` had. Home, zoekresultaten en het geopende gerecht gebruiken nu dezelfde `recipeImageFor`-resolver en de opgeslagen ingrediëntcontext. `DishImage` vangt een mislukte afbeelding op met de neutrale placeholder. Een eigen gerecht zonder gevalideerde foto krijgt die placeholder. De bestaande burrito-foto met rundvlees wordt voor dit kiprecept afgewezen.

De budgetsamenvatting staat bovenaan de geopende/voorgestelde gerechtcontext. Selecteren verplaatst de focus en scrollpositie naar die samenvatting. De knop **Bekijk ingrediënten** opent dezelfde `DishIngredients`-kaarten als de gewone planner. Die tonen hoeveelheid, product, inhoud, verpakkingen, prijs en afbeelding. Een onbekende prijs blijft expliciet onbekend.

## Gedeelde productselectie en pakketten

`selectIngredientProduct` vergelijkt alle gevonden geschikte kandidaten op `ceil(benodigde hoeveelheid / verpakkingsinhoud) × actuele verpakkingsprijs`. Receptvoorwaarden, exacte product-ID en Honig/Knorr-merkvoorwaarden worden eerst gecontroleerd. Dezelfde functie wordt gebruikt door automatische planning, vervangen, Vrije keuze en automatisch gekoppelde eigen ingrediënten. De cache bewaart de kandidaten zodat een andere hoeveelheid opnieuw het voordeligste pak kan kiezen. Nieuwe kandidaten en gewijzigde prijzen invalideren afhankelijke cachegegevens.

Maaltijdmixen worden afzonderlijk berekend met `ceil(personen / personen per pak)`, nooit met het nettogewicht. De gerichte tests controleren één tot en met tien personen; bij een vierpersoonsmix zijn vier personen één pak en acht personen twee pakken.

De bestaande lijstsync ontvangt dezelfde berekende productkeuzes en hoeveelheden. Bescherming van handmatige wijzigingen en het behoud van gedeelde producten blijven via de bestaande sync- en vervangtests gecontroleerd.

## Knorr burrito's: €23,91 gereproduceerd

Het betreft SKU **704883000**, Knorr Wereldgerechten Mexicaanse burrito's, 228 g. De huidige bron voor deze variant vermeldt maximaal drie personen per pak. Daarom zijn **twee pakken voor vier personen correct**. Dat mag niet worden aangepast naar vier personen omdat een andere variant of een oud recept vier personen noemt.

Bronnen: [exact product bij Hoogvliet](https://www.hoogvliet.com/product/knorr-wereldgerechten-maaltijdpakket-mexicaanse-burrito-s), [228 g en 2–3 personen bij Jumbo](https://www.jumbo.com/producten/knorr-wereldgerechten-burrito-s-mexicaanse-228-g-513261DS), [Knorr-recept met drie porties](https://www.knorr.com/nl/r/mexicaanse-burritos-met-lekker-veel-groente.html/160341).

| Product | Oude berekening, 4 personen | Nieuwe berekening, 4 personen |
|---|---:|---:|
| Champignons | 2 × 250 g à €1,05 = €2,10 | 1 × 400 g à €1,69 = €1,69 |
| Geraspte kaas | 1 × 175 g belegen = €2,09 | 1 × 175 g jong belegen **30+** = €1,91 |
| Hoogvliet kipfilet | 2 × ca. 220 g à €3,97 = €7,94 | 1 × ca. 400 g = €5,99 |
| Knorr burritopakket | 2 × €2,99 = €5,98 | 2 × €2,99 = €5,98 |
| Rode paprika | 3 × €0,85 = €2,55 | 2 × €0,85 = €1,70 |
| Rode uien, net met 3 stuks | 2 × €0,99 = €1,98 | 1 × €0,99 = €0,99 |
| Melkan volle kwark | 1 × 500 g = €1,27 | 1 × 500 g = €1,27 |
| Gele paprika, expliciet in bron | Ontbrak | 2 × €1,15 = €2,30 |
| Olie, expliciet in bron | Ontbrak | 1 × 1 liter Bio+ zonnebloemolie = €2,15 |
| **Totaal** | **€23,91** | **€23,98** |

De oude kipkeuze en het als één ui getelde net maakten de prijs onnodig hoog. De nieuwe broncontrole corrigeert bovendien de kleuren/hoeveelheden paprika en het type kaas. De bestaande regels dalen samen €4,38; de eerder ontbrekende gele paprika en olie voegen €4,45 toe. Het volledige correcte recept is daardoor zeven cent duurder. Dit zijn hele winkelverpakkingen, inclusief overblijvende inhoud; geen fictieve prijs voor alleen het verbruikte deel.

Voor vier personen vraagt de bron: 300 g kip, 333,333 g champignons, 1,333 rode en 1,333 gele paprika, 1,333 ui, 166,667 g kwark, 66,667 g geraspte 30+ kaas en 40 ml olie. De prijs van uitsluitend de gele paprika was verouderd en is op 20 september gericht opnieuw bij Hoogvliet gecontroleerd: nog steeds €1,15. Er is geen brede productimport uitgevoerd.

## Automatische profielverwerking en gecontroleerde backfill

Een database-trigger zet nieuwe/inhoudelijk gewijzigde ondersteunde producten in `meal_mix_profiles`. De onderhoudsjob leest de exacte Hoogvliet-productpagina, controleert URL en productidentiteit en verwerkt uitsluitend de expliciete boodschappenlijst/zelf-toevoegen-informatie. Ontbrekende eenheden, hoeveelheden, porties of bronidentiteit leiden tot `needs_review`; er worden geen ingrediënten verzonnen.

Een gevalideerd profiel wordt op product-ID persistent opgeslagen, het bijbehorende recept wordt idempotent aangemaakt en de cache voor 1–10 personen wordt ververst. Vergelijken van `updated_at` voorkomt publiceren na een gelijktijdige productwijziging. Een onderbroken cacheverversing hervat vanuit het opgeslagen profiel. Gebruikers doen geen live brononderzoek. Een gewijzigd nog niet opnieuw gevalideerd profiel is niet selecteerbaar.

De nieuwe dagelijkse workflow wordt pas door GitHub's scheduler uitgevoerd nadat de workflow op de default branch staat. Deze fixronde houdt zich aan het verbod op mergen: de initiële backfill is gecontroleerd uitgevoerd, de code voor vervolgonderhoud staat in de Draft PR.

Inventaris: **41 unieke catalogusmixen: 19 Honig en 22 Knorr**. Drie exacte varianten hadden al een gevalideerd profiel. De automatische backfill leverde **12 nieuwe volledige bronprofielen** op: **15 totaal, waarvan 6 Honig en 9 Knorr**. Voor **26** ontbreekt nog voldoende betrouwbare broninformatie. Volledig bronprofiel is niet hetzelfde als een volledig bestelbaar gerecht: voor 14 van die 15 ontbreken nog passende aanvullende catalogusproducten of bruikbare eenheden. De Knorr-burrito's zijn volledig geprijsd en selecteerbaar.

## Validatie en iPhone-hertest

Gecontroleerd: 406 webtests, 181 importer-tests, lint, TypeScript en production build geslaagd. Mobiele browserchecks op 375/390/430 pixels controleren kiezen, eigen gerecht, ingrediënten, budgetpositie, opslaan, vervangen, lijstsync, Home-foto na refresh en fallback bij een afbeeldingsfout; geen paginafouten of horizontale overflow. De zware websuite is met één worker en 20 seconden per test uitgevoerd; een eerdere gelijktijdige run raakte bij twee bestaande zware tests de standaardlimiet van vijf seconden.

De database bevat 150 unieke actuele cachevarianten (15 profielen × 10 persoonsaantallen), zonder duplicaten. De leescontrole voor vier personen geeft 15 cache-hits en nul live zoekacties/fallbacks. Een transactie met rollback bewijst invalidatie na wijziging van kandidaatproducten.

De Preview staat in PR #25. Hertest daar na de Ready-status:

1. Kies vier personen en een lege Vrije-keuzedag. Zoek **Knorr burritos** en kies het gerecht.
2. Controleer dat de samenvatting direct zichtbaar is: vier personen, totaal €23,98 op de gecontroleerde prijzen, negen producten en het resterende maaltijdbudget.
3. Open **Bekijk ingrediënten**. Controleer de tabel hierboven, met twee Knorr-pakken en één kipverpakking van ca. 400 g.
4. Sla op, open het gerecht opnieuw en vergelijk de kaarten en boodschappenlijst. Een neutrale burrito-placeholder is hier bewust correct; de beschikbare rundvleesfoto past niet bij dit kiprecept.
5. Kies een gewoon gerecht met een passende foto via Vrije keuze. Controleer dezelfde foto op Home, ververs en heropen de PWA. Controleer ook behoud van gerecht/productkeuzes.
6. Maak een eigen gerecht, controleer de samenvatting, sla op en heropen. Bij ontbreken van een gevalideerde foto moet een nette placeholder verschijnen.
7. Vervang een gerecht terwijl er gedeelde en handmatig gewijzigde lijstproducten zijn. Alleen unieke oude maaltijdproducten mogen verdwijnen.
8. Controleer de burrito's voor drie personen (één pak), vier personen (twee) en acht personen (drie). Vierpersoonsmixen worden afzonderlijk in de geautomatiseerde tests gecontroleerd op één/twee pakken bij vier/acht personen.

Na oplevering wachten we op fysieke iPhone-goedkeuring; niet mergen.

## Details per bestaande catalogusmix


| SKU | Mix | Bronprofiel | Cataloguscontrole voor 4 personen |
|---|---|---|---|
| 731727000 | Honig Bakplaat mix boontjes & gehaktballetjes | package_servings_missing | Bronprofiel ontbreekt |
| 731728000 | Honig Bakplaat mix broccoli & rundervink | package_servings_missing | Bronprofiel ontbreekt |
| 731729000 | Honig Bakplaat mix courgette & kip | package_servings_missing | Bronprofiel ontbreekt |
| 718160000 | Honig Basis voor bami speciaal | package_servings_missing | Bronprofiel ontbreekt |
| 718350000 | Honig Basis voor chili con carne | package_servings_missing | Bronprofiel ontbreekt |
| 181595000 | Honig Basis voor hachee | Gevalideerd, 4 personen | hacheevlees: no_catalog_product |
| 718363000 | Honig Basis voor italiaanse kruidensaus | package_servings_missing | Bronprofiel ontbreekt |
| 051885000 | Honig Basis voor kip kerrie | supplement_content_missing:1 klein blikje ananas | Bronprofiel ontbreekt |
| 070520000 | Honig Basis voor lasagnesaus | Gevalideerd, 4 personen | Italiaanse roerbakmix: low_confidence_match |
| 070519000 | Honig Basis voor macaroni en spaghetti | Gevalideerd, 4 personen | Italiaanse wokgroenten: low_confidence_match |
| 182737000 | Honig Basis voor macaronisaus stroganoff | Gevalideerd, 4 personen | kastanjechampignons: no_catalog_product; Provençaalse wokgroenten: no_catalog_product |
| 070517000 | Honig Basis voor nasi speciaal | Gevalideerd, 4 personen | nasi/bami groenten: no_catalog_product |
| 132802000 | Honig Basis voor roerbakmie | Gevalideerd, 4 personen | kastanjechampignons: no_catalog_product; Oosterse wokgroenten: no_catalog_product |
| 181722000 | Honig Basis voor spaghettisaus bolognese | package_servings_missing | Bronprofiel ontbreekt |
| 186457000 | Honig Basis voor tagliatelle roomsaus | supplement_content_missing:200 g spinazie diepvries | Bronprofiel ontbreekt |
| 070523000 | Honig Familiegerecht Oosterse wraps | package_servings_missing | Bronprofiel ontbreekt |
| 083039000 | Honig Maaltijdsoep erwten | package_servings_missing | Bronprofiel ontbreekt |
| 665854000 | Honig Mix voor boerenomelet | package_servings_missing | Bronprofiel ontbreekt |
| 714983000 | Honig Mix voor kapucijners | package_servings_missing | Bronprofiel ontbreekt |
| 733174000 | Knorr Air fryer mix voor krokante kip knoflook | package_servings_missing | Bronprofiel ontbreekt |
| 730051000 | Knorr Maaltijdmix kebab | package_servings_missing | Bronprofiel ontbreekt |
| 730044000 | Knorr Maaltijdmix kip madras | Gevalideerd, 4 personen | crème fraiche light: no_catalog_product; lente-ui: category_mismatch; tomaten: package_unknown |
| 730054000 | Knorr Maaltijdmix lasagne bolognese | Gevalideerd, 4 personen | Italiaans groentepakket: low_confidence_match; lasagnebladen: package_unknown |
| 730049000 | Knorr Maaltijdmix mac & cheese | package_servings_missing | Bronprofiel ontbreekt |
| 730047000 | Knorr Maaltijdmix teriyaki | Gevalideerd, 4 personen | Chinese wokgroente: no_catalog_product |
| 730052000 | Knorr Maaltijdmix tikka masala | Gevalideerd, 4 personen | magere yoghurt: package_unknown |
| 709641000 | Knorr Mix macaroni carbonara | supplement_list_missing | Bronprofiel ontbreekt |
| 709635000 | Knorr Mix spaghetti bolognese | Gevalideerd, 4 personen | italiaans groentepakket: low_confidence_match |
| 709604000 | Knorr Mix voor bami | Gevalideerd, 4 personen | Bami groentepakket: no_catalog_product; bosui: category_mismatch; mie: low_confidence_match |
| 709601000 | Knorr Mix voor macaroni | Gevalideerd, 4 personen | Italiaans groentepakket: low_confidence_match |
| 709603000 | Knorr Mix voor nasi | supplement_quantity_missing:nasi groentepakket 450 g 125 tauge | Bronprofiel ontbreekt |
| 709741000 | Knorr Mix voor tagliatelle | package_servings_missing | Bronprofiel ontbreekt |
| 729332000 | Knorr Risotto bospaddenstoelen | package_servings_missing | Bronprofiel ontbreekt |
| 729333000 | Knorr Risotto truffel | package_servings_missing | Bronprofiel ontbreekt |
| 703080000 | Knorr Spaghetteria carbonara | supplement_list_missing | Bronprofiel ontbreekt |
| 703081000 | Knorr Spaghetteria pesto | supplement_list_missing | Bronprofiel ontbreekt |
| 732786000 | Knorr Spaghetteria pomodoro mozzarella | package_servings_missing | Bronprofiel ontbreekt |
| 704890000 | Knorr Wereldgerecht maaltijdpakket italiaanse lasagnette napoletan | Gevalideerd, 3 personen | Italiaanse groentemix: low_confidence_match |
| 704883000 | Knorr Wereldgerechten maaltijdpakket mexicaanse burrito's | Gevalideerd, 3 personen | Volledig geprijsd |
| 704893000 | Knorr Wereldgerechten maaltijdpakketten italiaanse risotto | package_servings_missing | Bronprofiel ontbreekt |
| 704882000 | Knorr Wereldgerechten Mexicaanse taco`s | package_servings_missing | Bronprofiel ontbreekt |
