import assert from 'node:assert/strict';
import test from 'node:test';
import { guideForModelSlug, guideForProviderSlug, isPricingGuideSlug } from './pricing-guides';

test('maps search-opportunity model families to their pricing guides', () => {
  assert.equal(guideForModelSlug('chatglm-4-air'), 'glm-chatglm-api-pricing');
  assert.equal(guideForModelSlug('claude-opus-5'), 'claude-anthropic-pricing');
  assert.equal(guideForModelSlug('grok-4-fast'), 'grok-pricing');
  assert.equal(guideForModelSlug('kimi-k2.5'), 'kimi-api-pricing');
  assert.equal(guideForModelSlug('gpt-5'), null);
});

test('maps relevant providers and validates only known guide slugs', () => {
  assert.equal(guideForProviderSlug('anthropic'), 'claude-anthropic-pricing');
  assert.equal(guideForProviderSlug('moonshot-china'), 'kimi-api-pricing');
  assert.equal(guideForProviderSlug('openai'), null);
  assert.equal(isPricingGuideSlug('grok-pricing'), true);
  assert.equal(isPricingGuideSlug('not-a-guide'), false);
});
