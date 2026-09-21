import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({ resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } }, test: { environment: "node", include: ["scripts/pwa13-cache-backfill.test.ts"], testTimeout: 600000 } });
