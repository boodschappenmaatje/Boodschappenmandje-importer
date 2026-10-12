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

export async function inspectShanghaiSource({
  navigate,
  finalUrl,
  waitForSelector,
  readSource,
  parseSource,
  selector = '[data-testing-id="product-detail-page"]',
}) {
  let stage = "navigation";
  let status = null;
  let safeUrl = null;
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
    const source = await readSource();
    stage = "parser";
    const parsed = await parseSource(source);
    return {
      source,
      parsed,
      diagnostic: {
        navigation_status: status,
        final_url: safeUrl,
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
        error_stage: stage,
        error_type: safeErrorType(error),
        selector_status: stage === "selector" ? "failed" : stage === "parser" ? "matched" : "not_reached",
        parser_status: stage === "parser" ? "failed" : "not_reached",
        timeout: isTimeout(error),
      },
    };
  }
}
