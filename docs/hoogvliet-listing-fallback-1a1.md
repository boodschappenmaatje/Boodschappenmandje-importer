# Roadmap 1A.1 — externe Hoogvliet-listingfallback

Onderzoeksdatum: 10 oktober 2026. Dit document beschrijft het technische besluit en de nog verplichte live-proof. Het activeert geen externe provider en verandert geen importerpad.

## Bewezen probleem en grens

De directe Playwright/Hoogvliet-flow blijft de primary. Een gezonde run heeft 20 listingroutes, 359 listingwindows en 6.766 unieke listing-SKU's natuurlijk uitgeput, ruim onder `MAINTENANCE_MAX_LISTING_WINDOWS=800`. Latere runs leverden op geldige vervolgpagina's tijdelijk nul productlinks, waaronder `https://hoogvliet.nl/chips-zoutjes-noten/q/page/4`, terwijl diezelfde URL eerder 20 SKU's bevatte. De snapshot stopte correct fail-closed vóór GraphQL-/prijsbeoordeling en writer.

De fallback mag daarom alleen één aantoonbaar tijdelijk onbruikbaar listingwindow opnieuw ophalen. Hij is geen tweede catalogusbron en mag echte stagnatie, loops, caps, 404's of parserwijzigingen niet maskeren.

## Bright Data versus Zyte

| Onderdeel | Bright Data | Zyte API |
|---|---|---|
| Geschikte route | Web Unlocker Direct API; Scraping Browser is voor deze enkele HTML-response onnodig zwaar | `POST /v1/extract` met `browserHtml: true` |
| JavaScript/anti-bot | Web Unlocker documenteert JS-rendering, CAPTCHA-oplossing, automatische retries en een optionele element-wachtvoorwaarde | `browserHtml` levert browsergerenderde HTML; browser actions zijn beschikbaar als een gewone render onvoldoende blijkt |
| Node/GitHub Actions | Eén HTTPS-POST met bearer-token plus zone; geen browserkoppeling nodig | Eén HTTPS-POST met Basic-auth API-key; geen SDK of extra runtime nodig |
| Exact één window | Ja, de request bevat precies één doel-URL | Ja, de request bevat precies één doel-URL en de JSON-response bevat URL plus HTML |
| Integratiecomplexiteit | API-token én Web Unlocker-zone; raw-HTML-respons. Scraping Browser zou remote CDP, sessiebeheer en een langere browserverbinding toevoegen | Eén secret en een kleine JSON-request/response-adapter; past het directst vóór de bestaande parser |
| Kostenstructuur | Web Unlocker documenteert pay-per-success. De actuele openbare prijs staat op een dynamische prijspagina/accountplan en is in deze omgeving niet betrouwbaar verifieerbaar | Pay-as-you-go is domein- en featureafhankelijk; volume/commitmentplannen bestaan. De actuele `hoogvliet.nl`-prijs moet via Zyte domain pricing/account worden opgevraagd |
| Limieten/retries | Account-/zonegrenzen zijn niet publiek hard bewezen. Providerretries mogen onze eigen requestcap niet verhogen | Officiële Python-client gebruikt standaard 15 connecties en kan 429/netwerkfouten lang herhalen. De importer moet daarom een directe, sequentiële request zonder SDK-retry gebruiken |
| Latency | Geen bruikbare Hoogvliet-meting zonder account; Scraping Browser-voorbeelden hanteren maximaal twee minuten | Geen bruikbare Hoogvliet-meting zonder account; moet met dezelfde listing-URL in Actions worden gemeten |
| Observability | Pay-per-success en een domein-success-rate endpoint zijn nuttig, maar de zone is extra configuratie | Requeststatus en response-URL passen direct in veilige per-window accounting |

Primaire bronnen:

- Bright Data Web Unlocker API: <https://github.com/luminati-io/web-unlocker-api/blob/cbbc13ccc3732b6971a2521ab9a171f41d9bf6d4/README.md>
- Bright Data Scraping Browser/Playwright: <https://github.com/luminati-io/sbr-examples/blob/7ea128d655270fed3e4438b0d3bf79975fe03d56/nodejs/playwright-basic/scrape.js>
- Zyte API-client en requestmodel: <https://github.com/zytedata/python-zyte-api/blob/efc4fdc6cebf36de26a946d0e665d539cafbecf9/README.rst>
- Zyte retry-/concurrencygedrag: <https://github.com/zytedata/python-zyte-api/blob/efc4fdc6cebf36de26a946d0e665d539cafbecf9/docs/use/api.rst>
- Zyte browser-HTML en actions: <https://github.com/zytedata/zyte-api-workshop/tree/7df5dc07a0c8cc1c0ce161bba90d6b35f472b3ca/Solution>

De publieke Bright Data-prijsvoorbeelden die via GitHub vindbaar zijn dateren uit 2025; ze zijn geen actuele inkoopbron. Zyte publiceert de prijs voor een specifieke site via domain pricing. Daarom wordt geen bedrag of maandkostenraming als bewezen gepresenteerd.

## Providerbesluit

**Voorkeur voor de live-proof: Zyte API.** Voor deze use-case is een losse `browserHtml`-request met één API-key kleiner en beter controleerbaar dan een Bright Data-zone of remote Scraping Browser. De URL in de Zyte-response maakt bovendien een fail-closed controle op dezelfde Hoogvliet-listingidentiteit mogelijk.

Dit is nog geen activeringsbesluit. Zonder account/API-key zijn de vier beslissende feiten niet bewezen: ondersteuning van `hoogvliet.nl`, actuele domeinprijs voor `browserHtml`, latency en herhaalbare producthydratie. Daarom is bewust geen provideradapter aan het productiepad toegevoegd.

## Exacte toekomstige fallbacktrigger

Een latere implementatie mag uitsluitend starten wanneer al deze voorwaarden waar zijn:

1. De URL is door de bestaande normalisatie als geldige `https://hoogvliet.nl`-categorielisting toegelaten.
2. Het betreft een concreet huidig listingwindow en precies dezelfde canonical URL wordt aan de provider aangeboden.
3. Primary heeft óf een retryable bronstatus (`408`, `425`, `429` of `5xx`), óf een volledig geladen catalogusschil/vervolgpagina zonder productlinks en zonder expliciete lege-catalogusstatus.
4. Bij nul productlinks is aantoonbaar dat het window verwacht werd: een betrouwbare `next`-link wees ernaar. Een navigation-only oudercategorie blijft de bestaande nested-routeflow gebruiken.
5. Er is geen permanente `404`, ongeldige route, challenge die niet als tijdelijke providercase is geclassificeerd, parser/schemafout, pagination-loop, repeated-SKU-window of listing-window-cap.
6. De run heeft nog providerbudget over.

Een `load_more`-stagnatie zonder afzonderlijke, controleerbare window-URL is geen veilige fallbacktrigger. Die blijft fail-closed.

## Beoogde verwerking en veiligheidsrails

Bij een latere implementatie wordt de provider-HTML in een geïsoleerde Playwright-pagina met de oorspronkelijke URL aangeboden aan `extractCatalogListingCandidates`. De uitkomst gaat daarna door dezelfde normalisatie, SKU-dedupe, GraphQL-hydratatie, detailfallback en writergate. Er komt geen tweede catalogusparser.

Voorgestelde harde defaults en clamps:

- provider standaard uit; ontbrekende `ZYTE_API_KEY` verandert primary niet;
- maximaal 3 fallbackrequests per maintenance-run, hard clamp 10;
- exact 1 providerattempt per problematisch window; geen providerfailover en geen SDK-retry;
- 45 seconden timeout per providerrequest, hard clamp 60 seconden;
- sequentiële requests; `MAINTENANCE_MAX_LISTING_WINDOWS=800` blijft leidend en telt primary windows;
- alleen de API-key in GitHub Actions secret `ZYTE_API_KEY`; nooit body, authheader of key loggen;
- response groter dan een vast te bepalen veilige HTML-limiet, afwijkende response-URL, nul/ongeldige SKU's of providerfout blijft fail-closed;
- accounting: `primary_listing_windows`, `fallback_attempts`, `fallback_successes`, `fallback_failures`, `provider`, route/window/canonical URL, triggerreden, fallback raw-SKU-count en uiteindelijke snapshotstatus.

## Exacte minimale Work-live-proof

Deze proof is read-only en doet geen workflow/importerwrite.

1. Maak een Zyte API-account met pay-as-you-go en een harde lage spend alert/limiet. Vraag vóór uitvoering in domain pricing de actuele prijs voor `hoogvliet.nl` met `browserHtml` op en leg valuta, prijs per request en eventuele minimumcommitment vast.
2. Voeg uitsluitend `ZYTE_API_KEY` als GitHub Actions-secret toe. Toon of log de waarde niet.
3. Review de geïsoleerde workflow `.github/workflows/manual-zyte-listing-proof.yml` in Draft PR #66. Na een afzonderlijk mergebesluit en merge naar `main` start Work hem uitsluitend handmatig via **Actions → Handmatige Zyte listingproof → Run workflow → main**. Allowlist exact:
   - probleemwindow `https://hoogvliet.nl/chips-zoutjes-noten/q/page/4`;
   - gezond controlewindow `https://hoogvliet.nl/chips-zoutjes-noten/q/page/1`.
4. De workflow doet sequentieel exact drie Zyte-requests per URL met `{ "url": URL, "browserHtml": true }`, nul retries en maximaal 60 seconden timeout per request. Maximum: 6 betaalde requests.
5. Controleer per response zonder bodylogging: HTTP/providerstatus, response-URL exact dezelfde canonical listingidentiteit, latency, HTML-bytecount, bestaande parser raw-SKU-count en unieke geldige 9-cijferige SKU's. Sla alleen de veilige tellingen/fingerprints op.
6. Pass-gate: beide URL's leveren 3/3 keer binnen 60 seconden minimaal één geldige productlink; het probleemwindow levert bij voorkeur de eerder bewezen 20 SKU's, en alle resultaten zijn met de bestaande parser leesbaar. Geen redirect, challengebody, lege response of parserafwijking.
7. Noteer de werkelijk door Zyte gerapporteerde kosten van deze zes calls. Stop na de proof; voer geen maintenance dry-run of write-run uit.

Bij een mislukte Zyte-proof wordt niet automatisch Bright Data geactiveerd. Voer dan dezelfde maximaal-zes-requestproof met Web Unlocker uit, met API-token plus vaste zone, `format=raw` en een productlink-wachtvoorwaarde. Pas daarna mag de providerbeslissing worden herzien.

## Technische status

Roadmap 1A.1 is nog niet technisch afgerond. De handmatige read-only proofworkflow bevat geen productieadapter en is niet gestart. De eerstvolgende Codex-stap na een groene Zyte-proof is de minimale adapter plus de tien gevraagde regressies. `ROADMAP.md` blijft daarom ongewijzigd.
