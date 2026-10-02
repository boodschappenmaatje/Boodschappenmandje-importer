# BoodschappenMaatje — Roadmap

`PROJECT_STATE.md` bepaalt waar de ontwikkeling **nu technisch staat**. De actuele remote code/branch/PR is de hoogste technische bron van waarheid.

## Productdoel

BoodschappenMaatje helpt gebruikers vooral **geld besparen** en maakt boodschappen doen tegelijk sneller en eenvoudiger.

De **boodschappenlijst staat centraal**.

Vaste regels:
- rekenen met hele verpakkingen;
- geen fictieve €0-prijzen of hoeveelheden;
- geen geforceerde productmatches;
- handmatige gebruikerskeuzes beschermen;
- maaltijdbudget en totaal weekbudget blijven apart;
- actuele aanbiedingen meenemen in de echte kassaprijs;
- goedkoopste geschikte en betrouwbare optie wint;
- restvoorraad is geen strafpunt;
- Hoogvliet blijft voorlopig de ondersteunde prijsbron.

## Uitvoeringsregels

- **Codex** doet standaard codeonderzoek, implementatie, refactors, algoritmes, tests en performancewerk.
- **Work** doet GitHub/PR, Supabase-live-data, Vercel Preview, browsercontrole, live maintenance, release en Production-smoke.
- **Een Work-run behandelt maximaal één technisch checkpoint.**
- Bij gecombineerde taken: **Codex eerst → Work daarna**.
- Work implementeert alleen zelf als een wijziging klein is en direct onderdeel is van integratie/release.
- Geen merge of Production zonder expliciete goedkeuring wanneer een Preview/iPhone-acceptatie openstaat.

---

# Hoofdroadmap

| # | Onderdeel | Status | 💰 Bespaarimpact | Waarom | Uitvoering | Eerst nodig | Klaar als |
|---|---|---|---|---|---|---|---|
| 1A | Honig/Knorr NOT_READY | 🔵 Nu — PR #39 | Hoog | Betrouwbare recepten zonder verkeerde producten/verpakkingen | Codex → Work | — | Veilige fixes gereleased; AFTER-audit gedaan; alleen echte datablokkades blijven |
| 1B | Honig/Knorr NO_RECIPE | ⏭️ Hierna | Hoog | Meer maaltijdmixen bruikbaar maken | Codex → Work | 1A | 1 Honig + 14 Knorr profielen betrouwbaar beoordeeld/opgebouwd waar data dit toelaat |
| 1C | Overige receptkwaliteit + Data Health | Daarna | Hoog | Minder plannerfouten en betere productmatching | Codex → Work | 1B | Overige kritieke profiel-, package- en matchproblemen aantoonbaar beheerst |
| 2 | Budgetbewuste productselectie | ⭐ Hoge prioriteit | **Zeer hoog** | Altijd de goedkoopste geschikte kassacombinatie kiezen | Codex → Work | Receptkwaliteit betrouwbaar | Hele verpakkingen, aanbiedingen, huismerk en producthergebruik worden correct geoptimaliseerd binnen budget |
| 3 | Betrouwbare opslag + geschiedenis | Gepland | Middel | Geen verlies van week, lijst, recepten of keuzes | Codex → Work | Stabiele kernflows | Week/lijst/herstel en weekhistorie betrouwbaar bewezen |
| 4 | Voorraadkast + terugkerende producten | Gepland | **Zeer hoog** | Eerst gebruiken wat echt thuis is en minder onnodig kopen | Codex → Work | Opslagfundament | Voorraad telt alleen na bevestiging; restverpakkingen kunnen veilig als vermoedelijke voorraad terugkomen |
| 5 | Eigen recepten — vervolg | Gepland | Middel | Meer flexibiliteit zonder budget-/lijstregressies | Codex → Work | Opslag stabiel | Eigen recepten robuust bewerken/bewaren en correct laten meedoen in prijs/lijst |
| 6 | Slimmere suggesties | Gepland | Hoog | Relevante aanvullingen zonder lijst te vervuilen | Codex → Work | Voorraad + historie | Suggesties zijn relevant, uitlegbaar, budgetbewust en nooit automatisch dominant |
| 7 | Personalisatie | Gepland | Hoog | Minder handwerk en betere keuzes per huishouden | Codex → Work | Geschiedenis + suggesties | App leert voorkeuren/patronen zonder expliciete keuzes te overschrijven |
| 8 | Home-mascotte / gerechtfoto's | Later | Laag | Meer herkenning en aantrekkelijkere app | Work | Kernfunctionaliteit stabiel | Visueel goedgekeurd op iPhone zonder functionele regressies |
| 9 | Haptische feedback | Onderzoeken | Laag | Snellere/duidelijkere bediening waar iOS dit betrouwbaar ondersteunt | Work eerst | Fysieke iPhone-proef | Alleen behouden als echte PWA-ondersteuning bewezen is |
| 10 | Launch-polish | Voor publieke lancering | Middel | Snelle, betrouwbare en verzorgde eindervaring | Work | Functionele kern gereed | Volledige iPhone-flow, performance, toegankelijkheid, juridische pagina's en Production-smoke groen |
| 11 | Accounts & synchronisatie | Na kern + launch-polish | Laag | Data tussen apparaten bewaren | Codex → Work | Opslag + launch-polish | Login en synchronisatie betrouwbaar zonder lokale data stil te verliezen |
| 12 | BoodschappenMaatje Plus | Na accounts | Laag | Verdienmodel met extra gemak | Codex → Work | Accounts stabiel | Plus voegt waarde toe zonder gratis kern kunstmatig te beperken |

---

# Later

| Onderdeel | 💰 Bespaarimpact | Uitvoering | Voorwaarde |
|---|---:|---|---|
| Meldingen | Laag | Codex → Work | Alleen nuttige herinneringen |
| Offline/PWA-robuustheid | Middel | Codex → Work | Geen schijnbaar actuele onbetrouwbare prijsdata |
| Kassabon / werkelijke uitgaven | Hoog | Codex → Work | Betrouwbare invoer/herkenning beschikbaar |
| Meerdere supermarkten | **Zeer hoog** | Codex → Work | Hoogvliet-kern en providerarchitectuur betrouwbaar |

---

# Afgerond / Production

| Onderdeel | Status |
|---|---|
| PWA-basis t/m PWA 14 | ✅ |
| Branding + Home Optie C | ✅ |
| PR #28 — verpakkingen/lijst/budget | ✅ |
| PR #29 — stabiliteit & kernflows | ✅ |
| Importer & maintenanceherstel | ✅ |
| PR #37 — Hoogvliet-productdekking | ✅ |

Historische commits, deployments, testtellingen en technische bewijsdetails horen in `PROJECT_STATE.md` of relevante docs, niet in deze roadmap.

---

# Roadmapbeheer

- Nieuwe ideeën worden alleen toegevoegd als ze productwaarde hebben; buiten-scope ideeën worden geparkeerd.
- `ROADMAP.md` bevat alleen richting, volgorde, waarde, afhankelijkheden en uitvoeringskeuze.
- `PROJECT_STATE.md` bevat het actuele technische checkpoint.
- `DESIGN.md` bevat vaste UX/UI-regels.
- Diepe technische historie en bewijs horen in relevante docs.
- Bij conflict met actuele remote code/PR: eerst remote toestand vaststellen en daarna documentatie corrigeren.
