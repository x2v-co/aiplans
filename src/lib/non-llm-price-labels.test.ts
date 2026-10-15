import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { NonLlmCatalog } from '../components/non-llm-catalog';
import { catalogForKind } from './ai-vertical-catalog';
import {
  catalogPriceLabelKeys,
  humanizePriceKey,
  labelNonLlmPriceKey,
} from './non-llm-price-labels';

test('every catalog price key has zh and en translations', () => {
  const keys = catalogPriceLabelKeys();
  assert.ok(keys.length > 40, `expected a broad key set, got ${keys.length}`);
  const missing: string[] = [];
  for (const key of keys) {
    const zhHit = (zh.nonLlmModels as Record<string, string>)[key];
    const enHit = (en.nonLlmModels as Record<string, string>)[key];
    if (typeof zhHit !== 'string' || !zhHit.trim()) missing.push(`zh:${key}`);
    if (typeof enHit !== 'string' || !enHit.trim()) missing.push(`en:${key}`);
  }
  assert.deepEqual(missing, [], missing.join('\n'));
});

test('humanizePriceKey makes unknown snake_case keys readable', () => {
  assert.equal(humanizePriceKey('text_output_tokens'), 'text output tokens');
  assert.equal(humanizePriceKey('image_output_tokens'), 'image output tokens');
  assert.equal(humanizePriceKey('moondream-3.1_realtime_input'), 'moondream 3.1 realtime input');
  assert.equal(humanizePriceKey('kling-3.0 720p (no audio)'), 'kling-3.0 720p (no audio)');
  assert.equal(labelNonLlmPriceKey('totally_unknown_price_key', 'en'), 'totally unknown price key');
  assert.equal(labelNonLlmPriceKey('totally_unknown_price_key', 'zh'), 'totally unknown price key');
});

test('image cards render translated price kinds, not raw snake_case keys', () => {
  const items = catalogForKind('image-model');
  const zhHtml = renderToStaticMarkup(createElement(NonLlmCatalog, { items, locale: 'zh' }));
  const enHtml = renderToStaticMarkup(createElement(NonLlmCatalog, { items, locale: 'en' }));
  for (const raw of ['text_output_tokens', 'image_output_tokens', 'text_input_tokens', 'image_input_tokens']) {
    assert.doesNotMatch(zhHtml, new RegExp(raw));
    assert.doesNotMatch(enHtml, new RegExp(raw));
  }
  assert.match(zhHtml, /文本输出 token|图像输出 token/);
  assert.match(enHtml, /Text output tokens|Image output tokens/);
});
