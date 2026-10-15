import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGooglePlansBody } from './plan-google-gemini-dynamic';

test('US page: Plus/Pro/Ultra prices come from each plan section', () => {
  const result = parseGooglePlansBody('Google AI Pro & Ultra — get access United States Free $0 / month Google AI Plus 1 Get more $4.99 / month Google AI Plus is available Google AI Pro 1 Get higher $19.99 / month Google AI Pro is available Google AI Ultra Starting at: $99.99 / month $99.99 / month: 5x higher $199.99 / month: 20x higher');
  assert.deepEqual(result.plans.map(plan => [plan.planSlug, plan.priceMonthly, plan.currency]), [
    ['google-ai-plus', 4.99, 'USD'], ['gemini-advanced', 19.99, 'USD'], ['google-ai-ultra-5x', 99.99, 'USD'], ['google-ai-ultra-20x', 199.99, 'USD'],
  ]);
  assert.equal(result.errors, undefined);
});

test('Plus/Pro stay unknown without an explicit US page', () => {
  const result = parseGooglePlansBody('Google AI Plus $6.98/month Google AI Pro $28.99/month Google AI Ultra');
  for (const plan of result.plans.slice(0,2)) {
    assert.equal(plan.priceMonthly, null);
    assert.equal(plan.currency, null);
    assert.match(plan.notes ?? '', /needs-verification/);
  }
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
