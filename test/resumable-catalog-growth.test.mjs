import test from 'node:test';
import assert from 'node:assert/strict';
import { runResumableCatalogGrowth, MAX_DISCOVERY_SEGMENTS } from '../src/resumable-catalog-growth.mjs';
const logger = { info() {} };
const config = { maxNewProducts: 400, growthMaxRuntimeMs: 10000, growthMaxTotalPages: 800 };
const result = (n, page, reason = 'page_safety_limit') => ({ actualGrowth: n, stopReason: reason,
  sourceExhausted: false, resumeCheckpoint: { term: 'rijst', page, exhaustedTerms: [] } });

test('page segments preserve the 800 budget and consume only the remaining confirmed daily target', async () => {
  const remaining = [];
  const r = await runResumableCatalogGrowth(config, logger, async c => {
    remaining.push(c.maxNewProducts); assert.equal(c.growthMaxTotalPages, 800);
    return result(Math.min(150, c.maxNewProducts), remaining.length * 800);
  });
  assert.deepEqual(remaining, [400, 250, 100]);
  assert.equal(r.actualGrowth, 400); assert.equal(r.targetReached, true);
  assert.equal(r.stopReason, 'growth_target_reached'); assert.equal(r.segments.length, 3);
});

test('candidate safety resumes but hard segment cap keeps even an endless source bounded', async () => {
  let calls = 0;
  const r = await runResumableCatalogGrowth(config, logger, async () => result(0, ++calls, 'candidate_safety_limit'));
  assert.equal(calls, MAX_DISCOVERY_SEGMENTS);
  assert.equal(r.actualGrowth, 0); assert.equal(r.sourceExhausted, false);
  assert.equal(r.stopReason, 'attempt_safety_limit');
});

test('a non-advancing checkpoint stops without a loop or false exhaustion', async () => {
  let calls = 0;
  const r = await runResumableCatalogGrowth(config, logger, async () => { calls++; return result(0, 800); });
  assert.equal(calls, 2); assert.equal(r.stopReason, 'discovery_resume_stalled');
  assert.equal(r.sourceExhausted, false);
});

test('overall runtime is shared by all segments, not reset per segment', async () => {
  let clock = 0; const budgets = [];
  const r = await runResumableCatalogGrowth({ ...config, growthMaxRuntimeMs: 10 }, logger, async c => {
    budgets.push(c.growthMaxRuntimeMs); clock += 6; return result(1, clock);
  }, { now: () => clock });
  assert.deepEqual(budgets, [10, 4]); assert.equal(r.actualGrowth, 2);
  assert.equal(r.stopReason, 'runtime_safety_limit');
});

test('only proven exhaustion is terminal below the target; stalled source remains explicit', async () => {
  for (const stopReason of ['discovery_exhausted','discovery_incomplete_stalled_terms','runtime_safety_limit']) {
    let calls = 0;
    const r = await runResumableCatalogGrowth(config, logger, async () => {
      calls++; return { ...result(7, 0, stopReason), sourceExhausted: stopReason === 'discovery_exhausted' };
    });
    assert.equal(calls, 1); assert.equal(r.actualGrowth, 7);
    assert.equal(r.sourceExhausted, stopReason === 'discovery_exhausted');
  }
});

test('a later segment failure retains earlier confirmed insert accounting', async () => {
  let calls = 0;
  await assert.rejects(runResumableCatalogGrowth(config, logger, async () => {
    if (++calls === 1) return result(40, 800);
    throw Object.assign(new Error('fixture'), { actualGrowth: 3, code: 'source_unavailable' });
  }), e => e.actualGrowth === 43 && e.code === 'source_unavailable');
});
