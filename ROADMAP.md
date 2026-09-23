# BoodschappenMaatje — Roadmap

Dit document bevat de productroadmap. `PROJECT_STATE.md` bepaalt waar de ontwikkeling **nu** staat. De actuele code, remote branch en PR blijven de technische bron van waarheid.

## Productvisie
BoodschappenMaatje is een persoonlijke boodschappenassistent die de week voorbereidt, leert wat nodig is en helpt binnen budget te blijven. Het weekmenu ondersteunt de boodschappenlijst; het is niet het doel op zichzelf.

## Afgeronde hoofdmijlpalen

| Mijlpaal | Status | Kern |
|---|---|---|
| PWA 9 | Afgerond / Production | Budgetmotor, cent-nauwkeurig, quantity × prijs, cacheprijzen |
| PWA 10 | Afgerond / Production | Slimme weekvoorbereiding op personen, dagen, budget en bestaande lijst |
| PWA 11 | Afgerond | Recepten, ingrediënten, productmatching, actuele prijzen en readiness |
| PWA 11 Fixes | Afgerond | Data Health, Match Repair, Recipe Readiness Gate, Meal Budget Gate |
| PWA 12 | Afgerond | Menu aanpassen, gerecht/product/ingrediënt vervangen, budgetoverride |
| Planner-cache | Afgerond | Persistent readiness/match-cache, people_count 1–10, automatisch onderhoud |
| Productonderhoud | Afgerond | Gerichte rematch/readiness invalidatie bij nieuwe producten |
| PWA 13 | Afgerond / Production | Vrije keuze en maaltijdmixen, o.a. Honig/Knorr |
| Branding / UX simplification | Afgerond / Production | Metallic blauwe stijl, app-icoon, rustiger mobile-first UX |

## Actief

### PWA 14 — Eigen recepten
Doel: eigen recepten als volwaardig onderdeel van Vrije keuze en Menu.

Huidige scope:
- eigen recept maken, bekijken en bewerken;
- echte producten koppelen;
- actuele prijzen/verpakkingen;
- personen schalen;
- budgetvalidatie;
- weekcapaciteit respecteren;
- lijstsync;
- compacte receptdetails;
- aparte editor;
- mobiele mockup-uitwerking.

Zie `PROJECT_STATE.md` voor het actuele checkpoint.

## Bekende latere verbeteringen
Deze punten zijn bewust niet allemaal onderdeel van PWA 14:
- eigen recepten verder uitbreiden waar gebruikerstesten daar aanleiding toe geven;
- rechtenvrije/AI-gerechtfoto's met betrouwbare fallback;
- verdere uitbreiding van recept- en maaltijdmixdekking;
- catalogus/productmatching blijven verbeteren via dagelijkse data-import.

## Data & catalogus
Doel:
- dagelijkse Hoogvliet-product/prijsonderhoud;
- geen duplicaten;
- actuele prijzen;
- importer zelfherstellend met retry/back-off en checkpoints;
- gerichte rematch bij nieuwe/gewijzigde producten;
- doorgroeien naar een brede, bruikbare catalogus.

## Accounts
Later toevoegen:
- account/login, bij voorkeur eenvoudige Google-login;
- gebruikersdata veilig synchroniseren tussen apparaten;
- migratiepad voor lokale recepten/lijsten waar mogelijk;
- privacy en dataminimalisatie expliciet meenemen.

## BoodschappenMaatje Plus
Pas na stabiele kern en accounts.

Uitgangspunt:
- kernfuncties blijven gratis;
- Plus biedt extra gemak, automatisering en personalisatie;
- geen paywall die de basislijst, weekvoorbereiding, budget of essentiële prijsfunctionaliteit onbruikbaar maakt.

## Pre-launch UX & positionering
Voor publieke lancering:
- onboarding: “BoodschappenMaatje gebruikt momenteel Hoogvliet voor product- en prijsinformatie”;
- duidelijk maken dat BoodschappenMaatje onafhankelijk is en geen officiële Hoogvliet-app;
- supermarktinstelling: “Supermarkt: Hoogvliet” + “Momenteel ondersteund”;
- compacte bronvermelding bij prijzen;
- fout- en lege staten nalopen;
- install/PWA-flow nalopen;
- mobile performance en toegankelijkheid controleren;
- privacy-/voorwaardenpagina's en benodigde juridische informatie afronden.

## Roadmapregels
- Nieuwe ideeën worden eerst als roadmapitem vastgelegd als ze niet bij de huidige scope horen.
- Geen grote nieuwe feature midden in een acceptatie-/releasefase.
- Na afronding van een milestone: status bijwerken, release verifiëren en daarna pas de volgende stap starten.
- Bij conflicten tussen roadmap en actuele code/PR: eerst actuele remote toestand vaststellen en daarna documentatie corrigeren.
