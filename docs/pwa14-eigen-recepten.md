# PWA 14 — Eigen recepten (Preview only)

Base: remote main 881e57b70ef7519a7b255b0305b3cdaff3520f69, verified at phase start. All 422 base files matched their Git object hashes. Branch: feature/pwa14-eigen-recepten. Local snapshot has a synthetic commit; remote commits are created with the actual remote parent, never force pushed.

## Existing flow inventory

- Working: three Free-choice routes; canonical catalog search; CustomDish typed ingredient model; canonical package calculation, whole-week validation, budget override confirmation, list provenance and delta sync; neutral recipe/product photo fallbacks.
- Partial: custom recipe form, manual product choice and quantity entry; persistence only after selecting the dish into the active week; quantities implicitly followed household count.
- Missing: persistent draft, independent private recipe collection, reopen/reuse, chosen person count, search-result prices, per-ingredient unavailable/price feedback, explicit unknown-package-content input.
- Existing Supabase schema contains shared recipes, ingredients, relations, catalog and planner caches, with no authenticated private recipe ownership. No new Supabase table or migration needed in this account-free phase.

## Added

Product-first ingredient editor uses the existing provider catalog query/getByIds. Typed versioned localStorage saves drafts synchronously per week/day and a private recipe collection independently of the active week. No price snapshot is persisted. Each open/preview/confirmation retrieves current products. Selected custom product reads are batched and deduplicated. Unavailable, missing, stale, zero, wrong-product and wrong-supermarket prices cannot produce a ready custom dish. Fallbacks remain editable and saved recipes are retained.

`servings` remains the base; optional `targetServings` controls this custom meal without changing the household or other days. Existing PWA 13 records without it retain their behavior. Optional `savedRecipeId` maintains the saved recipe link inside the active week's customDish. Package-content overrides are explicit user input, bound to the chosen product and unit; changing either clears the override. Current reliable catalog contents take precedence. Grams and milliliters are never interconverted.

Existing free-choice preview, budget impact, explicit confirmation, revalidation, recipe selection and list-sync services remain the authority. Photo upload is not supported by the existing architecture, so a neutral fallback is used; no image generator or public storage.

## Validation / remaining checkpoint

Targeted service tests and existing baseline suite passed during implementation. Final lint/typecheck/full web tests/importer fixtures/build and deployed Preview flow are recorded in the Draft PR after final verification. No import, Production database write, merge, or Production deployment is permitted in this phase.

## Deployed Preview evidence (22 September 2026)

Draft PR #27; first implementation commit b6b31c2dcda0f497597cd2c49bf80e8a28e79d3c. Vercel GitHub status success. Preview branch URL: https://boodschappenmaatje-pwa-git-feature-pw-490117-dennisverkaik-4661.vercel.app/

Browser verified the full requested flow with a fresh 4-person, one-day free-choice week (€100 week / €50 meal budget):

1. Created Mijn pasta pesto PWA 14 with G'woon spaghetti 400 g, G'woon pesto 190 g and two red peppers. Catalog photos, contents and current prices visible. Total €3.25; meal remainder €46.75.
2. Replaced spaghetti with Bio+ wholewheat spaghetti (500 g / €0.48). Total €3.31; quantities retained.
3. Saved into Mijn recepten, navigated Home → Menu → Zelf maken. Draft and saved recipe survived.
4. Opened saved recipe and changed target from 4 to 6: 600 g spaghetti, 285 g pesto, 3 peppers; 2/2/3 packages, total €5.77; meal remainder €44.23. Household stayed at 4.
5. Added to list; three exact products and 2/2/3 quantities visible at €5.77.
6. Manually increased spaghetti to 3. Reapplied the same recipe: quantities stayed 3/2/3 and total €6.25. No duplicates or lost manual increment.
7. Real search results with unavailable current prices were clearly labelled and disabled. Automated tests additionally cover missing images/products, stale/wrong/zero prices, content overrides, changed confirmation prices and explicit budget overrides.

Two small issues found in the Preview were corrected: restored unchanged saved drafts no longer show a false unsaved-changes warning, and the dish-detail label uses the recipe's chosen persons rather than the household count. Targeted test added. No redesign or importer changes.

Validation: lint and TypeScript passed; full web suite 497 tests; importer regressions 189/189 using fixtures only; Production build generated 17 pages. Physical iPhone layout verification remains the user's next test. Private recipes are local to the browser/device and origin; Preview recipes are not synced to Production.
