# PWA 13 — Honig/Knorr en cache: vervolgcheckpoint

Datum: 2026-09-21. Status: code voorbereid en getest; dataverrijking, cache-refresh en live performancebewijs nog niet afgerond.

## Hersteld checkpoint

Repository: boodschappenmaatje/Boodschappenmandje-importer. Branch: codex/pwa-13-vrije-keuze. Draft PR #25.
Remote beginhead: 130d3d172f875ddd0fc569e9a0abb2dfd87a002b. Main: 2bda28b8aa184de6bc58d9acd3264fbe39f9fea8.
De volledige bronboom is hersteld met gecontroleerde Git-blobhashes; tree SHA 01156a6fc282d317d96a974ece1a9ab37a073b22. Oudere lokale werkmappen/patches zijn behouden.

## Databasecontrole — alleen gelezen

| Merk | Totaal | Verified / profiel current | Needs review / pending |
|---|---:|---:|---:|
| Honig | 19 | 6 | 13 |
| Knorr | 22 | 9 | 13 |
| Totaal | 41 | 15 | 26 |

150 gekoppelde mix-readinessvarianten bestaan: 15 per people_count 1–10. Daarvan zijn 140 pending en 10 current. Per personenaantal zijn dat 14 pending en 1 current. Profiel-cache-status en daadwerkelijke readiness zijn dus niet gelijk. De invalidatieoorzaken zijn product_match_changed (100 varianten) en product_price_changed (40 varianten). De huidige profielworker kijkt alleen naar profielstatus en mist deze onafhankelijke invalidatie en de readiness-TTL.

De bewaarde p4-uitkomst bevat 14 NOT_READY en 1 READY (Knorr burrito's); ook de READY-rij is inmiddels pending. Dit is geen bewijs van actuele selecteerbaarheid. De 14 NOT_READY-profielen noemen ontbrekende catalogusproducten, onvoldoende betrouwbare matches, categorieproblemen of onbruikbare verpakkingseenheden. Deze oorzaken zijn niet kunstmatig weggewerkt.

Laatste telling: 112 recipes, 403 recipe_ingredients, 140 ingredients, 205 aliases, 3978 products, 3978 product_prices, 179 matches en 1120 readinessrecords. Dit zijn actuele tellingen, geen vergelijking met de veel oudere p4-pilot. Deze uitvoering heeft geen databasewrites of importer-run uitgevoerd.

## Oorzaken van de 26 onvolledige profielen

De opgeslagen eerste fout per profiel: 20 ontbrekende portieverklaring; 3 ontbrekende aanvullende-ingrediëntenlijst; 2 onduidelijke inhoudsvorm; 1 ontbrekende/ambiguë hoeveelheid. Dit zijn parserredenen, niet automatisch bewezen afwezigheid van broninformatie.

Alle 26 gekoppelde Hoogvliet-productpagina's zijn opnieuw opgevraagd. De uitgegeven fabrikantinformatie is beoordeeld; fabrikantzoekresultaten leverden geen volledige vervangende dataset op. Geen generieke internetrecepten gebruikt.

Concrete bevindingen:

- Honig tagliatelle vermeldt 200 g diepvries-spinazie. De parser behandelt de haakjes ten onrechte als onbekende verpakkingsinhoud. Gerichte parserfix behoudt de diepvrieseis. Een aanvullende matchtest voorkomt vervanging door verse spinazie.
- Honig kip kerrie specificeert een klein blikje ananas zonder betrouwbare inhoudsmaat. Geen gewicht verzonnen.
- Knorr nasi bevat in de Hoogvliet-tekst een ontbrekende eenheid bij taugé. Andere retailerinformatie noemt gram, maar een automatische product-/verpakkingsidentiteitscontrole is nog niet geïmplementeerd; niets klakkeloos overgenomen.
- Spaghetteria carbonara en pesto noemen twee personen en uitsluitend waterbereiding. Dit is geen ontbrekend aanvullend ingrediënt. De huidige databaseconstraint vereist echter minstens één supplement. Een lege, betrouwbaar onderbouwde supplementenlijst kan nu niet als verified worden opgeslagen. Er is geen constraintwijziging uitgevoerd en geen fictief supplement toegevoegd.
- De verpakkingsfoto van Honig boontjes/gehaktballetjes toont vier porties, terwijl de paginabereidingstekst die informatie mist. Gecontroleerde koppeling van verpakkingsbeeldbewijs aan het profiel ontbreekt nog. Dit profiel is niet ten onrechte als afgerond gerapporteerd.

| Merk | Profiel / bron | Opgeslagen eerste blocker |
|---|---|---|
| Honig | [Honig Bakplaat mix boontjes & gehaktballetjes](https://www.hoogvliet.com/product/honig-bakplaat-mix-boontjes-gehaktballetjes) | package_servings_missing |
| Honig | [Honig Bakplaat mix broccoli & rundervink](https://www.hoogvliet.com/product/honig-bakplaat-mix-broccoli-rundervink) | package_servings_missing |
| Honig | [Honig Bakplaat mix courgette & kip](https://www.hoogvliet.com/product/honig-bakplaat-mix-courgette-kip) | package_servings_missing |
| Honig | [Honig Basis voor bami speciaal](https://www.hoogvliet.com/product/honig-basis-voor-bami-speciaal1) | package_servings_missing |
| Honig | [Honig Basis voor chili con carne](https://www.hoogvliet.com/product/honig-basis-voor-chili-con-carne) | package_servings_missing |
| Honig | [Honig Basis voor italiaanse kruidensaus](https://www.hoogvliet.com/product/honig-basis-voor-italiaanse-kruidensaus1) | package_servings_missing |
| Honig | [Honig Basis voor kip kerrie](https://www.hoogvliet.com/product/honig-basis-voor-kip-kerrie) | supplement_content_missing:1 klein blikje ananas |
| Honig | [Honig Basis voor spaghettisaus bolognese](https://www.hoogvliet.com/product/honig-basis-voor-spaghettisaus-bolognese) | package_servings_missing |
| Honig | [Honig Basis voor tagliatelle roomsaus](https://www.hoogvliet.com/product/honig-basis-voor-tagliatelle-roomsaus) | supplement_content_missing:200 g spinazie diepvries |
| Honig | [Honig Familiegerecht Oosterse wraps](https://www.hoogvliet.com/product/honig-familiegerecht-oosterse-wraps) | package_servings_missing |
| Honig | [Honig Maaltijdsoep erwten](https://www.hoogvliet.com/product/honig-maaltijdsoep-erwten) | package_servings_missing |
| Honig | [Honig Mix voor boerenomelet](https://www.hoogvliet.com/product/honig-mix-voor-boerenomelet) | package_servings_missing |
| Honig | [Honig Mix voor kapucijners](https://www.hoogvliet.com/product/honig-mix-voor-kapucijners) | package_servings_missing |
| Knorr | [Knorr Air fryer mix voor krokante kip knoflook](https://www.hoogvliet.com/product/knorr-air-fryer-mix-voor-krokante-kip-knoflook) | package_servings_missing |
| Knorr | [Knorr Maaltijdmix kebab](https://www.hoogvliet.com/product/knorr-maaltijdmix-kebab) | package_servings_missing |
| Knorr | [Knorr Maaltijdmix mac & cheese](https://www.hoogvliet.com/product/knorr-maaltijdmix-mac-cheese) | package_servings_missing |
| Knorr | [Knorr Mix macaroni carbonara](https://www.hoogvliet.com/product/knorr-mix-macaroni-carbonara1) | supplement_list_missing |
| Knorr | [Knorr Mix voor nasi](https://www.hoogvliet.com/product/knorr-mix-voor-nasi2) | supplement_quantity_missing:nasi groentepakket 450 g 125 tauge |
| Knorr | [Knorr Mix voor tagliatelle](https://www.hoogvliet.com/product/knorr-mix-voor-tagliatelle1) | package_servings_missing |
| Knorr | [Knorr Risotto bospaddenstoelen](https://www.hoogvliet.com/product/knorr-risotto-bospaddenstoelen) | package_servings_missing |
| Knorr | [Knorr Risotto truffel](https://www.hoogvliet.com/product/knorr-risotto-truffel) | package_servings_missing |
| Knorr | [Knorr Spaghetteria carbonara](https://www.hoogvliet.com/product/knorr-spaghetteria-carbonara) | supplement_list_missing |
| Knorr | [Knorr Spaghetteria pesto](https://www.hoogvliet.com/product/knorr-spaghetteria-pesto) | supplement_list_missing |
| Knorr | [Knorr Spaghetteria pomodoro mozzarella](https://www.hoogvliet.com/product/knorr-spaghetteria-pomodoro-mozzarella) | package_servings_missing |
| Knorr | [Knorr Wereldgerechten maaltijdpakketten italiaanse risotto](https://www.hoogvliet.com/product/knorr-wereldgerechten-maaltijdpakketten-italiaanse-risotto) | package_servings_missing |
| Knorr | [Knorr Wereldgerechten Mexicaanse taco`s](https://www.hoogvliet.com/product/knorr-wereldgerechten-mexicaanse-taco-s) | package_servings_missing |

## Codewijzigingen

1. Vrije keuze gebruikt de bestaande gedeelde planningscache. Kandidaten en reeds gekozen gerechten worden in één readinessronde geladen. Alleen complete kandidaten krijgen de bestaande volledige budget-/verpakkingsvalidatie; ontbrekende/stale records behouden de centrale fallback.
2. Eén catalogussnapshot wordt binnen een zoekactie hergebruikt. Productreads worden gedeeld. Geen bronopbouw vanuit de consumentenflow.
3. De meal_mix_profiles-query loopt parallel aan de vier onafhankelijke catalogusqueries: één netwerkgolf in plaats van twee voor die catalogusload.
4. De bestaande profielworker krijgt een begrensde controle op werkelijke readiness p1–10: ontbrekend, pending, invalidated of verlopen. Alleen betrokken verified recepten gaan naar de bestaande refreshroute; current recepten en brondata blijven ongemoeid. Geen tweede importer-/matchingpipeline.
5. Parser versie 3 herbeoordeelt needs_review-profielen van oudere parserversies; correct verified bronbewijs wordt niet alleen wegens een versienummer opnieuw opgehaald.
6. Expliciete diepvriesinformatie blijft behouden in parser én matcher.

De bestaande database-trigger blijft nieuwe/gewijzigde Honig/Knorr-producten queuen. De bestaande onderhoudsworkflow verwerkt die queue. Omdat PR #25 niet is gemerged, is de gewijzigde geplande workflow nog niet op main actief. Er is geen nieuwe trigger, migratie of grant toegevoegd.

## Validatie en performancebewijs

De regressietest met drie gerechten gaf vóór 7 catalogusrepository-aanroepen en 6 ingredient-search-aanroepen; na 1 en 2. Dit meet service-aanroepen met testfixtures, niet echte browsernetwerkrequests. De bestaande Provider had al requestmemoisatie; deze cijfers mogen daarom niet als gemeten iPhone-latencywinst worden gepresenteerd.

Tests voor alle p1–10 tonen correcte hoeveelheden/verpakkingen/prijzen, één persistente lookup en één productbatch voor twee identieke zoekacties, zonder live search. Een verlopen cache met ontbrekende producten wordt terecht niet READY. Onderhoudstests tonen gerichte refresh van pending/verlopen/ontbrekende varianten, idempotentie en behoud van niet-betrokken recepten.

Gerichte webtests: 50/50. Volledige importer-tests: 183/183. Volledige webtests: 419/419. ESLint, TypeScript en Next.js production build geslaagd. De lokale build vereiste herstel van de dependencies binnen de projectmap; hiervoor is geen projectconfiguratie aangepast.

## Niet afgerond / concrete blockers

- Deze browsersessie bereikt een Vercel-loginpagina. De veilige aanmeldvraag is geweigerd. De Vercel-integratie kan ook geen tijdelijke toegang maken: beheer-API 403. Beveiliging is niet gewijzigd.
- Directe Supabase REST-toegang vanuit de lokale uitvoeromgeving time-out; de Supabase-connector werkt voor de uitgevoerde read-only controles. Een werkende geautoriseerde serveruitvoering van de bestaande onderhoudsservice is in deze sessie nog niet vastgesteld.
- Geen nieuwe profielen gepubliceerd: nieuw compleet gemaakt = 0. Profieltellingen blijven 6/13 Honig en 9/13 Knorr. Cachevarianten blijven 150 → 150; de 140 pending rijen zijn nog niet vernieuwd.
- Geen live vóór/na-tijden beschikbaar voor weekgeneratie, Vrije keuze openen, spaghetti/Honig zoeken of selectie. Geen percentages of fysieke iPhone-resultaten geclaimd.
- Water-only-profielen vereisen een afzonderlijk beoordeelde aanpassing van de bestaande constraint en modelvalidatie. Geen databasewijziging hiervoor uitgevoerd.

## Vervolg na veilige toegang

Gebruik exact deze branch, valideer het resterende bronbewijs, voer de bestaande begrensde profiel-/cacheworker uit tegen de juiste Preview en controleer alle p1–10-rijen opnieuw. Meet dezelfde vijf flows vóór verdere optimalisatie. Pas daarna fysieke hertest: Safari Preview openen, 4 personen/7 dagen/€100 weekbudget/€70 maaltijdbudget, week genereren, Vrije keuze openen, spaghetti en Honig zoeken, een werkelijk complete mix selecteren, merk/verpakkingen/prijs/budget controleren; vervolgens dezelfde keuze voor 1 en 10 personen.

Geen merge, Production-appdeployment, brede import, handmatige prijs/productcorrectie of canonieke databasewijziging uitgevoerd.
