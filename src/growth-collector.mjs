/** One raw hit = one parsed product tile, including repeats and filtered tiles. */
export function candidateAccounting(stats) {
  const categories = { ...stats.dispositions };
  const accounted = Object.values(categories).reduce((sum, count) => sum + count, 0);
  return { rawPageHits: stats.candidatesExamined, categories, accounted,
    balanced: accounted === stats.candidatesExamined, uniqueRelevantSKUs: stats.uniqueSKUsDiscovered };
}

/** Bounded discovery; only confirmed new product/price pairs consume the target. */
export async function collectGrowthCandidates(config, {
  findCandidates, validateCandidate, onBatch, existingSKUs = new Set(),
  initialPageCursor = 0, persistBatchSize = 10, now = Date.now, onTermStall = () => {},
}) {
  const started = now();
  const products = [], pending = [], seen = new Set();
  const stats = {
    searchedTerms: 0, pagesFetched: 0, candidatesExamined: 0, uniqueSKUsDiscovered: 0,
    existingCandidatesSkipped: 0, duplicateSKUsSkipped: 0, invalidProductsSkipped: 0,
    irrelevantCandidatesSkipped: 0, productErrors: 0, searchErrors: 0,
    processedProducts: 0, newProducts: 0, persistedNewProducts: 0,
    lastSearchedTerm: null, nextPageCursor: initialPageCursor, termCoverage: {},
    exhaustedTerms: [], stalledTerms: [], stopReason: null, sourceExhausted: false,
    dispositions: { new: 0, existing: 0, concurrentExisting: 0, duplicate: 0,
      repeatedPage: 0, invalidIdentity: 0, irrelevant: 0, invalidPrice: 0, invalidDetail: 0,
      validatedOnly: 0, writeUnconfirmed: 0, notProcessed: 0, technicalUnprocessed: 0 },
  };
  const d = stats.dispositions;
  const confirmed = () => onBatch ? stats.persistedNewProducts : stats.newProducts;
  const recordWrites = (count, existing) => {
    stats.persistedNewProducts += count; d.new += count; d.concurrentExisting += existing;
    d.writeUnconfirmed -= count + existing;
  };
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending.splice(0);
    if (!onBatch) { d.writeUnconfirmed -= batch.length; d.validatedOnly += batch.length; return; }
    let feedback;
    try { feedback = await onBatch(batch); }
    catch (error) {
      const rows = error.confirmedImports ?? [];
      recordWrites(rows.filter(row => row.inserted === true).length, rows.filter(row => row.inserted === false).length);
      throw error;
    }
    const count = feedback?.newProducts, existing = feedback?.existingProducts ?? batch.length - count;
    if (!Number.isInteger(count) || count < 0 || !Number.isInteger(existing) || existing < 0
      || count + existing !== batch.length) {
      throw Object.assign(new Error('Ongeldige bevestiging van nieuwe inserts'), { code: 'invalid_insert_confirmation' });
    }
    recordWrites(count, existing);
  };
  const stop = () => confirmed() >= config.maxNewProducts ? 'growth_target_reached'
    : now() - started >= config.growthMaxRuntimeMs ? 'runtime_safety_limit' : null;
  const absorb = (result, coverage) => {
    stats.pagesFetched += result.pagesFetched;
    coverage.pages += result.pagesFetched;
    stats.candidatesExamined += result.rawCandidates ?? result.candidates.length;
    stats.duplicateSKUsSkipped += result.duplicateCandidates ?? 0;
    stats.irrelevantCandidatesSkipped += result.irrelevantCandidates ?? 0;
    stats.invalidProductsSkipped += result.invalidCandidates ?? 0;
    d.duplicate += result.duplicateCandidates ?? 0;
    d.irrelevant += result.irrelevantCandidates ?? 0;
    d.invalidIdentity += result.invalidCandidates ?? 0;
    d.repeatedPage += result.repeatedPageCandidates ?? 0;
    d.notProcessed += result.candidates.length;
  };
  const stall = (term, page, reason, coverage) => {
    const entry = { term, page, reason };
    // A repeated SKU set proves that this resolved route no longer advances:
    // fetching more pages would only replay already-accounted products. Treat
    // that route as locally exhausted, while keeping the diagnostic log. Other
    // ambiguous stalls remain fail-closed and may not prove global exhaustion.
    if (reason === 'repeated_sku_set') {
      coverage.sourceExhausted = true;
      stats.exhaustedTerms.push(term);
    } else {
      stats.stalledTerms.push(entry); stats.searchErrors++; coverage.errors++;
    }
    stats.nextPageCursor = 0; onTermStall(entry);
  };
  const finalize = () => { stats.accounting = candidateAccounting(stats); return { products, stats }; };
  try {
    outer: for (const [index, term] of config.searchTerms.entries()) {
      stats.lastSearchedTerm = term;
      let page = index === 0 ? initialPageCursor : 0;
      stats.nextPageCursor = page; stats.searchedTerms++;
      const coverage = stats.termCoverage[term] = { candidates: 0, pages: 0, new: 0, existingSkipped: 0, errors: 0, sourceExhausted: false };
      const signatures = new Set();
      while (true) {
        stats.stopReason = stop()
          ?? (stats.pagesFetched >= config.growthMaxTotalPages ? 'page_safety_limit' : null)
          ?? (stats.uniqueSKUsDiscovered >= config.growthMaxCandidates ? 'candidate_safety_limit' : null);
        if (stats.stopReason) break outer;
        stats.nextPageCursor = page; // Replay an interrupted window idempotently.
        let result;
        try {
          result = await findCandidates(term, Math.min(config.growthMaxPagesPerTerm,
            config.growthMaxTotalPages - stats.pagesFetched), { startPage: page, seenPageSignatures: signatures, shouldStop: () => stop() !== null });
        } catch (error) {
          if (error.pageCollection) absorb(error.pageCollection, coverage);
          stats.searchErrors++; coverage.errors++; throw error;
        }
        absorb(result, coverage);
        for (const candidate of result.candidates) {
          stats.stopReason = stop();
          if (stats.stopReason) break outer;
          d.notProcessed--;
          if (seen.has(candidate.sku)) { d.duplicate++; stats.duplicateSKUsSkipped++; continue; }
          seen.add(candidate.sku); stats.uniqueSKUsDiscovered++; coverage.candidates++;
          if (existingSKUs.has(candidate.sku)) {
            d.existing++; stats.existingCandidatesSkipped++; coverage.existingSkipped++; continue;
          }
          stats.processedProducts++;
          let product; const diagnostics = {};
          try { product = await validateCandidate({ ...candidate, searchTerm: term }, diagnostics); }
          catch (error) { d.technicalUnprocessed++; stats.productErrors++; coverage.errors++; throw error; }
          if (!product) {
            stats.invalidProductsSkipped++;
            d[diagnostics.reason === 'invalidPrice' ? 'invalidPrice' : 'invalidDetail']++; continue;
          }
          products.push(product); pending.push(product); stats.newProducts++; coverage.new++; d.writeUnconfirmed++;
          if (pending.length >= Math.min(persistBatchSize, config.maxNewProducts - confirmed())) await flush();
        }
        await flush();
        if (result.stallReason || result.repeatedPageStopped) {
          stall(term, result.stallPage ?? page, result.stallReason ?? 'repeated_sku_set', coverage); break;
        }
        if (result.sourceExhausted) {
          coverage.sourceExhausted = true; stats.exhaustedTerms.push(term); stats.nextPageCursor = 0; break;
        }
        stats.stopReason = stop();
        if (stats.stopReason) break outer;
        if (!Number.isInteger(result.nextPage) || result.nextPage <= page || result.pagesFetched < 1) {
          stall(term, page, 'cursor_not_advancing', coverage); break;
        }
        page = result.nextPage; stats.nextPageCursor = page;
      }
    }
    await flush();
    stats.stopReason = stop() ?? stats.stopReason ?? (stats.stalledTerms.length ? 'discovery_incomplete_stalled_terms' : 'discovery_exhausted');
    stats.sourceExhausted = stats.stopReason === 'discovery_exhausted'
      && stats.exhaustedTerms.length === config.searchTerms.length && stats.stalledTerms.length === 0;
    finalize();
    if (!stats.accounting.balanced) throw Object.assign(new Error('Kandidaattelling sluit niet'), { code: 'candidate_accounting_mismatch' });
    return { products, stats };
  } catch (error) {
    d.technicalUnprocessed += d.notProcessed; d.notProcessed = 0;
    stats.stopReason = error.code ?? 'technical_failure'; finalize();
    error.collectionStats = stats;
    throw error;
  }
}
