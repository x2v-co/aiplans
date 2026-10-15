import test from 'node:test';
import assert from 'node:assert/strict';
import { planEconomics } from './plan-economics';

test('a quarantined subscription price cannot become a free plan', () => {
  const plan = { slug: 'google-ai-plus', is_contact_sales: false, pack_validity_days: null, price: null, currency: null, price_unit: 'per_month',
    quotas: [{ amount: 1, unit: 'request' as const, period: 'month' as const }] };
  assert.equal(planEconomics(plan).state, 'unresearched');
  assert.equal(planEconomics({ ...plan, price: 0 }).state, 'free');
});
