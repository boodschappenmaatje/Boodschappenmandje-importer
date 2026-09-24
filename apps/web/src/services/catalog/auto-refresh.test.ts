import { afterEach, expect, it, vi } from "vitest";
import { CATALOG_PRICE_REFRESH_MS, subscribeCatalogRefresh } from "./auto-refresh";
afterEach(() => vi.useRealTimers());
it("refreshes without clicks every minute, on resume/reconnect, and cleans up", () => {
  vi.useFakeTimers();
  const page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const target = new EventTarget();
  const refresh = vi.fn();
  const stop = subscribeCatalogRefresh(refresh, page as unknown as Document, target as unknown as Window);
  vi.advanceTimersByTime(CATALOG_PRICE_REFRESH_MS); expect(refresh).toHaveBeenCalledTimes(1);
  page.visibilityState = "hidden";
  vi.advanceTimersByTime(CATALOG_PRICE_REFRESH_MS); expect(refresh).toHaveBeenCalledTimes(1);
  page.visibilityState = "visible"; page.dispatchEvent(new Event("visibilitychange"));
  target.dispatchEvent(new Event("online")); target.dispatchEvent(new Event("focus"));
  expect(refresh).toHaveBeenCalledTimes(4);
  stop(); vi.advanceTimersByTime(CATALOG_PRICE_REFRESH_MS); target.dispatchEvent(new Event("focus"));
  expect(refresh).toHaveBeenCalledTimes(4);
});
