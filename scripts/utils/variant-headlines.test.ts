import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addStandardHeadlines, assertCacheWriteHeadlines, keepsLastKnownPrice } from './variant-headlines';
import { parseAnthropicFastMode } from '../scrapers/anthropic-dynamic';
import type { ScrapedPrice, ScrapedPriceVariant } from './validator';

const price = (slug: string, i: number, o: number): ScrapedPrice => ({ modelName: slug, modelSlug: slug, inputPricePer1M: i, outputPricePer1M: o, isAvailable: true, currency: 'USD' });

test('fast-mode-only groups get one standard headline equal to the base price', () => {
  const fast = parseAnthropicFastMode([
    { cells: ['Claude Opus 5.5', '$8 USD / MTok', '$40 USD / MTok'], heading: '' },
    { cells: ['Claude Opus 5 / Claude Opus 4.8', '$10 USD / MTok', '$50 USD / MTok'], heading: '' },
  ]);
  const out = addStandardHeadlines([price('claude-opus-5.5', 5, 25), price('claude-opus-5', 5, 25), price('claude-opus-4.8', 5, 25)], fast);
  for (const slug of ['claude-opus-5.5', 'claude-opus-5', 'claude-opus-4.8']) {
    const heads = out.filter(v => v.modelSlug === slug && v.isHeadline);
    assert.equal(heads.length, 1, slug);
    assert.deepEqual([heads[0].variantKey, heads[0].inputPricePer1M, heads[0].outputPricePer1M], ['standard', 5, 25]);
  }
});

test('groups that already have a headline or lack a base price are untouched', () => {
  const variants: ScrapedPriceVariant[] = [
    { ...price('claude-haiku-5.5', 0.1, 0.5), variantKey: 'prompt-le-100k', variantName: '<=100K', isHeadline: true },
    { ...price('claude-haiku-5.5', 0.1, 0.5), variantKey: 'prompt-gt-100k', variantName: '>100K', isHeadline: false },
    { ...price('claude-opus-9', 5, 25), variantKey: 'fast-mode', variantName: 'Fast', isHeadline: false },
  ];
  assert.equal(addStandardHeadlines([price('claude-haiku-5.5', 0.1, 0.5)], variants).length, 3);
});

test('unverified scrape keeps a priced channel row, but fills an empty one', () => {
  assert.equal(keepsLastKnownPrice({ input_price_per_1m: 0.1, output_price_per_1m: 0.5 }), true);
  assert.equal(keepsLastKnownPrice({ input_price_per_1m: null, output_price_per_1m: null }), false);
  assert.equal(keepsLastKnownPrice(null), false);
});

const channel = { model_id: 10, provider_id: 43, input_price_per_1m: 2, output_price_per_1m: 10, is_available: true };
const cacheWrite = { ...channel, variant_key: 'cache-write-5m', cache_create_price_per_1m: 2, is_headline: true };

test('cache-write guard requires one headline per active model/provider group, including new keys and cache creation rates', () => {
  const secondary = { ...cacheWrite, variant_key: 'cache-write-1h', cache_create_price_per_1m: 4, is_headline: false };
  assert.doesNotThrow(() => assertCacheWriteHeadlines([cacheWrite, secondary], [channel]));
  for (const variant of [secondary, { ...secondary, variant_key: 'cache-write-24h' }, { ...secondary, variant_key: 'custom-cache-tier' }]) {
    assert.throws(() => assertCacheWriteHeadlines([variant], [channel]), /exactly one active headline/);
  }
  assert.throws(() => assertCacheWriteHeadlines([cacheWrite, { ...secondary, is_headline: true }], [channel]), /found 2/);
  assert.throws(() => assertCacheWriteHeadlines([cacheWrite, { ...secondary, provider_id: 99 }], [channel]), /99.*exactly one active headline/);
  assert.throws(() => assertCacheWriteHeadlines([cacheWrite, { ...secondary, model_id: 11 }], [channel]), /11:43.*exactly one active headline/);
  assert.throws(() => assertCacheWriteHeadlines([{ ...cacheWrite, is_available: false }, secondary], [channel]), /found 0/);
  assert.doesNotThrow(() => assertCacheWriteHeadlines([{ ...secondary, is_available: false }], []));
  const standard = { ...channel, variant_key: 'standard', is_headline: true };
  assert.doesNotThrow(() => assertCacheWriteHeadlines([standard, secondary], [channel]));
});

test('cache-write headline must match a unique active channel and finite non-null input/output prices', () => {
  for (const channels of [[], [{ ...channel, is_available: false }], [channel, channel]]) {
    assert.throws(() => assertCacheWriteHeadlines([cacheWrite], channels), /exactly one active channel/);
  }
  assert.doesNotThrow(() => assertCacheWriteHeadlines([{ ...cacheWrite, input_price_per_1m: '2.000000', output_price_per_1m: '10.00' }], [channel]));
  for (const field of ['input_price_per_1m', 'output_price_per_1m']) {
    for (const value of [null, undefined, NaN, Infinity, 99]) {
      assert.throws(() => assertCacheWriteHeadlines([{ ...cacheWrite, [field]: value }], [channel]), /headline must match channel/);
      assert.throws(() => assertCacheWriteHeadlines([cacheWrite], [{ ...channel, [field]: value }]), /headline must match channel/);
    }
  }
});
