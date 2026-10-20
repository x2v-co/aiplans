import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  AZURE_GPT4_BANDS,
  AZURE_GPT4_HEADLINE,
  AZURE_GPT4_NOTE,
  AZURE_GPT4_SOURCE,
  catalog20261020SeedOptions,
  planAzureGpt4,
  type AzureChannel,
  type AzureVariant,
} from './catalog-2026-10-20';

const staleChannel: AzureChannel = {
  id: 15066, input_price_per_1m: 2, output_price_per_1m: 8, cached_input_price_per_1m: 0.5,
  currency: 'USD', price_unit: 'per_1m_tokens', notes: null,
};

test('Azure GPT-4 uses the legacy 8K price as headline and 32K as a variant', () => {
  assert.deepEqual(AZURE_GPT4_HEADLINE, { input: 30, output: 60, cached: null });
  assert.deepEqual(AZURE_GPT4_BANDS.map(band => [band.key, band.input, band.output, band.headline]), [
    ['context-8k', 30, 60, true],
    ['context-32k', 60, 120, false],
  ]);
  assert.match(AZURE_GPT4_SOURCE, /^https:\/\/azure\.microsoft\.com\/.+azure-openai\/$/);
  assert.match(AZURE_GPT4_NOTE, /GPT-4\.1 Global/);
});

test('the $2/$8 GPT-4.1 row is repriced and the cached price cleared', () => {
  const plan = planAzureGpt4(staleChannel, []);
  assert.deepEqual(plan.channel?.changes.input_price_per_1m, { from: 2, to: 30 });
  assert.deepEqual(plan.channel?.changes.output_price_per_1m, { from: 8, to: 60 });
  assert.deepEqual(plan.channel?.changes.cached_input_price_per_1m, { from: 0.5, to: null });
  assert.deepEqual(plan.variantInserts.map(band => band.key), ['context-8k', 'context-32k']);
  assert.equal(plan.variantUpdates.length, 0);
});

test('a second run is a no-op and duplicate variants abort', () => {
  const channel: AzureChannel = { ...staleChannel, input_price_per_1m: '30', output_price_per_1m: 60, cached_input_price_per_1m: null, notes: AZURE_GPT4_NOTE };
  const variants: AzureVariant[] = AZURE_GPT4_BANDS.map((band, i) => ({
    id: i + 1, variant_key: band.key, variant_name: band.name, variant_kind: 'context_band',
    input_price_per_1m: band.input, output_price_per_1m: band.output, currency: 'USD', price_unit: 'per_1m_tokens',
    is_headline: band.headline, is_available: true, constraints_json: { ...band.constraints },
    source_url: AZURE_GPT4_SOURCE, notes: AZURE_GPT4_NOTE,
  }));
  const plan = planAzureGpt4(channel, variants);
  assert.equal(plan.channel, null);
  assert.equal(plan.variantInserts.length, 0);
  assert.equal(plan.variantUpdates.length, 0);
  assert.throws(() => planAzureGpt4(channel, [...variants, { ...variants[1], id: 9 }]), /Duplicate/);
});

test('seed is dry-run by default and is not on the deploy path', () => {
  assert.deepEqual(catalog20261020SeedOptions([]), { apply: false });
  assert.equal(catalog20261020SeedOptions(['--apply']).apply, true);
  assert.throws(() => catalog20261020SeedOptions(['--apply', '--dry-run']), /Usage/);
  for (const file of ['../../deploy/production/rollout.sh', '../../deploy/production/seed-catalog.sh', '../../.github/workflows/deploy-production.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /seed:catalog-2026-10-20|seed-catalog-2026-10-20/);
  }
});
