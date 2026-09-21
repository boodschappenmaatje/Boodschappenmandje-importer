# PWA 13 — cache hersteld, vijf extra mixen selecteerbaar

Status: gedeeltelijk afgerond. Cacheherstel en gerichte matchcorrectie zijn uitgevoerd. De 26 bronprofielen en live browserperformance zijn niet afgerond. Geen merge of Production-appdeployment.

## Checkpoint

- Repository: `boodschappenmaatje/Boodschappenmandje-importer`.
- Branch: `codex/pwa-13-vrije-keuze`, Draft PR #25.
- Remote beginhead: `97170a0c97e50dc18634abc8539ac8a3a80e1ec3`.
- Main: `2bda28b8aa184de6bc58d9acd3264fbe39f9fea8`.
- Lokale bronboom exact gelijk aan remote tree `01c91aaecf46e3a08eab7bf185d5d22c83c5fede`; lokale werkmap schoon. Oudere werkmappen behouden.
- De eerdere cache-first fixes zijn behouden, niet opnieuw gebouwd.

## Resultaat database

| Merk | Totaal | Inhoudelijk verified | Needs review | READY voor p1–10 | Verified maar geblokkeerd |
|---|---:|---:|---:|---:|---:|
| Honig | 19 | 6 | 13 | 2 | 4 |
| Knorr | 22 | 9 | 13 | 4 | 5 |
| Totaal | 41 | 15 | 26 | 6 | 9 |

- Nieuw verified bronprofiel: **0**. Nieuw selecteerbare, reeds verified mix: **5**.
- People-count-varianten: **150 → 150**; current **10 → 150**; pending **140 → 0**.
- Voor elk persoonsaantal 1–10: **6 READY, 9 NOT_READY**, allemaal current. Een actuele negatieve cache is geldig, maar maakt een gerecht niet selecteerbaar.
- Cache is tijdelijk: product-/prijswijzigingen en TTL kunnen later opnieuw gerichte invalidatie veroorzaken.

## Gerichte correcties

De bron noemt Italiaanse groentemix, groentepakket of wokgroenten; het bestaande Hoogvliet-product heet [Italiaanse roerbak](https://www.hoogvliet.com/product/italiaanse-roerbak). Dit is volgens de productinformatie een gesneden groentemix. De naamvariant wordt uitsluitend aan dergelijke Italiaanse groente-ingrediënten toegevoegd. Geen SKU geforceerd; de bestaande matcher blijft categorie, bereidingstype, prijs en benodigde verpakkingen controleren. Tests wijzen Oosterse roerbak, saus en complete maaltijden af.

Dit maakt vijf eerder geblokkeerde gerechten bruikbaar: Honig lasagnesaus, Honig macaroni, Knorr lasagnette, Knorr macaroni en Knorr spaghetti bolognese. Knorr burrito's was al volledig.

Serveronderhoud geeft nu ook de opgeslagen maaltijdmixprofielen door aan de bestaande ingrediëntverrijking. Anders kon een standaardprofiel de exacte product-id van een geverifieerde catalogusvariant overschrijven met een lege waarde. Een regressietest dekt dit af.

## Cache-uitvoering en integriteit

Vercel-beheer gaf 403 voor de projectscope; de Preview-browser stond op Vercel-login. Daarom is geen beheer-auth omzeild en geen beschermde route aangeroepen.

Voor het toegestane cacheherstel zijn actuele databaselezingen gebruikt via de Supabase-koppeling. De bestaande `SupabaseRecipeRepository`, `SupabaseCatalogRepository`, `evaluateRecipeReadiness` en `rowsForGate` zijn lokaal uitgevoerd met echte databasegegevens. Alle zoekpagina's kwamen uit de bestaande `search_catalog_products_v2`; er is geen alternatieve matcher gemaakt. Dit is een begrensde hersteluitvoering, geen tweede onderhoudspipeline.

Vóór de transactie zijn producten, prijzen en profielen tegen de voormeting gecontroleerd; afwijkingen zouden de opslag afbreken. Uitsluitend de gegenereerde cache-uitvoer is opgeslagen:

- 61 matchrecords bijgewerkt, waarvan 15 met een inhoudelijke/statuswijziging;
- 150 readinessrecords bijgewerkt;
- 970 overige readinessrecords byte-inhoudelijk ongewijzigd;
- producten en prijzen: volledige inhoudsdigests ongewijzigd;
- geen writes naar recipes, recipe_ingredients, ingredients, ingredient_aliases of meal_mix_profiles;
- geen import, migratie, schemawijziging, grant of nieuwe trigger.

Na teruglezen gebruiken alle p1–10-varianten 15 persistente hits en 0 fallback. De controle laat een zoekaanroep expliciet falen; geen zoekaanroep trad op. Dit bewijst de cachelogica op teruggelezen data, niet de mobiele netwerkvertraging.

Databasecontrole: dubbele producten, prijzen, matchkeys en readinesskeys = 0; prijs-, match- en readiness-orphans = 0; valid match zonder positieve prijs = 0.

## Resterende bronprofielen

De bestaande inventaris met alle 26 namen, SKU's, bronnen en parserredenen blijft in `pwa13-honig-knorr-cache-checkpoint.md`. De productpagina's zijn opnieuw geraadpleegd; geen generiek internetrecept of verzonnen hoeveelheid is gebruikt.

De opgeslagen eerste redenen blijven: 20 ontbrekende portieverklaringen, 3 ontbrekende aanvullende-ingrediëntenlijsten, 2 onduidelijke inhoudsvormen en 1 ontbrekende/ambiguë hoeveelheid. Dit zijn parserredenen, niet automatisch bewijs dat de informatie nergens bestaat.

Concrete open punten:

- Bij Honig tagliatelle is [bronbewijs voor vier porties en diepvries-spinazie](https://www.hoogvliet.com/product/honig-basis-voor-tagliatelle-roomsaus) aanwezig. De bereiding noemt daarnaast olie buiten de toevoeglijst. Een volledig geverifieerd profiel mag dit niet stilzwijgend missen. Er is nog geen gekoppeld recept. Publicatie vereist verdere parsercontrole en een gerichte recipe-toevoeging, buiten de nu opgesomde schrijftabellen.
- Bij Honig kip kerrie heeft het kleine blikje ananas geen betrouwbare inhoudsmaat in de geraadpleegde tekst.
- Bij Knorr nasi ontbreekt een eenheid voor taugé in de gekoppelde bron; gegevens van een andere verpakking zijn niet blind overgenomen.
- Twee Spaghetteria-profielen hebben uitsluitend water nodig. De huidige verified-constraint vereist een niet-lege supplementenlijst. Geen fictief ingrediënt of schemawijziging gebruikt om die controle te passeren.
- Een portieaantal op een verpakkingsfoto moet nog controleerbaar aan het exacte product worden gekoppeld.

## Verified maar niet volledig selecteerbaar

| Profiel | Resterende oorzaak bij 4 personen |
|---|---|
| Honig roerbakmie | Kastanjechampignons en Oosterse wokgroenten ontbreken |
| Honig hachee | Hacheevlees ontbreekt |
| Honig stroganoff | Kastanjechampignons en Provençaalse wokgroenten ontbreken |
| Honig nasi speciaal | Nasi/bami-groenten ontbreken |
| Knorr bami | Groentepakket ontbreekt; bosui-resultaat is soep; mie onvoldoende betrouwbare match |
| Knorr kip madras | Crème fraîche light ontbreekt; lente-ui-resultaat is soep; tomaten hebben geen bruikbare stukinhoud |
| Knorr teriyaki | Chinese wokgroente ontbreekt |
| Knorr tikka masala | Yoghurt gevraagd in gewicht, catalogusverpakking in volume; geen dichtheid verzonnen |
| Knorr lasagne bolognese | Lasagnebladen gevraagd per stuk, catalogusverpakking in gram; geen bladgewicht verzonnen |

## Performance en toekomstig onderhoud

| Flow, 4 personen / 7 dagen / €100 week / €70 maaltijden | Vóór | Na |
|---|---|---|
| Week genereren | Niet live gemeten | Niet live gemeten |
| Vrije keuze openen | Niet live gemeten | Niet live gemeten |
| Spaghetti zoeken | Niet live gemeten | Niet live gemeten |
| Honig zoeken | Niet live gemeten | Niet live gemeten |
| Complete mix selecteren | Niet live gemeten | Niet live gemeten |

Geen seconden of percentages geclaimd. De concrete oorzaken waren 140 pending caches en eerder herhaalde kandidaat-/weekvalidatie. De al aanwezige cache-first flow deelt de readinessronde en productsnapshot; alleen stale/ontbrekende data gebruikt de bestaande fallback. Bronopbouw gebeurt niet bij een cachehit.

De bestaande producttrigger queuet toekomstige Honig/Knorr-producten; de profielworker verifieert brondata en vernieuwt p1–10 via dezelfde onderhoudsservice. De worker controleert ook prijs-/matchinvalidatie en verlopen cache. De nieuwe naamvariant geldt eveneens voor toekomstige overeenkomende ingrediënten.

**Operationele beperking:** de PWA 13-workflow staat op deze Draft branch. Het nieuwe dagelijkse schema wordt pas actief nadat die workflow later is gemerged. Geen automatisch productieonderhoud voor deze branch geclaimd en geen merge uitgevoerd.

## Validatie

- Gerichte regressie: de vier nieuwe naamvarianttests faalden vóór de fix en slagen erna; 54 gerichte tests geslaagd.
- Volledige eindvalidatie: **424 webtests**, **183 importertests**, ESLint, TypeScript en Next.js production build groen.
- Teruggelezen live data: **150 persistente cachehits over p1–10**, **0 fallback/zoekaanroepen**.
- Geen fysieke iPhone-test door de agent geclaimd.

## Exacte iPhone-hertest

1. Open de bijgewerkte PR #25 Preview in Safari; meld zo nodig aan bij Vercel.
2. Stel 4 personen, 7 dagen, €100 weekbudget en €70 maaltijdbudget in; reserveer een Vrije-keuzedag.
3. Meet vanaf tikken tot zichtbaar resultaat: week genereren en Vrije keuze openen.
4. Zoek `spaghetti`, daarna `Honig`; noteer beide wachttijden.
5. Selecteer een complete Honig macaroni of Knorr spaghetti bolognese; controleer merk, alle ingrediënten, verpakkingen, maaltijdkosten en boodschappenlijst. Heropen de week en controleer behoud.
6. Herhaal voor 1 en 10 personen; controleer dat hoeveelheden en aantallen verpakkingen meegroeien.
7. Controleer bij een 4-persoonsmix: 4 personen = 1 pak en 8 personen = 2 pakken. Controleer Knorr burrito's 228 g: 3 personen per pak, dus 4 personen = 2 pakken.
8. Controleer dat een onvolledige mix geblokkeerd blijft met een begrijpelijke reden.

Nog nodig voor volledige afronding: betrouwbare profielverrijking binnen expliciet passende databasescope en werkende Preview-toegang voor dezelfde live vóór/na-metingen. PR blijft Draft; geen merge, Production-deploy of brede import.
