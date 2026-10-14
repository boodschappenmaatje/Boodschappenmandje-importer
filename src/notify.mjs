// Best-effort push notifications through ntfy (https://ntfy.sh). The topic
// name works as the password, so it lives in the NTFY_TOPIC secret and is
// never logged. A missing topic or a failed send never fails an import run.
const DEFAULT_NTFY_SERVER = "https://ntfy.sh";
const TOPIC_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const PRIORITIES = new Set(["min", "low", "default", "high", "urgent"]);

export function pushConfig(env = process.env) {
  const topic = String(env.NTFY_TOPIC ?? "").trim();
  const server = String(env.NTFY_SERVER ?? "").trim() || DEFAULT_NTFY_SERVER;
  let serverURL = null;
  try {
    const parsed = new URL(server);
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password) {
      serverURL = parsed.origin;
    }
  } catch {}
  return { enabled: TOPIC_PATTERN.test(topic) && serverURL !== null, topic, serverURL };
}

export async function sendPush({ title, message, priority = "default", tags = [] } = {}, {
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console,
  timeoutMs = 10_000,
} = {}) {
  const config = pushConfig(env);
  if (!config.enabled) {
    logger.info?.("Pushmelding overgeslagen: NTFY_TOPIC ontbreekt of is ongeldig.");
    return { sent: false, reason: "not_configured" };
  }
  const body = {
    topic: config.topic,
    title: String(title ?? "BoodschappenMaatje").slice(0, 120),
    message: String(message ?? "").slice(0, 2_000),
    priority: PRIORITIES.has(priority) ? priority : "default",
    tags: (Array.isArray(tags) ? tags : []).map(String).slice(0, 5),
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(config.serverURL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      logger.warn?.(`Pushmelding niet verstuurd (HTTP ${response.status}).`);
      return { sent: false, reason: `http_${response.status}` };
    }
    return { sent: true };
  } catch {
    logger.warn?.("Pushmelding niet verstuurd (netwerkfout of timeout).");
    return { sent: false, reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}

function count(value) {
  return new Intl.NumberFormat("nl-NL").format(Math.max(0, Math.trunc(Number(value) || 0)));
}

// Message for a finished daily maintenance run that wrote data.
export function dailyRunPush(result) {
  if (!result || result.dryRun) return null;
  const checked = count(result.processedCount);
  const changed = count(result.updatedCount);
  const added = count(result.newCount);
  const zyte = result.snapshot?.fallbackAccounting?.fallbackProviderRequests ?? 0;
  if (result.status === "success") {
    return {
      title: "Prijzen ververst",
      message: `${checked} producten gecontroleerd, ${changed} prijzen gewijzigd, ${added} nieuwe producten. Zyte-hulp: ${zyte}x.`,
      priority: "default",
      tags: ["white_check_mark"],
    };
  }
  return null;
}

// Evening alarm when no daily run succeeded today.
export function eveningAlarmPush(evaluation) {
  if (!evaluation || evaluation.ok) return null;
  const latest = evaluation.latest;
  const reason = latest?.error_summary ? String(latest.error_summary).slice(0, 400) : "Geen run gevonden vandaag.";
  const partialNote = evaluation.partialPricesToday > 0
    ? ` Wel ${count(evaluation.partialPricesToday)} prijzen bijgewerkt via gedeeltelijke runs.`
    : "";
  return {
    title: "Let op: geen complete prijsupdate vandaag",
    message: `${count(evaluation.attemptsToday)} pogingen vandaag, geen enkele compleet.${partialNote} Laatste oorzaak: ${reason}`,
    priority: "high",
    tags: ["warning"],
  };
}
