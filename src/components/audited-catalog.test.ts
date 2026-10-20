import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { auditedPrice, AuditedPricingFacts, DecisionModelCatalog } from './audited-catalog';
import { NonLlmCatalog, NonLlmFacts } from './non-llm-catalog';
import { AI_VERTICAL_CATALOG, type AiCatalogItem } from '../lib/ai-vertical-catalog';
import { currencyPrefix, formatCurrencyAmount } from '../lib/currency';

const base: AiCatalogItem = {
  kind: 'video-model', slug: 'x', name: 'X', provider: 'P', status: 'available', pricing: '', unit: 'seconds',
  capabilities: [], bestFor: '', priceStatus: 'priced', billingUnit: 'per_second', pricePerUnit: 0.3, pricePerUnitHigh: 1.8,
} as AiCatalogItem;

test('currencyPrefix: USD/缺省 → $，CNY → ¥，其他币种不当美元', () => {
  assert.equal(currencyPrefix('USD'), '$');
  assert.equal(currencyPrefix(undefined), '$');
  assert.equal(currencyPrefix(null), '$');
  assert.equal(currencyPrefix('CNY'), '¥');
  assert.equal(currencyPrefix('cny'), '¥');
  assert.equal(currencyPrefix('EUR'), '€');
  assert.notEqual(currencyPrefix('CHF'), '$');
  assert.equal(currencyPrefix('XXZ'), 'XXZ ');
  assert.equal(formatCurrencyAmount(0.46, 'CNY'), '¥0.46');
});

test('auditedPrice 按条目币种显示符号，不做换算', () => {
  for (const locale of ['en', 'zh']) {
    const cny = auditedPrice({ ...base, currency: 'CNY' }, locale);
    assert.match(cny, /^¥0\.30–¥1\.80 \/ /);
    assert.doesNotMatch(cny, /\$/);
    assert.match(auditedPrice({ ...base, currency: 'USD' }, locale), /^\$0\.30–\$1\.80 \/ /);
    assert.match(auditedPrice({ ...base, currency: undefined }, locale), /^\$0\.30–\$1\.80 \/ /);
  }
  assert.equal(auditedPrice({ ...base, currency: 'CNY', approximatePrice: true, pricePerUnitHigh: undefined }, 'en'), '≈¥0.30 / second');
});

test('AuditedPricingFacts / NonLlm 渲染的 usageRates 与 token 价按币种显示', () => {
  const rates = [{ priceKind: 'video_second', unit: 'second', price: 0.46 }] as AiCatalogItem['usageRates'];
  for (const locale of ['en', 'zh']) {
    const cny = { ...base, currency: 'CNY', usageRates: rates };
    for (const html of [
      renderToStaticMarkup(createElement(AuditedPricingFacts, { item: cny, locale })),
      renderToStaticMarkup(createElement(NonLlmFacts, { item: cny, locale })),
      renderToStaticMarkup(createElement(NonLlmCatalog, { items: [cny], locale })),
    ]) {
      assert.match(html, /¥0\.46/);
      assert.doesNotMatch(html, /\$0\.46/);
    }
    const usd = renderToStaticMarkup(createElement(AuditedPricingFacts, { item: { ...cny, currency: 'USD' }, locale }));
    assert.match(usd, /\$0\.46/);
  }
  const decision = { ...base, kind: 'decision-model', pricing: 'p', inputPricePer1M: 2, outputPricePer1M: 8, currency: 'CNY' } as AiCatalogItem;
  const html = renderToStaticMarkup(createElement(DecisionModelCatalog, { items: [decision, { ...decision, slug: 'y', currency: 'USD' }], locale: 'en' }));
  assert.match(html, /¥2<\/td>/);
  assert.match(html, /\$8<\/td>/);
});

test('静态目录里所有非 USD 条目（wan-video、seedance）显示 ¥', () => {
  const nonUsd = AI_VERTICAL_CATALOG.filter(item => item.currency && item.currency !== 'USD');
  assert.deepEqual(nonUsd.map(item => item.slug).sort(), ['seedance', 'wan-video']);
  for (const item of nonUsd) {
    for (const locale of ['en', 'zh']) {
      const text = auditedPrice(item, locale);
      assert.match(text, /^¥/, `${item.slug} ${locale}: ${text}`);
      assert.doesNotMatch(text, /\$/);
    }
  }
});
