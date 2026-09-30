import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appConfig } from "@/config/app";
import manifest from "@/app/manifest";

const tokens = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const values = new Map([...tokens.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
function value(name: string): string {
  const raw = values.get(name);
  if (!raw) throw new Error(`Missing token: ${name}`);
  const alias = raw.match(/^var\((--[\w-]+)\)$/);
  return alias ? value(alias[1]) : raw;
}
function luminance(hex: string) {
  const rgb = hex.replace("#", "").match(/../g)!.map((part) => {
    const c = parseInt(part, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const light = luminance(value(a));
  const dark = luminance(value(b));
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
}

describe("official icon blue visual contract", () => {
  it("uses all five approved brand colours centrally", () => {
    expect(value("--color-primary")).toBe("#1D87F7");
    expect(value("--color-primary-dark")).toBe("#034ECD");
    expect(value("--color-border")).toBe("#C9E2FD");
    expect(value("--color-background")).toBe("#EFF7FE");
    expect(value("--color-success")).toBe("#22C55E");
  });

  it("shares Home colours across the app and preserves semantic statuses", () => {
    for (const [home, shared] of [["blue", "brand-blue"], ["sky", "brand-sky"],
      ["glow", "brand-glow"], ["deep", "brand-deep"], ["blue-ink", "brand-ink"]]) {
      expect(values.get(`--home-c-${home}`)).toBe(`var(--${shared})`);
    }
    expect(`${tokens}\n${css}`).not.toMatch(/#(?:4f86c6|3e77b7|2e5e9e|b8d0ec|4a7399|385d7c|afc3d4)\b/i);
    expect(value("--color-danger")).toBe("#A03543");
    expect(value("--color-success")).toBe("#22C55E");
  });

  it("keeps browser chrome and install manifest aligned without changing install identity", () => {
    expect(appConfig.themeColor).toBe(value("--color-primary"));
    expect(appConfig.backgroundColor).toBe(value("--color-background"));
    expect(manifest()).toMatchObject({ theme_color: appConfig.themeColor, background_color: appConfig.backgroundColor,
      start_url: "/", scope: "/", display: "standalone" });
  });

  it("does not scatter literal colours through component styling", () => {
    expect(css).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|hsla?\(|:\s*(?:white|black)\b/i);
    expect(css).not.toMatch(/var\([^)]+\)[-\w]*\s*:/);
    expect(css).toContain("white-space: normal");
  });

  it("resolves every semantic colour, shadow and radius reference", () => {
    for (const match of `${css}\n${tokens}`.matchAll(/var\((--(?:brand|color|shadow|radius|surface|home-c)-[\w-]+)/g)) {
      expect(values.has(match[1]), match[1]).toBe(true);
    }
  });

  it("keeps primary button text and normal/muted/status text above 4.5:1 contrast", () => {
    for (const [fg, bg] of [
      ["on-primary", "primary-action"], ["on-primary", "primary-dark"],
      ["text", "surface"], ["text", "background"],
      ["muted", "surface"], ["muted", "background"], ["muted", "primary-soft"],
      ["primary-strong", "primary-soft"], ["success-text", "success-soft"],
      ["warning-text", "warning-soft"], ["danger", "danger-soft"],
    ]) expect(contrast(`--color-${fg}`, `--color-${bg}`), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it("does not use the bright green accent for small text", () => {
    expect(css).not.toMatch(/(?<![-\w])color:\s*var\(--color-success\)/);
    expect(css).toContain("color: var(--color-success-text)");
  });

  it("keeps keyboard focus, iOS-safe inputs and reduced-motion states", () => {
    expect(css).toContain("outline: 3px solid var(--color-focus)");
    expect(css).toContain("font-size: 16px");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).not.toContain("radial-gradient");
  });

  it("uses the same budget-chart tokens for segments and legend", () => {
    for (const part of ["meal", "list", "free"]) {
      expect(css).toContain(`i[data-color="${part}"] { background: var(--color-chart-${part}); }`);
      expect((css.match(new RegExp(`var\\(--color-chart-${part}\\)`, "g")) ?? []).length).toBe(2);
    }
  });
});
