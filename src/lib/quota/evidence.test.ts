import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceLink, groupQuotaEvidence, loadQuotaEvidence, type EvidenceRow } from './evidence';

test('read-only listing tolerates missing manual migrations, including wrapped Drizzle errors', async () => {
  for (const error of [{ code: '42P01' }, { code: '42703' }, { cause: { code: '42P01' } }]) {
    assert.deepEqual(await loadQuotaEvidence(async () => { throw error; }), []);
  }
  await assert.rejects(loadQuotaEvidence(async () => { throw new Error('connection unavailable'); }), /connection unavailable/);
});

test('evidence groups by plan, retaining unassigned and all review statuses', async () => {
  const base: EvidenceRow = { id: 1, planSlug: 'synthetic', sourceName: 'self', authorHandle: null, observedAt: null, capturedAt: '2026-10-15', url: null, screenshotUrl: null, confidence: 'low', reviewStatus: 'pending', rawValue: null, notes: null };
  const rows = [base, { ...base, id: 2, reviewStatus: 'accepted' }, { ...base, id: 3, planSlug: null, reviewStatus: 'rejected' }];
  const groups = groupQuotaEvidence(await loadQuotaEvidence(async () => rows));
  assert.deepEqual(groups.get('synthetic')?.map((r) => r.id), [1, 2]);
  assert.deepEqual(groups.get(null)?.map((r) => r.id), [3]);
});

test('listing only links to HTTP(S) sources and screenshots, including legacy records', () => {
  assert.equal(evidenceLink('https://example.com/evidence'), 'https://example.com/evidence');
  for (const link of [null, '', 'not a URL', 'javascript:alert(1)', 'data:text/html,test', 'file:///tmp/source']) assert.equal(evidenceLink(link), undefined);
});
