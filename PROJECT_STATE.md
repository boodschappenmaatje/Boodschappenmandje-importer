# BoodschappenMaatje — Project State

> Dit bestand is het actuele technische checkpoint. Controleer bij ontwikkelwerk altijd ook de remote branch en PR; remote Git-status gaat voor verouderde tekst in dit bestand.

## Huidige milestone
**PWA 14 — Eigen recepten / Vrije keuze**

## Actieve ontwikkeling
- Repository: `boodschappenmaatje/Boodschappenmandje-importer`
- Branch: `feature/pwa14-eigen-recepten`
- Draft PR: **#27**
- Base: `main`
- Status: **klaar voor fysieke iPhone-test**
- Laatst gecontroleerde remote head bij aanmaak van dit bestand: `547926b76f05153507903e260f739a9f8a054a64`

Gebruik bij hervatten altijd de **actuele remote branch-head** als bron van waarheid; hardcode de SHA niet in vervolgopdrachten.

## PWA 14 / Fix 1 — werkend
- compacte receptdetails voor gegenereerde gerechten, maaltijdmixen en eigen recepten;
- aparte editor voor nieuw/bewerk recept;
- Menu blijft Menu; gerechten openen compact binnen de bestaande context;
- dynamische Vrije keuze met weekcapaciteit en expliciete vervanging;
- actuele productprijzen en verpakkingen;
- personen herberekenen;
- maaltijd- en weekbudgetvalidatie, inclusief expliciete override waar toegestaan;
- lijstsync met bescherming van handmatige gebruikerswijzigingen;
- eigen recepten lokaal opslaan en opnieuw openen;
- mockup-uitwerking met 2×2 actiekaarten en compacte mobiele UI.

## Laatste geverifieerde checks volgens PR #27
- lint: geslaagd;
- TypeScript: geslaagd;
- webtests: **539/539**;
- importer fixtures/regressies: **189/189**;
- lokale Production-build: geslaagd;
- Preview: Ready.

## Volgende acceptatiestap
**Fysieke iPhone-test van de actuele Preview.**

Na succesvolle iPhone-test:
1. bevindingen verwerken indien nodig;
2. opnieuw regressietesten;
3. pas na expliciete toestemming van de gebruiker PR gereedmaken/mergen;
4. Production deployment controleren;
5. smoke test uitvoeren;
6. dit bestand en `ROADMAP.md` bijwerken.

## Release-regels
- Geen merge naar `main` zonder expliciete toestemming.
- Geen Production-deploy of Production-databasewijziging zonder expliciete scope/toestemming.
- Geen productimport, migratie of destructieve databaseactie als die niet expliciet bij de opdracht hoort.
- Behoud werkende functionaliteit en gebruikersdata.
- Werk vanaf de actuele remote staat; start niet opnieuw vanaf een oud checkpoint.

## Bijwerken
Werk dit bestand bij na een betekenisvolle milestone, geslaagde iPhone-acceptatie, merge/release of wijziging van actieve branch/PR.
