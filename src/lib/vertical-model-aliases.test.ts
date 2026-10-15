import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogForKind } from './ai-vertical-catalog';
import { ARENA_TEXT_TO_VIDEO_LEADERBOARD, arenaVideoSlug } from './arena-video-leaderboard';
import { isBenchmarkOnlySlug, parentSlugFor, VERTICAL_MODEL_PARENT } from './vertical-model-aliases';

/**
 * Ratchet: unpriced video models listed on /video-models may only go down.
 * Lower this number when you price or merge a model; never raise it.
 */
const MAX_UNPRICED_VIDEO_MODELS = 15;
const UNPRICED = new Set(['needs-verification', 'not-public', 'undisclosed', undefined]);

test('video alias parents exist in the audited catalog', () => {
  const catalog = new Set(catalogForKind('video-model').map((item) => item.slug));
  for (const [child, parent] of Object.entries(VERTICAL_MODEL_PARENT['video-model'] ?? {})) {
    assert.ok(catalog.has(parent), `${child} → ${parent} missing from catalog`);
    assert.ok(!catalog.has(child), `${child} is itself a catalog slug`);
  }
});

test('arena-t2v-* rows are benchmark-only', () => {
  assert.equal(isBenchmarkOnlySlug('arena-t2v-veo-3'), true);
  assert.equal(isBenchmarkOnlySlug('veo-3'), false);
});

test('unpriced video model count does not grow', () => {
  const catalog = catalogForKind('video-model');
  const catalogSlugs = new Set(catalog.map((item) => item.slug));
  const unpricedCatalog = catalog.filter((item) => UNPRICED.has(item.priceStatus)).map((item) => item.slug!);
  // DB-only rows are seeded from the Arena leaderboard without prices.
  const dbOnly = ARENA_TEXT_TO_VIDEO_LEADERBOARD.map((entry) => arenaVideoSlug(entry.modelDisplayName))
    .filter((slug) => !catalogSlugs.has(slug) && !isBenchmarkOnlySlug(slug) && !parentSlugFor('video-model', slug));
  const unpriced = [...unpricedCatalog, ...dbOnly];
  assert.ok(unpriced.length <= MAX_UNPRICED_VIDEO_MODELS,
    `unpriced video models grew to ${unpriced.length} (max ${MAX_UNPRICED_VIDEO_MODELS}): ${unpriced.join(', ')}`);
});
