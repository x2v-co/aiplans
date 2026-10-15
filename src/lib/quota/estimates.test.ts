import assert from 'node:assert/strict';
import test from 'node:test';
import { currentPlanEstimates, evidenceUrl, quotaChanges, readVerifiedQuotaEstimates, tokenRange, verifiedEstimate } from './estimates';
import { estimate, estimateRow } from './__fixtures__/estimates';

test('missing quota tables, unavailable queries and empty tables gracefully return no estimates', async () => {
  for (const table of ['quota_estimates', 'usage_mixes', 'quota_evidence']) {
    const rows = await readVerifiedQuotaEstimates(async () => {
      throw Object.assign(new Error(`relation "${table}" does not exist`), { code: '42P01' });
    });
    assert.deepEqual(rows, []);
  }
  assert.deepEqual(await readVerifiedQuotaEstimates(async () => { throw new Error('Connection unavailable'); }), []);
  assert.deepEqual(await readVerifiedQuotaEstimates(async () => []), []);
});

test('only reviewed, valid ranges and workload mixes reach the display', async () => {
  const invalid = [
    { verified_at: null }, { verified_at: 'invalid' }, { created_at: 'invalid' },
    { confidence: 'unverified' }, { window: 'hourly' }, { est_tokens_low: '-1' },
    { est_tokens_low: '3000000' }, { est_tokens_high: '9007199254740993' },
    { est_tokens_high: 'NaN' }, { est_tokens_low: '0.5' },
    { input_pct: '80' }, { input_pct: 'NaN' }, { cache_read_pct: '-1', input_pct: '76' },
  ];
  for (const overrides of invalid) assert.equal(verifiedEstimate(estimateRow(overrides)), null);
  const rows = await readVerifiedQuotaEstimates(async () => [estimateRow({ verified_at: null }), estimateRow()]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].confidence, 'medium');
  assert.equal(rows[0].verifiedAt, '2026-10-01T08:00:00.000Z');
  assert.equal(estimate({ served_model: '', plan_name: null }).planName, 'example-pro');
  assert.equal(estimate({ served_model: '' }).servedModel, null);
});

test('engine rounds display endpoints, labels magnitudes and converts only weekly/monthly estimates', () => {
  const weekly = estimate();
  assert.equal(tokenRange(weekly, 'en'), '1,200,000–2,300,000 tokens (~1M)');
  assert.equal(tokenRange(weekly, 'en', true), '4,900,000–9,400,000 tokens (~10M)');
  assert.equal(weekly.low, 1234567); // Display must not mutate the stored interval.
  assert.equal(tokenRange(estimate({ window: 'monthly' }), 'zh', true), '1,200,000–2,300,000 tokens (~1M)');
  for (const window of ['daily', '5h']) assert.equal(tokenRange(estimate({ window }), 'en', true), null);
  assert.equal(tokenRange(estimate({ est_tokens_low: '0', est_tokens_high: '0' }), 'en', true), '0 tokens (~0)');
  assert.equal(tokenRange(estimate({ est_tokens_low: '1', est_tokens_high: '9007199254740991' }), 'en', true), null);
});

test('plan cards isolate current estimates from historical and unrelated plan rows', () => {
  const current = estimate({ id: 2 });
  const previous = estimate({ id: 1, is_current: false, superseded_by: 2 });
  assert.deepEqual(currentPlanEstimates([previous, current, estimate({ id: 3, plan_slug: 'other' })], 'example-pro'), [current]);
});

test('history retains intermediate versions, corrections, increases and decreases, newest first', () => {
  const first = estimate({ id: 1, is_current: false, superseded_by: 2 });
  const second = estimate({ id: 2, created_at: '2026-10-02', is_current: false, superseded_by: 3, est_tokens_high: '3456789' });
  const third = estimate({ id: 3, created_at: '2026-10-03', est_tokens_high: '2000000' });
  const unchanged = estimate({ id: 4, created_at: '2026-10-04', is_current: false, superseded_by: 5 });
  const correction = estimate({ id: 5, created_at: '2026-10-05', notes: 'Corrected evidence only' });
  assert.deepEqual(quotaChanges([second, third, correction, first, unchanged]).map(change => [change.previous.id, change.next.id]), [[4, 5], [2, 3], [1, 2]]);
});

test('history rejects missing/unreviewed successors, mismatched identities and cycles', async () => {
  const previous = estimate({ is_current: false, superseded_by: 2 });
  assert.deepEqual(quotaChanges([previous]), []);
  for (const mismatch of [{ plan_slug: 'other' }, { served_model: 'other' }, { window: 'monthly' }, { usage_mix_id: 'other' }]) {
    assert.deepEqual(quotaChanges([previous, estimate({ id: 2, ...mismatch })]), []);
  }
  const rows = await readVerifiedQuotaEstimates(async () => [estimateRow({ is_current: false, superseded_by: 2 }), estimateRow({ id: 2, verified_at: null })]);
  assert.deepEqual(quotaChanges(rows), []);
  assert.deepEqual(quotaChanges([previous, estimate({ id: 2, is_current: false, superseded_by: 1 })]), []);
  assert.deepEqual(quotaChanges([estimate({ is_current: false, superseded_by: 1 })]), []);
});

test('evidence is version-specific and only safe public HTTP(S) source/screenshot URLs are linked', () => {
  for (const value of [null, '', 'javascript:alert(1)', 'data:text/html,test', '/relative', 'https://name:secret@example.com/']) assert.equal(evidenceUrl(value), null);
  assert.equal(evidenceUrl('https://example.com/evidence'), 'https://example.com/evidence');
  const old = estimate();
  const next = estimate({ id: 2, evidence: [{ id: 8, url: 'javascript:alert(1)', screenshot_url: 'https://example.com/new.png', captured_at: '2026-10-02', evidence_type: 'official_absolute' }] });
  assert.equal(old.evidence.length, 2);
  assert.deepEqual(next.evidence.map(evidence => evidence.url), ['https://example.com/new.png']);
});
