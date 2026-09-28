# Actions en dagelijkse Hoogvliet-groei — 28 september 2026

## Remote uitgangspunt en bewijs

- Main: `31705dd90c1f6d4b6d705b24219958f0c7894c84`.
- Bestaande Draft PR #31, `fix/daily-catalog-retry-schedule`, hervat op `8c72e42e76b5c9ec5499ec694303dab84f261c5e`. PR #30 Home en historische PR #21 blijven buiten scope.
- De huidige runners starten. De gebruiker meldt 2.163/3.000 minuten en $0 billable usage. De accountblokkade van 27 september is geen verklaring voor deze uitvoeringsfout.
- Honig/Knorr run `36388932160`, job `108820231782`: checkout/install/Chromium success; profielscript failure na ongeveer 2,4 seconden. `PLANNER_CACHE_BASE_URL` is de oude PR #23-preview `...git-fix-planne-a4a7f3...`.
- Supabase edge-log om `2026-09-28T06:56:36.625Z`: GET `meal_mix_profiles` HTTP 200, daarna geen volgende databaseaanvraag in de foutperiode. De eerste queued records zijn verified met geldige recipe_id; de volgende scriptstap is mix-refresh.
- Op de bijbehorende oude branch `fix/planner-new-product-maintenance` ontbreekt `apps/web/src/app/api/internal/planner-readiness/mix-refresh/route.ts`; de route bestaat op de actuele main. De oude Preview is bovendien beveiligd met Vercel-login. Daarmee is de structurele Preview-afhankelijkheid aantoonbaar verkeerd/verouderd. **De exacte historische HTTP-status van de refresh is niet bewaard door het oude script en kon niet uit Vercel worden opgehaald: connector heeft geen toegang tot deze scope (403). Geen verzonnen 401/404, tokenfout of timeout als gemeten feit.**
- Dagimport `36376081052`, job `108782085772`: 1.731 unieke kandidaten, 290 zoektermen, 0 nieuw, 0 bronfouten, stop `page_safety_limit` na ~70,6 minuten. De scan heeft het volledige bronassortiment niet bewezen uitgeput.
- Read-only dagstatus: 25 september 400; 26 september 400; 27 september 61 (7 attempts); 28 september 0 (1 attempt, retry_scheduled). Catalogusscope `Hoogvliet`: 6.052; apart bestaan 3 oudere lowercase `hoogvliet`-records. Geen records veranderd/verwijderd.

## Gevonden importerfouten

1. Na maximaal 20 pagina's per term wordt `nextPage` teruggezet naar 0 wanneer geen globale limiet is geraakt; ongelezen vervolgpagina's gaan verloren. De aparte grens `maxPerTerm=40` kapt eveneens een productieve term af.
2. 800 opgehaalde pagina's kunnen de verwerking van de net opgehaalde kandidaten al blokkeren. Een veiligheidsstop is daarna slechts een generieke partial met nieuwe retry.
3. Yield-prioritering en ontbreken van een daggebonden lijst van afgeronde routes laten retries dezelfde bekende resultaten opnieuw bezoeken.
4. Bronuitputting, veiligheidsstop en storing hebben geen afzonderlijke terminale dagafhandeling. Bestaande kandidaten/duplicaten ontbreken in het dagelijkse verslag.
5. De groeimetingen gebruiken catalogustotaal-na minus totaal-voor en een beginmoment-SKU-snapshot; dat is geen bewijs van door deze run bevestigde nieuwe product/prijs-paren bij races of gedeeltelijke schrijffouten.

## Herstel

- Bestaande collector/browser/validator blijven de bronadapter. De growth-loop verwerkt alle kandidaten van iedere pagina/window en vervolgt dezelfde term tot een werkelijk einde; de catalogusmodus blijft zijn bestaande limieten gebruiken.
- Read-only browsercontrole van Hoogvliet: zoekterm rijst heeft 31 producten, API-pagina 0 toont 16 producten/current=1/last=2; API-pagina 1 toont 15/current=2/last=2. API-pagina 2 zit daar voorbij. **URL-pagina's zijn 0-based, DOM-pagina's 1-based.** De paginering leest `.storePageNo`, `#nrofpages` en de resultaatteller, zet deze expliciet om en bezoekt geen pagina voorbij het bewezen einde. De werkelijke paginagrootte kan afwijken van aangevraagde PageSize.
- Echte nulresultaten zijn afzonderlijk gecontroleerd: “Helaas, we hebben niks kunnen vinden” / “We hebben geen resultaten gevonden”. Een lege loader zonder dit bewijs is geen bronuitputting.
- Daggebonden afgeronde routes en hervatpagina worden in bestaande discovery-metadata opgeslagen (versie 3, compatibel met versie 2); geen schemawijziging/migratie. Een nieuwe dag controleert routes opnieuw vanaf pagina 0. Onverwacht gestopte verwerking herhaalt het huidige window veilig.
- Alleen UUID-bevestigde nieuwe inserts én bevestigde positieve prijzen tellen. Bestaande/concurrent ingevoegde SKU's tellen niet als nieuw. Een batch is nooit groter dan het resterende doel. Gedeeltelijk bevestigde writes blijven bij een latere fout in het resultaat aanwezig.
- Succes onder 400 uitsluitend bij aantoonbaar doorlopen zoekroutes, zonder technische fouten. Gebruik bestaande terminale `daily_target_partial` met concrete uitputtingsreden en zonder retry. Dit bewijst uitputting van de beschikbare zoekroutes, niet van onbekende/veranderde routes buiten de huidige bronadapter.
- Veiligheidsgrenzen blijven 800 pagina's / 6.000 unieke kandidaten / 105 minuten per attempt. Ze bewaren een vervolgpositie en benoemen hun stopreden; ze claimen geen bronuitputting. Dagvenster 06–23 uur Amsterdam blijft bestaan. De veilige grenzen garanderen niet dat de volledige bron op één kalenderdag kan worden doorlopen.
- PR #31 behoudt drie retryvensters (08:17/13:17/18:17 UTC), 120/180/240 minuten cooldown, gedeelde Actions-concurrency en bestaande transactionele dagclaim/locktoken. Tijdelijke navigatiefouten: maximaal twee retries met backoff in dezelfde run. Permanente fouten blijven zichtbaar; geen nieuwe workflowdispatch-loop.
- Geplande import/retry/profielonderhoud gebruiken de vaste `https://boodschappenmaatje-pwa.vercel.app`. Historische uitsluitend-handmatige PR #23-preflight/falafelpoorten blijven intact.
- Profielonderhoud valideert configuratie, weigert Preview-origins, controleert exact teruggegeven recipe IDs en logt fase/status/veilige API- of netwerkcode. Geen headers, tokens, raw bodies of ongeredigeerde exceptions. Tijdelijke HTTP/netwerkfouten krijgen maximaal twee retries (1s, 2s), auth/redirect/404 geen retry.
- Dagverslag in Actions-log én step summary: doel, bekeken kandidaten, bevestigd nieuw, bestaand, duplicaten, ongeldig, fouten, stopreden, cumulatief/resterend, betrouwbaar catalogustotaal en vervolgplanning.

## Verificatie

- `npm test`: **215/215 groen**, uitsluitend fixtures/mocks, zonder live import.
- `npm run check`: syntax en drie seedconsistentiechecks groen.
- Zes workflow-YAML-bestanden geparseerd; `git diff --check` groen.
- Regressies: bestaande importer/prijsverversing/classificatie, Honig/Knorr-profielen, planner-notificaties en historische veilige preflight-/falafelguards.
- Nieuwe dekking: >400 onderzochte kandidaten met bekende/duplicaten/ongeldige producten; >40 nieuwe per term; voortzetting na page-window; exact 400; restant 7 met batch 7+2 bij twee concurrente collisions; 327 + echte laatste pagina; ontbrekende markup/repeated pages; gecontroleerde retries; permanente fout; gelijktijdige dagtriggers; exact insertbewijs zonder onderhoudconfig; unrelated catalogusgroei telt niet mee; gedeeltelijke writefout; dagcursor/nieuwe dag; Production-config en secretvrije diagnostics.
- De drie relevante webmodules die importerfixtures laden zijn inhoudelijk/hash-identiek aan de remote PR-basis. Geen UI/code of roadmap-mijlpaal gewijzigd.

## Open eindvalidatie / grenzen

- Geen live import, profiel-/cachewrite, migratie, merge of Production-deployment uitgevoerd. Een fixturetest bewijst geen live auth/bronbeschikbaarheid.
- Voor definitief live bewijs is na aparte toestemming één begrensde dagelijkse growth-attempt op de geteste branch nodig, voor uitsluitend het resterende dagdoel (nooit meer dan 400 bevestigd nieuwe producten). Deze schrijft products/product_prices, import-/dag-/discovery-status en kan gericht planner-/profielqueues/cache bijwerken. De actuele dagstand moet vlak vóór uitvoering opnieuw worden gelezen.
- Een live Honig/Knorr-run schrijft profiel-/recept-/readinessgegevens en is eveneens niet uitgevoerd. De eerstvolgende echte run geeft bij een eventueel resterende configuratiefout de concrete technische diagnose.
- De bestaande product- en prijswrites zijn afzonderlijke requests; een harde proceskill exact tussen writes en dagboekbevestiging valt niet onder de fixturegarantie. Bestaande lock/timeoutbeveiliging en idempotente SKU's blijven behouden; er is geen nieuwe transactionele database-RPC ingevoerd.
