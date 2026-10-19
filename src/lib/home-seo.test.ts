import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHomeMetadataCopy, FALLBACK_HOME_COPY } from './home-seo';

test('homepage metadata uses catalog counts and the update date', () => {
  const copy = buildHomeMetadataCopy({ modelCount: 512, channelCount: 1800, updatedOn: '2026-10-18' });
  assert.equal(copy.title.en, 'Compare AI Pricing · 512 models, 1800 channels | aiplans.dev');
  assert.match(copy.description.en, /512 models and 1800 channels/);
  assert.match(copy.description.en, /2026-10-18/);
  assert.match(copy.title.zh, /512 个模型、1800 个渠道/);
  assert.match(copy.description.zh, /更新于 2026-10-18/);
});

test('homepage metadata omits a date that was not recorded and never invents counts', () => {
  const copy = buildHomeMetadataCopy({ modelCount: 3, channelCount: 4, updatedOn: null });
  assert.doesNotMatch(copy.description.en, /updated/i);
  assert.doesNotMatch(copy.description.zh, /更新于/);
  assert.equal(buildHomeMetadataCopy(null), FALLBACK_HOME_COPY);
  assert.doesNotMatch(FALLBACK_HOME_COPY.title.en, /\d/);
});
