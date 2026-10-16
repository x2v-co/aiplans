import assert from 'node:assert/strict';
import test from 'node:test';
import { benchmarkBaseSlug, isIndexableVerticalDbSlug, parentSlugFor } from './vertical-model-aliases';

test('sitemap skips vertical DB slugs whose detail page 404s or redirects', () => {
  assert.equal(isIndexableVerticalDbSlug('video-model', 'arena-t2v-mochi-v1'), false);
  assert.equal(isIndexableVerticalDbSlug('video-model', 'veo-2'), false);
  assert.equal(isIndexableVerticalDbSlug('world-model', 'gamengen'), false);
  assert.equal(isIndexableVerticalDbSlug('video-model', 'some-new-video-model'), true);
});

test('old arena slugs map to a live page', () => {
  assert.equal(benchmarkBaseSlug('arena-t2v-veo-2'), 'veo-2');
  assert.equal(parentSlugFor('video-model', benchmarkBaseSlug('arena-t2v-kling-o1-pro')!), 'kling');
});
