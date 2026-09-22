import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } }, test: { environment: 'node', include: ['src/services/week-preparation/meal-mix-profiles.test.ts','src/services/week-preparation/meal-mix-completion.test.ts','src/services/week-preparation/recipe-images.test.ts','src/services/week-preparation/free-choice.test.ts','src/services/week-preparation/persistent-readiness-cache.test.ts','src/server/meal-mix-source.test.ts'] } });
