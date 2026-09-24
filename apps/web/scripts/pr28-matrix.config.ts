import { defineConfig } from 'vitest/config';
export default defineConfig({resolve:{alias:{'@':new URL('../src',import.meta.url).pathname}},test:{environment:'node',include:['scripts/pr28-matrix.test.ts'],testTimeout:180000}});
