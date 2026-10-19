import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ModelPricingSummary from '../components/model-pricing-summary';
import { modelAliases } from './model-aliases';
import { buildModelPricingSeo, pricingDate, pricingLabel, type PricingChannel } from './model-pricing-seo';
import { faqPage, jsonLd } from './seo';
import { argonChannelRow, ARGON_PROMO_ENDS_AT } from '../../scripts/data/gemini-4-argon';

const model = { name: 'GLM 5.3 Flash', slug: 'glm-5.3-flash', updated_at: '2026-09-01' };
const quote = (overrides: Partial<PricingChannel> = {}): PricingChannel => ({
  id: 1, input_price_per_1m: 2, output_price_per_1m: 10, cached_input_price_per_1m: null,
  currency: 'USD', updated_at: '2026-10-12', last_verified: '2026-10-13',
  providers: { name: 'Official', type: 'producer' }, ...overrides,
});

test('aliases match query spellings while preserving version and suffix identities', () => {
  for (const alias of ['glm-5.3-flash', 'glm5.3-flash', 'glm5.3 flash', 'glm5.3flash']) {
    assert.ok(modelAliases(model.name, model.slug).includes(alias), alias);
  }
  const gpt = modelAliases('GPT 6.1 Sol', 'openai-gpt-6-1-sol');
  for (const alias of ['gpt-6.1-sol', 'gpt6.1 sol', 'gpt6.1sol']) assert.ok(gpt.includes(alias), alias);
  assert.ok(!gpt.includes('gpt6'));
  assert.ok(modelAliases('GPT 6', 'gpt-6').includes('gpt6'));
  assert.ok(modelAliases('Claude Sonnet 5.5', 'anthropic-claude-sonnet-5-5').includes('sonnet5.5'));
  assert.ok(modelAliases('Claude Opus 5.5', 'claude-opus-5.5').includes('opus5.5'));
  assert.ok(modelAliases('DeepSeek V4 Flash', 'deepseek-v4-flash').includes('deepseekv4 flash'));
  assert.ok(modelAliases('Kimi K3', 'kimi-k3').includes('kimik3'));
});

test('currency ranking retains native prices in snippets, table rows and single-currency offers', () => {
  const rows = [quote(), quote({ id: 2, currency: 'CNY', input_price_per_1m: 6, cached_input_price_per_1m: 0,
    providers: { name: 'Router', type: 'aggregator' } }), quote({ id: 3, input_price_per_1m: 4 })];
  const en = buildModelPricingSeo(model, rows, 'en');
  const zh = buildModelPricingSeo(model, rows, 'zh');
  assert.equal(en.cheapest?.id, 2);
  assert.equal(en.tableChannels.length, 3);
  assert.match(en.description, /CNY 6 per 1M tokens/);
  assert.match(zh.description, /CNY 6\/百万 tokens/);
  assert.match(en.title, /API Pricing \/ Price per 1M tokens/);
  assert.equal(zh.title, 'GLM 5.3 Flash 价格');
  assert.equal(buildModelPricingSeo({ name: 'DeepSeek V4.1 Flash', slug: 'deepseek-v4.1-flash' }, [], 'zh').title,
    'DeepSeek V4.1 Flash 价格');
  for (const content of [en, zh]) {
    assert.match(content.description, /2026-10-13/);
    assert.equal(content.faqs.length, 4);
    assert.match(content.faqs[2].answer, /CNY 0/);
    const offer = content.aggregateOffer!;
    assert.equal(offer.priceCurrency, 'USD');
    assert.equal(offer.lowPrice, '2');
    assert.equal(offer.highPrice, '4');
    assert.ok(offer.offers.every(row => row.priceCurrency === 'USD'));
    assert.equal(JSON.parse(faqPage(content.faqs)).mainEntity.length, 4);
    assert.equal(JSON.parse(jsonLd({ '@type': 'Service', alternateName: content.aliases, offers: offer })).offers.lowPrice, '2');
  }
});

test('invalid, missing, unavailable and non-token rates cannot become offers or cheapest prices', () => {
  const rows = [quote({ input_price_per_1m: null, output_price_per_1m: null }),
    quote({ input_price_per_1m: NaN }), quote({ input_price_per_1m: Infinity }),
    quote({ input_price_per_1m: -1 }), quote({ is_available: false }),
    quote({ price_unit: 'per_request' }), quote({ currency: 'INVALID' })];
  const result = buildModelPricingSeo(model, rows, 'en');
  assert.equal(result.cheapest, undefined);
  assert.equal(result.aggregateOffer, undefined);
  assert.match(result.faqs[2].answer, /missing prices do not imply free/);
  assert.match(result.description, /No input price available/);
  const empty = buildModelPricingSeo({ name: 'Unknown', slug: 'unknown' }, [], 'zh');
  assert.equal(empty.updatedOn, null);
  assert.match(empty.description, /暂无记录/);
  assert.equal(pricingLabel(null, 'USD'), '—');
  assert.equal(pricingLabel(0.000001, 'USD'), 'USD 0.000001');
  const free = buildModelPricingSeo(model, [quote({ input_price_per_1m: 0 })], 'en');
  assert.equal(free.aggregateOffer?.lowPrice, '0');
});

test('updated dates use persisted timestamps, tolerate invalid dates and never claim the render date', () => {
  assert.equal(pricingDate({ last_verified: 'invalid', updated_at: '2026-10-13T23:30:00-07:00' }), '2026-10-14');
  assert.equal(pricingDate({}), null);
  assert.equal(buildModelPricingSeo(model, [], 'en', new Date('2030-01-01')).updatedOn, '2026-09-01');
});

test('Argon uses the #104 schedule for table, snippet, offers and FAQs at and after the cutoff', () => {
  const raw = { ...argonChannelRow(1, 2, new Date('2026-10-14')), providers: { name: 'Google', type: 'producer' } };
  const argon = { name: 'Gemini 4 Argon', slug: 'gemini-4-argon' };
  const cutoff = new Date(ARGON_PROMO_ENDS_AT);
  for (const locale of ['en', 'zh'] as const) {
    const before = buildModelPricingSeo(argon, [raw], locale, new Date(cutoff.getTime() - 1));
    const after = buildModelPricingSeo(argon, [raw], locale, cutoff);
    assert.deepEqual([before.cheapest?.input_price_per_1m, before.cheapest?.output_price_per_1m,
      before.cheapest?.cached_input_price_per_1m], [2, 10, 0.1]);
    assert.deepEqual([after.tableChannels[0].input_price_per_1m, after.tableChannels[0].output_price_per_1m,
      after.tableChannels[0].cached_input_price_per_1m], [4, 20, 0.2]);
    assert.equal(after.aggregateOffer?.lowPrice, '4');
    assert.match(after.description, /USD 4/);
    assert.match(after.faqs[0].answer, /USD 20/);
    assert.match(after.faqs[2].answer, /USD 0.2/);
    assert.equal(after.updatedOn, '2026-10-13');
    assert.equal(raw.input_price_per_1m, 2);
    const beforeHtml = renderToStaticMarkup(createElement(ModelPricingSummary,
      { pricing: before, locale, now: new Date(cutoff.getTime() - 1) }));
    const afterHtml = renderToStaticMarkup(createElement(ModelPricingSummary, { pricing: after, locale, now: cutoff }));
    for (const value of ['USD 4', 'USD 20', 'USD 0.2']) assert.ok(afterHtml.includes(value), value);
    assert.match(beforeHtml, /2026-11-30|Nov 30, 2026/);
    assert.match(afterHtml, /<time dateTime="2026-10-13">2026-10-13<\/time>/);
    assert.ok(!afterHtml.includes(locale === 'zh' ? '首发优惠至' : 'Introductory through'));
  }
});

test('route keeps a single Product and FAQPage with visible FAQ and table ahead of benchmarks', () => {
  const page = readFileSync(new URL('../app/[locale]/models/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.equal((page.match(/'@type': 'Product'/g) || []).length, 0);
  assert.equal((page.match(/'@type': 'Service'/g) || []).length, 1);
  assert.doesNotMatch(page, /aggregateRating:|review:|shippingDetails:/);
  assert.equal((page.match(/faqPage\(/g) || []).length, 1);
  assert.match(page, /faqPage\(pricing.faqs\)/);
  assert.match(page, /pricing.faqs.map/);
  assert.match(page, /alternateName: pricing.aliases/);
  assert.match(page, /keywords: \[productName, ...pricing.aliases\]/);
  assert.ok(page.indexOf('<ModelPricingSummary') < page.indexOf('<ModelBenchmarkPanel'));
});
