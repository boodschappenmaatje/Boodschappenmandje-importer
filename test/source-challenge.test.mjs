import test from 'node:test';
import assert from 'node:assert/strict';
import { challengeRecoveryDecision, sourceChallengeRetryAt } from '../src/source-challenge-policy.mjs';
import { createSourcePacer, withTransientNavigationRetry } from '../src/hoogvliet.mjs';
import { requeueSourceChallenge } from '../src/supabase.mjs';
import { resumeSourceChallenge } from '../src/daily-catalog-growth.mjs';

const now = new Date('2026-10-01T09:00:00Z');
const job = { id: 'job', stateKey: 'daily-catalog-growth', jobDate: '2026-10-01',
  targetNewProducts: 400, newProductsCollected: 100, remainingTarget: 300,
  status: 'daily_target_partial', attemptCount: 2, updatedAt: '2026-10-01T08:36:00Z' };
const attempts = [{ attempt_number: 1, status: 'succeeded' },
  { attempt_number: 2, status: 'daily_target_partial', error_code: 'source_challenge',
    completed_at: '2026-10-01T08:36:00Z', cumulative_new_after: 100, remaining_target_after: 300 }];

test('legacy recovery proves same date, exact latest challenge/accounting and elapsed cooldown', () => {
  assert.equal(challengeRecoveryDecision(job, attempts, now).allowed, true);
  for (const patch of [{ status: 'running' }, { lockExpiresAt: now.toISOString() },
    { attemptCount: 3 }, { newProductsCollected: 101 }, { remainingTarget: 299 },
    { targetNewProducts: 100 }, { jobDate: '2026-09-30' }, { updatedAt: null }]) {
    assert.equal(challengeRecoveryDecision({ ...job, ...patch }, attempts, now).allowed, false);
  }
  assert.equal(challengeRecoveryDecision(job, attempts, new Date('2026-10-01T08:40Z')).reason, 'retry_not_due');
  assert.equal(challengeRecoveryDecision(job, attempts, new Date('2026-10-01T21:00Z')).allowed, false);
  assert.equal(challengeRecoveryDecision(job, [attempts[0], { ...attempts[1], error_code: 'discovery_exhausted' }], now).allowed, false);
  assert.equal(sourceChallengeRetryAt(4, now.toISOString()), null);
});

test('requeue uses strict CAS, never modifies counters, claim ownership or attempt history', async () => {
  const original = globalThis.fetch;
  let conflict = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.method, 'PATCH');
    const query = new URL(url).searchParams;
    for (const [key, value] of Object.entries({ id: 'eq.job', status: 'eq.daily_target_partial',
      new_products_collected: 'eq.100', target_new_products: 'eq.400', attempt_count: 'eq.2',
      lock_token: 'is.null', lock_expires_at: 'is.null', updated_at: `eq.${job.updatedAt}` })) {
      assert.equal(query.get(key), value);
    }
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body).sort(), ['completed_at','last_public_message','next_retry_at','status','updated_at']);
    assert.equal(body.status, 'retry_scheduled');
    return new Response(JSON.stringify(conflict ? [] : [{ id: 'job', new_products_collected: 100,
      target_new_products: 400, status: 'retry_scheduled' }]));
  };
  try {
    const cfg = { supabaseURL: 'https://fixture.supabase.co', supabaseSecret: 'fixture' };
    assert.equal((await requeueSourceChallenge(cfg, job, attempts, now)).newProductsCollected, 100);
    conflict = true;
    await assert.rejects(requeueSourceChallenge(cfg, job, attempts, now), /claim_conflict/);
  } finally { globalThis.fetch = original; }
});

test('source pacer shares a fixed 2-second budget, with no immediate challenge retry', async () => {
  let time = 0; const waits = [];
  const pace = createSourcePacer({ now: () => time, wait: async ms => { waits.push(ms); time += ms; } });
  await pace(); time += 300; await pace(); time += 800; await pace();
  assert.deepEqual(waits, [1700, 1200]);
  let calls = 0;
  await assert.rejects(withTransientNavigationRetry(async () => {
    calls++; throw Object.assign(new Error('challenge timeout'), { code: 'source_challenge' });
  }, { wait: async () => assert.fail('no request retry on challenge') }), /challenge/);
  assert.equal(calls, 1);
});

test('blocked resume source makes no recovery, claim or import writes', async () => {
  // Validation itself is covered by the real snapshot fixtures; a rejected
  // day status must fail even before probing the source or fetching prices.
  await assert.rejects(resumeSourceChallenge({}, console, {
    now: () => now, fetchJob: async () => ({ ...job, status: 'running' }),
    fetchAttempts: async () => attempts,
    acceptanceSnapshot: async () => assert.fail('no snapshot for active claim'),
    verifySource: async () => assert.fail('no source request'),
    requeue: async () => assert.fail('no status write'),
    claim: async () => assert.fail('no claim'),
  }), /not_due/);
});

function snapshot(n) {
  return { products: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, sku: String(100000000 + i),
    supermarket: 'Hoogvliet', name: `Product ${i}`, source_url: `https://www.hoogvliet.com/product/p${i}`,
    created_at: '2026-10-01T07:00Z' })),
  prices: Array.from({ length: n }, (_, i) => ({ product_id: `p${i}`, price: 1.99 })),
  maintenance: { status: 'confirmed', notifiedProducts: 304 + n, pendingProductIds: [], failures: [] } };
}

test('a repeated preflight challenge cannot reopen a closed job or write products', async () => {
  await assert.rejects(resumeSourceChallenge({}, console, {
    now: () => now, fetchJob: async () => job, fetchAttempts: async () => attempts,
    acceptanceSnapshot: async () => snapshot(100),
    verifySource: async () => { throw Object.assign(new Error('source_challenge'), { code: 'source_challenge' }); },
    requeue: async () => assert.fail('no status write while source blocked'),
    claim: async () => assert.fail('no claim while source blocked'),
  }), /source_challenge/);
});

test('verified legacy resume uses the same day normal claim and exactly remaining 300 with full integrity gate', async () => {
  let n = 100; const order = [];
  const result = await resumeSourceChallenge({ dailyImportStateKey: job.stateKey, dailyTargetNewProducts: 400,
    dailySingleAttempt: true, dailyEndHour: 23, maxProducts: 400, growthMaxRuntimeMs: 100000 }, { info() {} }, {
    now: () => now, fetchJob: async () => job, fetchAttempts: async () => attempts,
    acceptanceSnapshot: async () => snapshot(n), hasProductTypeColumn: async () => true,
    verifySource: async () => order.push('source'),
    requeue: async (_c, original) => { assert.equal(original.id, job.id); order.push('requeue'); },
    claim: async (_c, args) => { order.push('claim'); assert.equal(args.targetNewProducts, 400);
      return { claimed: true, attemptId: 'a3', lockToken: 'lock3', job: { ...job, attemptCount: 3, status: 'running' } }; },
    runGrowth: async c => { order.push('growth'); assert.equal(c.maxNewProducts, 300); n += 300;
      return { actualGrowth: 300, accounting: { balanced: true, rawPageHits: 300, categories: { new: 300 } }, errorCount: 0, searchErrors: 0 }; },
    finish: async (_c, input) => { assert.equal(input.jobID, job.id); assert.equal(input.lockToken, 'lock3');
      assert.equal(input.counts.new, 300); return { ...job, status: 'target_reached', newProductsCollected: 400, remainingTarget: 0 }; },
  });
  assert.deepEqual(order, ['source', 'requeue', 'claim', 'growth']);
  assert.equal(result.acceptanceEvidence.confirmedNew, 300);
  assert.equal(result.acceptanceEvidence.remaining, 0);
});
