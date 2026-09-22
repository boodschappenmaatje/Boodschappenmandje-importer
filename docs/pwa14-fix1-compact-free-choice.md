# PWA 14 Fix 1 — compact viewing and dynamic free choices

Continues remote PR #27 at c459f5f7f8440d28fcaf8873b4c7750e087c21ac. No new branch, importer changes, migrations or Production release.

## Changes

- Shared CompactRecipeDetail for generated recipes, selected recipes, meal mixes and custom dishes. Five ingredient rows visible immediately; remaining ingredients expand inline. Real product thumbnails/fallbacks, needed amounts, package counts, costs, people and meal budget. Editing actions are collapsed in Menu.
- Menu accordions stay in Menu. Separate /vrije-keuze route with Menu/Vrije keuze navigation, current-week progress, explicit slot selection and replacement at capacity.
- Existing CustomDishEditor is reused as a separate new/edit screen. Mijn recepten opens read-only detail; save returns to detail. Draft persistence and fresh-price validation retained.
- The private recipe collection has no app-imposed recipe count limit. Storage failures remain visible.
- Changed week distribution retains the previous chosen meals until confirmation. Reducing below chosen count requires an explicit retention selection. Chosen recipes/customizations are remapped into the new slots on confirmation.
- Free-choice preview and commit cannot create a slot by converting an unrelated generated day; stale confirmations during distribution edits are rejected.
- Existing product lookup, quantity, manual package input, budget override and shopping-list provenance architecture reused.

## Validation

527 webtests (49 files), including 30 additional Fix 1 tests. Existing PWA 13 and PWA 14 regressions included. Importer 189/189 (fixtures only). Lint, TypeScript and local build results and live Preview evidence recorded in PR #27 after completion.

The Preview uses device-local data. No account sync or transfer to Production is introduced.
