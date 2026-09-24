export const CATALOG_PRICE_REFRESH_MS = 60_000;

/** Visible app polling plus resume/reconnect; no user action is required. */
export function subscribeCatalogRefresh(refresh: () => void, page: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener"> = document, target: Pick<Window, "addEventListener" | "removeEventListener"> = window): () => void {
  const run = () => { if (page.visibilityState === "visible") refresh(); };
  page.addEventListener("visibilitychange", run);
  target.addEventListener("focus", run);
  target.addEventListener("online", run);
  const timer = setInterval(run, CATALOG_PRICE_REFRESH_MS);
  return () => {
    clearInterval(timer);
    page.removeEventListener("visibilitychange", run);
    target.removeEventListener("focus", run);
    target.removeEventListener("online", run);
  };
}
