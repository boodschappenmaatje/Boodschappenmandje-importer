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

531 webtests (49 files), including 34 additional Fix 1 tests. Existing PWA 13 and PWA 14 regressions included. Importer 189/189 (fixtures only). Lint, TypeScript and local build results and live Preview evidence recorded in PR #27 after completion.

The Preview uses device-local data. No account sync or transfer to Production is introduced.

## Live Preview acceptance (22 September 2026)

- Existing private pasta recipe opens inside Menu: 6 people, €5.77, three compact rows. Generated tortellini and Honig spaghetti mix also opened within the unchanged Menu URL. Mix detail initially shows five rows and expands the remaining ingredients inline.
- Expanded existing one-day week into seven days: six free-choice slots plus one generated recipe. Existing recipe and manual list increment retained. Progress advanced from 1/6 through normal recipe, real Honig mix and custom recipes to 6/6. At capacity only an existing slot could be selected for replacement; Mijn recepten remained available without an add action.
- Created Mijn wraps Fix 1 using real Santa Maria medium wraps (8 pieces, €2.39), saved to compact detail, reopened from Mijn recepten, entered the editor explicitly, scaled 4→6 people (8→12 wraps; 2 packages, €4.78), saved back to detail and added to the list.
- Explicit budget override tested at the last slot: €1.15 meal overage, no week overage. Preview found a zero-clamped compact budget label; corrected to show actual overage, with a regression test. Collection-only views do not show budget impact of a nonexistent extra slot.
- Reduced six filled free-choice slots to two. All six choices remained until explicit selection and confirmation. Selected private pasta and Honig meal retained, other week contributions reconciled. Hand-increased Bio+ spaghetti remained at 3 packages (planned amount 2). Saved private recipes retained.

Only Preview-local test data was changed. Final remote SHA and final Preview verification are recorded in PR #27.
