import assert from 'node:assert/strict';
import test from 'node:test';
import { runCatalogGrowth } from '../src/catalog-growth.mjs';
const logger = { info() {}, error() {} };
const config = { maxNewProducts: 400, searchTerms: ['rijst', 'pasta'], advanceDiscoveryState: true,
  discoveryScanDate: '2026-09-28', discoveryStateKey: 'fixture', catalogBatch: 'growth' };
function harness(overrides = {}) {
  const saved = [], finished = [];
  return { saved, finished, dependencies: {
    fetchExistingProducts: async () => [], fetchExistingPriceStates: async () => new Map(),
    // Unrelated concurrent database growth must never count as our confirmed inserts.
    fetchExistingSKUs: async () => new Set(Array.from({ length: 999 }, (_, i) => String(i))),
    startCatalogImportRun: async () => ({ id: 'fixture-run' }),
    finishCatalogImportRun: async (_config, _run, result) => finished.push(result),
    fetchCatalogDiscoveryState: async () => ({ stateKey: 'fixture', termCursor: 0, pageCursor: 0 }),
    saveCatalogDiscoveryState: async (_config, state) => saved.push(state),
    upsertProducts: async (_config, rows) => ({ imported: rows.map((row, index) => ({ ...row, inserted: index !== 0 })), errors: [] }),
    collectProducts: async (_config, _logger, options) => {
      const rows = [{ sku: '100000000' }, { sku: '100000001' }];
      const feedback = await options.onBatch(rows);
      assert.equal(feedback.newProducts, 1);
      return { products: rows, stats: { lastSearchedTerm: 'rijst', nextPageCursor: 20,
        stopReason: 'page_safety_limit', exhaustedTerms: [], termCoverage: {}, uniqueSKUsDiscovered: 2 } };
    }, ...overrides,
  } };
}
test('growth reports only confirmed unique inserts, not total database count delta', async () => {
  const h = harness(); const result = await runCatalogGrowth(config, logger, h.dependencies);
  assert.equal(result.actualGrowth, 1); assert.equal(result.totalUniqueProductsAfter, 999);
  assert.equal(result.targetReached, false); assert.equal(h.saved[0].pageCursor, 20);
});
test('same-day continuation skips completed routes and resumes the exact term, next day revisits from page zero', async () => {
  for (const scanDate of ['2026-09-28', '2026-09-29']) {
    const h = harness({ fetchCatalogDiscoveryState: async () => ({ stateKey: 'fixture', termCursor: 999,
      pageCursor: 20, lastTerm: 'pasta', scanDate: '2026-09-28', exhaustedTerms: ['rijst'] }),
      collectProducts: async (settings, _logger, options) => {
        assert.equal(settings.searchTerms[0], 'pasta');
        assert.equal(settings.searchTerms.includes('rijst'), scanDate !== '2026-09-28');
        assert.equal(options.initialPageCursor, scanDate === '2026-09-28' ? 20 : 0);
        return { products: [], stats: { sourceExhausted: true, stopReason: 'discovery_exhausted',
          exhaustedTerms: settings.searchTerms, lastSearchedTerm: 'pasta', nextPageCursor: 0 } };
      } });
    const result = await runCatalogGrowth({ ...config, discoveryScanDate: scanDate }, logger, h.dependencies);
    assert.equal(result.actualGrowth, 0); assert.equal(result.sourceExhausted, true); assert.equal(result.status, 'success');
  }
});
test('a structural write failure preserves earlier confirmed inserts and collection diagnostics', async () => {
  const h = harness({ upsertProducts: async () => { throw Object.assign(new Error('database unavailable'), {
    code: 'ECONNRESET', confirmedImports: [{ sku: '100000000', inserted: true }],
  }); }, collectProducts: async (_settings, _logger, options) => {
    try { await options.onBatch([{ sku: '100000000' }, { sku: '100000001' }]); }
    catch (error) { error.collectionStats = { lastSearchedTerm: 'rijst', nextPageCursor: 20,
      candidatesExamined: 120, existingCandidatesSkipped: 60, duplicateSKUsSkipped: 10,
      invalidProductsSkipped: 5, stopReason: 'ECONNRESET' }; throw error; }
  } });
  await assert.rejects(runCatalogGrowth(config, logger, h.dependencies), error => {
    assert.equal(error.actualGrowth, 1); assert.equal(error.catalogAttemptMetrics.candidatesViewed, 120);
    assert.equal(error.catalogAttemptMetrics.existingCount, 60); return true;
  });
  assert.equal(h.saved[0].pageCursor, 20); assert.equal(h.finished[0].newCount, 1);
});
