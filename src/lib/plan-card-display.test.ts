import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanPlanDisplayText, planCardCopy, uniquePlanSentences } from './plan-card-display';

test('strips machine markers anywhere, detects unverified and preserves ordinary brackets', () => {
  assert.deepEqual(cleanPlanDisplayText('  Pro [NEEDS-VERIFICATION]\n [aiplans:review-source] [internal-only]  [100K context] '), {
    text: 'Pro [100K context]', unverified: true,
  });
  assert.deepEqual(cleanPlanDisplayText('Quota [unverified]'), { text: 'Quota', unverified: true });
  assert.deepEqual(cleanPlanDisplayText('Reviewed [aiplans:review-source]'), { text: 'Reviewed', unverified: false });
  for (const value of [null, undefined, {}, 12]) {
    assert.deepEqual(cleanPlanDisplayText(value), { text: '', unverified: false });
  }
});

test('deduplicates sentences across whitespace, casing, Chinese and repeated paragraphs', () => {
  assert.deepEqual(uniquePlanSentences([
    'Priority  support. More quota.', 'priority\n', 'PRIORITY support.',
    '更多额度。更多额度。', 'Source: https://example.com/a-very-long-source-url',
    'More quota.', 'Context [100K context]', null,
  ]), ['Priority support.', 'More quota.', 'priority', '更多额度。', 'Context [100K context]']);
  assert.deepEqual(uniquePlanSentences(['  HIGHER\n  quota. Extra tools.'], ['Higher quota']), ['Extra tools.']);
  assert.deepEqual(uniquePlanSentences(['Model 6.1 costs $0.50. Model 6.1 costs $0.50.']), ['Model 6.1 costs $0.50.']);
});

test('limits highlights to four and removes feature/source duplicates from details without mutating data', () => {
  const input = {
    name: 'Pro', features: ['Priority support.', 'More quota.', 'Tools', 'Team access', 'Fifth feature'],
    sourceLabel: 'Vendor pricing',
    conditions: [' priority SUPPORT. More quota.', 'Source: Vendor pricing', 'Extra condition. Extra condition.'],
    notes: '[needs-verification] More quota.\nSource: https://example.com/pricing\n[aiplans:review-source] https://example.com/pricing',
  };
  const before = structuredClone(input);
  assert.deepEqual(planCardCopy(input), {
    name: 'Pro', points: ['Priority support.', 'More quota.', 'Tools', 'Team access'],
    details: ['Fifth feature', 'Extra condition.'], unverified: true,
  });
  assert.deepEqual(input, before);
});

test('handles malformed features and a verification marker in a hidden feature or condition', () => {
  for (const features of [null, {}, 'not an array', [12, null, {}]]) {
    assert.deepEqual(planCardCopy({ name: 'Plan', features }).points, []);
  }
  assert.equal(planCardCopy({ name: 'Plan', features: ['[needs-verification]'] }).unverified, true);
  assert.equal(planCardCopy({ name: 'Plan', features: [], conditions: ['[needs-verification]'] }).unverified, true);
});
