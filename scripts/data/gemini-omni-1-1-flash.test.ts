import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import { parentSlugFor } from '../../src/lib/vertical-model-aliases';

test('gemini-omni-1.1-flash is its own available row, no longer folded into the retired preview', () => {
  const row = catalogForKind('video-model').find(item => item.slug === 'gemini-omni-1-1-flash')!;
  assert.equal(row.status, 'available');
  assert.equal(row.pricePerUnit, 17.5);
  assert.equal(row.billingUnit, 'per_1m_tokens');
  assert.equal(row.pricingUnit, 'per_1m_tokens');
  assert.equal(row.videoTokensPerSecond, 5792);
  assert.equal(row.resolutionTier, '720p');
  assert.deepEqual(row.usageRates, [
    { priceKind: 'input_tokens', unit: 'per_1m_tokens', price: 1.5 },
    { priceKind: 'text_output_tokens', unit: 'per_1m_tokens', price: 9 },
    { priceKind: 'video_output_tokens', unit: 'per_1m_tokens', price: 17.5 },
  ]);
  assert.match(row.pricing, /\$1\.50\/1M input.*\$17\.50\/1M video output.*\$9\.00\/1M text output/);
  assert.equal(row.sourceUrls?.[0].url, 'https://ai.google.dev/gemini-api/docs/pricing');
  assert.notEqual(parentSlugFor('video-model', 'gemini-omni-1-1-flash'), 'gemini-omni-flash');
  assert.equal(row.lastVerified, '2026-11-06');
  assert.equal(row.verifiedAt, '2026-11-06');
  assert.match(row.notes ?? '', /Effective December 3, 2026, all API requests to gemini-omni-1\.1-flash automatically route to gemini-omni-1\.2-flash/);
  assert.match(row.notes ?? '', /Listed 1\.1 prices are unchanged until that date/);
  assert.match(row.descriptionZh ?? '', /2026-12-03 起自动路由到 1\.2/);
  assert.match(row.descriptionZh ?? '', /\$17\.50\/1M/);
});
