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
