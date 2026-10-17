import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditExitCode, missingPlanFields } from './audit-plan-policy';

test('creative official_reference / research rows are not unclassified (116 of the 124 warnings)', () => {
  assert.deepEqual(missingPlanFields({ plan_kind: 'creative', pricing_model: 'official_reference', plan_line: null, tier_rank: null, model_selector: null }), []);
  assert.deepEqual(missingPlanFields({ plan_kind: 'creative', pricing_model: 'research', plan_line: 'world-google', tier_rank: null }), []);
  assert.deepEqual(missingPlanFields({ plan_kind: 'creative', pricing_model: 'subscription', plan_line: 'creative-pika', tier_rank: 1 }), []);
});

test('LLM plans still need a selector; subscriptions still need line and rank', () => {
  assert.deepEqual(missingPlanFields({ plan_kind: 'coding', pricing_model: 'subscription', plan_line: 'muse-code', tier_rank: 0 }), ['model_selector']);
  assert.deepEqual(missingPlanFields({ plan_kind: 'creative', pricing_model: 'subscription' }), ['plan_line', 'tier_rank']);
  assert.deepEqual(missingPlanFields({}), ['plan_kind', 'plan_line', 'tier_rank', 'model_selector']);
});

test('exit code: warnings pass by default, --strict keeps exit 2', () => {
  assert.equal(auditExitCode(false, 461, false), 0);
  assert.equal(auditExitCode(false, 461, true), 2);
  assert.equal(auditExitCode(true, 1, false), 1);
  assert.equal(auditExitCode(false, 0, true), 0);
});
