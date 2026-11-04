import assert from 'node:assert/strict';
import test from 'node:test';
import { X_SUBSCRIPTION_ANNUAL, annualPlanPatch, poolPerDollar } from './x-subscription-annual-2026-11-04';

test('X Subscription annual list prices match official docs', () => {
  assert.deepEqual(X_SUBSCRIPTION_ANNUAL.map((p) => [p.slug, p.monthly, p.annual, p.usageMultiple]), [
    ['x-subscription-plus', 8, 80, 1], ['x-subscription-premium', 30, 300, 4],
    ['x-subscription-super', 100, 1000, 15], ['x-subscription-ultra', 200, 2000, 50],
  ]);
});
test('annual monthly-equivalent derivation', () => {
  assert.deepEqual(X_SUBSCRIPTION_ANNUAL.map((p) => annualPlanPatch(p).price_yearly_monthly), [6.67, 25, 83.33, 166.67]);
});
test('pool per dollar: Ultra highest', () => {
  const m = X_SUBSCRIPTION_ANNUAL.map((p) => poolPerDollar(p, 'monthly'));
  assert.deepEqual(m.map((v) => Math.round(v * 1000) / 1000), [0.125, 0.133, 0.15, 0.25]);
  assert.equal(Math.round(poolPerDollar(X_SUBSCRIPTION_ANNUAL[3], 'annual') * 1000) / 1000, 0.3);
});
