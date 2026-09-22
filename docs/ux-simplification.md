# UX simplification — Preview only

Base: branding PR #26, remote a9b0e1d4ed479902fff58bab82607d2c9b05618b (local tree a869d1623b2b8599893e98d85dc9df0e04e97a68). User approved branding on iPhone. Continue on feature/metallic-blue-branding and retain PR #26; no merge or Production deployment.

## Inventory before changes

| Screen | Current issue | Target | Preservation risk |
| --- | --- | --- | --- |
| Home | Competing cards/actions, three equal budget numbers | Remaining budget, household/meal status, list primary, week secondary | Keep exact known/unknown/over-budget calculation |
| Week | All forms and generated menu visible together | Four steps: Basis, Maaltijden, Voorkeuren, Overzicht | Keep provider, generation gates, saved values, overrides and existing week |
| Free choice | Recipe/mix search combined with custom editor | Choose one of three routes, then search/check/confirm | Preserve search completeness, brand identity, revalidation and custom flow |
| Dish detail | Repeated budget labels, expanded ingredients, competing actions | Image/name/price first, expandable ingredients and mix identity, one add action | Retain matching, package calculations, warnings, replacement actions |
| List | No check state, no category grouping; provenance dominates | Direct local check state, three filters, actual catalog categories, direct quantity | Optional backward-compatible local fields; totals include checked items; preserve contributions |
| Budget | Planned amount dominates | Remaining amount first, breakdown secondary | Never call planned/checkmarked amounts actual paid spending |
| Products/filters | Large cards and multiple metadata rows | Compact product rows and single add; existing filter sheet/chips retained | Preserve prices, search, filters and unavailable states |
| More/navigation | Admin first, Budget absent from bottom bar | Consumer links first, separate owner section; Home/Menu/Lijst/Budget/Meer | Product access remains from list and More; retain all admin routes |

No Supabase schema, migrations, product import, matching/cache architecture or new account/custom-recipe backend. Existing approved colour tokens, contrast, tap targets and input sizes remain.

## Implementation and validation

- Four-step presentation uses existing week provider; valid budgets save on Next. Returning preserves inputs. An existing generated week opens at its overview.
- Route filtering happens before the existing result bound so recipes are not displaced by mix results; all matching mixes remain visible. No new search pipeline.
- Optional checked/category fields use the existing local IndexedDB record/schema v2. No database migration. Old records remain valid; prices, totals and contribution ownership are unchanged. Additional quantity returns the item to the remaining filter. Unknown categories remain honestly grouped as Other until catalog data supplies them.
- Existing product filters remain a sheet with active-filter chips. Keyboard focus is contained and restored.
- Lint and TypeScript passed. Full web suite 453/453, focused PWA suite 90/90, importer fixtures 189/189. Production build passed, 17 static pages.
- Preview/browser verification and the iPhone handoff are recorded in PR #26 after deployment. Browser viewport emulation remains unavailable; do not claim a physical iPhone test.
