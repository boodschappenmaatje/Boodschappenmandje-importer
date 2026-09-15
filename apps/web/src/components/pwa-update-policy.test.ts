import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SERVICE_WORKER_RELEASE } from "./PwaRegistrar";

const serviceWorkerSource = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);

describe("PWA updatebeleid", () => {
  it("houdt registrar en service-worker op dezelfde PWA 6-release", () => {
    expect(serviceWorkerSource).toContain(
      `const CACHE_VERSION = "${SERVICE_WORKER_RELEASE}"`,
    );
  });

  it("haalt navigaties eerst zonder browsercache van Production", () => {
    expect(serviceWorkerSource).toContain('fetch(request, { cache: "no-store" })');
  });

  it("ruimt oudere shellcaches op en ondersteunt directe activatie", () => {
    expect(serviceWorkerSource).toContain("caches.delete(key)");
    expect(serviceWorkerSource).toContain('event.data?.type === "SKIP_WAITING"');
  });
});
