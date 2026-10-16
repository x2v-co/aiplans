import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalModelKey, isModelsDevComparable, ModelsDevCatalog, ourModelKey } from './modelsdev';
import { LFM_OPENROUTER_ID, LFM_SLUG } from '../data/lfm2-5-24b-a2b';

test('models.dev audit matches the seeded Liquid slug to the OpenRouter API id', () => {
  const key = canonicalModelKey(LFM_OPENROUTER_ID);
  assert.equal(ourModelKey('openrouter', LFM_SLUG), key);
  assert.equal(canonicalModelKey(`${LFM_OPENROUTER_ID}-20261012`), key);
  const catalog = ModelsDevCatalog.fromJson({ openrouter: {
    models: { [LFM_OPENROUTER_ID]: { id: LFM_OPENROUTER_ID, cost: { input: 0.05, output: 0.7 } } },
  } });
  assert.equal(catalog.lookup('openrouter', LFM_SLUG)?.candidates[0].input, 0.05);
  assert.equal(catalog.lookup('openrouter', LFM_SLUG)?.candidates[0].output, 0.7);
  assert.equal(isModelsDevComparable('liquid', LFM_SLUG), false);
});

test('Liquid audit alias does not collapse older, other-size, or batch models', () => {
  for (const slug of ['liquid-lfm-2-24b-a2b', 'liquid-lfm-2-5-2-6b', `${LFM_SLUG}-batch`]) {
    assert.equal(ourModelKey('openrouter', slug), canonicalModelKey(slug));
    assert.notEqual(ourModelKey('openrouter', slug), ourModelKey('openrouter', LFM_SLUG));
  }
  assert.equal(ourModelKey('liquid', LFM_SLUG), canonicalModelKey(LFM_SLUG));
});
