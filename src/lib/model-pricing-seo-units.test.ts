import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ModelPricingSummary from '../components/model-pricing-summary';
import { buildModelPricingSeo, type PricingChannel } from './model-pricing-seo';
import { pricingSeoUsage, type ModelUsagePriceRow } from './model-usage-prices';
import { normalizePricingUnit, pricingUnitNoun } from './pricing-unit-noun';
import { faqPage, jsonLd } from './seo';

const usageRow = (overrides: Partial<ModelUsagePriceRow> = {}): ModelUsagePriceRow => ({
  id: 1, model_id: 3747, provider_id: 9, plan_id: null, price_kind: 'text_to_speech', unit: 'per_1k_characters',
  price: 0.08, currency: 'USD', is_available: true, constraints_json: null, source_url: 'https://elevenlabs.io/pricing/api',
  last_verified: '2026-11-04', provider_name: 'ElevenLabs', provider_slug: 'elevenlabs', provider_type: 'official',
  plan_name: null, plan_slug: null, ...overrides,
});

function seo(slug: string, name: string, pricingUnit: string | null, rows: ModelUsagePriceRow[], locale: 'en' | 'zh', channels: PricingChannel[] = []) {
  return buildModelPricingSeo({ name, slug }, channels, locale, new Date('2026-11-04T12:00:00Z'),
    { pricingUnit, usage: pricingSeoUsage(channels, rows, slug) });
}

test('pricing units normalize per_ prefixes, spaces and plurals', () => {
  assert.equal(normalizePricingUnit('per_1k_characters'), '1k_characters');
  assert.equal(normalizePricingUnit('1K characters'), '1k_characters');
  assert.equal(normalizePricingUnit('second'), 'second');
  assert.equal(normalizePricingUnit('per_second'), 'second');
  assert.equal(normalizePricingUnit('unknown'), null);
  assert.equal(normalizePricingUnit('subscription_only'), null);
  assert.equal(pricingUnitNoun('per_1m_tokens')?.isToken, true);
  assert.equal(pricingUnitNoun('per_generation')?.zh, '次生成');
  assert.equal(pricingUnitNoun('per_image')?.en, 'image');
});

test('eleven-v4 title, meta, FAQ and JSON-LD say 1K characters, not 1M tokens (en + zh)', () => {
  const rows = [usageRow()];
  const en = seo('eleven-v4', 'Eleven v4', 'per_1k_characters', rows, 'en');
  const zh = seo('eleven-v4', 'Eleven v4', 'per_1k_characters', rows, 'zh');
  assert.equal(en.mode, 'usage');
  assert.equal(en.title, 'Eleven v4 API Pricing / Price per 1K characters');
  assert.equal(zh.title, 'Eleven v4 价格与 API 费用（每千字符）');
  assert.match(en.description, /1K characters/);
  assert.match(zh.description, /千字符/);
  assert.doesNotMatch(en.description + zh.description, /USD 0\.08|最低报价|lowest listed|official rate USD/);
  for (const content of [en, zh]) {
    const text = [content.title, content.description, content.costAnswer, ...content.faqs.flatMap(f => [f.question, f.answer])].join('\n');
    assert.doesNotMatch(text, /1M tokens|百万 tokens|cache|缓存|input price|输入价格/i);
    assert.match(content.updateText, /2026-11-04/);
    const offer = content.aggregateOffer!;
    assert.equal(offer.lowPrice, '0.08');
    assert.equal(offer.priceSpecification.unitText, 'per 1K characters');
    assert.ok(offer.offers.every(row => row.priceSpecification.unitText === 'per 1K characters'));
    const parsed = JSON.parse(jsonLd({ '@type': 'Service', offers: offer }));
    assert.equal(parsed.offers.offers[0].seller.name, 'ElevenLabs');
    assert.equal(JSON.parse(faqPage(content.faqs)).mainEntity.length, content.faqs.length);
  }
  const html = renderToStaticMarkup(createElement(ModelPricingSummary, { pricing: en, locale: 'en', now: new Date(), officialUsagePrices: rows }));
  assert.match(html, /API pricing at a glance \(per 1K characters\)/);
  assert.doesNotMatch(html, /Input \/ 1M|per 1M tokens/);
  const zhHtml = renderToStaticMarkup(createElement(ModelPricingSummary, { pricing: zh, locale: 'zh', now: new Date(), officialUsagePrices: rows }));
  assert.match(zhHtml, /按千字符计费/);
  assert.doesNotMatch(zhHtml, /输入 \/ 1M|每百万 tokens/);
});

test('per_second, per_minute, per_image and per_generation pages state their own unit', () => {
  const cases: Array<[string, string, ModelUsagePriceRow[], RegExp, RegExp, string]> = [
    ['grok-imagine-video', 'per_second', [usageRow({ price_kind: '720p video', unit: 'second', price: 0.05 }),
      usageRow({ id: 2, price_kind: '1080p video', unit: 'second', price: 0.1 })],
    /Price per second/, /按秒计费/, 'per second'],
    ['gemini-3.5-transcribe-live', 'per_minute', [usageRow({ price_kind: 'live transcription', unit: 'minute', price: 0.009 })],
      /Price per minute/, /按分钟计费/, 'per minute'],
    ['some-image-model', 'per_image', [usageRow({ price_kind: 'image_generation', unit: 'image', price: 0.04 })],
      /Price per image/, /按张图片计费/, 'per image'],
    ['mureka-v8', 'per_generation', [usageRow({ price_kind: 'song', unit: 'per_generation', price: 0.03 })],
      /Price per generation/, /按次生成计费/, 'per generation'],
  ];
  for (const [slug, unit, rows, enTitle, zhDesc, unitText] of cases) {
    const en = seo(slug, slug, unit, rows, 'en');
    const zh = seo(slug, slug, unit, rows, 'zh');
    assert.match(en.title, enTitle, slug);
    assert.doesNotMatch(en.title + en.description, /1M tokens/, slug);
    assert.match(zh.description, zhDesc, slug);
    assert.doesNotMatch(zh.description + en.description, /USD |最低/, slug);
    assert.equal(en.aggregateOffer?.priceSpecification.unitText, unitText, slug);
  }
});

test('non-token model without any price still names its unit; token pages are unchanged', () => {
  const en = seo('eleven-v4', 'Eleven v4', 'per_1k_characters', [], 'en');
  assert.equal(en.title, 'Eleven v4 API Pricing / Price per 1K characters');
  assert.equal(en.aggregateOffer, undefined);
  assert.match(en.description, /1K characters/);
  assert.match(en.description, /No price is currently recorded/);
  const unknown = seo('mystery', 'Mystery', 'unknown', [], 'en');
  assert.match(unknown.title, /Price per 1M tokens/);
  assert.equal(unknown.mode, 'token');
  const channel: PricingChannel = { id: 1, input_price_per_1m: 2, output_price_per_1m: 10, cached_input_price_per_1m: null,
    currency: 'USD', updated_at: '2026-10-12', last_verified: '2026-10-13', providers: { name: 'Official', type: 'producer' } };
  const token = seo('glm-5.3-flash', 'GLM 5.3 Flash', 'per_1m_tokens', [usageRow()], 'en', [channel]);
  assert.equal(token.mode, 'token');
  assert.match(token.title, /Price per 1M tokens/);
  assert.equal(token.aggregateOffer?.priceSpecification.unitText, 'per 1M input tokens');
});

test('token-unit usage rows (Gemini TTS) stay per 1M tokens and only compare one price kind', () => {
  const rows = [usageRow({ price_kind: 'text input', unit: 'per_1m_tokens', price: 0.5 }),
    usageRow({ id: 2, price_kind: 'audio output', unit: 'per_1m_tokens', price: 10 })];
  const en = seo('gemini-3.8-flash-tts', 'Gemini 3.8 Flash TTS', 'per_1m_tokens', rows, 'en');
  assert.match(en.title, /Price per 1M tokens/);
  assert.equal(en.aggregateOffer?.offerCount, 1);
  assert.equal(en.aggregateOffer?.highPrice, '0.5');
});
