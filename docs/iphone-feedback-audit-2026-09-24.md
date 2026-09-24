# Afgekeurde iPhone-Preview — onderzoekscheckpoint 24 september 2026

Geen gereedmelding. Branch `feature/ingredient-quantity-controls`, Draft PR #28,
onderzocht functioneel hoofd `268066034c43e92de0028bdc1066aa6845297390`.
Geen functionele codewijziging in dit checkpoint.

## Methode en telling

Alle aangeboden Honig/Knorr-receptvarianten via `searchFreeChoice`, actuele
receptprofielen en productcatalogus gelezen met publiek geconfigureerde toegang.
De audit-fetch weigerde iedere methode behalve GET. Geen requestRefresh,
backfill, import of database-write uitgevoerd. Vrije keuze getest op servicelaag
met 4 personen en ruim budget om prijs-/datablokkades van budget te onderscheiden.
Dit is geen browserinteractietest.

| Merk | Aangeboden varianten | Technisch READY | Technisch niet READY / ongeverifieerd | Selecteerbaar |
|---|---:|---:|---:|---:|
| Honig | 19 | 10 | 9 | 0 |
| Knorr | 43 | 23 | 20 | 5 |

Varianten zijn niet noodzakelijk unieke SKU's: statische gerechten en dynamische
productprofielen kunnen naast elkaar voorkomen. Honig heeft 18 geverifieerde
profielen en 1 ongeverifieerde variant; Knorr 29 en 14. De ongeverifieerde
profielen zijn nog niet afzonderlijk op veilige herstelbaarheid onderzocht.

Koude en persistente readiness-evaluatie geven bij personen 1/2/4/6/10/12 steeds
Honig 10/18 en Knorr 23/29 READY. Geen geldige persistent-cachehits in deze run.
Dit bewijst niet de volledige dagen-/planner-/UI-matrix of cache-invalidatie.

## Aangetoonde prijsblokkade

`recipe-readiness.ts` beoordeelt bekende positieve prijzen als berekenbaar.
`ingredient-quantity.ts` maakt bediening afhankelijk van `freshness === fresh`.
`ingredient-quantity-preview.ts` wijst bovendien de hele wijziging af zodra
een ander verplicht ingrediënt van hetzelfde gerecht geen verse prijs heeft.
`free-choice.ts` kent dezelfde extra afwijzing van een technisch READY gerecht.
Versheid vervalt na acht dagen; de extra afwijzing bestaat dus onafhankelijk van
personen en weeklengte. Een enabled knop kan hierdoor toch een null-preview opleveren.

Actuele voorbeelden uit de catalogus:

| Product | Prijs opgehaald | Gevolg op 24 september |
|---|---|---|
| Cherry tomaten, SKU 070476000 | 21 september | Eigen prijs is vers; andere ingrediënten kunnen wijziging blokkeren |
| Italiaanse roerbak | 16 september 04:10 UTC | Ouder dan acht dagen; blokkeert onder andere Honig lasagnesaus en macaroni |
| Honig Basis voor macaroni en spaghetti | 16 september 04:21 UTC | Eigen bediening niet eligible |
| Honig Basis voor roerbakmie | 16 september 04:21 UTC | Extra prijsblokkade ondanks technische readiness |
| Hoogvliet Komkommer | 16 september 04:12 UTC | Blokkeert onder andere Honig Oosterse wraps |

Dit bewijst een concrete afwijzingsroute, niet dat alle fysieke tapproblemen
uitsluitend deze oorzaak hebben. Callback/state/touch-flow is nog niet opnieuw
met echte Preview-interactie afgedekt. Geen prijsdatum herschreven, geen stale
prijs als vers gelabeld, geen match geforceerd.

## Overige technisch geblokkeerde geverifieerde varianten

Dit zijn geobserveerde matcher-/quantity-redenen, nog geen verklaring dat elke
blokkade onvermijdelijk is. Vergelijking met veilige alternatieven blijft nodig.

| Variant | Geobserveerde blokkade |
|---|---|
| Honig Maaltijdsoep erwten | erwtensoepgroenten: category_mismatch; rookworst: package_unknown |
| Honig Basis voor hachee | hacheevlees: no_catalog_product |
| Honig Basis voor macaronisaus stroganoff | Provençaalse wokgroenten: no_catalog_product |
| Honig Mix voor boerenomelet | sneetjes volkoren brood: no_catalog_product |
| Honig Basis voor chili con carne | tomaten: package_unknown |
| Honig Basis voor italiaanse kruidensaus | Provençaalse wokgroenten: no_catalog_product; basilicum: low_confidence_match |
| Honig Bakplaat mix broccoli & rundervink | tomaten: package_unknown |
| Honig Bakplaat mix courgette & kip | tomaten: package_unknown |
| Knorr Wereldgerechten Mexicaanse taco's | tomaten: package_unknown |
| Knorr Maaltijdmix kip madras | tomaten: package_unknown |
| Knorr Maaltijdmix kebab | pitabroodjes: no_catalog_product |
| Knorr Maaltijdmix tikka masala | magere yoghurt: package_unknown |
| Knorr Maaltijdmix lasagne bolognese | lasagnebladen: package_unknown |
| Knorr Japanse teriyaki met runderreepjes | peultjes: no_catalog_product; runderreepjes: matcher_failed |

Daarnaast ongeverifieerd: Honig kip kerrie en 14 Knorr-productprofielen
(korean bbq, dynamische lasagne bolognese, beef shanghai, air fryer koreaanse kip,
hokkien mie, roti, piri piri, kip madras, bobotie, japanse teriyaki, kip siam,
kipfilet toscana, kofta, tandoori). Hun aanwezigheid in de zoekresultaten is
geen bewijs van een volledige, gevalideerde receptdefinitie.

## Stopreden en vervolg

De bestaande strenge versheidseis en het verbod op prijs-/productimport laten
niet toe om oude prijzen ongemerkt als actueel te gebruiken. Nodig: expliciete
productkeuze over laatst bekende prijzen met waarschuwing, óf een afzonderlijk
geautoriseerde reguliere prijsactualisatie. Deze opdracht heeft daarvoor geen
database-/importtoestemming verleend.

Ook ondersteunt de beschikbare browser geen mobiele viewport; een eerder
beleidsmatig afgewezen alternatieve weergave wordt niet omzeild. Mobiele
Preview-verificatie vereist een ondersteunde browservoorziening.

Open: daadwerkelijke fixes; per-variant herstelonderzoek; interactietests;
personen × dagen × recepttype; nieuwe actuele planner-case; volledige
regressies/lint/TypeScript/build; nieuwe functionele Preview en mobiele bewijsvoering.
De afzonderlijke live read-only audittest slaagde. Historische 594/189 checks
zijn geen validatie van deze nieuwe feedback. Geen variant als hersteld aangemerkt.
