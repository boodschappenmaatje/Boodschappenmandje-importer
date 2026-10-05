import { readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const targetURL = 'https://www.hoogvliet.com/INTERSHOP/web/WFS/org-webshop-Site/nl_NL/-/EUR/ViewTWParametricSearch-SimpleOfferSearch?PageNumber=0&PageSize=16&SelectedSearchResult=SFProductSearch&SearchTerm=&SelectedItem=&SortingOption=Relevantie&CategoryName=999999-100&CategoryTitle=Producten--Aardappelen%2C%20groente%2C%20fruit&SearchTermKey=';
const apiKey = process.env.ZYTE_API_KEY;
if (!apiKey) {
  process.stdout.write(JSON.stringify({ requestCount: 0, classification: 'UNKNOWN', error: 'missing_secret' }) + '\n');
  process.exitCode = 1;
} else {
  let apiStatus = null;
  let upstreamStatus = null;
  let finalURL = null;
  let body = null;
  let apiError = null;
  try {
    const response = await fetch('https://api.zyte.com/v1/extract', {
      method: 'POST',
      redirect: 'error',
      headers: {
        authorization: `Basic ${Buffer.from(`${apiKey}:`, 'utf8').toString('base64')}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ url: targetURL, httpResponseBody: true }),
      signal: AbortSignal.timeout(90_000),
    });
    apiStatus = response.status;
    const apiText = await response.text();
    let payload = null;
    try { payload = JSON.parse(apiText); } catch {}
    if (payload && typeof payload === 'object') {
      upstreamStatus = Number.isInteger(payload.statusCode) ? payload.statusCode : null;
      finalURL = typeof payload.url === 'string' ? payload.url : null;
      if (typeof payload.httpResponseBody === 'string') {
        body = Buffer.from(payload.httpResponseBody, 'base64');
      }
    }
  } catch (error) {
    apiError = error?.name === 'TimeoutError' ? 'timeout' : 'request_error';
  }

  const html = body ? body.toString('utf8') : '';
  const htmlLower = html.toLowerCase();
  const challengeRules = [
    ['upstream_403', upstreamStatus === 403],
    ['upstream_401', upstreamStatus === 401],
    ['incapsula_marker', /incapsula|_incapsula_resource/.test(htmlLower)],
    ['imperva_marker', /imperva/.test(htmlLower)],
    ['human_verification_text', /verify you are human|checking your browser|human verification/.test(htmlLower)],
    ['challenge_or_access_denied_text', /request unsuccessful|access denied|captcha|unusual traffic|security challenge/.test(htmlLower)],
  ].filter(([, matched]) => matched).map(([name]) => name);

  let analysis = {
    title: null,
    productTiles: 0,
    productSearchResultRoots: 0,
    productLinks: 0,
    tileSKUs: [],
    pagination: { currentPage: null, totalPages: null, totalProducts: null },
    embeddedJSON: { total: 0, parsed: 0, jsonLD: 0, topKeys: [] },
    scriptCount: 0,
    xhrFetchMentions: 0,
    endpointHints: [],
    intershopSignature: false,
    hoogvlietTitle: false,
    explicitEmpty: false,
    validSignatures: [],
  };
  let parserCandidateCount = 0;
  let parserUniqueSKUCount = 0;
  let parserSKUs = [];
  let parserCompatible = false;
  let parserError = null;

  if (html) {
    const parserPath = fileURLToPath(new URL('../src/hoogvliet.mjs', import.meta.url));
    const original = await readFile(parserPath, 'utf8');
    const candidateMarker = 'async function extractSearchCandidates(page)';
    const resultMarker = 'async function searchPageResult(page, options)';
    if (original.split(candidateMarker).length !== 2 || original.split(resultMarker).length !== 2) {
      throw new Error('parser_probe_instrumentation_mismatch');
    }
    const instrumented = original
      .replace(candidateMarker, 'export async function extractSearchCandidates(page)')
      .replace(resultMarker, 'export async function searchPageResult(page, options)');
    const tempModule = join(dirname(parserPath), `.zyte-parser-probe-${process.pid}.mjs`);
    let parserModule;
    try {
      await writeFile(tempModule, instrumented, { flag: 'wx', mode: 0o600 });
      parserModule = await import(pathToFileURL(tempModule).href);
    } finally {
      await unlink(tempModule).catch(() => {});
    }

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.route('**/*', route => route.abort());
      const safeHTML = html
        .replace(/<base\b[^>]*>/gi, '')
        .replace(/<script\b([^>]*)>/gi, (_tag, attrs) => {
          const withoutSrc = attrs.replace(/\s+src\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
          return `<script type="application/x-probe-disabled" ${withoutSrc}>`;
        })
        .replace(/<head(\b[^>]*)>/i, `<head$1><base href="${(finalURL || targetURL).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`);
      await page.setContent(safeHTML, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      analysis = await page.evaluate((baseURL) => {
        const clean = value => (value || '').replace(/\s+/g, ' ').trim();
        const scripts = [...document.scripts];
        const jsonScripts = [...document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"], script[type="application/x-probe-disabled"]')];
        const parsedTopKeys = [];
        const jsonSKUs = new Set();
        let jsonProductLikeObjects = 0;
        let jsonVisited = 0;
        const inspectJSON = (value, depth = 0) => {
          if (value === null || typeof value !== 'object' || depth > 10 || jsonVisited++ > 25000) return;
          if (Array.isArray(value)) { for (const item of value.slice(0, 2000)) inspectJSON(item, depth + 1); return; }
          const keys = Object.keys(value);
          const lower = keys.map(key => key.toLowerCase());
          if (lower.some(key => /product|article|artikel|sku|ean/.test(key)) && lower.some(key => /sku|ean|article|artikel|product.?number|product.?code/.test(key))) jsonProductLikeObjects += 1;
          for (const [key, child] of Object.entries(value)) {
            if (typeof child === 'string' && /sku|ean|article|artikel|product.?number|product.?code/i.test(key) && /^\d{9}$/.test(child)) jsonSKUs.add(child);
            inspectJSON(child, depth + 1);
          }
        };
        let parsed = 0;
        let jsonLD = 0;
        for (const script of jsonScripts) {
          const type = script.getAttribute('type') || '';
          if (type === 'application/ld+json') jsonLD += 1;
          try {
            const value = JSON.parse(script.textContent || '');
            parsed += 1;
            if (value && typeof value === 'object' && !Array.isArray(value)) parsedTopKeys.push(...Object.keys(value));
            inspectJSON(value);
          } catch {}
        }
        const root = document.querySelector('#product-search-result');
        const positive = value => /^\d+$/.test(value || '') ? Number(value) : null;
        const total = root?.querySelector('.pagination-total')?.textContent?.match(/^\s*([\d.]+)\s+Producten\s*$/i);
        const productLinks = [...new Set([...document.querySelectorAll("a[href*='/product/']")].map(a => a.href))];
        const tileSKUs = [...new Set([...document.querySelectorAll('.product-tile')].map(tile => (tile.id || '').replace(/^product-tile_/, '')).filter(sku => /^\d{9}$/.test(sku)))];
        const endpointHints = new Set();
        const safeURLHint = raw => {
          try {
            const value = new URL(raw, baseURL);
            if (value.hostname !== 'www.hoogvliet.com' && value.hostname !== 'hoogvliet.com') return;
            const keys = [...new Set(value.searchParams.keys())].sort();
            endpointHints.add(`${value.pathname}${keys.length ? `?${keys.join(',')}` : ''}`);
          } catch {}
        };
        for (const script of scripts) {
          const src = script.getAttribute('src');
          if (src) safeURLHint(src);
          const text = script.textContent || '';
          for (const match of text.matchAll(/https?:\/\/[^\s"'<>`]+/gi)) safeURLHint(match[0]);
          for (const match of text.matchAll(/(?:"|')((?:\/)[^"'\s<>]*(?:api|ajax|search|product|intershop)[^"'\s<>]*)/gi)) safeURLHint(match[1]);
        }
        const scriptText = scripts.map(script => script.textContent || '').join('\n');
        const bodyText = (document.body?.innerText || '').toLowerCase();
        const title = clean(document.title) || null;
        const explicitEmpty = /geen resultaten gevonden|geen producten gevonden|niks kunnen vinden|niets gevonden|0 resultaten/.test(bodyText);
        return {
          title,
          productTiles: document.querySelectorAll('.product-tile').length,
          productSearchResultRoots: document.querySelectorAll('#product-search-result').length,
          productLinks: productLinks.length,
          tileSKUs,
          pagination: {
            currentPage: positive(root?.querySelector('.storePageNo')?.getAttribute('data-page-number')),
            totalPages: positive(root?.querySelector('#nrofpages')?.getAttribute('data-page-number')),
            totalProducts: total ? Number(total[1].replaceAll('.', '')) : null,
          },
          embeddedJSON: { total: jsonScripts.length, parsed, jsonLD, productLikeObjects: jsonProductLikeObjects, uniqueSKUHints: [...jsonSKUs].sort().slice(0, 20), topKeys: [...new Set(parsedTopKeys)].sort().slice(0, 40) },
          scriptCount: scripts.length,
          xhrFetchMentions: (scriptText.match(/\bfetch\s*\(|XMLHttpRequest|\$\.ajax\s*\(|\baxios\b/gi) || []).length,
          endpointHints: [...endpointHints].sort().slice(0, 20),
          intershopSignature: /intershop/i.test(document.documentElement?.innerHTML || ''),
          hoogvlietTitle: /hoogvliet/i.test(title || ''),
          explicitEmpty,
        };
      }, finalURL || targetURL);
      const candidates = await parserModule.extractSearchCandidates(page);
      parserCandidateCount = candidates.length;
      parserSKUs = [...new Set(candidates.map(item => item?.sku).filter(sku => /^\d{9}$/.test(String(sku))))].sort();
      parserUniqueSKUCount = parserSKUs.length;
      try {
        const full = await parserModule.searchPageResult(page, {
          requirePaginationEvidence: true,
          sourceEvidence: { classification: 'ready' },
          requestedCategoryPage: 0,
        });
        parserCompatible = Array.isArray(full?.candidates) && full.candidates.length === candidates.length;
      } catch (error) {
        parserError = error?.code || error?.name || 'parser_error';
      }
    } finally {
      await browser.close();
    }
  }

  analysis.validSignatures = [
    ...(/hoogvliet\.com$/i.test(new URL(finalURL || targetURL).hostname) ? ['hoogvliet_host'] : []),
    ...(new URL(finalURL || targetURL).pathname.includes('/INTERSHOP/') ? ['intershop_listing_route'] : []),
    ...(analysis.hoogvlietTitle ? ['hoogvliet_title'] : []),
    ...(analysis.intershopSignature ? ['intershop_markup'] : []),
    ...(analysis.productTiles > 0 ? ['product_tiles'] : []),
    ...(analysis.productSearchResultRoots > 0 ? ['product_search_result_root'] : []),
    ...(analysis.productLinks > 0 ? ['product_links'] : []),
    ...(analysis.explicitEmpty ? ['explicit_empty_state'] : []),
  ];
  const apiSuccess = apiStatus !== null && apiStatus >= 200 && apiStatus < 300;
  const upstreamSuccess = upstreamStatus !== null && upstreamStatus >= 200 && upstreamStatus < 300;
  let classification = 'UNKNOWN';
  if (upstreamStatus === 401 || upstreamStatus === 403 || challengeRules.some(rule => !['upstream_401', 'upstream_403'].includes(rule))) {
    classification = 'CHALLENGE';
  } else if (apiSuccess && upstreamSuccess && analysis.validSignatures.length > 0) {
    classification = 'VALID_SOURCE';
  }
  const report = {
    requestCount: 1,
    requestedURL: targetURL,
    zyteApiHTTPStatus: apiStatus,
    upstreamHTTPStatus: upstreamStatus,
    responseBytes: body?.length ?? null,
    finalURL,
    classification,
    challengeSignatures: challengeRules,
    validHoogvlietSignatures: analysis.validSignatures,
    sourceAnalysis: analysis,
    existingParser: { candidates: parserCandidateCount, uniqueSKUs: parserUniqueSKUCount, skus: parserSKUs.slice(0, 20), compatible: parserCompatible, error: parserError },
    apiError,
    browserHtmlUsed: false,
    bodyLogged: false,
  };
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (classification === 'UNKNOWN' || apiError) process.exitCode = 2;
}
