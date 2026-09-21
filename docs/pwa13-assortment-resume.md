# PWA 13 — hervatte assortimentscontrole

21 september 2026. Voortgezet vanaf de **actuele remote head `e2c23bec81d465fc7f57c6f5c9e99560eb3be0b8`** op `codex/pwa-13-vrije-keuze`. Remote main: `2bda28b8aa184de6bc58d9acd3264fbe39f9fea8`. PR #25 is open en Draft. De lokale checkout stond achter op `a53e595` en is uitsluitend fast-forward bijgewerkt. Bestaande losse lokale bestanden zijn behouden en niet meegenomen.

## Actuele dekking

Read-only Supabase-controle om 19:25 UTC: 105 producten met merk/naam Honig of Knorr, waarvan 41 binnen de bestaande maaltijdmixdetectie. De overige 64 zijn onder meer losse pasta, soep, saus, bouillon en instantcups; geen ontbrekende ondersteunde maaltijdmixprofielen. Zie het [controlebestand met alle 105 SKU's](pwa13-assortment-audit-2026-09-21.json). De [eerdere volledige inventaris](pwa13-meal-mix-completion.md) blijft geldig.

| Categorie na deze codefix | Honig | Knorr | Voorbeeld / bewijs |
|---|---:|---:|---|
| A — product en volledige bruikbare maaltijd aanwezig | 10 | 15 | Honig bolognese, wraps; Knorr burrito, risotto, airfryermix |
| B — bestaande ondersteunde mix door zoeklimiet verborgen | 0 | 0 | Vóór de fix ontbreekt Knorr airfryermix bij `Knorr mix`, ondanks READY; na de fix aanwezig |
| C — mix aanwezig, bron-/ingrediëntgegevens onvolledig | 1 | 0 | Honig kip kerrie 051885000: inhoud van ‘klein blikje ananas’ onbekend |
| D — profiel compleet, veilige aanvullende match/verpakking ontbreekt | 8 | 7 | Hachee, boerenomelet, Knorr nasi/bami, kebab, tikka masala |
| Totaal bestaande ondersteunde mixen | 19 | 22 | 40 verified, 1 needs_review |

**E — mixproduct ontbreekt:** vier concreet gecontroleerde bestaande receptopties buiten bovenstaande 41: Knorr Griekse kofta, Hokkien Mie, Kip Siam en Surinaamse roti. Hun receptrecords bestaan; geen bijbehorende mix-SKU staat tussen de 105 merkproducten. Dit is een telling van deze vier bestaande receptopties, geen volledige inventaris van het landelijke fabrikantenassortiment. Een andere Knorr-maaltijdmix is geen bewijs voor de juiste wereldgerechtenverpakking.

De bestaande read-only live audit (`scripts/meal-mix-completion.config.ts`) is opnieuw uitgevoerd via de echte catalogus-, readiness- en Vrije-keuzeservices. Resultaat: **10 Honig + 15 Knorr selecteerbaar** bij vier personen en voldoende budget; 16 geblokkeerd. De actuele prijs-, verpakkings- en budgetvalidatie bleef actief. Alle 25 behouden hun gerechtbeeld na serialiseren/heropenen; geen afwijking tussen READY en selectie. Dit is een servicetest, geen nieuwe iPhone- of Preview-browsertest.

400/400 bestaande cachevarianten zijn current, niet geïnvalideerd en nog niet verlopen: Honig 180, Knorr 220. Voor ieder persoonsaantal 1–10 zijn respectievelijk 10 en 15 mixen READY. Geen databasewrite, prijswijziging, importer of cache-refresh uitgevoerd.

## Aangetoonde en herstelde zoekoorzaak

De eerdere fix maakte alleen exact `Honig` of `Knorr` vrij van de limiet van twintig zoekresultaten. `Knorr mix` had met de bestaande catalogusvolgorde 21 overeenkomende profielen, maar leverde er twintig. Daardoor verdween **Knorr Air fryer mix voor krokante kip knoflook (733174000)**. De regressietest met de bestaande 40 profiel-fixtures faalde vóór de wijziging op precies het ontbrekende product-ID.

De selectie behoudt nu alle overeenkomende maaltijdmixprofielen, ook bij samengestelde zoektermen en `mix`. Gewone gerechten behouden hun bestaande resultaatlimiet. Profielherkenning gebruikt de bestaande catalogusprofielen; er is geen nieuwe hardcoded assortimentslijst. Readiness blijft één gebatchte controle met dezelfde snapshot- en matching-cache. Prijzen, merk-/SKU-binding, ingrediënten, porties, verpakkingen, budget en boodschappenlijstcode zijn niet gewijzigd. Geen gemeten iPhone-snelheidswinst geclaimd.

## Minimale acties voor de resterende datagaten

| Betrokken mixen | Minimale benodigde actie |
|---|---|
| Honig kip kerrie | Betrouwbaar verpakkingsbewijs voor de ananashoeveelheid van exact deze 59 g-SKU; daarna alleen dit profiel beoordelen |
| Honig hachee | Eén geschikt rauw hachee-/stoofvleesproduct met verpakking en actuele prijs gericht toevoegen |
| Honig stroganoff en Italiaanse kruidensaus | Geschikte Provençaalse groentemix gericht toevoegen; bij kruidensaus ook basilicumhoeveelheid veilig oplossen |
| Honig erwtensoep | Erwtensoepgroentemix toevoegen en rookworsthoeveelheid/verpakking verifiëren |
| Honig boerenomelet | Betrouwbaar aantal sneetjes voor een bestaand volkorenbrood vastleggen |
| Honig chili en bakplaat broccoli/courgette; Knorr taco's | Passende tomatenverpakking met bekend stukaantal, of fabrikantbewijs in massa voor dezelfde bereiding |
| Knorr nasi, bami en kip madras | Verse bosui/lente-ui met bruikbare verpakking gericht toevoegen; madras vraagt ook bovenstaande tomatenoplossing |
| Knorr kebab | Passende pita-/shoarmabroodverpakking met gewicht en prijs gericht toevoegen |
| Knorr tikka masala | Betrouwbare netto massa van geschikte magere yoghurt; ml niet als gram behandelen |
| Knorr lasagne bolognese | Aantal lasagnebladen per verpakking of gecontroleerde fabrikantmassa voor dezelfde bereiding |
| Vier E-opties | Eerst exacte wereldgerechten-SKU, bron, porties, aanvullingen, verpakking en prijs vaststellen; alleen die producten gericht importeren en matchen |

Een nieuwe zoekindex of uitsluitend rematchen kan ontbrekende producten en verpakkingsgegevens niet aanvullen. Databasezoekopdrachten bevestigen dat de gevonden bosui-kandidaat soep is, hacheekandidaten bereide maaltijden zijn en yoghurt/tomaten/lasagnebladen de genoemde eenheidsproblemen hebben. Er zijn geen hoeveelheden of vervangingen verzonnen.

**Stopgrens:** publiceren van deze aanvullingen zou de gedeelde Production-data wijzigen. Volgens de opdracht zijn die acties niet uitgevoerd. Na afzonderlijke toestemming volstaat gericht profiel-/matchonderhoud voor de betrokken recepten en personen 1–10; geen brede 400-productenimport of volledige cacheherbouw.

## Verificatie

- Nieuwe zoekregressie aantoonbaar rood vóór de fix (20 in plaats van 21), daarna groen.
- 83 gerichte webregressies geslaagd, inclusief merk/SKU, schaalregels 1–10, verpakkingen, budget, lijstsync, geen duplicaten/cross-brand match, normale gerechten en cachehergebruik.
- 189 importer-/maintenance-regressies geslaagd; geen importer gestart.
- Volledige websuite: 433/434 geslaagd onder standaardtimeout; één bestaande budget/cachetest overschreed 5 seconden. De betreffende suite slaagt 23/23 met een tijdelijke CLI-timeout van 30 seconden. Geen timeoutinstelling in het project gewijzigd; dit is geen volledig groene run onder standaardinstellingen.
- De tijdelijke Windows-testconfiguratie gebruikt `fileURLToPath` voor de bestaande `@`-alias. De eerste tijdelijke configuratie had een fout pad; gecorrigeerd vóór de inhoudelijke volledige run.
- TypeScript, lint van beide gewijzigde bestanden en lokale Next.js-build geslaagd.
- Read-only live selectieaudit: geslaagd, 25/41 bruikbaar. Alle cachevarianten alleen gelezen.

## iPhone-hertest na succesvolle Preview-build

1. Zoek `Knorr mix`: controleer dat de airfryermix zichtbaar en kiesbaar is; zoek ook `mix` en `Honig`.
2. Kies afzonderlijk Honig bolognese en Oosterse wraps; Knorr burrito en Italiaanse risotto. Controleer merk, ingrediënten, verpakkingen en totaalprijs.
3. Test vier personen (burrito/risotto: twee mixverpakkingen), daarna één en tien personen.
4. Voeg toe, controleer boodschappenlijst en budget, heropen de app en controleer behoud zonder dubbele mixregels.
5. Controleer dat een normaal gerecht blijft werken en kip kerrie/kebab veilig geblokkeerd blijven zolang de datagaten bestaan.

Preview-status en de definitieve branch-head worden op PR #25 bijgewerkt na de push. Geen merge naar main of Production-deploy.
