import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import { parentSlugFor } from '../../src/lib/vertical-model-aliases';

test('gemini-omni-1.1-flash is its own available row, no longer folded into the retired preview', () => {
  const row = catalogForKind('video-model').find(item => item.slug === 'gemini-omni-1-1-flash')!;
  assert.equal(row.status, 'available');
  assert.equal(row.pricePerUnit, 17.5);
  assert.equal(row.billingUnit, 'per_token');
  assert.match(row.pricing, /\$1\.50\/1M input.*\$17\.50\/1M video output.*\$9\.00\/1M text output/);
  assert.equal(row.sourceUrls?.[0].url, 'https://ai.google.dev/gemini-api/docs/pricing');
  assert.notEqual(parentSlugFor('video-model', 'gemini-omni-1-1-flash'), 'gemini-omni-flash');
});
