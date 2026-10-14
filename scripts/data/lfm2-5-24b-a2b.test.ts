import assert from 'node:assert/strict';
import test from 'node:test';
import { seedChanges } from './gemini-4-argon';
import { LFM_SLUG, LFM_SOURCE, liquidProviderRow, lfmModelRow, lfmOfficialChannelRow } from './lfm2-5-24b-a2b';
import { checkModelIdentity, isCachedPriceSane } from '../utils/model-identity-guard';

test('Liquid is an official USD provider; model uses its producer ID and official context', () => {
  const provider = liquidProviderRow();
  assert.equal(provider.slug, 'liquid');
  assert.equal(provider.type, 'official');
  assert.equal(provider.currency, 'USD');
  assert.equal(provider.pricing_url, LFM_SOURCE);
  const model = lfmModelRow(70);
  assert.equal(model.slug, LFM_SLUG);
  assert.deepEqual(model.provider_ids, [70]);
  assert.equal(model.context_window, 131_072);
  assert.equal(model.released_at.toISOString(), '2026-10-13T00:00:00.000Z');
  assert.equal(model.open_source, true);
  assert.deepEqual(model.input_modalities, ['text']);
  assert.deepEqual(model.output_modalities, ['text']);
  assert.deepEqual(model.capabilities, ['reasoning', 'tool-calling', 'structured-outputs']);
  assert.match(model.description, /reasoning-only/);
  assert.match(model.description, /128,000 context and an 8,192-token completion limit for its route/);
  assert.ok(!('max_output_tokens' in model), 'OpenRouter limit must not become an official model limit');
  assert.deepEqual(checkModelIdentity(model.name, model.slug), { ok: true, reasons: [] });
});

test('seed writes only verified Liquid Console prices, separately from OpenRouter', () => {
  const channel = lfmOfficialChannelRow(70, 123);
  assert.equal(channel.provider_id, 70);
  assert.equal(channel.model_id, 123);
  assert.deepEqual([channel.input_price_per_1m, channel.cached_input_price_per_1m, channel.output_price_per_1m], [0.1, 0.05, 1]);
  assert.equal(channel.currency, 'USD');
  assert.equal(channel.price_unit, 'per_1m_tokens');
  assert.equal(channel.is_available, true);
  assert.equal(channel.last_verified.toISOString(), '2026-10-14T00:00:00.000Z');
  assert.ok(isCachedPriceSane(channel.input_price_per_1m, channel.cached_input_price_per_1m));
  assert.match(channel.notes, /Liquid Console official/);
});

test('dry-run dependency placeholders and field diffs are stable on reruns', () => {
  assert.equal(lfmModelRow(null).provider_ids, null);
  assert.equal(lfmOfficialChannelRow(null, null).provider_id, null);
  assert.equal(lfmOfficialChannelRow(null, null).model_id, null);
  for (const row of [liquidProviderRow(), lfmModelRow(70), lfmOfficialChannelRow(70, 123)]) {
    assert.deepEqual(seedChanges(row, row), {});
    assert.equal(Object.keys(seedChanges(null, row)).length, Object.keys(row).length);
  }
  const row = lfmOfficialChannelRow(70, 123);
  assert.deepEqual(seedChanges({ ...row, input_price_per_1m: 0.05 }, row), {
    input_price_per_1m: { from: 0.05, to: 0.1 },
  });
});
