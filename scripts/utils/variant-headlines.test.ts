import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addStandardHeadlines, keepsLastKnownPrice } from './variant-headlines';
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
  const variants = [
    { modelSlug: 'claude-haiku-5.5', variantKey: 'prompt-le-100k', isHeadline: true },
    { modelSlug: 'claude-haiku-5.5', variantKey: 'prompt-gt-100k', isHeadline: false },
    { modelSlug: 'claude-opus-9', variantKey: 'fast-mode', isHeadline: false },
  ] as ScrapedPriceVariant[];
  assert.equal(addStandardHeadlines([price('claude-haiku-5.5', 0.1, 0.5)], variants).length, 3);
});

test('unverified scrape keeps a priced channel row, but fills an empty one', () => {
  assert.equal(keepsLastKnownPrice({ input_price_per_1m: 0.1, output_price_per_1m: 0.5 }), true);
  assert.equal(keepsLastKnownPrice({ input_price_per_1m: null, output_price_per_1m: null }), false);
  assert.equal(keepsLastKnownPrice(null), false);
});
