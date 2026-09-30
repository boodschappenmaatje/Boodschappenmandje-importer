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

test('durable maintenance scope precedes notification and remains visible after failure and later success', async () => {
  const h = harness({
    upsertProducts: async (_config, rows, lifecycle) => {
      await lifecycle.onMaintenancePending(['new-id']);
      assert.deepEqual(h.saved.at(-1).plannerMaintenance.pendingProductIds, ['previous-id', 'new-id']);
      await lifecycle.onMaintenanceResult({ notifiedProducts: 0, pendingProductIds: ['new-id'],
        failures: [{ stage: 'new-product-cache-refresh', status: 401 }] }, ['new-id']);
      return { imported: rows.map((row, index) => ({ ...row, inserted: index !== 0 })), errors: [] };
    },
    fetchCatalogDiscoveryState: async () => ({ stateKey: 'fixture', termCursor: 0,
      plannerMaintenance: { status: 'pending_requires_attention', pendingProductIds: ['previous-id'], notifiedProducts: 0, failures: [] } }),
  });
  const result = await runCatalogGrowth(config, logger, h.dependencies);
  assert.equal(result.actualGrowth, 1);
  assert.equal(result.plannerMaintenance.status, 'pending_requires_attention');
  assert.deepEqual(h.saved.at(-1).lastAttemptReport.plannerMaintenance.pendingProductIds, ['previous-id', 'new-id']);
  assert.equal(result.plannerMaintenance.failures[0].status, 401);
});

test('a repeated-page term from an earlier same-day window migrates to proven exhaustion', async () => {
  const h = harness({ fetchCatalogDiscoveryState: async () => ({ stateKey: 'fixture', termCursor: 0,
    scanDate: config.discoveryScanDate, stalledTerms: [{ term: 'rijst', page: 2, reason: 'repeated_sku_set' }] }),
    collectProducts: async settings => {
      assert.equal(settings.searchTerms.includes('rijst'), false);
      assert.equal(settings.searchTerms.includes('pasta'), true);
      return { products: [], stats: { sourceExhausted: true, stopReason: 'discovery_exhausted', exhaustedTerms: settings.searchTerms } };
    },
  });
  const result = await runCatalogGrowth(config, logger, h.dependencies);
  assert.equal(result.stopReason, 'discovery_exhausted');
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.searchErrors, 0);
  assert.equal(result.stalledTerms.length, 0);
  assert.ok(h.saved.at(-1).exhaustedTerms.includes('rijst'));
  assert.equal(h.saved.at(-1).lastAttemptReport.stalledTerms.length, 0);
});

test('real v4 CAS writer accepts only the IDs confirmed by the maintenance callback', async t => {
  const { fetchCatalogDiscoveryState, saveCatalogDiscoveryState } = await import('../src/supabase.mjs');
  const id = '00000000-0000-4000-8000-000000000001';
  let row = { state_key: 'fixture', term_cursor: 0, page_cursor: 0, updated_at: '2026-09-29T12:00:00Z',
    last_batch: JSON.stringify({ version: 4, future: 'preserved', plannerMaintenance: {
      pendingProductIds: [], notifiedProducts: 304, status: 'confirmed', failures: [] } }) };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.pathname, '/rest/v1/catalog_discovery_state');
    if (options.method === 'PATCH') {
      assert.equal(url.searchParams.get('updated_at'), 'eq.' + row.updated_at);
      row = JSON.parse(options.body);
    } else assert.equal(options.method, 'GET');
    return new Response(JSON.stringify([row]), { status: 200 });
  });
  const h = harness({ fetchCatalogDiscoveryState, saveCatalogDiscoveryState,
    upsertProducts: async (_c, products, lifecycle) => {
      await lifecycle.onMaintenancePending([id]);
      assert.deepEqual(JSON.parse(row.last_batch).plannerMaintenance.pendingProductIds, [id]);
      await lifecycle.onMaintenanceResult({ notifiedProducts: 1, pendingProductIds: [], failures: [] }, [id]);
      return { imported: products.map((p, i) => ({ ...p, inserted: i !== 0 })), errors: [] };
    },
  });
  await runCatalogGrowth({ ...config, supabaseURL: 'https://fixture.supabase.co', supabaseSecret: 'sb_secret_fixture' }, logger, h.dependencies);
  const state = JSON.parse(row.last_batch);
  assert.equal(state.version, 4); assert.equal(state.future, 'preserved');
  assert.equal(state.plannerMaintenance.notifiedProducts, 305);
  assert.deepEqual(state.plannerMaintenance.pendingProductIds, []);
});
