# Metallic blue branding — Preview only

Base: remote main `72f36dd63b1a6a40a457af1267fd0f0e3fc71ce7`.
All 415 source blobs were verified against main tree `81989ca95bd489ff677b93ad5a2fb1d644240376` before editing.
Branch: `feature/metallic-blue-branding`. No PWA 13 branch reuse.

## Inventory

Ten page routes covered by the shared style audit: Home, list, week preparation (including menu, dishes and Free choice), budget, products, product detail, More, catalogue status, Data Health and offline.

Good foundations retained: existing CSS-variable theme (no Tailwind), shared cards/icons/navigation, responsive layouts, safe-area spacing, image identity, PWA registration and all domain behaviour.

Inconsistencies addressed: saturated blue literals outside tokens; unrelated green/grey Free-choice inputs; separate red/amber/green text palettes; disparate radii/shadows; missing `--color-border-strong`; weak green text contrast; mismatched manifest/browser colours; undersized compact action targets.

## Visual contract

- Primary `#4A7399`, dark `#385D7C`, steel `#AFC3D4`, background `#F2F6F9`, positive accent `#36B37E`.
- All CSS colour literals now live in `src/styles/tokens.css`. Native manifest/viewport values mirror the same primary/background through `config/app.ts`, checked by tests.
- Primary actions remain blue. Positive small text uses a darker accessible green. Warning/error colours remain semantic and distinct. Maatje's existing pink mouth/cheeks remain illustration tokens; no image or official icon replacement.
- Solid calm page background, subtle card highlights, unified radii/shadows, focus/pressed/hover/selected/disabled states, 44px action targets, 16px form fields and reduced-motion support.
- No new settings or list-check feature: existing "Binnenkort" placeholders and existing list behaviour stay intact.
- Only the existing shell release identifier changes in registrar and service worker; no user storage reset, cache strategy or database changes.

## Automated validation

- Lint and TypeScript passed.
- Web suite: 442/442 (434 retained + 8 branding contract tests).
- Targeted PWA 13: 83/83.
- Importer regressions: 189/189, fixtures only; no import executed.
- Production build passed, 17/17 static pages.
- Branding contract covers palette, manifest identity, resolved tokens, no scattered literal colours, text contrast >=4.5:1, accessible status text, mobile/focus rules and chart/legend consistency.
- A local dependency symlink was replaced by copied dependencies for Turbopack. An accidental CSS replacement affecting `white-space` was corrected before publication and guarded by a test. Neither workaround affects application/runtime code.

## Scope and handoff

No application data, matching, recipe, budget, list sync, serving calculation, importer or database logic changed. No database writes, migrations, import, merge or Production deployment.
Preview/browser results will be recorded in the Draft PR after validation. Physical iPhone approval is required before any separately authorized release.
