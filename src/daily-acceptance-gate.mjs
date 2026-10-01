// No writes and no importer here: fail-closed evidence for the normal daily job.
function requireEvidence(condition, reason) {
  if (!condition) throw Object.assign(new Error(`Acceptance geblokkeerd: ${reason}`), {
    code: `acceptance_${reason}`, retryable: false,
  });
}

function dateKey(value) {
  const date = new Date(value);
  requireEvidence(Number.isFinite(date.getTime()), "invalid_product_date");
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam",
    year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function inspectAcceptanceSnapshot(snapshot, jobDate) {
  requireEvidence(Array.isArray(snapshot?.products) && Array.isArray(snapshot?.prices), "snapshot_missing");
  const ids = new Set(); const skus = new Set(); const prices = new Map();
  for (const p of snapshot.products) {
    requireEvidence(p.id && !ids.has(p.id), "duplicate_product_id");
    const key = `${p.supermarket}\0${p.sku}`;
    requireEvidence(p.sku && !skus.has(key), "duplicate_sku");
    ids.add(p.id); skus.add(key);
  }
  for (const p of snapshot.prices) {
    requireEvidence(ids.has(p.product_id), "orphan_price");
    requireEvidence(!prices.has(p.product_id), "duplicate_price");
    requireEvidence(Number.isFinite(Number(p.price)) && Number(p.price) > 0, "invalid_price");
    prices.set(p.product_id, p);
  }
  requireEvidence(ids.size === prices.size, "product_without_price");
  const m = snapshot.maintenance;
  requireEvidence(m?.status === "confirmed" && Array.isArray(m.pendingProductIds)
    && m.pendingProductIds.length === 0 && Array.isArray(m.failures) && m.failures.length === 0
    && Number.isSafeInteger(m.notifiedProducts), "maintenance_unconfirmed");
  const today = snapshot.products.filter(p => dateKey(p.created_at) === jobDate).length;
  return { products: ids.size, prices: prices.size, today, notified: m.notifiedProducts };
}

export function verifyDailyAcceptance({ before, after, job, result, limit }) {
  const a = inspectAcceptanceSnapshot(before, job.jobDate);
  const b = inspectAcceptanceSnapshot(after, job.jobDate);
  requireEvidence(job.targetNewProducts === 400 && a.today === job.newProductsCollected, "day_accounting_before");
  const count = result.actualGrowth;
  requireEvidence(Number.isSafeInteger(count) && count >= 0 && count <= limit, "invalid_growth_count");
  requireEvidence(b.products - a.products === count && b.prices - a.prices === count
    && b.today - a.today === count && b.today <= 400, "write_delta_mismatch");
  const oldIds = new Set(before.products.map(p => p.id));
  const oldSkus = new Set(before.products.map(p => `${p.supermarket}\0${p.sku}`));
  const added = after.products.filter(p => !oldIds.has(p.id));
  requireEvidence(added.length === count && before.products.every(p => after.products.some(q => q.id === p.id && q.sku === p.sku)), "identity_changed");
  for (const p of added) {
    let url; try { url = new URL(p.source_url); } catch { /* fail closed below */ }
    requireEvidence(p.supermarket === "Hoogvliet" && /^\d{9}$/.test(p.sku) && p.name?.trim()
      && !oldSkus.has(`${p.supermarket}\0${p.sku}`) && dateKey(p.created_at) === job.jobDate
      && url?.protocol === "https:" && url.hostname === "www.hoogvliet.com"
      && !url.username && !url.password && url.pathname.startsWith("/product/"), "new_product_identity");
  }
  const oldPrices = new Map(before.prices.map(p => [p.product_id, p]));
  requireEvidence(after.prices.every(p => !oldPrices.has(p.product_id)
    || JSON.stringify(p) === JSON.stringify(oldPrices.get(p.product_id))), "unexpected_existing_price_write");
  requireEvidence(b.notified - a.notified === count, "acknowledgement_mismatch");
  requireEvidence((result.errorCount ?? 0) === 0 && (result.searchErrors ?? 0) === 0, "import_errors");
  requireEvidence(result.accounting?.balanced === true, "unbalanced_discovery");
  return { before: a, after: b, confirmedNew: count, confirmedPrices: count,
    pending: 0, acknowledgements: count, remaining: 400 - b.today };
}
