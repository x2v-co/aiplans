import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { catalogForKind, type AiCatalogItem } from './ai-vertical-catalog';
import { catalogBillingUnit } from './catalog-billing-unit';
import { worldModelPrice } from './world-model-pricing';
import { WorldModelCatalog } from '../components/world-model-catalog';
import { auditedPrice } from '../components/audited-catalog';

const world = catalogForKind('world-model').find(item => item.slug === 'tencent-hy-world-2-1')!;

test('HY-World list renders $1.60 per million tokens in both locales', () => {
  assert.equal(world.billingUnit, 'per_1m_tokens');
  for (const locale of ['en', 'zh']) {
    const price = locale === 'zh' ? 'US$1.60 / 百万 tokens' : '$1.60 / 1M tokens';
    assert.equal(worldModelPrice(world, locale), price);
    const html = renderToStaticMarkup(createElement(WorldModelCatalog, { items: [{ ...world, providerLogoUrl: '/fixture.svg' }], locale }));
    assert.ok(html.includes(price));
    assert.doesNotMatch(html, /\$1\.60 \/ token(?:<|$)/);
  }
});

test('explicit million-token denominators survive legacy billing families across verticals', () => {
  for (const kind of ['world-model', 'video-model', 'image-model', 'voice-model', 'music-model'] as const) {
    for (const pricingUnit of ['per_1m_tokens', 'per 1M tokens']) {
      const item: AiCatalogItem = { ...world, kind, billingUnit: 'per_token', pricingUnit };
      assert.equal(catalogBillingUnit(item), 'per_1m_tokens');
      assert.match(auditedPrice(item, 'en'), /\/ 1M (?:video output )?tokens/);
      assert.match(auditedPrice(item, 'zh'), /\/ 百万(?:视频输出 )?tokens|\/ 百万 tokens/);
      assert.equal(worldModelPrice(item, 'en'), '$1.60 / 1M tokens');
    }
  }
  const token = { ...world, unit: 'token', pricingUnit: 'per_token', billingUnit: 'per_token' as const };
  assert.equal(worldModelPrice(token, 'en'), '$1.60 / token');
  assert.equal(catalogBillingUnit({ ...world, billingUnit: 'per_second' }), 'per_second');
});
