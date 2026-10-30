import assert from 'node:assert/strict';
import test from 'node:test';
import { isSupersededPlan } from './plan-lifecycle';

test('only an explicit superseded marker removes a plan from current entitlement audits', () => {
  assert.equal(isSupersededPlan({ notes: 'April row\n[aiplans:superseded-by kimi-2026-10]\nSource: official' }), true);
  assert.equal(isSupersededPlan({ notes: '[aiplans:superseded-by chatgpt-pro-100/200/500]' }), true);
  for (const notes of [null, '', 'superseded?', 'source=manual', '[aiplans:superseded-by]']) assert.equal(isSupersededPlan({ notes }), false);
});
