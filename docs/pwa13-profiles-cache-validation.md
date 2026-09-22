# PWA 13: maaltijdmixprofielen en cache

Datum: 21 september 2026. Branch: codex/pwa-13-vrije-keuze; Draft PR #25.

## Resultaat

19 Honig- en 22 Knorr-producten onderzocht. Vooraf 15 verified/current; nu 36 verified (Honig 16, Knorr 20), vijf needs_review. Geen brede productimport, productwrites of prijswrites. De bestaande idempotente maintenanceflow vereist 21 nieuwe afgeleide recipes; ingredients en recipe_ingredients zijn niet gewijzigd.

36 profielen × 10 personenvarianten = 360 maaltijdmixcachevarianten. Ook de bestaande gewone gerechten zijn bijgewerkt: totaal 133 × 10 = 1.330 readinessrecords, met 230 gedeelde productmatches. Current betekent een actuele beoordeling, niet automatisch selecteerbaar. Bij vier personen zijn 68 gerechten READY, waaronder vijftien branded mixen met complete productdekking. De afzonderlijke prijscontrole laat tien daadwerkelijk selecteerbare mixen zien; vijf van de vijftien hebben nog een verouderde prijs. Van de overige 21 verified profielen hebben achttien een ontbrekend catalogusproduct; drie stranden op matching/verpakkingen.

## De 26 eerder onvolledige profielen

Bronnen zijn exacte Hoogvliet-productgegevens, aangevuld met dezelfde verpakking bij fabrikant/AH/Jumbo/Plus. Aanvullend bewijs is gekoppeld aan SKU, productnaam, verpakking, bron-URL en fingerprint van de bereidingsinstructies. Een veranderde verpakking/instructie mag dit bewijs niet hergebruiken. Volledige inventaris vooraf: [inventaris](pwa13-profile-inventory-before.md).

| Product | SKU | Uitkomst | Bronbewijs / ontbrekende informatie |
|---|---|---|---|
| Knorr Spaghetteria pesto | 703081000 | verified | [bron](https://www.ah.nl/producten/product/wi232605/spaghetteria-al-pesto); 155 g; Aantal porties: 2. Standaardbereiding met alleen 500 ml water; serveertips zijn optioneel. |
| Knorr Spaghetteria pomodoro mozzarella | 732786000 | verified | [bron](https://www.knorr.com/nl/p/spaghetteria-pomodoro.html/08720182422248); Exacte Pomodoro mozzarella-variant (163 g op BE pagina met dezelfde GTIN). Maaltijd voor 1-2 personen, alleen 500 ml water. |
| Honig Bakplaat mix broccoli & rundervink | 731728000 | verified | [bron](https://www.ah.nl/producten/product/wi605445/honig-mix-aardappel-broccoli-en-rundervink); 36 g; Voor 4 personen. |
| Honig Maaltijdsoep erwten | 083039000 | verified | [bron](https://www.ah.nl/producten/product/wi215238/honig-maaltijdsoep-erwten); 137 g; Aantal porties: 4. Halve rookworst zonder gewicht; niet invullen. |
| Honig Mix voor kapucijners | 714983000 | verified | [bron](https://www.ah.nl/producten/product/wi199022/honig-mix-voor-kapucijners); 45 g; Aantal porties: 4. |
| Knorr Maaltijdmix kebab | 730051000 | needs_review | [bron](https://www.plus.nl/product/knorr-maaltijdmix-kebab-stazak-30-g-417907); preparation_time_missing |
| Honig Basis voor bami speciaal | 718160000 | verified | [bron](https://www.ah.nl/producten/product/wi3495/honig-basis-voor-bami-speciaal); 37 g; Aantal porties: 4. |
| Knorr Air fryer mix voor krokante kip knoflook | 733174000 | verified | [bron](https://www.ah.nl/producten/product/wi615444/0800%20-%20022%2030%2055); 70 g; Aantal porties: 3. Fabrikant bevestigt 400 g kipfilet en 3 el olie. |
| Honig Bakplaat mix boontjes & gehaktballetjes | 731727000 | verified | [bron](https://www.ah.nl/producten/product/wi605440/honig-mix-aardappel-boontjes-gehaktballetjes); 36 g; Voor 4 personen. Olie in de lijst is olijfolie. |
| Honig Basis voor chili con carne | 718350000 | verified | [bron](https://www.ah.nl/producten/product/wi123658/honig-basis-voor-chili-con-carne); 42 g; Aantal porties: 4. |
| Honig Bakplaat mix courgette & kip | 731729000 | verified | [bron](https://www.ah.nl/producten/product/wi605446/honig-mix-aardappel-courgette-en-kip); 36 g; Voor 4 personen. |
| Honig Mix voor boerenomelet | 665854000 | needs_review | [bron](https://www.hoogvliet.com/product/honig-mix-voor-boerenomelet); package_servings_missing |
| Knorr Wereldgerechten maaltijdpakketten italiaanse risotto | 704893000 | needs_review | [bron](https://www.hoogvliet.com/product/knorr-wereldgerechten-maaltijdpakketten-italiaanse-risotto); package_servings_missing |
| Honig Basis voor kip kerrie | 051885000 | needs_review | [bron](https://www.hoogvliet.com/product/honig-basis-voor-kip-kerrie); supplement_content_missing:1 klein blikje ananas |
| Honig Basis voor italiaanse kruidensaus | 718363000 | verified | [bron](https://www.ah.nl/producten/product/wi37912/honig-mix-voor-italiaanse-kruidensaus); 68 g; Aantal porties: 4. Basilicum blijft in eetlepels; geen verzonnen gewicht. |
| Knorr Mix voor tagliatelle | 709741000 | verified | [bron](https://www.ah.nl/producten/product/wi173552/maaltijdmix-tagliatelle); 62 g; Aantal porties: 4. |
| Honig Familiegerecht Oosterse wraps | 070523000 | needs_review | [bron](https://www.hoogvliet.com/product/honig-familiegerecht-oosterse-wraps); package_servings_missing |
| Honig Basis voor spaghettisaus bolognese | 181722000 | verified | [bron](https://www.ah.nl/producten/product/wi37921/honig-basis-voor-spaghettisaus-bolognese); 41 g; Aantal porties: 4. |
| Knorr Spaghetteria carbonara | 703080000 | verified | [bron](https://www.ah.nl/producten/product/wi232612/knorr-spaghetteria-carbonara); 154 g; Aantal porties: 2. Alleen 500 ml water toevoegen. |
| Honig Basis voor tagliatelle roomsaus | 186457000 | verified | [bron](https://www.hoogvliet.com/product/honig-basis-voor-tagliatelle-roomsaus); Expliciete boodschappenlijst en porties op productpagina |
| Knorr Mix voor nasi | 709603000 | verified | [bron](https://www.knorr.com/nl/p/mix-voor-nasi.html/08710522979549); Fabrikant specificeert 125 g taugé, Hoogvliet mist de unit. |
| Knorr Maaltijdmix mac & cheese | 730049000 | verified | [bron](https://www.ah.nl/producten/product/wi594774/0800-022%2030%2055); 64 g; Aantal porties: 4. |
| Knorr Mix macaroni carbonara | 709641000 | verified | [bron](https://www.ah.nl/producten/product/wi164103/maaltijdmix-macaroni-carbonara); 64 g; Aantal porties: 4. Toevoegingen uit productetiket, olie 2 el in bereiding. |
| Knorr Risotto bospaddenstoelen | 729332000 | verified | [bron](https://www.ah.nl/producten/product/wi594806/knorr-risotteria-bospaddenstoelen); 175 g; Aantal porties: 2. Standaardbereiding met alleen 500 ml water. |
| Knorr Wereldgerechten Mexicaanse taco`s | 704882000 | verified | [bron](https://www.jumbo.com/producten/knorr-wereldgerecht-mexicaanse-taco-s-136g-390317DS); 136 g; verpakking bevat 3 porties. |
| Knorr Risotto truffel | 729333000 | verified | [bron](https://www.ah.nl/producten/product/wi594780/knorr-risotteria-truffel); 175 g; Aantal porties: 2. Standaardbereiding met alleen 500 ml water. |

De vijf open punten: kipkerrie noemt een klein blikje ananas zonder inhoud; Oosterse wraps heeft conflicterende oude/nieuwe pakketbereiding; boerenomelet heeft meerdere sachets en onduidelijke pakket-/portieschaal; Wereldgerechten Italiaanse risotto mist bewezen porties; kebab heeft ingrediënten/porties maar geen bereidingstijd voor de bestaande recipepublicatie. Geen hoeveelheden of tijden verzonnen.

## Selecteerbaarheid bij vier personen

| Verified profiel | Selecteerbaar | Resterende concrete blokkades |
|---|---|---|
| Knorr Spaghetteria pesto | ja |  |
| Knorr Spaghetteria pomodoro mozzarella | ja |  |
| Honig Bakplaat mix broccoli & rundervink | nee | tomaten: package_unknown; voorgekookte krieltjes: no_catalog_product; Honig Bakplaat mix broccoli & rundervink: stale prijs (2026-09-10T04:53:25.949+00:00); tomaten: stale prijs (2026-09-08T08:48:28.666+00:00) |
| Knorr Maaltijdmix teriyaki | nee | Chinese wokgroente: no_catalog_product; Knorr Maaltijdmix teriyaki: stale prijs (2026-09-07T18:29:26.345+00:00) |
| Honig Maaltijdsoep erwten | nee | erwtensoepgroenten: no_catalog_product; rookworst: package_unknown; rookworst: stale prijs (2026-09-12T02:25:59.247+00:00) |
| Honig Mix voor kapucijners | ja |  |
| Honig Basis voor bami speciaal | nee | Mie Nestjes: no_catalog_product; nasi/bami groenten: no_catalog_product; Honig Basis voor bami speciaal: stale prijs (2026-09-12T02:28:16.192+00:00) |
| Knorr Air fryer mix voor krokante kip knoflook | ja |  |
| Honig Basis voor lasagnesaus | nee | cherrytomaatjes: stale prijs (2026-09-08T08:48:28.666+00:00); Honig Basis voor lasagnesaus: stale prijs (2026-09-12T02:25:38.012+00:00) |
| Honig Basis voor roerbakmie | nee | kastanjechampignons: no_catalog_product; Oosterse wokgroenten: no_catalog_product; Roerbakmie: stale prijs (2026-09-12T02:25:00.864+00:00) |
| Honig Bakplaat mix boontjes & gehaktballetjes | nee | voorgekookte mini krieltjes: no_catalog_product; cherrytomaatjes: stale prijs (2026-09-08T08:48:28.666+00:00) |
| Honig Basis voor chili con carne | nee | Hollandse bruine bonen: no_catalog_product; tomaten: package_unknown; tomaten: stale prijs (2026-09-08T08:48:28.666+00:00) |
| Honig Basis voor macaroni en spaghetti | nee | cherrytomaatjes: stale prijs (2026-09-08T08:48:28.666+00:00) |
| Honig Bakplaat mix courgette & kip | nee | tomaten: package_unknown; voorgekookte aardappelpartjes: no_catalog_product; wortels: category_mismatch; tomaten: stale prijs (2026-09-08T08:48:28.666+00:00) |
| Knorr Wereldgerecht maaltijdpakket italiaanse lasagnette napoletan | ja |  |
| Knorr Mix voor bami | nee | Bami groentepakket: no_catalog_product; bosui: category_mismatch; mie: low_confidence_match |
| Honig Basis voor italiaanse kruidensaus | nee | Provençaalse wokgroenten: no_catalog_product; Spaghetti Original: no_catalog_product; verse basilicum: low_confidence_match; cherrytomaatjes: stale prijs (2026-09-08T08:48:28.666+00:00) |
| Knorr Maaltijdmix lasagne bolognese | nee | lasagnebladen: package_unknown; Knorr Maaltijdmix lasagne bolognese: stale prijs (2026-09-07T18:29:21.249+00:00) |
| Knorr Maaltijdmix tikka masala | nee | magere yoghurt: package_unknown; Knorr Maaltijdmix tikka masala: stale prijs (2026-09-07T18:29:22.853+00:00) |
| Knorr Mix voor tagliatelle | nee | cherrytomaten: stale prijs (2026-09-08T08:48:28.666+00:00) |
| Knorr Mix voor macaroni | ja |  |
| Knorr Mix spaghetti bolognese | ja |  |
| Honig Basis voor spaghettisaus bolognese | nee | gezeefde tomaten: no_catalog_product |
| Knorr Spaghetteria carbonara | nee | Knorr Spaghetteria carbonara: stale prijs (2026-09-10T04:52:56.032+00:00) |
| Honig Basis voor nasi speciaal | nee | nasi/bami groenten: no_catalog_product; Honig Basis voor nasi speciaal: stale prijs (2026-09-10T04:53:16.757+00:00) |
| Honig Basis voor tagliatelle roomsaus | nee | kastanjechampignons: no_catalog_product; spinazie diepvries: low_confidence_match |
| Knorr Mix voor nasi | nee | bosui: category_mismatch; Nasi groentepakket: no_catalog_product |
| Knorr Maaltijdmix mac & cheese | ja |  |
| Knorr Maaltijdmix kip madras | nee | crème fraiche light: no_catalog_product; lente-ui: category_mismatch; tomaten: package_unknown; tomaten: stale prijs (2026-09-08T08:48:28.666+00:00) |
| Knorr Mix macaroni carbonara | nee | hamblokjes: matcher_failed; Knorr Mix macaroni carbonara: stale prijs (2026-09-12T02:27:56.964+00:00) |
| Knorr Risotto bospaddenstoelen | nee | Knorr Risotto bospaddenstoelen: stale prijs (2026-09-07T18:28:41.937+00:00) |
| Knorr Wereldgerechten Mexicaanse taco`s | nee | maïs blik: no_catalog_product; tomaten: package_unknown; tomaten: stale prijs (2026-09-08T08:48:28.666+00:00) |
| Knorr Risotto truffel | ja |  |
| Knorr Wereldgerechten maaltijdpakket mexicaanse burrito's | ja |  |
| Honig Basis voor hachee | nee | hacheevlees: no_catalog_product |
| Honig Basis voor macaronisaus stroganoff | nee | kastanjechampignons: no_catalog_product; Provençaalse wokgroenten: no_catalog_product |

Profielvalidatie, catalogusdekking en verpakking/prijsvalidatie blijven gescheiden. Ontbrekende producten worden niet aangemaakt en onbetrouwbare matches worden niet geforceerd. De gebruikersinterface toont hiervoor bestaande consumententaal.

## Gemeten performance

Echte Supabase-catalogus en prijzen, vier personen, zeven dagen, €100 weekbudget en €70 maaltijdlimiet. Gemeten foreground-serviceflow in dezelfde lokale Node/Vitest-omgeving, geen mocks voor catalogus of prijzen. Background maintenance wordt bij deze read-only meting onderdrukt. De voor/nameting omvat zowel de cachebackfill als de zoekoptimalisatie; netwerkvariatie blijft mogelijk. Dit zijn geen fysieke iPhone-tijden.

| Flow | Voor (ms) | Na (ms) | Verschil | Cataloguszoek-RPC's voor → na |
|---|---:|---:|---:|---:|
| search:spaghetti | 33694 | 751 | 98% | 67 → 0 |
| search:Honig | 6831 | 590 | 91% | 12 → 0 |
| search:Knorr lasagne | 5619 | 339 | 94% | 16 → 0 |
| search:burrito | 232 | 594 | -156% | 0 → 0 |
| select:burrito | 124 | 102 | 18% | 0 → 0 |

Een aparte voormeting van het openen van het Vrije-keuze-paneel en weekgeneratie is niet vastgelegd; daarvoor wordt geen verbetering geclaimd.

## Implementatie en onderhoud

Zoeken beoordeelt de kandidaten en reeds gekozen recepten gezamenlijk. De provider hergebruikt zijn bestaande planningscache; per resultaat komt geen nieuwe readinessquery. Zowel READY als NOT_READY wordt persistent hergebruikt. Producten/prijzen blijven op actualiteit en de bestaande goedkoopste geldige totaaloplossing gecontroleerd. Dynamische profielen behouden hun exacte productreferentie bij generatie en herkeuring.

De bestaande databasetrigger zet toekomstige ondersteunde Honig/Knorr-mixen en gewijzigde verpakkingen op pending. De dagelijkse workflow verwerkt de wachtrij met parser versie 4, behoudt bronbewijs en bouwt 1–10 varianten. Verified profielen worden na 20 uur voor cachevernieuwing geselecteerd zonder opnieuw de bron op te bouwen. Prijs-/productwijzigingen blijven afhankelijkheden invalideren. Nieuwe onbekende of onvolledige bronformaten blijven needs_review.

Let op: GitHub schedule draait alleen vanuit de default branch. Deze wijziging blijft op de Draft PR; de nieuwe parser/onderhoudsversie is dus nog niet automatisch actief op main. Bestaande workflowconfiguratie vereist SUPABASE-secret, PLANNER_CACHE_BASE_URL en PLANNER_CACHE_ADMIN_TOKEN. Er is geen productie-uitrol of merge uitgevoerd.

## Verificatie

425 webtests, 188 importertests, lint, TypeScript en production build geslaagd. Alle 1.330 varianten zijn teruggelezen met 133 cachehits per personenaantal en nul fallback; geen dubbele cachekeys. Mobiele controle van de lokale productiebuild op 375/390/430: weekgeneratie, zoeken, productkaart, opslaan en herladen geslaagd; geen horizontale overflow of browserfouten. 4p/7d/€100/€70 met zes categorieën en een Vrije-keuzedag resulteert na selectie van Knorr Spaghetteria pesto in zeven gerechten en €52,13 aan maaltijden/lijst. Pesto: twee verpakkingen voor vier personen, €5,12. De Vercel Preview vraagt login, waardoor de gedeployde browserflow nog niet is afgetekend. De oorspronkelijke fysieke iPhone-plannerfout is niet reproduceerbaar bewezen; deze wijziging claimt daarom geen aangetoonde serveroorzaak voor die eerdere melding.

## iPhone-hertest

1. Open de nieuwe Preview en gebruik vier personen, zeven dagen, €100 weekbudget en €70 maaltijdlimiet.
2. Genereer een week met een categoriecombinatie; controleer het weekmenu en budget bovenaan.
3. Kies Vrije keuze voor een dag. Zoek spaghetti, Honig, Knorr lasagne en burrito's.
4. Kies een complete mix zoals Knorr Burrito's of Knorr Spaghetteria pesto. Controleer ingrediënten, merk en verpakkingen.
5. Controleer dat een onvolledige mix niet als volledig beschikbaar kan worden gekozen.
6. Voeg toe aan de lijst, heropen de app en controleer week/lijst/budgetpersistentie.
