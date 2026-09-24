# PR #28 — functionele prijs- en verpakkingsfix, 24 september 2026

Hervat vanaf remote `2789063240adf3ed1b4cbbdb191253b1cdc95c97`, op dezelfde branch en Draft PR.

## Oorzaak en oplossing

De echte knoppenflow had twee prijsblokkades: de eigen prijs kon de knop disabled maken, en een ander verplicht ingrediënt met een oudere prijs kon de hele preview afwijzen. Readiness gebruikte die leeftijdsgrens niet. Geen ontbrekende touch-handler gevonden. De echte React Menu/Vrije-keuze-controls en hun providers worden nu met DOM-clicks getest, inclusief zoeken → detail → aanpassen → toevoegen.

Vaste productregel: **NIEUWSTE betrouwbare positieve prijs gebruiken; laatst bekende betrouwbare positieve catalogusprijs als fallback. Zodra een nieuwere geldige prijs beschikbaar is, wordt die automatisch actief.**

Versheid is een label, geen afwijzingsgrond. Exacte productidentiteit, positieve centprijs, betrouwbare match en verpakkingsinhoud blijven verplicht. Geen prijsdatum herschreven. Een verlopen actie verliest het actielabel; de werkelijk waargenomen positieve prijs blijft een laatst bekende prijs, niet een verzonnen normale prijs.

De actieve week en lijst lezen prijzen bij hervatten/focus/netwerkherstel en iedere minuut zolang de app zichtbaar is. De week ververst uitsluitend prijzen; gekozen producten, recepten, verpakkingen, recepthoeveelheden, afvinken en handmatige lijstbijdragen blijven behouden. Gewijzigde product-ID's invalideren de afhankelijke lokale zoek-/readiness-/weeksnapshots. Bestaande database-invalidatietriggers blijven ongewijzigd; gewijzigde evaluator-/matcherversies voorkomen hergebruik van oude semantiek. Eigen recepten slaan productkoppelingen op en worden bij openen opnieuw berekend.

Automatische test: €1,79 → €1,99 bij focus; 2 gekozen verpakkingen blijven 2; recept 800 g; 1 extra handmatige lijstverpakking blijft behouden. De test wijzigt uitsluitend lokale fixtures, geen Production-prijs.

## Read-only audit en matrix

Catalogus gelezen op 2026-09-24T17:08:44.628Z; 5.184 producten. Alle live auditrequests zijn GET; geen import, backfill, refresh-write of migratie. De Preview-API weigert cachewrites naar de gedeelde database. De definitieve matrix gebruikt dezelfde vastgelegde catalogus voor eerlijke vergelijking, met de gewijzigde matcher.

| Merk | Aangeboden varianten | READY | Selecteerbaar | Resterend |
|---|---:|---:|---:|---:|
| Honig | 19 | 10 | 10 | 9 |
| Knorr | 43 | 23 | 23 | 20 |

Dit telt aangeboden receptvarianten, niet unieke mix-SKU's. 10 Honig en 18 Knorr-varianten zijn door de prijsregel weer selecteerbaar. De 14 pending Knorr-productprofielen bevatten geen gevalideerd profiel of bronbewijs; bestaande statische receptvarianten zijn afzonderlijke resultaten.

6 personenwaarden (1/2/4/6/10/12) × 4 weeklengtes (1/3/5/7) zijn geslaagd. 12 personen is officieel ondersteund (UI 1–12). Iedere cel controleert alle Honig/Knorr-resultaten, een normaal READY recept en een gekoppeld eigen recept. READY/selecteerbaar blijft steeds Honig 10 / Knorr 23; eigen recept controleert exacte hoeveelheid, afronding naar verpakkingen en prijs. De pakketregressies controleren behoud van expliciete keuzes bij personenverandering.

## Resterende varianten

| Variant | Concrete blokkade na softwareherstel |
|---|---|
| Honig Maaltijdsoep erwten | rookworst (piece): package_unknown; product Slagershuis Gelderse rookworst |
| Honig Basis voor hachee | hacheevlees (g): no_catalog_product |
| Honig Basis voor macaronisaus stroganoff | Provençaalse wokgroenten (g): no_catalog_product |
| Honig Mix voor boerenomelet | sneetjes volkoren brood (piece): no_catalog_product |
| Honig Basis voor chili con carne | tomaten (piece): package_unknown; product Mutti Gepelde tomaten |
| Honig Basis voor italiaanse kruidensaus | Provençaalse wokgroenten (g): no_catalog_product; verse basilicum (ml): low_confidence_match |
| Honig Bakplaat mix broccoli & rundervink | tomaten (piece): package_unknown; product Mutti Gepelde tomaten |
| Honig Bakplaat mix courgette & kip | tomaten (piece): package_unknown; product Mutti Gepelde tomaten |
| Honig Basis voor kip kerrie | supplement_content_missing:1 klein blikje ananas; geen betrouwbare hoeveelheid, profiel ontbreekt. |
| Knorr Wereldgerechten Mexicaanse taco`s | tomaten (piece): package_unknown; product Mutti Gepelde tomaten |
| Knorr Maaltijdmix kip madras | tomaten (piece): package_unknown; product Mutti Gepelde tomaten |
| Knorr Maaltijdmix kebab | pitabroodjes (g): no_catalog_product |
| Knorr Maaltijdmix tikka masala | magere yoghurt (g): package_unknown; product Campina Magere yoghurt |
| Knorr Maaltijdmix lasagne bolognese | lasagnebladen (piece): package_unknown; product Daily Chef Lasagnebladen |
| Knorr Japanse teriyaki met runderreepjes | peultjes (g): no_catalog_product; runderreepjes (g): matcher_failed |
| Knorr Asia special korean bbq | Geen gevalideerd receptprofiel; status pending, profiel en bronbewijs ontbreken. |
| Knorr Wereldgerechten maaltijdpakket italiaanse lasagne bolognese | Geen gevalideerd receptprofiel; status pending, profiel en bronbewijs ontbreken. |
| Knorr Wereldgerecht maaltijdpakket chinese beef shanghai | Geen gevalideerd receptprofiel; status pending, profiel en bronbewijs ontbreken. |
| Knorr Air fryer mix voor koreaanse kip | Geen gevalideerd receptprofiel; status pending, profiel en bronbewijs ontbreken. |
| Knorr Wereldgerechten maaltijdpakket hokkien mie | Geen gevalideerd receptprofiel; status pending, profiel en bronbewijs ontbreken. |
| Knorr Wereldgerechten maaltijdpakket surinaamse roti | Geen gevalideerd receptprofiel; status pending, profiel en bronbewijs ontbreken. |
| Knorr Wereldgerecht maaltijdpakket portugese kip piri piri | Geen gevalideerd receptprofiel; status pending, profiel en bronbewijs ontbreken. |
| Knorr Wereldgerechten maaltijdpakket indiase kip madras | Geen gevalideerd receptprofiel; status pending, profiel en bronbewijs ontbreken. |
| Knorr Wereldgerecht maaltijdpakket zuid-afrikaanse bobotie | Geen gevalideerd receptprofiel; status pending, profiel en bronbewijs ontbreken. |
| Knorr Wereldgerechten maaltijdpakket japanse teriyaki | Geen gevalideerd receptprofiel; status pending, profiel en bronbewijs ontbreken. |
| Knorr Wereldgerechten maaltijdpakket thaise kip siam | Geen gevalideerd receptprofiel; status pending, profiel en bronbewijs ontbreken. |
| Knorr Wereldgerechten trattoria kipfilet toscana | Geen gevalideerd receptprofiel; status pending, profiel en bronbewijs ontbreken. |
| Knorr Wereldgerechten maaltijdpakket griekse kofta | Geen gevalideerd receptprofiel; status pending, profiel en bronbewijs ontbreken. |
| Knorr Wereldgerecht maaltijdpakket indiase kip tandoori | Geen gevalideerd receptprofiel; status pending, profiel en bronbewijs ontbreken. |

Veilig hersteld: erwtensoepgroenten worden niet langer verward met bereide soep; tomatenconcentraat is uitgesloten als verse tomaat. De resterende recepten hebben nog een echte tweede blokkade. Catalogusonderzoek: verse tomaten staan in gramverpakkingen zonder stuksinhoud; rookworst eveneens zonder expliciet stuksgetal; magere yoghurt heeft ml terwijl het recept gram vraagt; lasagnebladen hebben gram maar het recept stuks. Geen gewicht per stuk/dichtheid verzonnen. Volkoren broden bestaan maar sneetjes per brood zijn onbekend. Pita's bestaan als 5 stuks zonder benodigde gramomrekening. Geen passende hacheevlees/Provençaalse wokgroenten/peultjes/runderreepjes gevonden. Basilicum is als plant/gedroogd beschikbaar zonder betrouwbare ml-omrekening.

## Planner 4 personen / 5 dagen / €100 week / €70 maaltijden

Uitkomst **B**: er bestaat een geldige combinatie binnen €70. De gecontroleerde week kost **€39,44** aan te kopen verpakkingen; vijf gerechten zijn gekozen. Losse gerechtprijzen kunnen optellen tot meer doordat de week gedeelde verpakkingen samenvoegt.

- Boerenkoolstamppot met rookworst
- Vegetarische pasta met courgette
- Hutspot met rundergehaktbal
- Gebakken rijst met ei en groente
- Couscous met kikkererwten en groente

De harde budgetpoort blijft werken: dezelfde fixture met €0,01 maaltijdbudget geeft `noValidMealPlanWithinBudget`. Er is geen budget verhoogd en de test muteert de meegegeven week/lijst niet.

## Reproduceerbaar

Vanuit `apps/web`, met uitsluitend publieke Supabase-configuratie en bestaande `test-results`-map:

```sh
PR28_PUBLIC_CONFIG=/pad/naar/publieke-config.json PR28_AUDIT_SNAPSHOT=/tmp/pr28-snapshot.json npx vitest run --config scripts/iphone-mix-audit.config.ts
PR28_AUDIT_SNAPSHOT=/tmp/pr28-snapshot.json PR28_AUDIT_OUTPUT=/tmp/pr28-matrix.json npx vitest run --config scripts/pr28-matrix.config.ts
npm run check
```

De configuratie bevat alleen `{ "url": "...", "key": "publishable/anon" }`. De audit blokkeert alle niet-GET-methoden. De gewone tests gebruiken fixtures en verrichten geen live databasewrites.

## Preview en acceptatie

Functionele Preview-verificatie volgt op de codecommit. Nog geen nieuwe iPhone-gereedmelding in dit checkpoint. Geen merge of Production-deployment.
