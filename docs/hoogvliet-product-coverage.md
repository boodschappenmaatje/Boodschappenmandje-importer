# Hoogvliet-productdekking — onderzoek 30 september 2026

## Scope en uitgangspunt

Basis: main `7e35035a02996ef403546eb3878e706e93f8da3c`, na PR #36.
Branch: `feature/hoogvliet-product-coverage`. Alleen Draft/Preview; geen import,
workflow-dispatch, databasewrite, maintenance-call, merge of Production-deploy.
De automatische import/monitor van 1 oktober blijven onafhankelijk op main.

Brononderzoek: normale openbare navigatie, zoekformulieren en productpagina's
van https://www.hoogvliet.com/ ; read-only SQL uitsluitend voor catalogusvergelijking.
Geen login, private API, CAPTCHA-omzeiling of ongepubliceerde product-ID-enumeratie.
Een openbare route is technisch toegankelijk; dit onderzoek verleent geen nieuwe
licentie en wijzigt de bestaande afspraken over brongebruik niet.

## Waarom 598 routes toch geen volledige dekking waren

1. **148 vaste woorden + 450 dynamische termen.** De daadwerkelijke v4
   `exhaustedTerms` bevatte precies 598 routes. Alle 450 dynamische plaatsen waren
   gevuld met merknamen. `buildDynamicDiscoveryTerms` stopt toevoegen bij 450;
   de latere categorieën, producttypen, letters en naamwoorden kwamen niet meer
   aan bod. Een merk dat nog niet bekend was, kon zo buiten het bereik blijven.
2. **Bewezen spatiecoderingfout.** Het zichtbare zoekformulier gebruikt `%20`.
   `searchURL` gebruikte URLSearchParams en schreef `+`; ook het veranderen van
   alleen PageNumber codeerde bestaande `%20` opnieuw als `+`.
   Op dezelfde dag en in dezelfde normale browsersessie, met PageSize=40:
   `SearchTerm=Just+O` gaf 25 resultaten (eerste pagina 16 Dolce Gusto-koffiecups),
   `SearchTerm=Just%20O` gaf 21 resultaten met de vier juiste Just O-producten
   vooraan. Het relevante-productfilter accepteert die vier; de koffiecups
   horen terecht niet bij Just O. Historische termStats voor Just O: 0 kandidaten.
   Drie van de vier juiste producten ontbraken in de DB en zijn individueel
   bevestigd met €3,99, 750 ml en overeenkomende SKU. De vierde bestond al.
   Dit bewijst de fout voor deze route; het aantal andere geraakte termen is
   niet via een volledige herscan gemeten.
3. **Categorieën zijn geen zoekzinnen.** Het huidige keywordfilter vereist ieder
   woord van de zoekterm in naam/merk/trackingcategorie. Een categoriepagina kan
   producten uit meerdere trackingcategorieën tonen: Qualino Pruimen rte staat
   onder Bewuste voeding, maar heeft als trackingcategorie AGF/gedroogd fruit.
   Een tekstzoektocht naar 'Bewuste voeding' zou dit product wegfilteren.
4. **Uitputting was routegebonden.** De gecorrigeerde eerdere acceptatie sloeg
   dezelfde dag reeds voltooide routes over. Zij valideerde hun checkpoint,
   niet het complete assortiment. Nul inserts bewijzen dus geen volledige dekking.

## Openbare aanvullende routes en gemeten steekproef

Het actuele **Producten-menu bevat 20 hoofdcategorieën**. Iedere menulink is
read-only geopend; alle 20 kwamen op het bestaande Intershop-zoekendpoint met
de hieronder genoemde CategoryName uit. Het oudere
https://www.hoogvliet.com/assortimentsoverzicht heeft enkele verkeerde/verouderde
linklabels (onder meer frisdrank/zuivel en soepen/koek). Daarom is het actuele
Producten-menu de bron voor de twintig categorie-identiteiten.

| ID achter `999999-` | Categorie | Website-totaal | Bestaande DB-trackinggroep | Ontbrekend in eerste 16 |
|---|---|---:|---:|---:|
| 100 | Aardappelen, groente, fruit | 364 | 272 | 1 |
| 200 | Vlees, vis, vegetarisch | 249 | 160 | 0 |
| 300 | Kaas, vleeswaren, tapas | 559 | 505 | 0 |
| 400 | Verse maaltijden, salades | 141 | 95 | 3 |
| 500 | Zuivel, plantaardig, eieren | 582 | 512 | 0 |
| 600 | Diepvries | 410 | 395 | 0 |
| 700 | Brood | 93 | 60 | 0 |
| 800 | Ontbijtgranen, broodbeleg, tussendoor | 387 | 281 | 0 |
| 900 | Frisdrank, sappen | 500 | 456 | 0 |
| 1900 | Koffie, thee | 352 | 305 | 0 |
| 1000 | Bier, wijn, alcoholvrij | 451 | 61 | 14 |
| 1100 | Chips, zoutjes, noten | 282 | 251 | 3 |
| 1200 | Koek, chocolade, snoep, zelf bakken | 779 | 647 | 3 |
| 1300 | Internationale keuken, pasta, rijst | 566 | 493 | 0 |
| 1400 | Soepen, conserven, sauzen, kruiden | 755 | 603 | 0 |
| 1500 | Huishoud, non-food | 472 | 340 | 7 |
| 1800 | Huisdier | 240 | 195 | 0 |
| 1600 | Gezondheid, cosmetica | 375 | 245 | 3 |
| 2000 | Baby, kind | 209 | 163 | 2 |
| 1700 | Bewuste voeding | 65 | 34 | 8 |

Website- en DB-groepen zijn **geen één-op-één dekkingsratio**: producten kunnen
op meerdere categoriepagina's staan, hun opgeslagen trackinggroep kan anders
zijn en de bron verandert. Nul ontbrekende SKU's in de eerste 16 bewijst niet dat
de rest van die categorie volledig is. De opgegeven brontotalen zijn geen
individueel gevalideerde of wereldwijd unieke SKU-aantallen.

**Schrijfvrije meting:** twintig eerste pagina's plus één tweede pagina van
bier/wijn/alcoholvrij: **336 tiles, 334 unieke SKU's, 275 bestaand, 59 afwezig**.
Alle 59 hebben op de listing een naam, verpakking, product-URL en positieve
prijs. Eerste pagina's leveren samen 44 afwezige SKU's; de tweede pagina nog 15.
**15 van de 59 zijn daarnaast individueel detailgevalideerd** (8 Bewuste voeding,
7 bier/wijn/alcoholvrij), met overeenkomende SKU, verpakking en positieve prijs.
De overige 44 vereisen vóór een insert dezelfde normale detailvalidatie.

- Reproduceerbare SKU-metingen: `docs/hoogvliet-coverage-sample-20260930.json`.
- 15 beperkte productdetailfixtures: `test/fixtures/hoogvliet-coverage-20260930.json`.
- DB-snapshot: 6359 productregels totaal, waarvan 6356 `Hoogvliet` en 3 reeds
  bestaande lowercase `hoogvliet`-testregels met TEST-* SKU. Geen echte SKU van
  de steekproef stond in die drie testregels. Er is niets opgeschoond/gewijzigd.
- Aanvullend openbaar: merkroutes, categoriepermalinks en productlinks uit de
  categoriepagina's. `/sitemap` is een algemene template zonder bruikbare
  productinventaris; XML-sitemap/robots konden met de researchtool niet worden
  vastgesteld en vormen geen basis voor deze implementatie.

## Implementatie

- Spaties als `%20` naar Intershop, zowel aanvankelijk als bij hervatte pagina's.
  Letterlijke `+`, `&`, accenten en apostroffen blijven correct geëncodeerd.
- 20 vaste publieke categorieroutes in de growth-batch, naast de bestaande 148
  zoekwoorden en maximaal 450 dynamische termen: maximaal 618 routes bij deze
  configuratie. Eigen stabiele `category:999999-ID` cursors; bestaande keyword-
  checkpoints/maintenance worden niet gereset. Expliciete SEARCH_TERMS-overrides
  worden niet verbreed.
- Alleen bekende categorie-ID's op dezelfde HTTPS-host en hetzelfde endpoint;
  na navigatie moet de gevraagde categorie behouden zijn en SearchTerm leeg zijn.
  Categorielidmaatschap vervangt uitsluitend op zo'n route het keywordfilter.
  Detailprijs, SKU, product-URL, verpakking, dedupe en insertbevestiging blijven
  de bestaande gates.
- Paginering gebruikt bronmetadata. Waargenomen: request PageNumber=0 → pagina1,
  request1 → pagina2, met 16 andere SKU's. PageSize=40 werd bij de merkmeting
  feitelijk als 16 tiles gerenderd; de collector vertrouwt daarom de metadata,
  niet een berekende offset uit de gevraagde grootte. Categorieën gebruiken de
  waargenomen standaard16. Geen bewijs gevonden dat deze huidige metadata-
  cursor in die steekproef een tussenpagina overslaat.
- Verkeerde categorie/cursor sluit veilig af. Een identieke categoriepagina
  vóór bewezen eindmetadata heet `repeated_category_page`, blijft een stall en
  bewijst geen uitputting. Andere routes gaan bij deze stall door.
- 800 pagina's per segment, 8 segmenten, gedeeld 105-minutenbudget, resterend
  dagelijks 400-budget, DB-claims, retries, CAS en maintenance blijven ongewijzigd.

## Validatie en acceptatiegrens

- 11 nieuwe regressies: codering en vervolgpagina; limiet450 sluit categorieën
  niet uit; route/host/credentials-gates; cross-listing; ongeldige/duplicate SKU;
  echte detailvalidator met 15 fixtures; ontbrekende/onjuiste detailprijs; cursor;
  stall versus uitputting; resterend insertbudget; bestaand same-day checkpoint.
- Root: 286 tests; importerfixtures/syntax/seedchecks; web756; lint/TypeScript/
  build. Exacte CI/Preview-status staat op de Draft PR en in PROJECT_STATE.
- Lokale build vereiste echte dependencydirectories in deze aparte checkout;
  externe symlinks worden door Turbopack geweigerd. Geen projectcodeworkaround.
- Geen zichtbare appwijziging: geen specifieke iPhone-hertest nodig.
- Nog geen live inserts of nieuwe dagelijkse groei geaccepteerd. 59 kandidaten
  uit een gerichte steekproef zijn geen extrapolatie naar dagelijks 400.

Vóór een later expliciet goedgekeurde live acceptatie: actuele PR-head/CI,
broncontract, Nederlandse dagstand en resterend budget, vrije gezamenlijke
concurrency/DB-claim, geen andere import, gezonde maintenance en Production
controleren. Eén begrensde `daily_attempt_only` volgens bestaande gates; geen
reset of tweede handmatige run naast de natuurlijke automatische cyclus.

Hoogvliet kondigt op https://www.hoogvliet.com/nieuwe-website een nieuwe website
en app aan op **5 oktober** (de pagina noemt geen jaartal). De huidige Intershop-
extractie is op 30 september bewezen; compatibiliteit met die nieuwe site is
niet bewezen en moet bij/na een daadwerkelijke bronwissel opnieuw worden getoetst.
