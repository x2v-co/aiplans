import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ModelPricingSummary from './model-pricing-summary';
import { buildModelPricingSeo, type PricingChannel } from '@/lib/model-pricing-seo';
import { pricingSeoUsage, type ModelUsagePriceRow } from '@/lib/model-usage-prices';

const now = new Date('2026-11-30T00:00:00Z');
const cutoff = new Date('2026-12-01T08:00:00Z');
const model = { name: 'GPT 6 Astra', slug: 'openai-gpt-6-astra' };
const channel: PricingChannel = {
  id: 1, input_price_per_1m: 2, output_price_per_1m: 10, cached_input_price_per_1m: 0.1,
  regular_input_price_per_1m: 4, regular_output_price_per_1m: 20, regular_cached_input_price_per_1m: 0.2,
  promo_ends_at: cutoff.toISOString(), currency: 'USD', price_unit: 'per_1m_tokens', last_verified: '2026-11-17',
  providers: { name: 'OpenAI', type: 'producer', website: 'https://example.com/pricing' },
};
const usage: ModelUsagePriceRow = {
  id: 1, model_id: 2, provider_id: 3, plan_id: null, price_kind: 'text_to_speech', unit: 'per_1k_characters',
  price: 0.08, currency: 'USD', is_available: true, constraints_json: null,
  source_url: 'https://example.com/tts', last_verified: '2026-11-17',
  provider_name: 'Official TTS', provider_slug: 'fixture-tts', provider_type: 'official', plan_name: null, plan_slug: null,
};

function render(locale: 'en' | 'zh', mode: 'token' | 'usage', rows: PricingChannel[] = [channel], prices: ModelUsagePriceRow[] = [], at = now) {
  const pricing = buildModelPricingSeo(model, rows, locale, at, mode === 'usage'
    ? { pricingUnit: 'per_1k_characters', usage: pricingSeoUsage(rows, prices, model.slug) } : {});
  return renderToStaticMarkup(createElement('main', { className: 'min-w-0 [overflow-wrap:anywhere]' },
    createElement(ModelPricingSummary, { pricing, locale, now: at, officialUsagePrices: prices })));
}

function assertLocalTable(html: string, mode: 'token' | 'usage') {
  // Structural/CSS contract for the observed GUI defect, not a pixel/scroll measurement.
  assert.match(html, /<section class="[^"]*min-w-0 max-w-full/);
  assert.match(html, /<div class="min-w-0 w-full max-w-full overflow-x-auto"><table/);
  const classes = html.match(/<table class="([^"]+)"/)![1];
  assert.ok(classes.includes(mode === 'token' ? 'min-w-[52rem]' : 'min-w-[36rem]'), classes);
  assert.ok(classes.includes('[overflow-wrap:normal]'), 'table must override inherited anywhere wrapping');
  assert.doesNotMatch(classes, /table-fixed|break-all|overflow-hidden/);
  const headers = [...html.matchAll(/<th[^>]*scope="col"[^>]*class="([^"]*)"/g)];
  assert.equal(headers.length, mode === 'token' ? 5 : 3);
  headers.forEach((header, i) => {
    assert.ok(header[1].includes('whitespace-nowrap'), `header ${i} must retain whole words`);
    assert.ok(header[1].includes(i === 0 ? 'min-w-64' : i === headers.length - 1 ? 'min-w-48' : 'min-w-32'));
  });
  assert.match(html, /<caption class="sr-only">[^<]+<\/caption>/);
  assert.doesNotMatch(html, /<script|overflow-x-hidden|text-overflow|truncate/);
}

test('token summary overrides inherited anywhere wrapping and keeps readable columns inside a local scroll frame in both locales', () => {
  for (const locale of ['en', 'zh'] as const) {
    const html = render(locale, 'token');
    assertLocalTable(html, 'token');
    assert.match(html, locale === 'en' ? />Cache read \/ 1M<\/th>/ : />缓存读取 \/ 1M<\/th>/);
    assert.match(html, /<th scope="row" class="[^"]*min-w-64/);
    assert.match(html, /aria-label="(?:Visit OpenAI website|访问 OpenAI 官网)"/);
    assert.match(html, /href="https:\/\/example.com\/pricing"/);
    for (const value of ['USD 2', 'USD 10', 'USD 0.1', '2026-11-17']) assert.ok(html.includes(value));
    assert.match(html, /data-limited-time-offer="active"/);
    assert.match(html, locale === 'en' ? /Limited-time offer/ : /限时优惠/);
    assert.match(html, /<s>[^<]+\$4<\/s>/);
  }
});

test('usage summary keeps its unit, three semantic columns and official usage source without token headers', () => {
  for (const locale of ['en', 'zh'] as const) {
    const html = render(locale, 'usage', [], [usage]);
    assertLocalTable(html, 'usage');
    assert.match(html, /<th scope="row"[^>]*>(?:Official|官方)<\/th><td colSpan="2"/);
    assert.match(html, locale === 'en' ? /per 1K characters/ : /按千字符计费/);
    assert.match(html, /USD 0.08/);
    assert.match(html, /href="https:\/\/example.com\/tts"/);
    assert.doesNotMatch(html, /Cache read \/ 1M|Input \/ 1M|缓存读取 \/ 1M|输入 \/ 1M/);
  }
});

test('empty token and usage fallbacks retain captions, row headers and correct column spans', () => {
  for (const locale of ['en', 'zh'] as const) for (const mode of ['token', 'usage'] as const) {
    const html = render(locale, mode, []);
    assertLocalTable(html, mode);
    assert.match(html, new RegExp(`colSpan="${mode === 'token' ? 4 : 2}"`));
    assert.match(html, new RegExp(`colSpan="${mode === 'token' ? 5 : 3}"`));
    assert.match(html, locale === 'en' ? /No official quote recorded/ : /暂无官方报价/);
    assert.match(html, locale === 'en' ? /No channel quotes available/ : /暂无可用渠道报价/);
  }
});

test('long channel names and promotion content remain in SSR, with strict render-time expiry and no source price mutation', () => {
  const original = structuredClone(channel);
  const long = { ...channel, providers: { ...channel.providers!, name: `International Channel ${'LongIdentifier'.repeat(20)}` } };
  const pricing = buildModelPricingSeo(model, [long], 'en', now);
  const live = renderToStaticMarkup(createElement(ModelPricingSummary, { pricing, locale: 'en', now }));
  assertLocalTable(live, 'token');
  assert.ok(live.includes(long.providers.name));
  assert.match(live, /Limited-time offer/);
  const ended = render('en', 'token', [channel], [], cutoff);
  assertLocalTable(ended, 'token');
  assert.doesNotMatch(ended, /data-limited-time-offer="active"/);
  assert.match(ended, /USD 4/);
  assert.match(ended, /USD 20/);
  assert.deepEqual(channel, original);
});
