import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromoPriceNotice } from './promo-price-notice';
import { planPromoSync, type PromoChannel } from '../../scripts/utils/promo-sync';

const source: PromoChannel = { id: 1, model_id: 1, model_slug: 'gemini-4-argon', provider_slug: 'google',
  provider_type: 'producer', currency: 'USD', price_unit: 'per_1m_tokens', input_price_per_1m: 2, output_price_per_1m: 10,
  promo_ends_at: '2026-12-01T08:00:00Z', regular_input_price_per_1m: 4, regular_output_price_per_1m: 20, notes: null };

test('OpenRouter and Vertex rows render inherited expiry and future prices in both locales', () => {
  for (const [provider_slug, provider_type] of [['openrouter', 'aggregator'], ['google-vertex', 'cloud']]) {
    const target = { ...source, id: 2, provider_slug, provider_type, promo_ends_at: null };
    const [change] = planPromoSync([source, target]);
    const row = { ...target, ...change.values };
    for (const locale of ['en', 'zh']) {
      const html = renderToStaticMarkup(createElement(PromoPriceNotice, { row, locale, now: new Date('2026-10-15') }));
      assert.match(html, locale === 'en' ? /Nov 30, 2026/ : /2026-11-30/);
      assert.match(html, /\$4/);
      assert.match(html, /\$20/);
      assert.equal(renderToStaticMarkup(createElement(PromoPriceNotice, { row, locale, now: new Date('2026-12-01T08:00:00Z') })), '');
    }
  }
});
