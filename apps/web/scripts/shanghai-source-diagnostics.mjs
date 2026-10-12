export const SHANGHAI_CONTENT_ROOT = "main:has(h1)";

const SHANGHAI_PRODUCT_NAME = "Knorr Wereldgerecht maaltijdpakket chinese beef shanghai";
const SHANGHAI_SOURCE_MARKERS = ["239 gram", "Voor 2-3 personen", "Boodschappenlijstje:"];

const PUBLIC_HOOGVLIET_HOSTS = new Set([
  "hoogvliet.com",
  "www.hoogvliet.com",
  "hoogvliet.nl",
  "www.hoogvliet.nl",
]);

function safePublicUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !PUBLIC_HOOGVLIET_HOSTS.has(url.hostname)) return null;
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function safeErrorType(error) {
  const name = typeof error?.name === "string" ? error.name : "";
  return /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(name) ? name : "Error";
}

function isTimeout(error) {
  return /timeout/i.test(typeof error?.name === "string" ? error.name : "");
}

export function validateShanghaiContentRoot(source) {
  if (source?.title !== SHANGHAI_PRODUCT_NAME || typeof source?.text !== "string" ||
      SHANGHAI_SOURCE_MARKERS.some((marker) => !source.text.includes(marker))) {
    throw new Error("source-content-incomplete");
  }
  return source;
}

export async function inspectShanghaiSource({
  navigate,
  finalUrl,
  waitForSelector,
  readSource,
  parseSource,
  selector = SHANGHAI_CONTENT_ROOT,
}) {
  let stage = "navigation";
  let status = null;
  let safeUrl = null;
  let rootFound = false;
  const currentUrl = async () => {
    try {
      safeUrl = safePublicUrl(await finalUrl()) ?? safeUrl;
    } catch {
      // Diagnostics must never replace the original source failure.
    }
  };
  try {
    const response = await navigate();
    status = Number.isInteger(response?.status) && response.status >= 100 && response.status <= 599
      ? response.status
      : null;
    await currentUrl();
    stage = "selector";
    await waitForSelector(selector);
    rootFound = true;
    stage = "validation";
    const source = await readSource();
    stage = "parser";
    const parsed = await parseSource(source);
    return {
      source,
      parsed,
      diagnostic: {
        navigation_status: status,
        final_url: safeUrl,
        content_root: selector,
        content_root_found: true,
        error_stage: null,
        error_type: null,
        selector_status: "matched",
        parser_status: "parsed",
        timeout: false,
      },
    };
  } catch (error) {
    await currentUrl();
    return {
      error: "source_unavailable",
      diagnostic: {
        navigation_status: status,
        final_url: safeUrl,
        content_root: selector,
        content_root_found: rootFound,
        error_stage: stage,
        error_type: safeErrorType(error),
        selector_status: rootFound ? "matched" : stage === "selector" ? "failed" : "not_reached",
        parser_status: stage === "parser" ? "failed" : "not_reached",
        timeout: isTimeout(error),
      },
    };
  }
}
