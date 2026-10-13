export const SHANGHAI_CONTENT_ROOT = "main:has(h1)";

export function shanghaiOilMeasurementCount(text) {
  if (typeof text !== "string") return 0;
  const start = text.search(/\bZo maak\b/i);
  if (start < 0) return 0;
  const preparation = text.slice(start).split(/Netto-inhoud/i)[0];
  return [...preparation.matchAll(/\b\d+(?:[.,]\d+)?\s*(?:el|eetl\.?|eetlepels?)\s+(?:(?:olijf|zonnebloem|arachide|rijst)?olie)\b/gi)].length;
}

export function safeShanghaiSourceFacts(text) {
  return { instruction_oil_measurement_count: shanghaiOilMeasurementCount(text) };
}

export function safeShanghaiParserReason(value) {
  if (typeof value !== "string") return null;
  const [code, detail = ""] = value.split(":", 2);
  if (!/^[a-z][a-z0-9_]{0,80}$/.test(code)) return null;
  const itemAliases = [
    ["rundergehakt", /\brundergehakt\b/i],
    ["champignons", /\bchampignons\b/i],
    ["taugé", /\btaug[eé]\b/i],
    ["bosui", /\bbosuien?\b/i],
    ["prei", /\bprei\b/i],
    ["olie", /\bolie\b/i],
    ["ui", /\bui\b/i],
  ];
  const item = itemAliases.find(([, pattern]) => pattern.test(detail))?.[0] ?? null;
  return { code, item };
}

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

function safeDocumentSnapshot(value) {
  if (!value || typeof value !== "object") return null;
  const count = (key) => Number.isInteger(value[key]) ? Math.max(0, Math.min(value[key], 99)) : 0;
  return {
    ready_state: ["loading", "interactive", "complete"].includes(value.ready_state) ? value.ready_state : "unknown",
    playwright_root_count: count("playwright_root_count"),
    heading_locator_count: count("heading_locator_count"),
    instructions_locator_count: count("instructions_locator_count"),
    main_count: count("main_count"),
    main_visible_count: count("main_visible_count"),
    main_zero_rect_count: count("main_zero_rect_count"),
    main_display_contents_count: count("main_display_contents_count"),
    main_with_h1_count: count("main_with_h1_count"),
    visible_main_with_h1_count: count("visible_main_with_h1_count"),
    content_root_query_count: count("content_root_query_count"),
    visible_content_root_count: count("visible_content_root_count"),
    h1_count: count("h1_count"),
    visible_h1_count: count("visible_h1_count"),
    matching_product_h1_count: count("matching_product_h1_count"),
    playwright_root_visible: value.playwright_root_visible === true,
    heading_locator_visible: value.heading_locator_visible === true,
    instructions_locator_visible: value.instructions_locator_visible === true,
    consent_control_visible_count: count("consent_control_visible_count"),
    consent_reject_only_count: count("consent_reject_only_count"),
    consent_accept_all_count: count("consent_accept_all_count"),
    reject_only_locator_count: count("reject_only_locator_count"),
    reject_only_locator_visible: value.reject_only_locator_visible === true,
    reject_only_locator_enabled: value.reject_only_locator_enabled === true,
    instructions_intersects_viewport: value.instructions_intersects_viewport === true,
    instructions_center_hit_target: value.instructions_center_hit_target === true,
    instructions_center_hit_by_consent: value.instructions_center_hit_by_consent === true,
    instructions_center_hit_kind: ["button", "a", "input", "svg", "path", "div", "span", "body", "main", "section", "dialog", "iframe", "other"].includes(value.instructions_center_hit_kind)
      ? value.instructions_center_hit_kind : "none",
    instructions_center_hit_has_click_surface: value.instructions_center_hit_has_click_surface === true,
    instructions_center_hit_inside_content_root: value.instructions_center_hit_inside_content_root === true,
    instructions_expanded_count: count("instructions_expanded_count"),
    instructions_aria_controls_count: count("instructions_aria_controls_count"),
    controlled_panel_present_count: count("controlled_panel_present_count"),
    visible_controlled_panel_count: count("visible_controlled_panel_count"),
    panel_within_content_root_count: count("panel_within_content_root_count"),
    title_matches_product: value.title_matches_product === true,
    body_contains_product_name: value.body_contains_product_name === true,
    has_package_marker: value.has_package_marker === true,
    has_people_marker: value.has_people_marker === true,
    has_shopping_list_marker: value.has_shopping_list_marker === true,
    instruction_oil_measurement_count: count("instruction_oil_measurement_count"),
    instructions_button_count: count("instructions_button_count"),
    visible_instructions_button_count: count("visible_instructions_button_count"),
    consent_control_count: count("consent_control_count"),
    challenge_signals: {
      cloudflare: value.challenge_signals?.cloudflare === true,
      human_check: value.challenge_signals?.human_check === true,
      access_denied: value.challenge_signals?.access_denied === true,
      captcha: value.challenge_signals?.captcha === true,
    },
  };
}
function safeDocumentDiagnostic(value) {
  if (!value || typeof value !== "object") return null;
  const substages = ["content_root", "product_heading", "instructions_button", "optional_consent", "instructions_click", "aria_controls", "instructions_panel", "instructions_content"];
  const count = (key) => Number.isInteger(value[key]) ? Math.max(0, Math.min(value[key], 99)) : 0;
  return {
    selector_substage: substages.includes(value.selector_substage) ? value.selector_substage : "unknown",
    playwright_root_count: count("playwright_root_count"),
    playwright_root_visible: value.playwright_root_visible === true,
    heading_locator_count: count("heading_locator_count"),
    heading_locator_visible: value.heading_locator_visible === true,
    instructions_locator_count: count("instructions_locator_count"),
    instructions_locator_visible: value.instructions_locator_visible === true,
    at_domcontentloaded: safeDocumentSnapshot(value.at_domcontentloaded),
    after_wait: safeDocumentSnapshot(value.after_wait),
  };
}

export async function dismissShanghaiRejectOptionalConsent(buttons) {
  const count = await buttons.count();
  if (count === 0) return false;
  if (count !== 1) throw new Error("source-consent-choice-ambiguous");
  if (!(await buttons.isVisible()) || !(await buttons.isEnabled())) return false;
  await buttons.click({ timeout: 5000 });
  return true;
}

export async function clickShanghaiInstructionsWithConsentFallback({ instructions, inspectDocument, rejectOptionalCookies }) {
  try {
    await instructions.click({ timeout: 5000 });
    return;
  } catch (clickError) {
    const state = await inspectDocument();
    if (state.instructions_center_hit_target !== false || state.consent_reject_only_count !== 1) throw clickError;
    const dismissed = await dismissShanghaiRejectOptionalConsent(rejectOptionalCookies);
    if (!dismissed) throw clickError;
    await instructions.click({ timeout: 10000 });
  }
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
  diagnose,
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
    let documentDiagnostic = null;
    if (stage === "selector" && typeof diagnose === "function") {
      try { documentDiagnostic = safeDocumentDiagnostic(await diagnose()); } catch { /* keep the original failure */ }
    }
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
        ...(documentDiagnostic ? { document_diagnostic: documentDiagnostic } : {}),
      },
    };
  }
}
