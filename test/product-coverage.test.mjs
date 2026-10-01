import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { catalogBatches, loadConfig } from '../src/config.mjs';
import { buildDynamicDiscoveryTerms } from '../src/catalog-growth.mjs';
import { HOOGVLIET_CATEGORIES, categoryDiscoveryRoute } from '../src/discovery-routes.mjs';
import { collectGrowthCandidates } from '../src/growth-collector.mjs';
import { collectCandidatePages, isRelevantCandidate, isReliableCatalogProduct,
  navigateSearchPage, resolvedSearchPageURL, searchPaginationEvidence, searchURL,
  validateCandidate, verifyCategorySearchRoute } from '../src/hoogvliet.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/hoogvliet-coverage-20260930.json', import.meta.url)));
const category = 'category:999999-1700';
const pageResult = (candidates, page = 0, totalPages = 2) => ({ candidates,
  ...searchPaginationEvidence({ currentPage: page + 1, totalPages,
    totalProducts: 65, candidateCount: candidates.length, requestedPage: page }) });
const settings = { searchTerms: [category], maxNewProducts: 400, growthMaxTotalPages: 800,
  growthMaxPagesPerTerm: 1, growthMaxCandidates: 5000, growthMaxRuntimeMs: 10000 };
function detailPage(detail) {
  return { goto: async () => {}, waitForFunction: async () => {},
    evaluate: async (_fn, selector) => selector ? { hasExpectedContent: true } : detail };
}

test('Intershop receives form-compatible %20, including on resumed multiword searches', async () => {
  const requested = searchURL('Just O');
  assert.match(requested, /SearchTerm=Just%20O&/);
  assert.doesNotMatch(requested, /SearchTerm=Just\+O/);
  const routes = new Map(), visits = [];
  const page = { goto: async url => visits.push(url), url: () => visits.at(-1) };
  await navigateSearchPage(page, 'Just O', 0, { resolvedRoutes: routes });
  await navigateSearchPage(page, 'Just O', 1, { resolvedRoutes: routes });
  assert.match(visits[1], /SearchTerm=Just%20O&/);
  assert.equal(new URL(visits[1]).searchParams.get('PageNumber'), '1');
  // Literal plus and ampersand are data, never turned into spaces/parameters.
  for (const term of ['Bio+', 'Body&fit', "G'woon", 'Céréal', 'Ben & Jerry\'s']) {
    assert.equal(new URL(resolvedSearchPageURL(searchURL(term), 3)).searchParams.get('SearchTerm'), term);
  }
});

test('all twenty public departments remain reachable when 450 dynamic slots contain brands', () => {
  const brands = Array.from({ length: 500 }, (_, i) => ({ brand: `Brand ${i}` }));
  const terms = buildDynamicDiscoveryTerms(brands, catalogBatches.growth);
  assert.equal(terms.length, 450);
  assert.equal(HOOGVLIET_CATEGORIES.length, 20);
  for (const route of HOOGVLIET_CATEGORIES) {
    assert.ok(catalogBatches.growth.includes(route.key));
    const url = new URL(searchURL(route.key));
    assert.equal(url.searchParams.get('CategoryName'), route.id);
    assert.equal(url.searchParams.get('SearchTerm'), '');
  }
  assert.equal(loadConfig({ DRY_RUN: '1', CATALOG_BATCH: 'growth' }).searchTerms.length, 168);
  assert.deepEqual(loadConfig({ DRY_RUN: '1', SEARCH_TERMS: 'rijst', CATALOG_BATCH: 'growth' }).searchTerms, ['rijst']);
});

test('only allowlisted, same-origin, correctly resolved category routes qualify', async () => {
  const route = categoryDiscoveryRoute(category), valid = searchURL(category);
  assert.doesNotThrow(() => verifyCategorySearchRoute(valid, route));
  for (const value of [valid.replace('999999-1700', '999999-700'),
    valid.replace('SearchTerm=&', 'SearchTerm=rijst&'),
    valid.replace('www.hoogvliet.com', 'evil.example'),
    valid.replace('www.hoogvliet.com', 'user:pass@www.hoogvliet.com')]) {
    assert.throws(() => verifyCategorySearchRoute(value, route), { code: 'source_unavailable' });
  }
  assert.throws(() => searchURL('category:unknown'), { code: 'source_unavailable' });
  const page = { goto: async () => {}, url: () => searchURL('rijst') };
  await assert.rejects(navigateSearchPage(page, category, 0, { resolvedRoutes: new Map() }), { code: 'source_unavailable' });
});

test('public category membership accepts cross-listed food while keyword search stays strict', async () => {
  const prunes = fixture.products.find(p => p.sku === '718878000');
  assert.equal(isRelevantCandidate(prunes, 'Bewuste voeding'), false);
  const keyword = await collectCandidatePages(async () => [prunes], 'Bewuste voeding', 1);
  assert.equal(keyword.candidates.length, 0);
  const result = await collectCandidatePages(async () => pageResult([prunes]), category, 1);
  assert.equal(result.candidates[0].sku, prunes.sku);
  assert.equal(result.sourceExhausted, false);
  assert.equal(result.nextPage, 1);
});

test('category discovery still rejects malformed identity and deduplicates', async () => {
  const p = fixture.products[0];
  const result = await collectCandidatePages(async () => pageResult([
    p, p, { ...p, sku: 'bad' }, { ...p, sourceURL: 'https://evil.example/product/test' },
  ]), category, 1);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.invalidCandidates, 2);
  assert.equal(result.duplicateCandidates, 1);
});

test('observed 15 absent SKUs pass the real detail validator offline without persistence', async () => {
  const result = await collectGrowthCandidates(settings, {
    findCandidates: async () => ({ candidates: fixture.products, rawCandidates: 15,
      pagesFetched: 1, sourceExhausted: true }),
    validateCandidate: p => validateCandidate(detailPage(p.detail), p),
  });
  assert.equal(new Set(result.products.map(p => p.sku)).size, 15);
  assert.ok(result.products.every(isReliableCatalogProduct));
  assert.equal(result.stats.persistedNewProducts, 0);
  assert.equal(result.stats.dispositions.validatedOnly, 15);
  assert.equal(result.stats.accounting.balanced, true);
});

test('category candidate still requires matching detail identity, package and positive price', async () => {
  const p = fixture.products[0];
  for (const changes of [{ sku: '123456789' }, { packageText: '' }, { displayPrice: 0 }, { displayPrice: null }]) {
    assert.equal(await validateCandidate(detailPage({ ...p.detail, ...changes }), p), null);
  }
});

test('category metadata uses observed zero-based requests and one-based returned pages', () => {
  assert.deepEqual(searchPaginationEvidence({ currentPage: 2, totalPages: 29, totalProducts: 451,
    candidateCount: 16, requestedPage: 1 }), { sourceExhausted: false, nextPage: 2, currentPage: 2 });
  assert.throws(() => searchPaginationEvidence({ currentPage: 1, totalPages: 29, totalProducts: 451,
    candidateCount: 16, requestedPage: 1 }), { code: 'source_unavailable' });
  assert.equal(searchPaginationEvidence({ currentPage: 29, totalPages: 29, totalProducts: 451,
    candidateCount: 3, requestedPage: 28 }).sourceExhausted, true);
});

test('repeated category page does not become faux exhaustion and other routes continue', async () => {
  const p = fixture.products[0], signatures = new Set();
  const fetchPage = async page => pageResult([p], page, 5);
  await collectCandidatePages(fetchPage, category, 1, { seenPageSignatures: signatures });
  const stalled = await collectCandidatePages(fetchPage, category, 1, { startPage: 1, seenPageSignatures: signatures });
  assert.equal(stalled.stallReason, 'repeated_category_page');
  assert.equal(stalled.sourceExhausted, false);
  const visited = [];
  const result = await collectGrowthCandidates({ ...settings, searchTerms: [category, 'rijst'] }, {
    findCandidates: async term => { visited.push(term); return term === category ? stalled
      : { candidates: [], rawCandidates: 0, pagesFetched: 1, sourceExhausted: true }; },
    validateCandidate: async () => assert.fail('no candidate to validate'),
  });
  assert.deepEqual(visited, [category, 'rijst']);
  assert.equal(result.stats.sourceExhausted, false);
  assert.equal(result.stats.stopReason, 'discovery_incomplete_stalled_terms');
});

test('new category routes keep remaining insert budget and resume exact page after bounded stop', async () => {
  const visited = [], writes = [];
  const result = await collectGrowthCandidates({ ...settings, maxNewProducts: 2 }, {
    initialPageCursor: 3,
    findCandidates: async (_term, _max, options) => {
      visited.push(options.startPage);
      return { candidates: fixture.products.slice(0, 5), rawCandidates: 5, pagesFetched: 1, nextPage: 4 };
    },
    validateCandidate: p => validateCandidate(detailPage(p.detail), p),
    onBatch: async products => { writes.push(...products); return { newProducts: products.length, existingProducts: 0 }; },
  });
  assert.deepEqual(visited, [3]);
  assert.equal(writes.length, 2);
  assert.equal(result.stats.persistedNewProducts, 2);
  assert.equal(result.stats.nextPageCursor, 3, 'replay interrupted window idempotently');
  assert.equal(result.stats.stopReason, 'growth_target_reached');
  assert.equal(result.stats.accounting.balanced, true);
});
