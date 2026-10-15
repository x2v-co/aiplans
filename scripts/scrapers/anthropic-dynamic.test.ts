import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAnthropicPricing } from './anthropic-dynamic';

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
