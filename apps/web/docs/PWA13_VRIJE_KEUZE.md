# PWA 13 — Vrije keuze

Basis: `main` / `origin/main` op `2bda28b`, inclusief PWA 12 en planneronderhoud.
GitHub rapporteerde de bestaande Vercel-deployment voor deze commit als `success`.
Featurebranch: `codex/pwa-13-vrije-keuze`. Alleen Preview; fysieke iPhone-goedkeuring blijft vereist voor merge.

## Gedrag

- Vrije keuze toont **Zoek gerecht of maaltijdmix** en **Maak zelf een gerecht**.
- Zoeken gebruikt bestaande recepten, merknamen en gevalideerde maaltijdmixprofielen. Alleen complete, vers geprijsde keuzes zijn selecteerbaar. Onvolledige resultaten hebben geen fictieve prijs.
- De bestaande maaltijdmixprofielen bepalen merk, exacte mix, aanvullende ingrediënten en porties. Verpakkingen worden omhoog afgerond. De bestaande matcher en productdeduplicatie blijven leidend.
- Eigen gerechten bewaren naam, totale hoeveelheden voor het actieve huishouden, eenheden en eventuele expliciete productkeuzes in de bestaande IndexedDB-week. Geen account of databasewrite.
- Canonieke ingrediënten en aliases lopen via `searchIngredientProduct`; handmatige productkeuzes worden op ID herladen. De bestaande verpakkings- en prijsberekening wordt hergebruikt.
- Bevestigen loopt via `commitExplicitRecipeAlternative`: actuele validatie, expliciete budgetoverschrijdingsbevestiging, bestaande lijstsync en budgetmotor. Ook een nog niet aangevulde lijst wordt automatisch gevuld.
- Een nieuwe keuze verwijdert alleen de oude bijdrage van die week; gedeelde en handmatig beschermde producten blijven via de bestaande bijdrageadministratie behouden.
- Andere vrije keuzes blijven behouden bij hergeneratie en categoriewijzigingen. Een oude preview wordt opnieuw op de actuele week toegepast en vraagt opnieuw bevestiging bij gewijzigde budgetimpact.

## Databeperking op 20 september 2026

De echte catalogus bevat producten voor Honig spaghettisaus, maar geen gevalideerd receptprofiel voor **Honig Spaghetti Bolognese**. Ook een Knorr-spaghettiprofiel ontbreekt. Deze namen worden expliciet als nog niet compleet beschikbaar getoond; er zijn geen ingrediënten verzonnen.

De read-only controle met zes personen leverde:

- Spaghetti carbonara: compleet, €26,42 aan berekende verpakkingen op het testmoment.
- Honig macaroni en Knorr lasagne: op het testmoment geen volledig actuele matchset; veilig geblokkeerd.
- Eigen gerecht met 600 g spaghetti: echte Honig Spaghetti, €3,56 (twee verpakkingen) op het testmoment.

Deze bedragen zijn testobservaties, geen vaste UI-prijzen. De voorgeschreven iPhone-keuze van Honig Spaghetti Bolognese kan pas volledig worden doorlopen zodra gevalideerde receptdata en complete actuele productmatches bestaan. Er is geen importer-run of migratie uitgevoerd.

## Validatie

- Webregressies: 394 tests groen, inclusief PWA 12, merkbehoud, porties, verpakkingen, budget, lijstbijdragen en de nieuwe vrije-keuzetests.
- Importerregressies: 174 tests groen; geen importer uitgevoerd.
- TypeScript, ESLint en lokale production build.
- `scripts/pwa13-browser.mjs`: geïsoleerde browserflow met catalogusfixtures op 375, 390 en 430 px; naam, toevoegen/verwijderen, hoeveelheid, match, opslaan, refresh, zoeken, vervangen en lijst. Geen horizontale overflow of browserexceptions. Screenshots lokaal in `apps/web/test-results/pwa13/`.
- `apps/web/scripts/pwa13-live.config.ts`: afzonderlijke read-only controle op de echte Supabase-catalogus. Publieke configuratie via de bestaande `NEXT_PUBLIC_SUPABASE_*`-variabelen. Resultaten lokaal in `test-results/pwa13/live.json`.
- Fysiek iOS-toetsenbord, safe area en sluiten/heropenen als geïnstalleerde PWA blijven onderdeel van de gebruikersacceptatie.

Reproduceerbare opdrachten vanuit `apps/web`:

```sh
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js . --max-warnings=0
node node_modules/vitest/vitest.mjs run --maxWorkers=2
node node_modules/next/dist/bin/next build
node node_modules/vitest/vitest.mjs run --config scripts/pwa13-live.config.ts
```

De browsertest verwacht een lokale devserver op poort 3013 met
`NEXT_PUBLIC_SUPABASE_URL=https://pwa13-test.supabase.co` en een niet-geheime
testwaarde voor `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Alle Supabase-verzoeken
worden onderschept. Start vanuit de repositoryroot met
`node scripts/pwa13-browser.mjs`; eventueel `CHROME_PATH` en `PLAYWRIGHT_MODULE`
instellen voor een bestaande browserinstallatie.

## Exacte iPhone-acceptatie

1. Open de Preview in Safari en open of maak een week met ingesteld maaltijd-budget.
2. Zet maandag op **Vrije keuze**. Controleer dat er geen willekeurig gerecht wordt gekozen.
3. Tik **Zoek gerecht of maaltijdmix**, zoek **Honig spaghetti**. Controleer de Honig-naam en de eerlijke melding dat de variant nog niet compleet beschikbaar is; geen selecteerbare Knorr-vervanging.
4. Zoek **spaghetti** en kies een compleet beschikbare variant, op het testmoment **Spaghetti carbonara**. Controleer personen, producten, verpakkingen en prijs vóór bevestigen.
5. Sla het gerecht op. Controleer de boodschappenlijst, maaltijdkosten en resterend weekbudget.
6. Open het gerecht opnieuw, zoek een andere beschikbare variant en vervang het. Controleer dat oude unieke bijdragen verdwijnen en gedeelde/handmatige bijdragen blijven.
7. Kies **Maak zelf een gerecht**, voer **Pasta met kip** in en voeg ingrediënten toe. Kies per regel een hoeveelheid en eenheid. Verwijder een tijdelijke regel en wijzig een hoeveelheid.
8. Controleer de automatische matches; gebruik **Zelf product kiezen** om een match bewust te wijzigen. Probeer ook een onbekende naam en controleer de melding.
9. Tik **Controleer producten en prijs**. Controleer de volledige productenlijst en eventuele budgetwaarschuwing; sla het gerecht op.
10. Sluit Safari/de geïnstalleerde PWA volledig en open opnieuw. Controleer gerechtnaam, ingrediënten, hoeveelheden, gekozen producten en boodschappenlijst.
11. Controleer toetsenbordbediening, onderste navigatie en safe area op de echte iPhone. Geef daarna pas fysieke goedkeuring; deze PR blijft Draft en wordt niet automatisch gemerged.
