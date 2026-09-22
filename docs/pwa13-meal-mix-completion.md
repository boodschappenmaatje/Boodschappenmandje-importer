# PWA 13 — volledige Honig/Knorr-inventaris, 21 september 2026

Vervolg op remote head `a53e595ffba8b2b217e77935430cafce6807b18e`, dezelfde branch `codex/pwa-13-vrije-keuze` en Draft PR #25. Dit rapport vervangt uitsluitend de maaltijdmix-aantallen uit de eerdere rapportage.

## Resultaat en afbakening

| Merk | Ondersteunde SKU's | Inhoudelijk verified | Cache current (1–10) | Selecteerbaar bij geldige week/budget | Niet selecteerbaar |
|---|---:|---:|---:|---:|---:|
| Honig | 19 | 18 | 18 / 180 varianten | 10 | 9 |
| Knorr | 22 | 22 | 22 / 220 varianten | 15 | 7 |
| Totaal | 41 | 40 | 40 / 400 varianten | 25 | 16 |

Selecteerbaarheid is daadwerkelijk gecontroleerd via de Vrije-keuzeservice met vier personen en voldoende budget. Profielcompleetheid en catalogusdekking zijn afzonderlijke begrippen: 15 verified profielen hebben een concrete catalogus-/verpakkingsblokkade; één profiel mist betrouwbare bronhoeveelheden. Dit is **geen claim dat alle 41 kiesbaar zijn**.

De definitieve ondersteunde set omvat alle 41 relevante Honig/Knorr-product-ID's in de bestaande Supabase-catalogus en hun profielen. Het landelijke fabrikantenassortiment is groter. De [Knorr-wereldgerechtenpagina](https://www.knorr.com/nl/knorr-producten/wereldgerechten.html) en Honig/fabrikant- en retailerpagina's zijn vergeleken met deze set. Onder andere oude receptsjablonen voor roti, Kip Siam, Hokkien Mie en kofta hebben geen bijbehorende ondersteunde Hoogvliet-product-ID. Zij tellen niet als extra complete SKU en blijven behouden als bestaande recepten. Geen nieuw supermarktassortiment of brede importer-run toegevoegd.

## Vier aangevulde profielen

- **Honig boerenomelet, 665854000, 38 g:** twee zakjes van vier porties, dus acht personen per doos. De aanvullende boodschappen gelden voor vier personen: 6 eieren, 1 ui, 125 g (kastanje)champignons, 4 sneetjes volkorenbrood, 30 ml olijfolie. `supplementServings=4` voorkomt halvering van de boodschappen. [AH, exacte verpakking](https://www.ah.nl/producten/product/wi122943/honig-mix-voor-boerenomelet).
- **Knorr Italiaanse risotto, 704893000, 257 g:** drie personen per doos; 225 g kipfilet, 250 g champignons, 2 uien, 1 courgette, 1 prei en 30 ml olie. Niet overgenomen van de gewijzigde 264 g-verpakking. [Jumbo, 257 g](https://www.jumbo.com/producten/knorr-wereldgerechten-maaltijdpakket-italiaanse-risotto-257-g-513922DS).
- **Knorr kebab, 730051000, 30 g:** vier personen; 400 g kipfilet, 400 g pita, 1 rode ui, 1 komkommer, 1 ijsbergsla, 15 ml olie; 25 minuten. [Betrouwbare verpakkingsinformatie bij PLUS](https://www.plus.nl/product/knorr-maaltijdmix-kebab-stazak-30-g-417907). PLUS is alleen een bron, geen toegevoegde supermarkt.
- **Honig Oosterse wraps, 070523000, 357 g:** vier personen; 300 g kipfilet, 450 g nasi/bamigroente, 1 rode paprika, ½ komkommer, 1 citroen, 250 g Griekse yoghurt en 30 ml olijfolie. [AH](https://www.ah.nl/producten/product/wi584828/honig-familie-maaltijdpakket-oosterse-wraps) en [PLUS](https://www.plus.nl/product/honig-maaltijdpakket-oosterse-wraps-doos-357-g-823896) komen overeen over het boodschappenlijstje van deze exacte verpakking. De oude Hoogvliet-tekst mist deze hoeveelheden. Voor tijd is de conservatieve 25 minuten gebruikt; de bron noemt ook 20 minuten bereiding.

Bronbewijs geldt alleen voor de exacte product-ID, SKU, naam, verpakking en bereidingsfingerprint. Bij gewijzigde verpakking/bereiding wordt bewijs niet blind hergebruikt. De 36 al geldige profielen zijn behouden. Servings worden nooit uit nettogewicht afgeleid. Voor bronranges zoals 2–3 en 3–4 blijft de bestaande regel voor de expliciete maximale porties gelden.

## Productmatching en prijsbasis

Merk en exacte SKU van de maaltijdmix blijven verplicht. Aanvullingen gebruiken de bestaande vergelijking van totale aankoopkosten inclusief benodigde verpakkingen. Gerichte aliassen dekken onder meer Chinese/Oosterse wok, eiermie, aardappelpartjes, minikrieltjes, demi crème fraîche, worteltjes en generieke droge pasta. Achterham kan zelf in blokjes worden gesneden; voor boerenomelet staat de bron gewone champignons expliciet toe.

Babyhapjes/fruitmoes zijn geen verse appel of droge pasta. Conserven zijn geen verse champignons/wortel voor deze bereidingen. Deze afwijzingen zijn begrensd tot maaltijdmixaanvullingen. Bij diepvries-spinazie betekent ‘fijn gehakt’ gesneden spinazie, geen gehakt vlees; alleen die specifieke misclassificatie is hersteld.

De actuele Hoogvliet-pagina's bevestigden de bereidingsvorm van [aardappelpartjes](https://www.hoogvliet.com/product/aardappelpart-met-schil), [minikrieltjes](https://www.hoogvliet.com/product/minikrieltjes2) en [demi crème fraîche](https://www.hoogvliet.com/product/melkan-demi-cr-me-fra-che). De laatste is crème fraîche light met 15% vet.

Tien direct betrokken prijsregels zijn op de zichtbare Hoogvliet-productpagina's gecontroleerd en gericht bijgewerkt. Eén prijs veranderde: Knorr macaroni carbonara 709641000 van €1,29 naar €1,43. Overige gecontroleerde SKU's: 070476000 €0,98; 070520000 €1,87; 070523000 €4,42; 018587000 €1,84; 703080000 €2,46; 718160000 €1,79; 729332000 €3,08; 730047000 €1,95; 070517000 €1,79. Geen prijsbeleid, verversingsfunctie of algemene cachearchitectuur gewijzigd.

## Volledige inventaris

Iedere niet-kiesbare SKU heeft hieronder precies één primaire concrete blokkadereden. Een huidige cache mag terecht INCOMPLETE zijn; dat verandert een inhoudelijk verified profiel niet in needs_review.

| Merk / SKU | Product en bron | Profiel | Selectie / primaire reden |
|---|---|---|---|
| Honig 051885000 | [Honig Basis voor kip kerrie](https://www.hoogvliet.com/product/honig-basis-voor-kip-kerrie) | needs_review | De exacte inhoud van het voorgeschreven ‘klein blikje ananas’ is niet vermeld; geen betrouwbare hoeveelheid voor deze 59 g-variant gevonden. |
| Honig 070517000 | [Honig Basis voor nasi speciaal](https://www.hoogvliet.com/product/honig-basis-voor-nasi-speciaal) | verified | Selecteerbaar |
| Honig 070519000 | [Honig Basis voor macaroni en spaghetti](https://www.hoogvliet.com/product/honig-basis-voor-macaroni-en-spaghetti) | verified | Selecteerbaar |
| Honig 070520000 | [Honig Basis voor lasagnesaus](https://www.hoogvliet.com/product/honig-basis-voor-lasagnesaus) | verified | Selecteerbaar |
| Honig 070523000 | [Honig Familiegerecht Oosterse wraps](https://www.hoogvliet.com/product/honig-familiegerecht-oosterse-wraps) | verified | Selecteerbaar |
| Honig 083039000 | [Honig Maaltijdsoep erwten](https://www.hoogvliet.com/product/honig-maaltijdsoep-erwten) | verified | Geen erwtensoepgroentepakket of aantoonbaar gelijkwaardige groentemix in de bestaande Hoogvliet-catalogus. |
| Honig 132802000 | [Honig Basis voor roerbakmie](https://www.hoogvliet.com/product/honig-basis-voor-roerbakmie) | verified | Selecteerbaar |
| Honig 181595000 | [Honig Basis voor hachee](https://www.hoogvliet.com/product/honig-basis-voor-hachee) | verified | Geen rauw hacheevlees, stoofrundvlees of geschikte runderlappen in de bestaande catalogus. |
| Honig 181722000 | [Honig Basis voor spaghettisaus bolognese](https://www.hoogvliet.com/product/honig-basis-voor-spaghettisaus-bolognese) | verified | Selecteerbaar |
| Honig 182737000 | [Honig Basis voor macaronisaus stroganoff](https://www.hoogvliet.com/product/honig-basis-voor-macaronisaus-stroganoff) | verified | Geen aantoonbaar gelijkwaardige Provençaalse wokgroentemix in de bestaande catalogus. |
| Honig 186457000 | [Honig Basis voor tagliatelle roomsaus](https://www.hoogvliet.com/product/honig-basis-voor-tagliatelle-roomsaus) | verified | Selecteerbaar |
| Honig 665854000 | [Honig Mix voor boerenomelet](https://www.hoogvliet.com/product/honig-mix-voor-boerenomelet) | verified | Volkorenbrood is aanwezig, maar het aantal sneetjes per koopverpakking is niet betrouwbaar bekend. |
| Honig 714983000 | [Honig Mix voor kapucijners](https://www.hoogvliet.com/product/honig-mix-voor-kapucijners) | verified | Selecteerbaar |
| Honig 718160000 | [Honig Basis voor bami speciaal](https://www.hoogvliet.com/product/honig-basis-voor-bami-speciaal1) | verified | Selecteerbaar |
| Honig 718350000 | [Honig Basis voor chili con carne](https://www.hoogvliet.com/product/honig-basis-voor-chili-con-carne) | verified | Tomaten zijn per gewicht verpakt; het benodigde aantal hele tomaten kan niet betrouwbaar naar koopverpakkingen worden omgerekend. |
| Honig 718363000 | [Honig Basis voor italiaanse kruidensaus](https://www.hoogvliet.com/product/honig-basis-voor-italiaanse-kruidensaus1) | verified | Geen aantoonbaar gelijkwaardige Provençaalse wokgroentemix in de bestaande catalogus. |
| Honig 731727000 | [Honig Bakplaat mix boontjes & gehaktballetjes](https://www.hoogvliet.com/product/honig-bakplaat-mix-boontjes-gehaktballetjes) | verified | Selecteerbaar |
| Honig 731728000 | [Honig Bakplaat mix broccoli & rundervink](https://www.hoogvliet.com/product/honig-bakplaat-mix-broccoli-rundervink) | verified | Tomaten zijn per gewicht verpakt; het benodigde aantal hele tomaten kan niet betrouwbaar naar koopverpakkingen worden omgerekend. |
| Honig 731729000 | [Honig Bakplaat mix courgette & kip](https://www.hoogvliet.com/product/honig-bakplaat-mix-courgette-kip) | verified | Tomaten zijn per gewicht verpakt; het benodigde aantal hele tomaten kan niet betrouwbaar naar koopverpakkingen worden omgerekend. |
| Knorr 703080000 | [Knorr Spaghetteria carbonara](https://www.hoogvliet.com/product/knorr-spaghetteria-carbonara) | verified | Selecteerbaar |
| Knorr 703081000 | [Knorr Spaghetteria pesto](https://www.hoogvliet.com/product/knorr-spaghetteria-pesto) | verified | Selecteerbaar |
| Knorr 704882000 | [Knorr Wereldgerechten Mexicaanse taco`s](https://www.hoogvliet.com/product/knorr-wereldgerechten-mexicaanse-taco-s) | verified | Tomaten zijn per gewicht verpakt; het benodigde aantal hele tomaten kan niet betrouwbaar naar koopverpakkingen worden omgerekend. |
| Knorr 704883000 | [Knorr Wereldgerechten maaltijdpakket mexicaanse burrito's](https://www.hoogvliet.com/product/knorr-wereldgerechten-maaltijdpakket-mexicaanse-burrito-s) | verified | Selecteerbaar |
| Knorr 704890000 | [Knorr Wereldgerecht maaltijdpakket italiaanse lasagnette napoletan](https://www.hoogvliet.com/product/knorr-wereldgerecht-maaltijdpakket-italiaanse-lasagnette-napoletan) | verified | Selecteerbaar |
| Knorr 704893000 | [Knorr Wereldgerechten maaltijdpakketten italiaanse risotto](https://www.hoogvliet.com/product/knorr-wereldgerechten-maaltijdpakketten-italiaanse-risotto) | verified | Selecteerbaar |
| Knorr 709601000 | [Knorr Mix voor macaroni](https://www.hoogvliet.com/product/knorr-mix-voor-macaroni1) | verified | Selecteerbaar |
| Knorr 709603000 | [Knorr Mix voor nasi](https://www.hoogvliet.com/product/knorr-mix-voor-nasi2) | verified | Geen verse bosui/lente-ui in de bestaande catalogus; de gevonden soep is geen vervanging. |
| Knorr 709604000 | [Knorr Mix voor bami](https://www.hoogvliet.com/product/knorr-mix-voor-bami1) | verified | Geen verse bosui/lente-ui in de bestaande catalogus; de gevonden soep is geen vervanging. |
| Knorr 709635000 | [Knorr Mix spaghetti bolognese](https://www.hoogvliet.com/product/knorr-mix-spaghetti-bolognese1) | verified | Selecteerbaar |
| Knorr 709641000 | [Knorr Mix macaroni carbonara](https://www.hoogvliet.com/product/knorr-mix-macaroni-carbonara1) | verified | Selecteerbaar |
| Knorr 709741000 | [Knorr Mix voor tagliatelle](https://www.hoogvliet.com/product/knorr-mix-voor-tagliatelle1) | verified | Selecteerbaar |
| Knorr 729332000 | [Knorr Risotto bospaddenstoelen](https://www.hoogvliet.com/product/knorr-risotto-bospaddenstoelen) | verified | Selecteerbaar |
| Knorr 729333000 | [Knorr Risotto truffel](https://www.hoogvliet.com/product/knorr-risotto-truffel) | verified | Selecteerbaar |
| Knorr 730044000 | [Knorr Maaltijdmix kip madras](https://www.hoogvliet.com/product/knorr-maaltijdmix-kip-madras) | verified | Geen verse lente-ui/bosui in de bestaande catalogus; de gevonden soep is geen vervanging. |
| Knorr 730047000 | [Knorr Maaltijdmix teriyaki](https://www.hoogvliet.com/product/knorr-maaltijdmix-teriyaki) | verified | Selecteerbaar |
| Knorr 730049000 | [Knorr Maaltijdmix mac & cheese](https://www.hoogvliet.com/product/knorr-maaltijdmix-mac-cheese) | verified | Selecteerbaar |
| Knorr 730051000 | [Knorr Maaltijdmix kebab](https://www.hoogvliet.com/product/knorr-maaltijdmix-kebab) | verified | Geen pitabroodjes/shoarmabroodjes of gelijkwaardig pitabrood in de bestaande catalogus. |
| Knorr 730052000 | [Knorr Maaltijdmix tikka masala](https://www.hoogvliet.com/product/knorr-maaltijdmix-tikka-masala) | verified | De magere yoghurt is in ml geregistreerd terwijl het recept gram vraagt; een betrouwbare netto massa ontbreekt. |
| Knorr 730054000 | [Knorr Maaltijdmix lasagne bolognese](https://www.hoogvliet.com/product/knorr-maaltijdmix-lasagne-bolognese) | verified | Het recept vraagt een aantal lasagnebladen; het aantal bladen in de koopverpakking is onbekend. |
| Knorr 732786000 | [Knorr Spaghetteria pomodoro mozzarella](https://www.hoogvliet.com/product/knorr-spaghetteria-pomodoro-mozzarella) | verified | Selecteerbaar |
| Knorr 733174000 | [Knorr Air fryer mix voor krokante kip knoflook](https://www.hoogvliet.com/product/knorr-air-fryer-mix-voor-krokante-kip-knoflook) | verified | Selecteerbaar |

### Onderzoek van de resterende gaten

Gezocht in bestaande producten, productnamen, aliassen en categorieën: hacheevlees/stoofvlees/runderlappen, bosui/lente-ui, pita/shoarmabrood, erwtensoepgroenten/soepgroenten, Provençaalse groente/wok, volkorenbrood/sneetjes, tomaat/trostomaat, yoghurt en lasagnebladen. Alleen een inhoudelijk geschikte kandidaat met betrouwbare verpakkingseenheid telt mee. Een bereide maaltijd, soep of willekeurige groentemix vervangt geen ontbrekend ingrediënt.

Retailer- en verpakkingsonderzoek leverde geen betrouwbare exacte inhoud voor het ‘klein blikje ananas’ bij Honig kipkerrie op; een 227 g-blikje uit een los internetrecept is daarom niet aangenomen. Voor tomaten, brood en lasagnebladen is geen standaardgewicht per stuk/snee/blad verzonnen. Voor yoghurt is ml niet stilzwijgend gelijkgesteld aan gram.

De tabel noemt per gerecht één voldoende blokkerende reden. Aanvullende diagnostiek: erwtensoep vraagt ook een betrouwbare halve-rookworstverpakking; Italiaanse kruidensaus heeft ook een basilicum-volumeprobleem; kip madras mist ook een betrouwbare stukverpakking van tomaten. Appel is opgelost met Granny Smith-appels op schaal met bekende stukaantallen. De volledige bestaande readiness-validator behoudt alle problemen.

## Beelden

40 eigen AI-gegenereerde gerechten in één lichte, rustige foodfotostijl; geen retailer-/fabrikantfoto's, verpakking, merklogo's of tekst. Elk beeld is visueel vergeleken met gerecht, bereidingswijze en hoofdingrediënten. Onder andere de bestaande rund-burritofoto is vervangen door kipburrito volgens het productprofiel.

Mapping gebruikt stabiele recipe source keys en profiel/product-ID's, niet alleen namen. Alle 40 WebP-bestanden staan lokaal in de app. [Beeldherkomst en beoordeling](pwa13-meal-mix-image-provenance.json) bevat de individuele mapping, beschrijving en beschikbare generatieprompts. Het oorspronkelijke prompt van het eerste beeld is niet bewaard; dit is expliciet null, geen gereconstrueerd bewijs.

## Cache en onderhoud

400 persistente readinessvarianten (40 profielen × personen 1–10), met de bestaande evaluator en exact dezelfde berekening als de app. Unieke sleutels `recipe_id, people_count`; productmatches blijven uniek op `match_key`. De schrijfvoorbereiding gebruikt conditionele upserts zodat identieke gegevens geen tweede record of onnodige update opleveren.

Finale Supabase-teruglezing op 21 september 2026 om 18:33 UTC: Honig 18/18 profielen current, Knorr 22/22 current; alle 400 varianten current, niet geïnvalideerd en niet verlopen. Voor elk persoonsaantal zijn 10 Honig- en 15 Knorr-varianten READY. Nul dubbele readiness- of matchsleutels. Een herhaalde match-upsert en readiness-upserts voor personen 1, 6 en 10 veranderden nul records; een databaseassertie controleerde iedere herhaling afzonderlijk.

Parser 5 bewaart de bestaande maintenanceflow. Nieuwe/gewijzigde ondersteunde producten gaan nog steeds via broncontrole naar verified, productmatching, readiness en caches 1–10. Onderbroken cachevernieuwing kan opnieuw worden uitgevoerd zonder dubbele recepten. De bestaande dagelijkse workflow wordt pas vanuit de default branch gepland; PR #25 blijft Draft.

## Verificatie

- 80 gerichte webtests: merkbehoud, verpakkingen, schaalregels 1–10, volledige merkzoeklijst, foutieve productmatches, beeldmapping/persistentie en cache-idempotentie.
- 15 maintenance-regressies: exact bronbewijs, bronwijzigingen, servings, herstel na onderbreking en bestaande maintenanceflow.
- Gerichte lint, TypeScript-controle en definitieve lokale Next-build geslaagd; Preview-status staat in PR #25.
- Live Supabase-audit van de volledige set via de daadwerkelijke selectie- en readinessservices; opgeslagen week heen-en-terug door de bestaande serializer gecontroleerd.
- Browser: Honig bolognese en Knorr burrito geselecteerd, ingrediënten/verpakkingen geopend, opgeslagen en Home herladen. Beide juiste gerechtbeelden zijn geladen en behouden. Burrito voor vier personen gebruikt twee 3-persoonsmixverpakkingen en 300 g kipfilet.
- Geen fysieke iPhone-test geclaimd.

## Korte iPhone-hertest

Open de Preview uit PR #25. Maak een week met Vrije-keuzedagen en voldoende budget. Zoek ‘Honig’ en ‘Knorr’, open meerdere varianten, controleer ingrediënten en afbeelding, selecteer een gerecht en bekijk Home. Herlaad/heropen de app en controleer hetzelfde gerechtbeeld. Test risotto/burrito op vier personen: twee 3-persoonsverpakkingen. Resterende blokkades moeten overeenkomen met de tabel.

Geen merge naar main en geen Production-deploy.
