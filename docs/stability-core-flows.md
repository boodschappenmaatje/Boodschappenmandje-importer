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
- Preview- en eindregressieresultaten staan hieronder; fysieke iPhone-acceptatie blijft open.

## Checkpoint 26 september 2026

- Draft PR #29 / `feature/stability-core-flows`, functionele commit `851413496cd6fba5d3ed18443d74060d6b23169a`.
- 733/733 webtests (63 bestanden), 189/189 importerfixtures, lint, TypeScript, seed-/syntaxchecks en Production-build groen. Snelle kernset 248/248.
- Eerste lokale build faalde uitsluitend doordat de hergebruikte node_modules-symlink buiten de checkout wees; met lokale dependencies geslaagd, zonder aanpassing aan de app/buildconfig.
- Vercel-check op deze commit: success / Ready. Branch-Preview: https://boodschappenmaatje-pwa-git-feature-st-07a781-dennisverkaik-4661.vercel.app
- GitHub CI-releasecheck op de functionele head én aansluitende documentatiehead: **success**, inclusief schone dependency-installatie en alle test/buildstappen.
- Eerste Preview-toegang was geblokkeerd door Vercel-login; de gebruiker heeft via de beveiligde aanmeldflow toegang gegeven. Geen projectbeveiliging of permissies gewijzigd. Live browsercontrole daarna hervat.
- Geen merge, Production-deployment, databasewijziging of productimport.

## Nog uit te voeren acceptatie

**KLAAR VOOR FYSIEKE IPHONE-TEST.** Controleer op iPhone: receptplus/lijstmin met manual extra; vervanging en gelijke hoeveelheid in compact/bewerken; herkomstkeuze bij gedeeld product; categorie/filter/afvinken/trash; maaltijd versus weekbudget; Honig/Knorr/eigen recept; sluiten/heropenen van de PWA. De beschikbare Work-browser heeft geen telefoonviewport.

Live data-aandachtspunt voor Productdata & receptkwaliteit: bij Knorr werd “Rode uien net 3 stuks” als productnaam getoond naast catalogusverpakking “1 stuk”. Geen cataloguscorrectie of geforceerde hoeveelheid uitgevoerd; afzonderlijk van de herstelde interne verpakkingsaantalpresentatie beoordelen.

## Live Preview-bewijs (functionele code 85141349)

- Schone lokale Preview-state: 4 personen, 5 dagen, €100 week / €70 maaltijden; 1 Hollandse +1 pasta +3 vrije plekken. Twee automatisch geldige gerechten voor €8,86, expliciet naar lijst gesynchroniseerd.
- Spinazie receptplus: 1→2, 600g receptbehoefte → expliciet 1.600g, gerecht €4,79→€5,74, maaltijd/lijst €8,86→€9,81. Lijstmin: terug naar expliciet 800g/1, €8,86. Productdetails bevestigt exact dag 2.
- Losse spinazie +1: recept1 + los1; lijst €9,81, maaltijden €8,86. Productwissel naar G'woon Broccoli 800g à €1,97: beide receptweergaven 800g; gerecht €5,81, maaltijden €9,88, lijst €10,83. Losse oorspronkelijke spinazie blijft €0,95.
- Diepvries in/uit, Overig-filter en afvinken werken; browserrefresh behoudt lijsttotaal/vervanging/losse bijdrage. Geen nieuwe prijs in Production gewijzigd.
- Honig macaroni geselecteerd; Italiaanse wokgroenten bewust van 2 naar1 verpakking/400g, gerecht €13,52→€11,63. Knorr Hokkien geselecteerd voor €20,81; onvolledige parallelle variant bleef veilig niet selecteerbaar.
- Eigen recept “Kernflow broccoli” gemaakt en bewaard met gekoppelde 800g broccoli à €1,97. Algemene lijstplus bij gedeelde broccoli opent eerst de herkomstkeuze zonder mutatie. Gerichte plus voor eigen recept dag 5: 1→2 / 800→1.600g / €1,97→€3,94; gewoon gerecht dag 2 blijft 1/800g. Totale broccoli 3 verpakkingen.
- Volledige reload + heropenen behoudt beide afzonderlijke bijdragen en afgevinkte manual spinazie. Menu toont eigen recept 1.600g, €3,94 / €0,99 p.p. Eindstand maaltijden €46,26 (ruimte €23,74), lijst €47,21 (weekruimte €52,79). Verschil €0,95 is exact de losse spinazie. Budgetpagina bevestigt dezelfde lijst/weekwaarden.
- Preview-herberekeningen kunnen merkbaar wachten op catalogus/revalidatie; geen snelheidsgarantie/benchmark. Werkelijke telefoonviewport en iOS-PWA-hervatten blijven fysieke acceptatie.
