import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGooglePlansBody } from './plan-google-gemini-dynamic';

const body = 'Free Gemini SGD 0/ month with a Google Account Google AI Plus SGD 6.98/ month Google AI Pro SGD 28.98/ month '
  + 'Google AI Ultra1 Starting at: SGD 139.98/ month SGD 139.98/ month: 5x SGD 279.98 / month: 20x '
  + 'Google AI Ultra is available in more than 150 countries Create Learn';

test('parses Ultra without the old footer marker', () => {
  const r = parseGooglePlansBody(body);
  assert.equal(r.success, true);
  assert.deepEqual(r.plans.map((p) => [p.planSlug, p.priceMonthly]),
    [['gemini-free', 0], ['google-ai-plus', 6.98], ['gemini-advanced', 28.98], ['google-ai-ultra', 139.98]]);
});

test('a missing plan price is a warning, not a failure', () => {
  const r = parseGooglePlansBody(body.replace('Starting at: SGD 139.98/ month SGD 139.98/ month: 5x SGD 279.98 / month: 20x', 'Contact us'));
  assert.equal(r.success, true);
  assert.equal(r.plans.length, 3);
  assert.match(r.errors?.[0] ?? '', /Google AI Ultra/);
});
