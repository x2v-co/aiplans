import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAnthropicFastMode, parseAnthropicPricing } from './anthropic-dynamic';

test('Haiku official base is unknown; context and batch tiers never become headline prices', () => {
  const result = parseAnthropicPricing(['Haiku 5.5 Input $0.10 Output $0.50'], [
    { cells: ['Claude Haiku 5.5', '>100K prompt', '$0.50', '$2.50'], heading: 'Standard pricing' },
    { cells: ['Claude Haiku 5.5', '>100K prompt', '$0.25', '$1.25'], heading: 'Batch pricing' },
  ]);
  assert.equal(result.success, true);
  assert.equal(result.prices.length, 0);
  assert.match(result.unverifiedPrices?.[0].notes ?? '', /needs-verification/);
  assert.deepEqual(result.variants?.map(v => [v.inputPricePer1M, v.outputPricePer1M, v.isHeadline]), [[0.5,2.5,false],[0.25,1.25,false]]);
  assert.ok(result.variants?.every(v => v.constraints?.prompt_tokens_gt === 100000));
});

test('missing or ambiguous docs tiers preserve existing variants and never use another model rates', () => {
  const result = parseAnthropicPricing([], [
    { cells: ['Haiku 5.5', '$0.10', '$0.50'], heading: 'Unknown context' },
    { cells: ['Sonnet 5.5', '>100K', '$0.50', '$2.50'], heading: 'Standard' },
  ]);
  assert.equal(result.variants?.length, 0);
  assert.ok(result.warnings?.length);
  assert.equal(parseAnthropicPricing([], []).success, false);
});

test('documented Haiku 5.5 <=100K rows become the base price and a batch variant', () => {
  const result = parseAnthropicPricing([], [
    { cells: ['Claude Haiku 5.5 (for prompts up to 100,000 tokens)', '$0.10 / MTok', '$0.125 / MTok', '$0.20 / MTok', '$0.01 / MTok', '$0.50 / MTok'], heading: 'Model pricing' },
    { cells: ['Claude Haiku 5.5 (for prompts over 100,000 tokens)', '$0.50 / MTok', '$0.625 / MTok', '$1 / MTok', '$0.05 / MTok', '$2.50 / MTok'], heading: 'Model pricing' },
    { cells: ['Claude Haiku 5.5 (for prompts up to 100,000 tokens)', '$0.05 / MTok', '$0.25 / MTok'], heading: 'Batch processing' },
    { cells: ['Claude Haiku 5.5 (for prompts over 100,000 tokens)', '$0.25 / MTok', '$1.25 / MTok'], heading: 'Batch processing' },
  ]);
  assert.deepEqual(result.prices.map(p => [p.modelSlug, p.inputPricePer1M, p.outputPricePer1M, p.cachedInputPricePer1M]), [['claude-haiku-5.5', 0.1, 0.5, 0.01]]);
  assert.equal(result.unverifiedPrices?.length, 0);
  assert.deepEqual(result.variants?.map(v => [v.variantKey, v.inputPricePer1M, v.outputPricePer1M]).sort(), [
    ['batch-prompt-gt-100k', 0.25, 1.25], ['batch-prompt-le-100k', 0.05, 0.25], ['prompt-gt-100k', 0.5, 2.5], ['prompt-le-100k', 0.1, 0.5]]);
  assert.deepEqual(result.variants?.filter(v => v.isHeadline).map(v => v.variantKey), ['prompt-le-100k']);
  assert.equal(result.warnings, undefined);
});

test('fast mode: Opus 5.5 GA public variant; Opus 5 / 4.8 research preview; never headline', () => {
  const variants = parseAnthropicFastMode([
    { cells: ['Claude Opus 5.5', '$8 USD / MTok', '$40 USD / MTok'], heading: '' },
    { cells: ['Claude Opus 5 / Claude Opus 4.8', '$10 USD / MTok', '$50 USD / MTok'], heading: '' },
    { cells: ['Claude Opus 5.5 (claude-opus-5-5)', 'Claude API, including Claude Managed Agents', ''], heading: '' },
  ]);
  assert.deepEqual(variants.map(v => [v.modelSlug, v.inputPricePer1M, v.outputPricePer1M, v.isPublic, v.constraints?.status]), [
    ['claude-opus-5.5', 8, 40, true, 'ga'], ['claude-opus-5', 10, 50, false, 'research_preview'], ['claude-opus-4.8', 10, 50, false, 'research_preview']]);
  assert.ok(variants.every(v => v.isHeadline === false && v.variantKey === 'fast-mode'));
});
