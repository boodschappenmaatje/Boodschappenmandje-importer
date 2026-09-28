/** Bounded discovery; only confirmed new product/price pairs consume the target. */
export async function collectGrowthCandidates(config, {
  findCandidates, validateCandidate, onBatch, existingSKUs = new Set(),
  initialPageCursor = 0, persistBatchSize = 10, now = Date.now,
}) {
  const started = now();
  const products = [], pending = [], seen = new Set(), existing = new Set();
  const stats = {
    searchedTerms: 0, pagesFetched: 0, candidatesExamined: 0, uniqueSKUsDiscovered: 0,
    existingCandidatesSkipped: 0, duplicateSKUsSkipped: 0, invalidProductsSkipped: 0,
    irrelevantCandidatesSkipped: 0, productErrors: 0, searchErrors: 0,
    processedProducts: 0, newProducts: 0, persistedNewProducts: 0,
    lastSearchedTerm: null, nextPageCursor: initialPageCursor, termCoverage: {},
    exhaustedTerms: [], stopReason: null, sourceExhausted: false,
  };
  const confirmed = () => onBatch ? stats.persistedNewProducts : stats.newProducts;
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending.splice(0);
    if (!onBatch) return;
    const feedback = await onBatch(batch);
    const count = feedback?.newProducts;
    if (!Number.isInteger(count) || count < 0 || count > batch.length) {
      throw Object.assign(new Error('Ongeldige bevestiging van nieuwe inserts'), { code: 'invalid_insert_confirmation' });
    }
    stats.persistedNewProducts += count;
  };
  const stop = () => confirmed() >= config.maxNewProducts ? 'growth_target_reached'
    : now() - started >= config.growthMaxRuntimeMs ? 'runtime_safety_limit' : null;
  try {
    outer: for (const [index, term] of config.searchTerms.entries()) {
      stats.lastSearchedTerm = term;
      let page = index === 0 ? initialPageCursor : 0;
      stats.nextPageCursor = page;
      stats.searchedTerms++;
      const coverage = stats.termCoverage[term] = { candidates: 0, pages: 0, new: 0, existingSkipped: 0, errors: 0, sourceExhausted: false };
      const signatures = new Set();
      while (true) {
        stats.stopReason = stop()
          ?? (stats.pagesFetched >= config.growthMaxTotalPages ? 'page_safety_limit' : null)
          ?? (stats.uniqueSKUsDiscovered >= config.growthMaxCandidates ? 'candidate_safety_limit' : null);
        if (stats.stopReason) break outer;
        stats.nextPageCursor = page; // Replay current window if interrupted; SKU checks make it idempotent.
        let result;
        try {
          result = await findCandidates(term, Math.min(config.growthMaxPagesPerTerm,
            config.growthMaxTotalPages - stats.pagesFetched), { startPage: page, seenPageSignatures: signatures, shouldStop: () => stop() !== null });
        } catch (error) { stats.searchErrors++; coverage.errors++; throw error; }
        stats.pagesFetched += result.pagesFetched;
        coverage.pages += result.pagesFetched;
        stats.candidatesExamined += result.rawCandidates ?? result.candidates.length;
        stats.duplicateSKUsSkipped += result.duplicateCandidates ?? 0;
        stats.irrelevantCandidatesSkipped += result.irrelevantCandidates ?? 0;
        stats.invalidProductsSkipped += result.invalidCandidates ?? 0;
        for (const candidate of result.candidates) {
          stats.stopReason = stop();
          if (stats.stopReason) break outer;
          if (seen.has(candidate.sku)) { stats.duplicateSKUsSkipped++; continue; }
          seen.add(candidate.sku);
          stats.uniqueSKUsDiscovered++;
          coverage.candidates++;
          if (existingSKUs.has(candidate.sku)) {
            existing.add(candidate.sku); stats.existingCandidatesSkipped++; coverage.existingSkipped++; continue;
          }
          stats.processedProducts++;
          let product;
          try { product = await validateCandidate({ ...candidate, searchTerm: term }); }
          catch (error) { stats.productErrors++; coverage.errors++; throw error; }
          if (!product) { stats.invalidProductsSkipped++; continue; }
          products.push(product); pending.push(product); stats.newProducts++; coverage.new++;
          // Never overshoot a remainder smaller than the usual batch size.
          if (pending.length >= Math.min(persistBatchSize, config.maxNewProducts - confirmed())) await flush();
        }
        await flush();
        if (result.repeatedPageStopped) {
          throw Object.assign(new Error(`Paginering herhaalt resultaten voor ${term}`), { code: 'pagination_stalled', retryable: false });
        }
        if (result.sourceExhausted) {
          coverage.sourceExhausted = true; stats.exhaustedTerms.push(term); stats.nextPageCursor = 0; break;
        }
        stats.stopReason = stop();
        if (stats.stopReason) break outer;
        if (!Number.isInteger(result.nextPage) || result.nextPage <= page || result.pagesFetched < 1) {
          throw Object.assign(new Error('Zoekcursor gaat niet vooruit'), { code: 'pagination_stalled', retryable: false });
        }
        page = result.nextPage;
        stats.nextPageCursor = page;
      }
    }
    await flush();
    stats.stopReason = stop() ?? stats.stopReason ?? 'discovery_exhausted';
    stats.sourceExhausted = stats.stopReason === 'discovery_exhausted'
      && stats.exhaustedTerms.length === config.searchTerms.length;
    return { products, stats };
  } catch (error) {
    stats.stopReason = error.code ?? 'technical_failure';
    error.collectionStats = stats;
    throw error;
  }
}
