# Stabiliteit & kernflows — vaste testset

Uitgangspunt: Production/main `ba4119677cc054039bebab7dd4424fef670caf25`, PR #28 geaccepteerd. Geen nieuwe consumentenfeature, data-import of opslagmigratie.

## Testlagen en commando's

- **Unit/service:** prijsvalidatie, hoeveelheden, matching/readiness, budgetselectie, storage-codecs en gerichte cache-invalidatie.
- **UI-integratie/kernflow:** Vitest + happy-dom, echte React-schermen, providers en click/input-events. Alleen catalogus/opslagpoorten en Next-navigatie worden deterministisch aangeboden. Dit is geen volledige browser-E2E, en bewijst geen Safari-layout of echte IndexedDB-transacties.
- **Preview-browser:** aanvullende echte navigatie, catalogusreads en opslag/heropenen op Vercel. Fysieke iPhone/PWA-acceptatie blijft apart.

Snelle releasecheck: `npm run test:core --prefix apps/web` (248 tests in 14 bestanden, ongeveer 11 seconden lokaal). Volledige webcheck: `npm run check --prefix apps/web`. Importerfixtures: `npm test` en `npm run check` vanuit de root; deze commando's voeren geen import uit.

De GitHub Actions-workflow `core-flows.yml` draait bij iedere PR en op main. Eén volledige webcheck bevat de kernset; geen dubbele suite, secrets, databaseverbinding of automatische deploymentstap. De bestaande Vercel Git-integratie verzorgt Preview. De check is een releasecriterium; deze wijziging zet geen branch protection aan en maakt niet zelfstandig een server-side mergeblokkade.

## Bewaking per kernflow

| Flow / regressie | Automatische bewaking |
|---|---|
| Lege Home → personen/dagen/budget → week genereren | `src/test/core-flows/new-week.test.ts`: echte invoer, knoppen, READY gerechten, lijst expliciet aanvullen |
| Recept + werkt werkelijk, 400→800g, lijst terug 2→1 | `quantity-flow.test.ts` plus nieuwe routeketen, echte providers/mutatieroute |
| Verkeerd gerecht of verdwenen manual extra | `quantity-flow.test.ts`, `recipe-contributions.test.ts`: exacte dag/recept/ingrediëntlink, gemengde/gedeelde bijdragen |
| Nieuwste prijs, oude fallback, €0/invalid, gerichte cache | `price.test.ts`, `catalog-repository.test.ts`, `planning-cache.test.ts`, `quantity-flow.test.ts` (focus reprijst zonder aantallen te wijzigen) |
| Automatisch €70,00 toegestaan / €70,01 geweigerd | `meal-budget-selection.test.ts`; goedkopere tweede combinatie, bewezen onhaalbare fixture; `planner-five-days.test.ts` met opgenomen catalogusdata |
| Handmatige override is apart; verlagen altijd mogelijk | `quantity-flow.test.ts`: Menu/Vrije keuze/Lijst, Annuleren/Toch verhogen, maaltijd/wekelijkse overschrijding en heropenen |
| Productwissel houdt naam/foto/hoeveelheid/prijs/lijst actueel | vijf vervangingen in `quantity-flow.test.ts`, inclusief broccoli 800g, liter en 6 stuks; beide presentaties na heropenen |
| Compacte lijst, details, filters, afvinken, categorieën, directe trash | `quantity-flow.test.ts`, bestaande shopping-list-, origin- en lifecycle-tests |
| Opslag, navigeren, opnieuw laden, fouten | nieuwe routeketen mount zonder initial state; echte codecs na JSON-roundtrip; laadfout bewaart records, schrijffout is zichtbaar; bestaande legacy-schema/invalid-state-tests |
| Recepttypen en schaalbaarheid | `recipe-types-matrix.test.ts`: 1/2/4/6/10/12 personen × 1/3/5/7 dagen, normaal/Honig macaroni/Knorr Hokkien mie/eigen recept; 96 typegevallen met positieve prijzen, verpakkingen, exacte origins en codec-roundtrip |
| Planner personen/dagen | bestaande 24-cellenmatrix in `meal-budget-selection.test.ts`, volledige geldige week binnen harde grens |
| Ontbrekende prijs, onbekende inhoud, INVALID match, lege eigen recepten | `recipe-readiness.test.ts`, `ingredient-packages.test.ts`, `my-recipes.test.ts`; geen verzonnen data/prijs |
| PWA-regressies | bestaande update-/cache-/navigatietests; echte iPhone-installatie/hervatten blijft handmatig |

Vitest ontdekt nu ook `src/**/*.test.tsx`: twaalf reeds aanwezige tests voor catalogusstatus, gerechtfoto-fallback en Meer werden voorheen ongemerkt overgeslagen.

## Centrale state: bevinding

Het bestaande model is consistent: expliciete pakketkeuzes leven in `WeekPreparation.customizations.quantityOverrides` (en native eigen-receptinputs). `ingredient-quantity` past ze op de geplande dag toe; `completeShoppingListFromWeek` leidt exacte bijdrageadressen af. `recipeContributionTargets` controleert week/dag/recept/ingrediënt/product/SKU. Zowel recept- als lijstknoppen gebruiken `usePackageMutation` en dezelfde provider-preview/commit. Losse bijdragen blijven `persistentQuantity`. Verwijderen gebruikt `excludedIngredients`, geen kunstmatige quantity 0.

Geen parallelle bewerkbare recept- en lijstquantity toegevoegd; geen refactor van de werkende centrale mutatieroute nodig. De expliciete actie “Maak mijn lijst compleet” koppelt een nieuwe voorbereiding aan de actieve lijst; daarna werken beide richtingen.

## Hoeveelheidspresentatie: oorzaak en correctie

Een handmatig vervangend product wordt intern als verpakkingsaantal vastgelegd (`quantityIsPackageCount`). `ingredientRecipeAmount` rekende dat al om voor compact detail, maar de uitgeklapte `DishIngredients`-weergave gebruikte rechtstreeks `requiredQuantity` en `unit`. Daardoor betekende interne `1 piece` één verpakking, maar werd dit als “1 stuk nodig” getoond.

Beide presentaties gebruiken nu dezelfde daghoeveelheid en betrouwbare verpakkingsinhoud. 1×800g → 800g, 2×800g → 1.600g; idem ml/stuks. Normale recepten behouden hun geschaalde behoefte (bijvoorbeeld 200g nodig, één te kopen verpakking van 400g); die twee begrippen worden niet stil gelijkgemaakt. Bij onbekende inhoud blijft een expliciet verpakkingsaantal “verpakking”, nooit een verzonnen eetbaar stuk. De dubbele lokale pakketberekening is vervangen door de bestaande gedeelde helper.

## Grenzen en open punten

- Fixtures voor Honig/Knorr bewaken softwaregedrag; zij zijn geen nieuwe live assortimentsaudit en herstellen geen ontbrekende productdata. Echte datablokkades blijven onder Productdata & receptkwaliteit.
- happy-dom simuleert routes/opslagpoorten; native IndexedDB, Safari-touch, PWA-resume en offlinegedrag vragen browser/iPhone-controle. Geen claim van cloud/accountsync of atomaire opslag over meerdere stores.
- Geen timingasserties of nieuwe productiecode voor caching; geen extra catalogusrequests door deze presentatiecorrectie.
- Preview- en eindregressieresultaten worden bij voltooiing hieronder vastgelegd.

## Checkpoint 26 september 2026

- Draft PR #29 / `feature/stability-core-flows`, functionele commit `851413496cd6fba5d3ed18443d74060d6b23169a`.
- 733/733 webtests (63 bestanden), 189/189 importerfixtures, lint, TypeScript, seed-/syntaxchecks en Production-build groen. Snelle kernset 248/248.
- Eerste lokale build faalde uitsluitend doordat de hergebruikte node_modules-symlink buiten de checkout wees; met lokale dependencies geslaagd, zonder aanpassing aan de app/buildconfig.
- Vercel-check op deze commit: success / Ready. Branch-Preview: https://boodschappenmaatje-pwa-git-feature-st-07a781-dennisverkaik-4661.vercel.app
- Echte browsercontrole **niet uitgevoerd**: de Preview toont Vercel-login. Tijdelijke toegangsaanvraag via de gekoppelde Vercel-app is geweigerd omdat project/team niet geautoriseerd zijn. Geen beveiliging of permissies gewijzigd. GitHub CI-releasecheck op de functionele head: **success**, inclusief schone dependency-installatie en alle test/buildstappen.
- Geen merge, Production-deployment, databasewijziging of productimport.

## Nog uit te voeren acceptatie

Na toegang: genereer een week; recept 1→2 / lijst 2→1; voeg een losse extra toe; vervang een product door 800g/een liter/stuksverpakking en vergelijk compact/bewerken; klap categorie in/uit en vink af; controleer bedragen; herlaad; voeg een geldige Honig-, Knorr- en eigen-receptkeuze toe. Bevestig hoeveelheden, origins en behoud van de losse extra. Daarna fysieke iPhone-touch/PWA-hervatting.
