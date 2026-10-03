# Knorr kebab: bewijsgrens voor pitabroodjes (Fix 3)

Schrijfvrije controle op 30 september 2026. Deze notitie bevat **geen** afgeleide nettomassa voor een Hoogvliet-SKU.

## Recept en actuele catalogus

- De [Hoogvliet-pagina van Knorr Maaltijdmix kebab](https://www.hoogvliet.com/product/knorr-maaltijdmix-kebab) (mix-SKU `730051000`, 30 g droge mix) vermeldt bij *Zelf toevoegen* expliciet **“Pitabroodjes (400 g)”**. Het opgeslagen profiel vraagt `400 g` voor vier personen en schaalt die massa naar personen 1–10. Er is geen bewezen alternatief in stuks voor dezelfde receptvariant.
- [SKU `675984000`, G'woon Pita broodjes](https://www.hoogvliet.com/product/g-apos-woon-pita-broodjes): Hoogvliet vermeldt `10 stuk`, netto-inhoud `10.00 ST`, productomschrijving “Voorgebakken witte tarwepitabroodjes” en een positieve zichtbare listingprijs van €0,79. De catalogus heeft `package_text=10 stuk`, `weight_grams=null` en een positieve opgeslagen prijs van €0,79.
- [SKU `675985000`, G'woon Maaltijd pita`s](https://www.hoogvliet.com/product/g-apos-woon-maaltijd-pita-s): Hoogvliet vermeldt `5 stuk`, netto-inhoud `5.00 ST`, dezelfde generieke productomschrijving en een positieve zichtbare listingprijs van €0,85. De catalogus heeft `package_text=5 stuk`, `weight_grams=null` en een positieve opgeslagen prijs van €0,85.
- De publieke productdetails en de via deze exacte SKU's geladen [10-stuksfoto](https://cdn.hoogvliet.com/Images/Product/XL/675984000.jpg) en [5-stuksfoto](https://cdn.hoogvliet.com/Images/Product/XL/675985000.jpg) leveren geen betrouwbaar leesbaar nettogewicht op. Voedingswaarden *per 100 g* zijn geen gewicht van een koopverpakking. In de openbare HTML is geen aan deze SKU's gekoppelde EAN/GTIN aangetroffen.

## Externe verpakkingvermeldingen

| Externe aanbieding | Vermelde massa | Identiteitsgrens |
| --- | ---: | --- |
| [Sligro G'woon Pita broodjes, artikel 141564](https://www.sligro.nl/p.141564.html/g-woon-pita-broodjes-zak-10-stuks-x-50-gram.html) | 10 × 50 g = 500 g | Zelfde merk/soort/stukaantal, maar geen aantoonbare koppeling van de externe EAN/verpakking aan Hoogvliet-SKU `675984000`. |
| [Sligro G'woon Maaltijdpita, artikel 140553](https://www.sligro.nl/p.140553.html/g-woon-maaltijdpita-zak-5-stuks-x-80-g.html) | 5 × 80 g = 400 g | Zelfde merk/soort/stukaantal, maar geen aantoonbare koppeling van de externe EAN/verpakking aan Hoogvliet-SKU `675985000`. |

Deze vermeldingen zijn **kandidaten voor vervolgverificatie**, geen bewijs dat de actuele Hoogvliet-verpakkingen dezelfde EAN, samenstelling en nettomassa hebben. Een andere [aggregator met EAN 8710624326616](https://productvraag.nl/product/g-woon-pita-brood-5-stuks-400-g-mnjggp2n) overbrugt dat ontbrekende Hoogvliet-identiteitsbewijs evenmin. Geen massa of EAN uit deze bronnen wordt aan de catalogus toegevoegd.

## Beslissing en regressie

Het bestaande `productPackageCapacity` rekent `stuk` terecht niet om naar `g`. Met de in PR #39 voorgestelde gerichte pita-zoekalias wordt een geschikt product gevonden, maar de verpakkingscapaciteit blijft onbekend; automatische aankoophoeveelheid, gerechtprijs, budget en readiness mogen daarom niet worden vrijgegeven. PR #39 is Draft en ongemerged: de actuele main-cache meldt voor Knorr kebab nog `NOT_READY` met `pitabroodjes:no_catalog_product`; na uitsluitend die alias wordt `package_unknown` de resterende codeblokkade. Er is geen cache- of databaseherberekening uitgevoerd.

De gerichte regressie controleert voor beide exacte SKU's en personen 1–10 dat een positieve prijs plus 5/10 stuks geen gramcapaciteit, heel verpakkingsaantal of compleet gerechtbudget oplevert. De bestaande algemene test dekt een expliciet bewezen massaverpakking en afronding naar hele pakketten. Naan, tortilla en andere producten krijgen geen gewichtsmetadata van deze SKU's; de negatieve semantische matchtests staan afzonderlijk in PR #39.

**Nodig om deze blokkade later op te heffen:** een leesbaar etiket of gezaghebbende productspecificatie met nettogewicht **én** een geverifieerde EAN/GTIN- of SKU-koppeling aan exact de bij Hoogvliet verkochte verpakking, gevolgd door bestaande hele-pak-, prijs-, lijst-, budget- en readinessregressies. Tot die tijd blijft Knorr kebab NOT_READY. De volgende afgebakende kwaliteitsfix kan het halve-rookworst-verpakkingsbewijs voor Honig erwtensoep onderzoeken.
