# Honig/Knorr NO_RECIPE-audit — Production read-only — 10 oktober 2026

## Scope en bronnen

- Auditbron: actuele Production-tabellen in Supabase (alleen SELECT) en de actuele code op remote `main` `9922b4b666c89fed42104b0700e5cd690e6b6459`.
- Deze audit vervangt het verloren lokale checkpoint. De vorige branch/worktree en het eerdere auditbestand waren niet beschikbaar; er is geen remote 1B-branch of auditdocument gevonden.
- Productie-mutaties in deze audit: **0**. Geen profiel-, recipe-, prijs-, product- of readiness-write, refresh, import, migratie of maintenance-run gestart.
- De nieuwste opgeslagen prijs is positief voor alle 17 NO_RECIPE-records. De per-SKU `fetched_at`-tijden staan hieronder. Voor de zeven receptkandidaten zijn die prijsrecords van 24 september; de 10 oktober onderhoudsrun meldde een volledige prijscheck op catalogusniveau, maar logde geen per-SKU prijsresultaat. Daarom is de positieve opgeslagen prijs bewezen; de prijsversheid per SKU is niet individueel bewezen.

## Live aantallen

Readiness hieronder is de Production-cache voor 4 personen. `pending` betekent dat de cache-refresh nog niet actueel was; een daar getoonde READY/NOT_READY is dan de laatst opgeslagen uitslag en geen nieuwe actuele beoordeling.

| Merk | Profielen | Profiel verified | Current READY (p4) | Cached READY, refresh pending | Cached NOT_READY, refresh pending | NO_RECIPE / no recipe_id |
|---|---:|---:|---:|---:|---:|---:|
| Honig | 20 | 18 | 5 | 6 | 7 | 2 |
| Knorr | 37 | 22 | 5 | 12 | 5 | 15 |

Alle 17 NO_RECIPE-profielen hebben `status=needs_review`, `profile=null`, `recipe_id=null`, `meal_mix_profiles.cache_status=pending`; er is geen gekoppelde recipe-readiness-cache voor het profiel zolang `recipe_id` ontbreekt. Alle prijzen in de lijst zijn positief opgeslagen bedragen.

## Volledige NO_RECIPE-inventaris

`profile-id` hieronder is het bestaande product/profile `product_id`; het huidige `recipe_id` is null. De doelrecepten in de volgende sectie zijn al bestaande `recipes`-rijen. De bronreden is de actuele Production-waarde van `meal_mix_profiles.reason`.

| Merk | SKU | Product | Catalogusmerk | Huidige status/cache | Profile-id; huidige recipe-id | Mogelijk bestaand doelrecept / huidige doel-cache | Laatste opgeslagen prijs | Bronblokkade |
|---|---|---|---|---|---|---|---|---|
| Honig | 051885000 | Honig Basis voor kip kerrie | Honig | needs_review / profile-cache pending | `6fe5b134-caa2-4681-bf0e-deddb2ae0891`; current recipe_id: null | — | €1.93 (2026-09-15 16:27:27.235+00); positief: ja; versheid individueel niet bevestigd | bronprofiel mist 1 klein blikje ananas |
| Honig | 181617000 | Honig Basis voor goulash | ontbreekt | needs_review / profile-cache pending | `8ef62432-9cdb-4373-9f5e-f9f88ecd4894`; current recipe_id: null | — | €1.99 (2026-10-08 05:56:39.378+00); positief: ja; versheid individueel niet bevestigd | bronpagina/evidence niet beschikbaar; geen profiel |
| Knorr | 067439000 | Knorr Wereldgerechten trattoria kipfilet toscana | Knorr | needs_review / profile-cache pending | `f7ebe67c-ba74-48da-8b81-f8722fd11edd`; current recipe_id: null | — | €4.89 (2026-09-24 04:27:35.881+00); positief: ja; versheid individueel niet bevestigd | bronpagina/evidence niet beschikbaar; geen profiel |
| Knorr | 231215000 | Knorr Wereldgerecht maaltijdpakket chinese beef shanghai | Knorr | needs_review / profile-cache pending | `837af4a6-b7b6-4fd4-8eea-3437d4f138a7`; current recipe_id: null | — | €5.14 (2026-09-24 04:27:25.046+00); positief: ja; versheid individueel niet bevestigd | supplementlijst ambigue; meerdere losse hoeveelheden/ingrediënten zonder veilige parse |
| Knorr | 686060000 | Knorr Wereldgerechten maaltijdpakket thaise kip siam | Knorr | needs_review / profile-cache pending | `4076c0fb-88d3-427b-9fd9-375238bf639f`; current recipe_id: null | Knorr Thaise Kip Siam met groente (6593543a-5c8d-409d-8c9e-145632c43f0b); 4 ingredientregels; exact product-SKU als valid ingredient-productmatch; targetcache p4 READY/current (0) | €3.99 (2026-09-24 04:27:42.939+00); positief: ja; versheid individueel niet bevestigd | bronpagina/evidence niet beschikbaar; geen profiel |
| Knorr | 686149000 | Knorr Wereldgerecht maaltijdpakket zuid-afrikaanse bobotie | Knorr | needs_review / profile-cache pending | `16bf1a5e-0013-4736-a1c1-e68653c78448`; current recipe_id: null | — | €4.59 (2026-09-24 04:27:33.866+00); positief: ja; versheid individueel niet bevestigd | bronpagina/evidence niet beschikbaar; geen profiel |
| Knorr | 686150000 | Knorr Wereldgerechten maaltijdpakket italiaanse lasagne bolognese | Knorr | needs_review / profile-cache pending | `e12d25bd-d0d6-4438-b47c-e2f9faac2141`; current recipe_id: null | Knorr Italiaanse lasagne bolognese (17b1cade-cd86-4c55-81b6-ceeef22ed196); 6 ingredientregels; exact product-SKU als valid ingredient-productmatch; targetcache p4 READY/pending (0) | €3.99 (2026-09-24 04:27:20.793+00); positief: ja; versheid individueel niet bevestigd | supplementlijst ambigue; hoeveelheden/ingrediënten niet betrouwbaar te scheiden |
| Knorr | 704881000 | Knorr Wereldgerecht kip madras | ontbreekt | needs_review / profile-cache pending | `2f01025d-b252-4ee1-a7dc-02477a4f50ac`; current recipe_id: null | — | €5.99 (2026-10-08 06:54:52.888+00); positief: ja; versheid individueel niet bevestigd | bronpagina/evidence niet beschikbaar; geen profiel |
| Knorr | 704884000 | Knorr Wereldgerechten maaltijdpakket surinaamse roti | Knorr | needs_review / profile-cache pending | `be25316f-e359-4e49-b0b4-502735628c6e`; current recipe_id: null | Knorr Surinaamse roti met kip (654b1b0c-6a25-412e-9119-b05a475e0d2e); 6 ingredientregels; exact product-SKU als valid ingredient-productmatch; targetcache p4 READY/pending (0) | €4.49 (2026-09-24 04:27:32.363+00); positief: ja; versheid individueel niet bevestigd | bronpagina/evidence niet beschikbaar; geen profiel |
| Knorr | 704888000 | Knorr Wereldgerechten maaltijdpakket indiase kip madras | Knorr | needs_review / profile-cache pending | `3396a525-01c4-492b-937c-3f5805033731`; current recipe_id: null | Knorr Indiase Kip Madras (f6460830-bd8e-4e85-9568-5336f5543bfb); 7 ingredientregels; exact product-SKU als valid ingredient-productmatch; targetcache p4 READY/pending (0; profile recipe rows 7 vs cached required 8) | €3.99 (2026-09-24 04:27:41.511+00); positief: ja; versheid individueel niet bevestigd | bronpagina/evidence niet beschikbaar; geen profiel |
| Knorr | 704889000 | Knorr Wereldgerecht maaltijdpakket indiase kip tandoori | Knorr | needs_review / profile-cache pending | `59733f76-c7ee-404d-8f53-d05f7582b856`; current recipe_id: null | — | €3.29 (2026-09-24 04:27:45.102+00); positief: ja; versheid individueel niet bevestigd | bronpagina/evidence niet beschikbaar; geen profiel |
| Knorr | 704892000 | Knorr Wereldgerechten maaltijdpakket japanse teriyaki | Knorr | needs_review / profile-cache pending | `339d97f8-b509-41ef-b92a-c8f84ae9c536`; current recipe_id: null | Knorr Japanse teriyaki met runderreepjes (4404d963-73f3-4cc7-b8d0-b9a91cbca5da); 5 ingredientregels; exact product-SKU als valid ingredient-productmatch; targetcache p4 NOT_READY/pending (2: runderreepjes matcher_failed; peultjes no_catalog_product) | €4.69 (2026-09-24 04:27:38.757+00); positief: ja; versheid individueel niet bevestigd | bronpagina/evidence niet beschikbaar; geen profiel |
| Knorr | 704894000 | Knorr Wereldgerecht maaltijdpakket portugese kip piri piri | Knorr | needs_review / profile-cache pending | `84848e22-562f-4a41-871d-f8346cff53db`; current recipe_id: null | — | €4.60 (2026-09-24 04:27:37.226+00); positief: ja; versheid individueel niet bevestigd | bronpagina/evidence niet beschikbaar; geen profiel |
| Knorr | 704897000 | Knorr Wereldgerechten maaltijdpakket hokkien mie | Knorr | needs_review / profile-cache pending | `04047132-64d3-4f0c-b94e-0364996a49b6`; current recipe_id: null | Knorr Hokkien Mie met kip en groente (4718fbbd-5cd9-4a58-841c-e62bee4574db); 3 ingredientregels; exact product-SKU als valid ingredient-productmatch; targetcache p4 READY/pending (0) | €4.99 (2026-09-24 04:27:26.457+00); positief: ja; versheid individueel niet bevestigd | bronpagina/evidence niet beschikbaar; geen profiel |
| Knorr | 704898000 | Knorr Wereldgerechten maaltijdpakket griekse kofta | Knorr | needs_review / profile-cache pending | `5660e2f5-a71a-46eb-b964-cfa703b4367a`; current recipe_id: null | Knorr Griekse kofta met rundergehakt (95cfbfc8-45a0-4de9-b015-a731cb015107); 4 ingredientregels; exact product-SKU als valid ingredient-productmatch; targetcache p4 READY/pending (0) | €4.59 (2026-09-24 04:27:40.036+00); positief: ja; versheid individueel niet bevestigd | bronpagina/evidence niet beschikbaar; geen profiel |
| Knorr | 726496000 | Knorr Asia special korean bbq | Knorr | needs_review / profile-cache pending | `79f27025-097a-4780-a186-147f860a4861`; current recipe_id: null | — | €3.18 (2026-09-24 04:27:16.037+00); positief: ja; versheid individueel niet bevestigd | bron heeft geen ingrediëntlijst |
| Knorr | 733172000 | Knorr Air fryer mix voor koreaanse kip | Knorr | needs_review / profile-cache pending | `b663b427-00de-449a-846a-cd50267a2e41`; current recipe_id: null | — | €1.95 (2026-09-29 08:27:11.418+00); positief: ja; versheid individueel niet bevestigd | porties op verpakking ontbreken |

## Bewezen bestaande receptkoppelingen

Deze zeven zijn exacte bestaande-receptmatches, geen nieuwe recepten en geen vrije productmatch. Voor elk product bestaat er een Knorr-recept waarvan de receptingrediëntenlijst een geldige ingredient-productmatch bevat naar precies dezelfde Knorr-SKU. De recipe-ID, ingrediëntenrijen en cachetoestand zijn read-only uit Production gelezen.

| SKU | Product | Positieve opgeslagen prijs | Bestaand doelrecept | Recipe-id | Receptingredienten | Exacte productmatch | P4 doelcache | Beperking |
|---|---|---:|---|---|---:|---|---|---|
| 686060000 | Knorr Wereldgerechten maaltijdpakket thaise kip siam | €3.99 (laatst opgeslagen 2026-09-24 04:27:42.939+00) | Knorr Thaise Kip Siam met groente | `6593543a-5c8d-409d-8c9e-145632c43f0b` | 4 | 1 exact Knorr-SKU-productmatch | READY/current | 0 |
| 686150000 | Knorr Wereldgerechten maaltijdpakket italiaanse lasagne bolognese | €3.99 (laatst opgeslagen 2026-09-24 04:27:20.793+00) | Knorr Italiaanse lasagne bolognese | `17b1cade-cd86-4c55-81b6-ceeef22ed196` | 6 | 1 exact Knorr-SKU-productmatch | READY/pending | 0 |
| 704884000 | Knorr Wereldgerechten maaltijdpakket surinaamse roti | €4.49 (laatst opgeslagen 2026-09-24 04:27:32.363+00) | Knorr Surinaamse roti met kip | `654b1b0c-6a25-412e-9119-b05a475e0d2e` | 6 | 1 exact Knorr-SKU-productmatch | READY/pending | 0 |
| 704888000 | Knorr Wereldgerechten maaltijdpakket indiase kip madras | €3.99 (laatst opgeslagen 2026-09-24 04:27:41.511+00) | Knorr Indiase Kip Madras | `f6460830-bd8e-4e85-9568-5336f5543bfb` | 7 | 1 exact Knorr-SKU-productmatch | READY/pending | 0; profile recipe rows 7 vs cached required 8 |
| 704892000 | Knorr Wereldgerechten maaltijdpakket japanse teriyaki | €4.69 (laatst opgeslagen 2026-09-24 04:27:38.757+00) | Knorr Japanse teriyaki met runderreepjes | `4404d963-73f3-4cc7-b8d0-b9a91cbca5da` | 5 | 1 exact Knorr-SKU-productmatch | NOT_READY/pending | 2: runderreepjes matcher_failed; peultjes no_catalog_product |
| 704897000 | Knorr Wereldgerechten maaltijdpakket hokkien mie | €4.99 (laatst opgeslagen 2026-09-24 04:27:26.457+00) | Knorr Hokkien Mie met kip en groente | `4718fbbd-5cd9-4a58-841c-e62bee4574db` | 3 | 1 exact Knorr-SKU-productmatch | READY/pending | 0 |
| 704898000 | Knorr Wereldgerechten maaltijdpakket griekse kofta | €4.59 (laatst opgeslagen 2026-09-24 04:27:40.036+00) | Knorr Griekse kofta met rundergehakt | `95cfbfc8-45a0-4de9-b015-a731cb015107` | 4 | 1 exact Knorr-SKU-productmatch | READY/pending | 0 |

Teriyaki (`704892000`) heeft in de laatst opgeslagen p4-cache `NOT_READY / pending`, met twee bekende issues: `runderreepjes: matcher_failed` en `peultjes: no_catalog_product`. Dit is een bestaand-receptmatch, geen toestemming om ingrediënten of productmatches te repareren. De andere zes doelcaches zijn als READY opgeslagen, maar vijf daarvan staan op `refresh_status=pending`; alleen Kip Siam is momenteel `READY/current`. Een gerichte post-link readiness-refresh is nog niet uitgevoerd.

## Niet bewezen kandidaten en resterende blokkades

- **Honig 2:** SKU 051885000 mist de benoemde supplementinhoud `1 klein blikje ananas`; SKU 181617000 heeft `source_unavailable` en catalogusmerk ontbreekt. Geen bestaande receptkoppeling zonder aanvullend bewijs.
- **Knorr 8 resterend:** SKU 067439000, 686149000, 704881000, 704889000 en 704894000 hebben `source_unavailable`; 231215000 heeft `supplement_ambiguous`; 726496000 heeft `supplement_list_missing`; 733172000 heeft `package_servings_missing`.
- **SKU 704881000** blijft uitdrukkelijk uitgesloten: het catalogusmerk ontbreekt, ondanks de Knorr-profieltekst.
- Voor deze acht Knorr-records is geen exact bewezen doelrecept opgenomen. Er wordt geen vervangend record gekozen en er is geen profiel aangepast.

Indeling resterende tien: 6 `source_unavailable` (waaronder 181617000 en 704881000; bij 704881000 ook ontbrekend catalogusmerk), 1 ontbrekende supplementinhoud (051885000), 1 ambigue supplementlijst (231215000), 1 ontbrekende ingrediëntenlijst (726496000), 1 ontbrekende verpakkingsporties (733172000).

## Onderhoudsrun en Production-postcheck

- Dry-run [38061167591](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/38061167591) op main `9922b4b`: geslaagd; `DRY_RUN=1`, bevestiging leeg. Snapshot compleet: 20 rootcategorieën, 20 listingroutes, 420 listingwindows/primary windows. Eén begrensde Zyte-fallback op de verwachte next-window `https://hoogvliet.nl/frisdrank-sappen/q/page/13`: 1 attempt/providerrequest, 1 succes, 0 failures, 30 raw en 30 unieke SKU’s, 7.745 ms. `snapshot_complete=true`.
- Production write-run [38063646183](https://github.com/boodschappenmaatje/Boodschappenmandje-importer/actions/runs/38063646183) op dezelfde main: geslaagd met `DRY_RUN=0` en expliciete workflowbevestiging. Runaccounting: 7.945 actuele SKU’s; 7.616 bulkprijschecks + 329 detailfallbacks; 0 nieuwe producten, 562 bestaande prijzen gewijzigd, 7.383 ongewijzigd; 414 Production-only/verdwenen producten behouden; 0 duplicaten; dezelfde ene succesvolle Zyte-fallback; `snapshot_complete=true`.
- Read-only Production-postcheck na die run: 8.359 productrecords met exact supermarketlabel `Hoogvliet`, alle 8.359 met een prijs; 0 niet-positieve prijsrijen; 0 dubbele SKU-groepen; 562 prijsrijen bijgewerkt sinds de run. Dat is 7.945 actuele SKU’s + 414 behouden Production-only/verdwenen records. Daarnaast bestaan 3 oude testproducten (`TEST-001`–`TEST-003`) met label `hoogvliet` (kleine letters), elk met prijs; ze vallen buiten de maintenance-run en zijn niet gewijzigd. Geen orphan-prijsrijen gevonden.
- Geen actieve, niet-verlopen cataloguslock. Er staan wel twee oude `retry_scheduled` catalogusjobs met verlopen `next_retry_at` (29 september en 6 oktober); ze hebben geen lock en zijn geen door deze audit gestarte jobs.

## Writegate en volgende checkpoint

**In deze audit-PR is geen 1B Production-write toegestaan of uitgevoerd.** De zeven exact bewezen receptkoppelingen zijn:
`686060000`, `686150000`, `704884000`, `704888000`, `704892000`, `704897000`, `704898000`.

Voor een latere afzonderlijk geautoriseerde writegate: herbevestig vlak vóór schrijven per SKU het positieve prijsrecord en catalogusmerk, controleer dat dezelfde bestaande recipe-ID en geldige exacte Knorr-SKU-ingredientmatch nog bestaan; wijzig uitsluitend `meal_mix_profiles.recipe_id` voor de nog geldige records; refresh daarna alleen de daardoor geraakte readiness en lees die read-only na. Geen prijs-/productwrite, nieuwe recept-/ingrediëntdata, overige NO_RECIPE-profielen, geforceerde matches, migratie of globale readiness-rebuild. Teriyaki blijft NOT_READY zolang de genoemde blockers niet afzonderlijk met bewijs zijn opgelost.
