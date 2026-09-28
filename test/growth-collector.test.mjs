import assert from 'node:assert/strict';
import test from 'node:test';
import { collectGrowthCandidates } from '../src/growth-collector.mjs';
import { collectCandidatePages, navigateSearchPage, resolvedSearchPageURL, withTransientNavigationRetry } from '../src/hoogvliet.mjs';
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

test('permanent errors fail globally but repeated pages mark only their term incomplete', async () => {
  const h = harness([]);
  await assert.rejects(collectGrowthCandidates(config, { ...h.options, findCandidates: async () => {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  } }), e => e.status === 403 && e.collectionStats.searchErrors === 1 && e.collectionStats.nextPageCursor === 0);
  const repeated = await collectGrowthCandidates(config, { ...h.options, findCandidates: async () => ({
    candidates: [], pagesFetched: 2, nextPage: 0, sourceExhausted: true, repeatedPageStopped: true,
  }) });
  assert.equal(repeated.stats.sourceExhausted, false);
  assert.equal(repeated.stats.stopReason, 'discovery_incomplete_stalled_terms');
});

test('explicit one-based source page count advances zero-based URL pages exactly once', async () => {
  const calls = [];
  const result = await collectCandidatePages(async page => {
    calls.push(page);
    return { candidates: [item(page)], sourceExhausted: page === 1, nextPage: 1 };
  }, 'rijst', 20);
  assert.deepEqual(calls, [0, 1]); assert.equal(result.sourceExhausted, true);
});

test('fruit keeps its resolved category context and zero-based page beyond a redirect', () => {
  const category = 'https://www.hoogvliet.com/INTERSHOP/web/WFS/org-webshop-Site/nl_NL/-/EUR/ViewTWParametricSearch-SimpleOfferSearch?PageNumber=0&PageSize=16&SearchTerm=&CategoryName=100-10003&SortingOption=Relevantie';
  const next = new URL(resolvedSearchPageURL(category, 21));
  assert.equal(next.searchParams.get('PageNumber'), '21');
  for (const key of ['CategoryName', 'PageSize', 'SearchTerm', 'SortingOption']) {
    assert.equal(next.searchParams.get(key), new URL(category).searchParams.get(key));
  }
  assert.throws(() => resolvedSearchPageURL('https://other.example/search', 1));
});

test('fruit stalls, groente continues beyond page 20, and confirmed inserts alone reach 400', async () => {
  const calls = [], inserted = new Set();
  const result = await collectGrowthCandidates({ ...config, searchTerms: ['fruit', 'groente'] }, {
    findCandidates: (term, pages, cursor) => collectCandidatePages(async page => {
      calls.push([term, page]);
      const candidates = term === 'fruit' ? [item(900)] : Array.from({ length: 16 }, (_, i) => item(page * 16 + i));
      return { candidates: candidates.map(row => ({ ...row, name: `${term} product` })),
        sourceExhausted: false, nextPage: page + 1 };
    }, term, pages, cursor),
    existingSKUs: new Set([item(900).sku]),
    validateCandidate: async row => ({ ...row, price: 1 }),
    onBatch: async rows => { rows.forEach(row => inserted.add(row.sku)); return { newProducts: rows.length }; },
  });
  assert.equal(inserted.size, 400);
  assert.deepEqual(calls.filter(([term]) => term === 'fruit'), [['fruit', 0], ['fruit', 1]]);
  assert.ok(calls.some(([term, page]) => term === 'groente' && page > 20));
  assert.deepEqual(result.stats.stalledTerms, [{ term: 'fruit', page: 1, reason: 'repeated_sku_set' }]);
  assert.equal(result.stats.sourceExhausted, false);
  assert.equal(result.stats.stopReason, 'growth_target_reached');
  assert.equal(result.stats.accounting.balanced, true);
});

test('reordered SKU sets, A-B-A cycles, cursor loops and ambiguous empty pages stop safely without exhaustion', async () => {
  for (const mode of ['reordered', 'cycle', 'cursor', 'empty']) {
    const result = await collectCandidatePages(async page => ({
      candidates: mode === 'empty' ? [] : (mode === 'cycle' && page === 1 ? [item(3)] : page % 2 ? [item(2), item(1)] : [item(1), item(2)]),
      nextPage: mode === 'cursor' ? 0 : page + 1, sourceExhausted: false,
    }), 'rijst', 100);
    assert.equal(result.sourceExhausted, false, mode);
    assert.ok(result.stallReason, mode);
    assert.ok(result.pagesFetched <= 3, mode);
  }
});

test('a stalled route followed by genuinely exhausted routes never proves global exhaustion', async () => {
  const result = await collectGrowthCandidates({ ...config, searchTerms: ['fruit', 'groenten'] }, {
    findCandidates: async term => ({ candidates: [], pagesFetched: 1, nextPage: 0,
      sourceExhausted: term !== 'fruit', stallReason: term === 'fruit' ? 'empty_page_without_end' : null }),
    validateCandidate: async row => row,
  });
  assert.equal(result.stats.sourceExhausted, false);
  assert.equal(result.stats.stopReason, 'discovery_incomplete_stalled_terms');
  assert.deepEqual(result.stats.exhaustedTerms, ['groenten']);
  assert.equal(result.stats.accounting.balanced, true);
});

test('raw tile ledger explains filtering, missing identity, duplicates, repeats, prices and confirmed/concurrent inserts', async () => {
  const page = [item(0), item(1), item(1), item(2), item(3), item(4), item(5),
    { ...item(6), name: 'wasmiddel' }, { name: 'Rijst zonder SKU' }];
  const result = await collectGrowthCandidates(config, {
    findCandidates: (term, pages, cursor) => collectCandidatePages(async n => ({
      candidates: n === 0 ? page : [...page].reverse(), nextPage: n + 1, sourceExhausted: false,
    }), term, pages, cursor),
    existingSKUs: new Set([item(0).sku]),
    validateCandidate: async (row, diagnostic) => {
      if (row.sku === item(2).sku) { diagnostic.reason = 'invalidPrice'; return null; }
      if (row.sku === item(3).sku) return null;
      return { ...row, price: 2 };
    },
    onBatch: async () => ({ newProducts: 2, existingProducts: 1 }),
  });
  const ledger = result.stats.accounting;
  assert.equal(ledger.rawPageHits, 18); assert.equal(ledger.accounted, 18); assert.equal(ledger.balanced, true);
  assert.deepEqual(ledger.categories, { new: 2, existing: 1, concurrentExisting: 1, duplicate: 1,
    repeatedPage: 9, invalidIdentity: 1, irrelevant: 1, invalidPrice: 1, invalidDetail: 1,
    validatedOnly: 0, writeUnconfirmed: 0, notProcessed: 0, technicalUnprocessed: 0 });
});

test('partial page-fetch failure and partial database confirmation preserve a balanced ledger', async () => {
  for (const failure of ['page', 'write', 'detail']) {
    await assert.rejects(collectGrowthCandidates(config, {
      findCandidates: (term, pages, cursor) => collectCandidatePages(async page => {
        if (failure === 'page' && page === 1) throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
        return { candidates: [item(0), item(1)], nextPage: page + 1, sourceExhausted: failure !== 'page' };
      }, term, pages, cursor),
      validateCandidate: async row => { if (failure === 'detail') throw new Error('detail unavailable'); return row; },
      onBatch: async () => { throw Object.assign(new Error('write unavailable'), { confirmedImports: [{ inserted: true }] }); },
    }), error => {
      assert.equal(error.collectionStats.accounting.balanced, true, failure);
      assert.equal(error.collectionStats.accounting.accounted, 2);
      if (failure === 'write') assert.equal(error.collectionStats.dispositions.new, 1);
      return true;
    });
  }
});

test('actual navigation preserves redirected fruit category across windows and on nonzero resume', async () => {
  const calls = []; let current;
  const page = { url: () => current, goto: async value => {
    const url = new URL(value); calls.push(url);
    if (url.searchParams.get('SearchTerm') === 'fruit') {
      url.searchParams.set('SearchTerm', ''); url.searchParams.set('CategoryName', '100-10003'); url.searchParams.set('PageNumber', '0');
    }
    current = url.href;
  } };
  const resolvedRoutes = new Map();
  await navigateSearchPage(page, 'fruit', 0, { resolvedRoutes });
  await navigateSearchPage(page, 'fruit', 1, { resolvedRoutes });
  await navigateSearchPage(page, 'fruit', 21, { resolvedRoutes });
  assert.deepEqual(calls.map(url => url.searchParams.get('PageNumber')), ['0', '1', '21']);
  assert.equal(calls[1].searchParams.get('CategoryName'), '100-10003');
  await navigateSearchPage(page, 'fruit', 22, { resolvedRoutes: new Map() });
  assert.equal(calls.at(-1).searchParams.get('CategoryName'), '100-10003');
  assert.equal(new URL(current).searchParams.get('PageNumber'), '22');
});
