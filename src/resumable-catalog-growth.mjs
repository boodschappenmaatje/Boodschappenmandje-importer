// One daily claim owns all segments. Every segment persists its discovery cursor;
// a page/candidate budget bounds one segment, never proves source exhaustion.
export const MAX_DISCOVERY_SEGMENTS = 8;
const RESUMABLE = new Set(["page_safety_limit", "candidate_safety_limit"]);
const SUM_FIELDS = ["newCount", "actualGrowth", "updatedCount", "unchangedCount", "processedCount",
  "skippedCount", "errorCount", "candidatesViewed", "existingCount", "duplicateCount",
  "invalidCount", "irrelevantCount", "searchedTerms", "searchErrors", "durationSeconds"];

export async function runResumableCatalogGrowth(config, logger, runGrowth, { now = Date.now } = {}) {
  if (!Number.isSafeInteger(config.maxNewProducts) || config.maxNewProducts < 1 || config.maxNewProducts > 400 ||
      !Number.isFinite(config.growthMaxRuntimeMs) || config.growthMaxRuntimeMs <= 0) {
    throw Object.assign(new Error("Ongeldig begrensd discoverybudget"), { code: "invalid_discovery_budget" });
  }
  const started = now();
  const deadline = started + config.growthMaxRuntimeMs;
  const checkpoints = new Set();
  const discoverySeenSKUs = new Set();
  let aggregate = null;
  for (let segment = 1; segment <= MAX_DISCOVERY_SEGMENTS; segment++) {
    const remaining = config.maxNewProducts - (aggregate?.actualGrowth ?? 0);
    const remainingMs = deadline - now();
    if (remaining <= 0 || (aggregate && remainingMs <= 0)) break;
    let result;
    try {
      result = await runGrowth({ ...config, discoverySeenSKUs, maxNewProducts: remaining,
        growthMaxRuntimeMs: Math.max(1, remainingMs) }, logger);
    } catch (error) {
      // Earlier confirmed segments still consume the same daily budget.
      error.actualGrowth = (aggregate?.actualGrowth ?? 0) + (error.actualGrowth ?? 0);
      if (aggregate) error.catalogAttemptMetrics = {
        ...error.catalogAttemptMetrics,
        candidatesViewed: aggregate.candidatesViewed + (error.catalogAttemptMetrics?.candidatesViewed ?? 0),
        priorSegments: aggregate.segments,
      };
      throw error;
    }
    if (!Number.isSafeInteger(result.actualGrowth) || result.actualGrowth < 0 || result.actualGrowth > remaining) {
      throw Object.assign(new Error("Ongeldige segmentgroeitelling"), { code: "invalid_growth_confirmation",
        actualGrowth: aggregate?.actualGrowth ?? 0 });
    }
    const previous = aggregate;
    aggregate = { ...result, totalUniqueProductsBefore: previous?.totalUniqueProductsBefore ?? result.totalUniqueProductsBefore,
      segments: [...(previous?.segments ?? []), { number: segment, actualGrowth: result.actualGrowth,
        stopReason: result.stopReason, checkpoint: result.resumeCheckpoint, accounting: result.accounting }] };
    for (const key of SUM_FIELDS) aggregate[key] = (previous?.[key] ?? 0) + (result[key] ?? 0);
    if (result.accounting) {
      const categories = { ...(previous?.accounting?.categories ?? {}) };
      for (const [key, value] of Object.entries(result.accounting.categories)) categories[key] = (categories[key] ?? 0) + value;
      const rawPageHits = (previous?.accounting?.rawPageHits ?? 0) + result.accounting.rawPageHits;
      const accounted = Object.values(categories).reduce((sum, value) => sum + value, 0);
      aggregate.accounting = { rawPageHits, categories, accounted, balanced: rawPageHits === accounted,
        // Unique discovery is scoped to each segment; confirmed daily inserts
        // remain globally unique through the SKU constraint and insertion ID.
        uniqueRelevantSKUs: aggregate.segments.length === 1 ? result.accounting.uniqueRelevantSKUs : null };
    }
    aggregate.targetNewProducts = config.maxNewProducts;
    aggregate.targetReached = aggregate.actualGrowth >= config.maxNewProducts;
    if (aggregate.targetReached) {
      aggregate.stopReason = "growth_target_reached"; aggregate.status = "success";
      aggregate.growthStatus = aggregate.errorCount || aggregate.searchErrors
        ? "partial_but_growth_target_reached" : "growth_target_reached";
      aggregate.errorSummary = aggregate.errorCount || aggregate.searchErrors ? aggregate.errorSummary : null;
      break;
    }
    if (!RESUMABLE.has(result.stopReason) || result.sourceExhausted) break;
    const checkpoint = result.resumeCheckpoint;
    if (!checkpoint || typeof checkpoint.term !== "string" || !Number.isSafeInteger(checkpoint.page) || checkpoint.page < 0) {
      aggregate.stopReason = "discovery_resume_stalled"; break;
    }
    const key = JSON.stringify(checkpoint);
    if (checkpoints.has(key)) { aggregate.stopReason = "discovery_resume_stalled"; break; }
    checkpoints.add(key);
    aggregate.sourceExhausted = false;
    aggregate.stopReason = now() >= deadline ? "runtime_safety_limit" : "attempt_safety_limit";
    if (now() >= deadline) break;
    logger.info(`Discovery veilig hervatten: segment=${segment}, bevestigd=${aggregate.actualGrowth}, resterend=${config.maxNewProducts - aggregate.actualGrowth}.`);
  }
  return aggregate;
}
