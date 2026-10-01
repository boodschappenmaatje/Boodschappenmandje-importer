# Honig/Knorr-readiness, 1 oktober 2026

Schrijfvrije Supabase-controle van `meal_mix_profiles` gekoppeld aan `recipe_readiness_cache` bij vier personen. De productiecache is niet herschreven. Alle genoemde SKU's en prijzen komen uit de actuele catalogus (6759 producten en 6759 positieve prijsregels). De codewijziging op de Previewbranch maakt alleen een bewezen juiste hachee-match mogelijk en corrigeert een onjuiste tomatenmatch. Een gerichte cacheversie voor de drie gewijzigde supplementkeys zorgt dat de Preview oude persistente resultaten schrijfvrij herberekent; live aantallen veranderen pas na een normale release en gerichte veilige rematch.

| Merk | READY live | NOT_READY live | NO_RECIPE |
| --- | ---: | ---: | ---: |
| Honig | 10 | 8 | 1 |
| Knorr | 17 | 5 | 14 |

## Iedere resterende live blokkade

| Recept | Ingrediënt en eis (vier personen) | Huidige reden | Bewijsgrens en exacte vervolginformatie |
| --- | --- | --- | --- |
| Honig Bakplaat broccoli & rundervink | tomaten, 2 stuks | `package_unknown` | SKU 733141000 is 400 g gepelde tomaten in blik en wordt nu verworpen; verse SKU 060936000 is 500 g zonder vast aantal. Vereist stuks per exacte verpakking of een grambehoefte uit deze mixbron. |
| Honig Bakplaat courgette & kip | tomaten, 2 stuks | `package_unknown` | Zelfde SKU- en stuksgrens. |
| Honig Basis chili con carne | tomaten, 4 stuks | `package_unknown` | Zelfde SKU- en stuksgrens. |
| Honig Basis hachee | hacheevlees, 500 g | `no_catalog_product` | Previewcode vindt uitsluitend geverifieerde rauwe runderriblap SKU 733659000 (ca. 700 g, positieve prijs). Live cache blijft oud tot reguliere gerichte rematch na release. |
| Honig Basis Italiaanse kruidensaus | Provençaalse wokgroenten, 400 g; verse basilicum, 30 ml | `no_catalog_product`; `low_confidence_match` | Geen bewezen culinair gelijkwaardige Provençaalse groentemix. SKU 714681000 is 15 g verse basilicum, geen 30 ml. Nodig: geschikt exact groentemixproduct én betrouwbare ml-naar-gram recept- of verpakkingsinformatie voor basilicum. Pesto en gedroogde kruiden zijn geen vervanging. |
| Honig Basis macaronisaus stroganoff | Provençaalse wokgroenten, 400 g | `no_catalog_product` | Een bewezen passende samenstelling/variant met gramcapaciteit en prijs ontbreekt. |
| Honig Maaltijdsoep erwten | rookworst, 0,5 stuk | `package_unknown` | Geselecteerde Slagershuis SKU 078633000 noemt 225 g, geen bewezen aantal hele worsten in de koopverpakking. Gramgewicht alleen bewijst geen stuksverpakking. Nodig: exact 1-worst-per-verpakking bewijs of een grambehoefte in dezelfde receptbron. |
| Honig Mix boerenomelet | sneetjes volkoren brood, 4 stuks | `no_catalog_product` | Een heel brood van 1 stuk geeft geen vast snee-aantal. Nodig: aantal sneden per exact verpakte, gesneden volkorenbrood-SKU. |
| Knorr Maaltijdmix kebab | pitabroodjes, 400 g | `no_catalog_product` | Previewcode herkent SKU's 675984000 (10 stuks) en 675985000 (5 stuks), maar niet hun massa. Daardoor blijft `package_unknown` en NOT_READY. Nodig: netto gramgewicht plus exacte SKU/EAN-verpakkingsidentiteit. |
| Knorr Maaltijdmix kip madras | tomaten, 2 stuks | `package_unknown` | Zelfde verse-stuksgrens als boven. |
| Knorr Maaltijdmix lasagne bolognese | lasagnebladen, 12 stuks | `package_unknown` | SKU's 703311000/719236000/184470000 geven 250/500/250 g, geen gegarandeerd aantal bladen. Nodig: bladenaantal per exacte SKU of massa-eis uit deze mixbron. |
| Knorr Maaltijdmix tikka masala | magere yoghurt, 260 g | `package_unknown` | SKU 064395000 vermeldt 500 ml, andere varianten liters. Een gramvraag vereist bewezen nettomassa of brongebonden dichtheid; ml/l-parser is hier niet de oorzaak. |
| Knorr Wereldgerechten Mexicaanse taco's | tomaten, 2,667 stuks bij vier personen | `package_unknown` | Zelfde verse-stuksgrens; het afwijkende aantal komt door receptschaling, niet uit een pakketgewicht. |

De 1 Honig en 14 Knorr `NO_RECIPE`-profielen worden na acceptatie rechtstreeks als volgende stap binnen Productdata & receptkwaliteit opgepakt. Bovenstaande inventaris is de persistente live toestand; de code op een Draft PR kan deze cache niet eerlijk als veranderd presenteren. Een veilig gerichte rematch na release moet zowel nieuwe READY als alle onverwachte regressies opnieuw controleren.

Bronnen: de bestaande exacte [tomaten](tomato-packaging-evidence-20260930.md), [hachee en aanvullende matches](meal-mix-supplement-match-audit-20260930.md), en [pita](knorr-kebab-pita-packaging-evidence-20260930.md) audits; publieke product-/mixpagina's staan daarin. De actuele officiële Knorr-mixpagina's bevestigen expliciet 12 lasagnebladen en 260 g magere yoghurt; de Honig-erwtensoep vermeldt 1/2 rookworst.
