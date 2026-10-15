import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGooglePlansBody } from './plan-google-gemini-dynamic';

test('US Ultra has two consumer tiers; Plus/Pro stay unknown', () => {
  const result = parseGooglePlansBody('Google AI Plus $6.98/month Google AI Pro $28.99/month Google AI Ultra Starting at: USD 99.99/month USD 99.99/month: 5x USD 199.99/month: 20x');
  assert.deepEqual(result.plans.map(plan => [plan.planSlug, plan.priceMonthly]), [
    ['google-ai-plus', null], ['gemini-advanced', null], ['google-ai-ultra-5x', 99.99], ['google-ai-ultra-20x', 199.99],
  ]);
  for (const plan of result.plans.slice(0,2)) {
    assert.equal(plan.currency, null);
    assert.match(plan.notes ?? '', /needs-verification/);
  }
  assert.ok(result.plans.slice(2).every(plan => plan.currency === 'USD' && plan.region === 'US' && plan.tier !== 'enterprise'));
});

test('regional or bare dollar prices cannot become US Ultra rates', () => {
  for (const body of ['Google AI Ultra SGD 139.99/month: 5x', 'Google AI Ultra $99.99/month: 5x $199.99/month: 20x']) {
    const result = parseGooglePlansBody('Google AI Plus Google AI Pro ' + body);
    assert.equal(result.plans.length, 2);
    assert.ok(result.plans.every(plan => plan.priceMonthly === null));
    assert.ok(result.errors?.length);
  }
});

test('an empty or changed page fails without fabricated rows', () => {
  const result = parseGooglePlansBody('');
  assert.equal(result.success, false);
  assert.deepEqual(result.plans, []);
});
