import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import manifest from "./manifest";
import { APP_ICON_REVISION, appIconUrl } from "@/config/app-icons";

const publicFile = (name: string) => new URL(`../../public/icons/${name}`, import.meta.url);
const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
const sw = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const icons = [
  ["maatje-v1-apple-touch.png", 180], ["maatje-v1-192.png", 192],
  ["maatje-v1-512.png", 512], ["maatje-v1-maskable-512.png", 512],
  ["maatje-v1-favicon-16.png", 16], ["maatje-v1-favicon-32.png", 32],
] as const;

describe("officieel BoodschappenMaatje app-icoon", () => {
  beforeEach(() => vi.stubEnv("VERCEL_ENV", "production"));
  afterEach(() => vi.unstubAllEnvs());

  it("behoudt de exacte originele aangeleverde afbeelding", () => {
    const master = readFileSync(new URL("../../assets/branding/boodschappenmaatje-original.jpeg", import.meta.url));
    expect(createHash("sha256").update(master).digest("hex"))
      .toBe("c77530d67cd5d19a7251672d4dcc0a4fae0909aed3f5490ad1f7d001b31e648f");
  });

  for (const [name, size] of icons) {
    it(`${name} is een dekkende ${size}x${size} PNG zonder witte buitenrand`, async () => {
      const bytes = readFileSync(publicFile(name));
      const metadata = await sharp(bytes).metadata();
      expect(metadata).toMatchObject({ format: "png", width: size, height: size, hasAlpha: false });
      const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (x !== 0 && x !== size - 1 && y !== 0 && y !== size - 1) continue;
        const index = (y * size + x) * info.channels;
        expect(data[index + 2] - data[index]).toBeGreaterThan(30);
      }
    });
  }

  it("registreert alleen de nieuwe 192/512 any en afzonderlijke maskable-versie", () => {
    expect(manifest().icons).toEqual([
      { src: appIconUrl("maatje-v1-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: appIconUrl("maatje-v1-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: appIconUrl("maatje-v1-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
    for (const icon of manifest().icons ?? []) expect(existsSync(publicFile(new URL(icon.src, "https://app.test").pathname.split("/").at(-1)!))).toBe(true);
  });

  it("gebruikt één apple-touch-configuratie en geen conflicterend oud SVG-logo", () => {
    expect(layout).toContain('apple: [{ url: appIconUrl("maatje-v1-apple-touch.png"), sizes: "180x180", type: "image/png" }]');
    expect((layout.match(/apple: /g) ?? []).length).toBe(1);
    expect(layout).not.toMatch(/\/icons\/(icon\.svg|icon-192\.png|apple-touch-icon\.png)/);
    for (const name of ["apple-icon.png", "icon.png", "icon.svg", "favicon.ico"]) {
      expect(existsSync(new URL(`./${name}`, import.meta.url))).toBe(false);
    }
  });

  it("ICO bevat drie geldige PNG-frames van 16, 32 en 48 pixels", async () => {
    const ico = readFileSync(publicFile("maatje-v1-favicon.ico"));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    for (const [index, size] of [16, 32, 48].entries()) {
      const entry = 6 + index * 16;
      expect(ico[entry]).toBe(size);
      expect(ico[entry + 1]).toBe(size);
      const start = ico.readUInt32LE(entry + 12);
      const bytes = ico.subarray(start, start + ico.readUInt32LE(entry + 8));
      expect(await sharp(bytes).metadata()).toMatchObject({ width: size, height: size, format: "png" });
    }
    expect(layout).toContain('appIconUrl("maatje-v1-favicon.ico")');
  });

  it("houdt de maskable-voorgrond binnen de veilige cirkel van 40 procent", async () => {
    const { data } = await sharp(readFileSync(publicFile("maatje-v1-maskable-512.png"))).raw().toBuffer({ resolveWithObject: true });
    let pixels = 0;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 3;
      const navy = data[i + 2] < 135 && data[i + 1] < 95;
      const white = data[i] > 170 && Math.abs(data[i] - data[i + 1]) < 25 && Math.abs(data[i + 1] - data[i + 2]) < 25;
      if (!navy && !white) continue;
      pixels++;
      expect(Math.hypot(x - 255.5, y - 255.5)).toBeLessThan(204.8);
    }
    expect(pixels).toBeGreaterThan(20_000);
  });

  it("precachet alle nieuwe iconen zonder globale cache- of gegevensreset", () => {
    for (const [name] of icons) expect(sw).toContain(appIconUrl(name));
    expect(sw).toContain('/icons/maatje-v1-favicon.ico');
    expect(sw).not.toContain('/icons/icon-192.png');
    expect(sw).toContain('key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME');
    expect(sw).not.toMatch(/indexedDB|localStorage|deleteDatabase/);
  });

  it("gebruikt in Preview publieke logo-URLs zonder een Preview-inlogcookie nodig te hebben", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    for (const [name] of icons) {
      expect(appIconUrl(name)).toBe(`https://boodschappenmaatje-pwa.vercel.app/icons/${name}?v=${APP_ICON_REVISION}`);
    }
    for (const icon of manifest().icons ?? []) {
      expect(new URL(icon.src).origin).toBe("https://boodschappenmaatje-pwa.vercel.app");
    }
    expect(manifest()).toMatchObject({ start_url: "/", scope: "/", display: "standalone" });
  });

  it("houdt Production en lokaal op eigen iconpaths met een nieuwe icooncacheversie", () => {
    for (const environment of ["production", "development", undefined]) {
      vi.stubEnv("VERCEL_ENV", environment);
      expect(appIconUrl("maatje-v1-apple-touch.png"))
        .toBe(`/icons/maatje-v1-apple-touch.png?v=${APP_ICON_REVISION}`);
    }
  });
});
