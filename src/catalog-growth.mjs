import { collectProducts, SourceBlockedError } from "./hoogvliet.mjs";
import {
  fetchCatalogDiscoveryState,
  fetchExistingPriceStates,
  fetchExistingProducts,
  fetchExistingSKUs,
  finishCatalogImportRun,
  saveCatalogDiscoveryState,
  startCatalogImportRun,
  upsertProducts,
} from "./supabase.mjs";

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cents(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0
    ? Math.round(Number(value) * 100)
    : null;
}

export const CATALOG_SOURCE_UNAVAILABLE_MESSAGE =
  "Catalogusupdate kon niet worden uitgevoerd. De bestaande catalogus blijft beschikbaar.";

export function catalogImportFailure(error, actualGrowth = 0) {
  const sourceStatus = error instanceof SourceBlockedError
    ? (error.code ?? "source_unavailable")
    : null;
  return {
    sourceStatus,
    publicSummary: sourceStatus
      ? CATALOG_SOURCE_UNAVAILABLE_MESSAGE
      : `partial_growth_target_not_reached; werkelijke_groei=${actualGrowth}; `
        + (error instanceof Error ? error.message : "Onbekende importfout"),
  };
}

const DISCOVERY_TOKEN_STOPWORDS = new Set([
  "hoogvliet", "gwoon", "biologisch", "original", "naturel", "classic", "fresh",
  "voor", "met", "zonder", "extra", "mini", "maxi", "klein", "groot",
]);

function discoveryKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildDynamicDiscoveryTerms(existingProducts, configuredTerms, limit = 450) {
  const seen = new Set((configuredTerms ?? []).map(discoveryKey).filter(Boolean));
  const result = [];
  const add = (value) => {
    const term = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
    const key = discoveryKey(term);
    if (!key || seen.has(key) || result.length >= limit) return;
    seen.add(key);
    result.push(term);
  };

  for (const product of existingProducts ?? []) add(product.brand);
  for (const product of existingProducts ?? []) add(product.category);
  for (const product of existingProducts ?? []) add(product.productType);

  // Eenlettertermen zijn een veilige laatste vangrail: de centrale
  // relevantiegate accepteert alleen producten met een woord dat met die
  // letter begint. Zo ontstaat brede discovery zonder willekeurige resultaten.
  for (const letter of "abcdefghijklmnopqrstuvwxyz") add(letter);

  const tokenFrequency = new Map();
  for (const product of existingProducts ?? []) {
    const tokens = discoveryKey(product.name).split(" ");
    for (const token of tokens) {
      if (token.length < 4 || DISCOVERY_TOKEN_STOPWORDS.has(token) || /^\d+$/.test(token)) continue;
      tokenFrequency.set(token, (tokenFrequency.get(token) ?? 0) + 1);
    }
  }
  for (const [token] of [...tokenFrequency].sort((left, right) => (
    right[1] - left[1] || left[0].localeCompare(right[0], "nl")
  ))) add(token);
  return result;
}

export function rotateDiscoveryTerms(terms, cursor = 0) {
  if (!Array.isArray(terms) || terms.length === 0) return [];
  const offset = Math.max(0, Math.trunc(cursor)) % terms.length;
  return [...terms.slice(offset), ...terms.slice(0, offset)];
}

export function nextDiscoveryCursor(cursor, searchedTerms, termCount) {
  if (!Number.isInteger(termCount) || termCount < 1) return 0;
  return (Math.max(0, Math.trunc(cursor)) + Math.max(1, Math.trunc(searchedTerms))) % termCount;
}

export function prioritizeDiscoveryTerms(terms, discoveryState, now = new Date()) {
  const termStats = discoveryState?.termStats ?? {};
  const saturatedUntil = discoveryState?.saturatedUntil ?? {};
  const nowMs = now.getTime();
  const prioritized = terms
    .map((term, index) => ({
      term,
      index,
      yield: Number(termStats[term]?.discoveryYield) || 0,
      saturated: Date.parse(saturatedUntil[term] ?? "") > nowMs,
    }))
    .sort((left, right) => (
      Number(left.saturated) - Number(right.saturated)
      || right.yield - left.yield
      || left.index - right.index
    ))
    .map(({ term }) => term);
  const resumePreviousTerm = (discoveryState?.pageCursor ?? 0) > 0
    || (discoveryState?.lastStopReason
      && discoveryState.lastStopReason !== "discovery_exhausted");
  if (resumePreviousTerm && terms.includes(discoveryState?.lastTerm)) {
    return [discoveryState.lastTerm, ...prioritized.filter((term) => term !== discoveryState.lastTerm)];
  }
  return prioritized;
}

export function mergeDiscoveryMetrics(discoveryState, termCoverage, now = new Date()) {
  const termStats = { ...(discoveryState?.termStats ?? {}) };
  const saturatedUntil = { ...(discoveryState?.saturatedUntil ?? {}) };
  for (const [term, coverage] of Object.entries(termCoverage ?? {})) {
    termStats[term] = {
      candidates: coverage.candidates ?? 0,
      newProducts: coverage.new ?? 0,
      existingProducts: coverage.existingSkipped ?? coverage.existing ?? 0,
      errors: coverage.errors ?? 0,
      discoveryYield: Number((coverage.discoveryYield ?? 0).toFixed(4)),
      updatedAt: now.toISOString(),
    };
    if (coverage.saturated) {
      saturatedUntil[term] = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      delete saturatedUntil[term];
    }
  }
  return { termStats, saturatedUntil };
}

export function catalogGrowthMode(totalUniqueProducts) {
  const total = Math.max(0, Number(totalUniqueProducts) || 0);
  if (total >= 10_000) return "maintenance";
  if (total >= 9_500) return "balanced";
  return "discovery";
}

export function productChanged(existing, previousPrice, current) {
  if (!existing) return true;
  const pairs = [
    [text(existing.name), text(current.name)],
    [text(existing.brand), text(current.brand)],
    [text(existing.category), text(current.category)],
    [text(existing.packageText), text(current.packageText)],
    [Number(existing.weightGrams) || null, Number(current.weightGrams) || null],
    [text(existing.imageURL), text(current.imageURL)],
    [text(existing.sourceURL), text(current.sourceURL)],
    [existing.available ?? null, current.isAvailable ?? null],
    [text(existing.productType), text(current.productType)],
    [cents(previousPrice?.price), cents(current.price)],
    [cents(previousPrice?.oldPrice), cents(current.oldPrice)],
    [previousPrice?.isOffer === true, current.isOffer === true],
    [text(previousPrice?.offerText), text(current.offerText)],
    [text(previousPrice?.validFrom), text(current.validFrom)],
    [text(previousPrice?.validUntil), text(current.validUntil)],
  ];
  return pairs.some(([before, after]) => before !== after);
}

export function classifyCatalogOutcomes({
  products,
  importedSKUs,
  existingBySKU,
  existingPrices,
  stats,
  writeErrors = 0,
}) {
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  for (const product of products) {
    if (!importedSKUs.has(product.sku)) continue;
    const existing = existingBySKU.get(product.sku);
    if (!existing) {
      newCount += 1;
      continue;
    }
    const previousPrice = existingPrices.get(existing.id) ?? null;
    if (productChanged(existing, previousPrice, product)) updatedCount += 1;
    else unchangedCount += 1;
  }
  const skippedCount = Math.max(0, stats.invalidProductsSkipped ?? 0);
  const errorCount = Math.max(0, stats.productErrors ?? 0) + Math.max(0, writeErrors);
  const processedCount = newCount + updatedCount + unchangedCount + skippedCount + errorCount;
  return { processedCount, newCount, updatedCount, unchangedCount, skippedCount, errorCount };
}

export function importRunStatus({
  errorCount,
  searchErrors = 0,
  actualGrowth = null,
  targetNewProducts = null,
} = {}) {
  if (Number.isFinite(actualGrowth) && Number.isFinite(targetNewProducts)) {
    return actualGrowth >= targetNewProducts ? "success" : "partial";
  }
  return errorCount > 0 || searchErrors > 0 ? "partial" : "success";
}

export function formatCatalogGrowthSummary(result) {
  return [
    "Catalogusgroei",
    `status=${result.status}`,
    `groeistatus=${result.growthStatus}`,
    `target_nieuw=${result.targetNewProducts}`,
    `verwerkt=${result.processedCount}`,
    `nieuw=${result.newCount}`,
    `bijgewerkt=${result.updatedCount}`,
    `ongewijzigd=${result.unchangedCount}`,
    `overgeslagen=${result.skippedCount}`,
    `fouten=${result.errorCount}`,
    `kandidaten_bekeken=${result.candidatesViewed}`,
    `zoektermen=${result.searchedTerms}`,
    `zoektermfouten=${result.searchErrors}`,
    `totaal_voor=${result.totalUniqueProductsBefore}`,
    `totaal_na=${result.totalUniqueProductsAfter}`,
    `werkelijke_groei=${result.actualGrowth}`,
    `stopreden=${result.stopReason}`,
    `duur=${result.durationSeconds.toFixed(1)}s`,
  ].join(" | ");
}

export async function runCatalogGrowth(config, logger = console) {
  const startedAt = Date.now();
  const existingProducts = await fetchExistingProducts(config);
  const existingPrices = await fetchExistingPriceStates(config);
  const existingBySKU = new Map(existingProducts.map((product) => [product.sku, product]));
  const existingSKUs = new Set(existingBySKU.keys());
  const totalUniqueProductsBefore = existingSKUs.size;
  const run = await startCatalogImportRun(config, {
    trigger: config.importTrigger,
    totalUniqueProductsBefore,
  });
  let stats = {};
  let writeErrors = [];

  try {
    const discoveryState = await fetchCatalogDiscoveryState(config, config.discoveryStateKey);
    const dynamicTerms = buildDynamicDiscoveryTerms(existingProducts, config.searchTerms);
    const originalTerms = [...config.searchTerms, ...dynamicTerms];
    const rotatedTerms = rotateDiscoveryTerms(originalTerms, discoveryState.termCursor);
    const prioritizedTerms = prioritizeDiscoveryTerms(rotatedTerms, discoveryState);
    const growthConfig = {
      ...config,
      searchTerms: prioritizedTerms,
      catalogNewOnly: true,
    };
    logger.info(
      `Catalogusgroei gestart: modus=${catalogGrowthMode(totalUniqueProductsBefore)}, `
        + `cursor=${discoveryState.termCursor}, doel=${growthConfig.maxNewProducts} werkelijk nieuwe producten, `
        + `veiligheidsgrens=${growthConfig.growthMaxCandidates} kandidaten, `
        + `dynamische_termen=${dynamicTerms.length}.`,
    );

    const imported = [];
    const persistBatch = async (batch) => {
      const result = await upsertProducts(growthConfig, batch);
      imported.push(...result.imported);
      writeErrors.push(...result.errors);
      logger.info(`Catalogusgroei tussentijds opgeslagen: ${imported.length}.`);
      return {
        newProducts: result.imported.filter((product) => !existingSKUs.has(product.sku)).length,
      };
    };
    const collected = await collectProducts(growthConfig, logger, {
      existingSKUs,
      onBatch: persistBatch,
      persistBatchSize: 10,
      initialPageCursor: discoveryState.pageCursor,
    });
    stats = collected.stats;
    const importedSKUs = new Set(imported.map((product) => product.sku));
    const counts = classifyCatalogOutcomes({
      products: collected.products,
      importedSKUs,
      existingBySKU,
      existingPrices,
      stats,
      writeErrors: writeErrors.length,
    });
    const totalUniqueProductsAfter = (await fetchExistingSKUs(config)).size;
    const actualGrowth = Math.max(0, totalUniqueProductsAfter - totalUniqueProductsBefore);
    const searchErrors = stats.searchErrors ?? 0;
    const targetReached = actualGrowth >= config.maxNewProducts;
    const growthStatus = targetReached
      ? (searchErrors > 0 || counts.errorCount > 0
        ? "partial_but_growth_target_reached"
        : "growth_target_reached")
      : "partial_growth_target_not_reached";
    const result = {
      ...counts,
      processedCount: stats.processedProducts ?? counts.processedCount,
      newCount: actualGrowth,
      status: importRunStatus({
        errorCount: counts.errorCount,
        searchErrors,
        actualGrowth,
        targetNewProducts: config.maxNewProducts,
      }),
      growthStatus,
      targetNewProducts: config.maxNewProducts,
      targetReached,
      totalUniqueProductsBefore,
      totalUniqueProductsAfter,
      actualGrowth,
      candidatesViewed: stats.uniqueSKUsDiscovered ?? 0,
      searchedTerms: stats.searchedTerms ?? 0,
      searchErrors,
      stopReason: stats.stopReason ?? "discovery_exhausted",
      durationSeconds: (Date.now() - startedAt) / 1000,
      errorSummary: [
        growthStatus,
        searchErrors ? `${searchErrors} zoektermfout(en)` : null,
        writeErrors.length ? `${writeErrors.length} schrijffout(en)` : null,
        !targetReached ? `stopreden=${stats.stopReason ?? "discovery_exhausted"}` : null,
      ].filter(Boolean).join("; ") || null,
    };
    await finishCatalogImportRun(config, run, result);

    if (config.advanceDiscoveryState) {
      const metrics = mergeDiscoveryMetrics(discoveryState, stats.termCoverage);
      const lastOriginalIndex = originalTerms.indexOf(stats.lastSearchedTerm);
      const resumeCurrentTerm = result.stopReason !== "discovery_exhausted"
        && lastOriginalIndex >= 0;
      await saveCatalogDiscoveryState(config, {
        ...discoveryState,
        termCursor: lastOriginalIndex < 0
          ? nextDiscoveryCursor(discoveryState.termCursor, stats.searchedTerms ?? 0, originalTerms.length)
          : (lastOriginalIndex + (resumeCurrentTerm ? 0 : 1)) % originalTerms.length,
        pageCursor: stats.nextPageCursor ?? 0,
        lastBatch: config.catalogBatch,
        lastTerm: stats.lastSearchedTerm,
        lastStopReason: result.stopReason,
        ...metrics,
        updatedAt: new Date().toISOString(),
      });
    }
    logger.info(formatCatalogGrowthSummary(result));
    return result;
  } catch (error) {
    const totalUniqueProductsAfter = await fetchExistingSKUs(config)
      .then((skus) => skus.size)
      .catch(() => totalUniqueProductsBefore);
    const actualGrowth = Math.max(0, totalUniqueProductsAfter - totalUniqueProductsBefore);
    const failure = catalogImportFailure(error, actualGrowth);
    logger.error(
      `Catalogusbronstatus | status=${failure.sourceStatus ?? "import_error"}`
        + ` | werkelijke_groei=${actualGrowth}`
        + ` | detail=${error instanceof Error ? error.message : "Onbekende importfout"}`,
    );
    await finishCatalogImportRun(config, run, {
      status: actualGrowth > 0 ? "partial" : "failed",
      processedCount: stats.processedProducts ?? 0,
      newCount: actualGrowth,
      updatedCount: 0,
      unchangedCount: 0,
      skippedCount: stats.invalidProductsSkipped ?? 0,
      errorCount: Math.max(1, (stats.productErrors ?? 0) + writeErrors.length),
      totalUniqueProductsAfter,
      errorSummary: failure.publicSummary,
    }).catch((finishError) => {
      logger.error(`Runstatus kon niet worden afgesloten: ${finishError instanceof Error ? finishError.message : "onbekend"}`);
    });
    if (error && typeof error === "object") {
      Object.assign(error, {
        actualGrowth,
        catalogAttemptMetrics: {
          candidatesViewed: stats.uniqueSKUsDiscovered ?? 0,
          updatedCount: 0,
          unchangedCount: 0,
          skippedCount: stats.invalidProductsSkipped ?? 0,
          invalidCount: stats.invalidProductsSkipped ?? 0,
          sourceErrors: stats.searchErrors ?? 1,
        },
      });
    }
    throw error;
  }
}
