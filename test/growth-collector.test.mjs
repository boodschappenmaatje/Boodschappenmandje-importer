import assert from 'node:assert/strict';
import test from 'node:test';
import { collectGrowthCandidates } from '../src/growth-collector.mjs';
import { collectCandidatePages, withTransientNavigationRetry } from '../src/hoogvliet.mjs';
const config = { updateMode: 'growth', maxNewProducts: 400, maxPerTerm: 40,
  searchTerms: ['rijst'], growthMaxTotalPages: 800, growthMaxPagesPerTerm: 2,
  growthMaxCandidates: 6000, growthMaxRuntimeMs: 3600000 };
const item = (i) => ({ sku: String(100000000 + i), name: `Rijst ${i}`, sourceURL: `https://www.hoogvliet.com/product/rijst-${i}` });
function harness(rows, options = {}) {
  const inserted = new Set(), calls = [], batches = [];
  const existingSKUs = options.existingSKUs ?? new Set();
  return { inserted, calls, batches, options: {
    existingSKUs,
    findCandidates: (term, pages, cursor) => collectCandidatePages(async (page) => {
      calls.push(page); return rows.slice(page * 40, (page + 1) * 40);
    }, term, pages, cursor),
    validateCandidate: async (row) => options.invalid?.has(row.sku) ? null : row,
    onBatch: async (batch) => { batches.push(batch.length); let added = 0;
      for (const row of batch) if (!inserted.has(row.sku) && !options.collisions?.has(row.sku)) {
        inserted.add(row.sku); added++;
      }
      return { newProducts: added };
    },
  } };
}

test('production collector passes known/duplicate/invalid candidates, term cap and page windows to reach 400 inserts', async () => {
  const rows = Array.from({ length: 750 }, (_, i) => item(i));
  rows.splice(225, 0, ...rows.slice(200, 225));
  const h = harness(rows, { existingSKUs: new Set(rows.slice(0, 150).map(x => x.sku)),
    invalid: new Set(Array.from({ length: 50 }, (_, i) => item(150 + i).sku)) });
  const result = await collectGrowthCandidates(config, h.options);
  assert.equal(h.inserted.size, 400);
  assert.equal(result.stats.persistedNewProducts, 400);
  assert.equal(result.stats.existingCandidatesSkipped, 150);
  assert.equal(result.stats.invalidProductsSkipped, 50);
  assert.ok(result.stats.duplicateSKUsSkipped >= 25);
  assert.ok(Math.max(...h.calls) > 2);
  assert.equal(result.stats.stopReason, 'growth_target_reached');
});

test('327 valid products and confirmed empty next page exhaust once without a retry loop', async () => {
  const h = harness(Array.from({ length: 327 }, (_, i) => item(i)));
  const result = await collectGrowthCandidates(config, h.options);
  assert.equal(result.stats.persistedNewProducts, 327);
  assert.equal(result.stats.sourceExhausted, true);
  assert.equal(result.stats.stopReason, 'discovery_exhausted');
  assert.deepEqual(result.stats.exhaustedTerms, ['rijst']);
  assert.ok(h.calls.length <= 10);
});

test('all-invalid and empty results are genuine route exhaustion, not an invented source outage', async () => {
  for (const rows of [[], [item(0)]]) {
    const h = harness(rows, { invalid: new Set([item(0).sku]) });
    const result = await collectGrowthCandidates(config, h.options);
    assert.equal(result.stats.sourceExhausted, true); assert.equal(h.inserted.size, 0);
  }
});

test('partial daily remainder and concurrent collisions never exceed the confirmed target', async () => {
  const h = harness(Array.from({ length: 100 }, (_, i) => item(i)), { collisions: new Set([item(0).sku, item(1).sku]) });
  const result = await collectGrowthCandidates({ ...config, maxNewProducts: 7 }, h.options);
  assert.equal(h.inserted.size, 7); assert.deepEqual(h.batches, [7, 2]);
  assert.equal(result.stats.persistedNewProducts, 7);
});

test('page safety stop preserves the next window and never claims exhaustion', async () => {
  const h = harness(Array.from({ length: 200 }, (_, i) => item(i)));
  const first = await collectGrowthCandidates({ ...config, growthMaxTotalPages: 2 }, h.options);
  assert.equal(first.stats.persistedNewProducts, 80);
  assert.equal(first.stats.nextPageCursor, 2);
  assert.equal(first.stats.stopReason, 'page_safety_limit'); assert.equal(first.stats.sourceExhausted, false);
  const second = await collectGrowthCandidates(config, { ...h.options, initialPageCursor: first.stats.nextPageCursor });
  assert.equal(second.stats.persistedNewProducts, 120); assert.equal(h.inserted.size, 200);
});

test('runtime interruption keeps the current window for lossless replay', async () => {
  let clock = 0;
  const h = harness(Array.from({ length: 120 }, (_, i) => item(i)));
  const result = await collectGrowthCandidates({ ...config, growthMaxRuntimeMs: 15 }, {
    ...h.options, now: () => clock, validateCandidate: async row => { clock++; return row; },
  });
  assert.equal(result.stats.stopReason, 'runtime_safety_limit');
  assert.equal(result.stats.nextPageCursor, 0); assert.equal(result.stats.sourceExhausted, false);
  assert.equal(h.inserted.size, 15);
});

test('temporary navigation failure uses bounded backoff and then continues', async () => {
  let attempt = 0; const delays = [];
  const h = harness(Array.from({ length: 10 }, (_, i) => item(i)));
  const result = await collectGrowthCandidates(config, { ...h.options,
    findCandidates: (...args) => withTransientNavigationRetry(async () => {
      if (++attempt < 3) throw new Error('navigation timeout');
      return h.options.findCandidates(...args);
    }, { wait: async ms => delays.push(ms) }),
  });
  assert.deepEqual(delays, [350, 700]); assert.equal(result.stats.persistedNewProducts, 10);
});

test('permanent errors and repeated pages remain explicit failures with a replay cursor', async () => {
  const h = harness([]);
  await assert.rejects(collectGrowthCandidates(config, { ...h.options, findCandidates: async () => {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  } }), e => e.status === 403 && e.collectionStats.searchErrors === 1 && e.collectionStats.nextPageCursor === 0);
  await assert.rejects(collectGrowthCandidates(config, { ...h.options, findCandidates: async () => ({
    candidates: [], pagesFetched: 2, nextPage: 0, sourceExhausted: true, repeatedPageStopped: true,
  }) }), e => e.code === 'pagination_stalled' && !e.collectionStats.sourceExhausted);
});

test('explicit one-based source page count advances zero-based URL pages exactly once', async () => {
  const calls = [];
  const result = await collectCandidatePages(async page => {
    calls.push(page);
    return { candidates: [item(page)], sourceExhausted: page === 1, nextPage: 1 };
  }, 'rijst', 20);
  assert.deepEqual(calls, [0, 1]); assert.equal(result.sourceExhausted, true);
});
