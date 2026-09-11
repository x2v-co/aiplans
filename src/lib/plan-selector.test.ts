import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isSubscribableSlug,
  matchesFamily,
  matchesGlob,
  resolveSelector,
  type SelectableModel,
} from './plan-selector';

const catalog: SelectableModel[] = [
  { id: 1, slug: 'gpt-5', providerSlugs: ['openai'], elo: null },
  { id: 2, slug: 'gpt-5-pro', providerSlugs: ['openai'], elo: null },
  { id: 3, slug: 'gpt-4o', providerSlugs: ['openai'], elo: null },
  { id: 4, slug: 'gpt-4o-batch', providerSlugs: ['openai'], elo: null },
  { id: 5, slug: 'doubao-seed-evolving', providerSlugs: ['seed'], elo: null },
  { id: 6, slug: 'glm-5.3', providerSlugs: ['zhipu-china'], elo: null },
  { id: 7, slug: 'glm-5.3-flash', providerSlugs: ['zhipu-china'], elo: null },
];

test('matchesFamily on a dash/dot boundary, not a prefix', () => {
  assert.equal(matchesFamily('gpt-5', 'gpt-5'), true);
  assert.equal(matchesFamily('gpt-5-pro', 'gpt-5'), true);
  assert.equal(matchesFamily('gpt-55', 'gpt-5'), false);
  assert.equal(matchesFamily('glm-5.3-flash', 'glm-5.3'), true);
});

test('matchesGlob anchors and matches *', () => {
  assert.equal(matchesGlob('gpt-4o-batch', '*-pro'), false);
  assert.equal(matchesGlob('gpt-5-pro', '*-pro'), true);
});

test('batch variants are never subscription entitlements', () => {
  assert.equal(isSubscribableSlug('gpt-4o'), true);
  assert.equal(isSubscribableSlug('gpt-4o-batch'), false);
  assert.equal(isSubscribableSlug('claude-haiku-(batch)'), false);
});

test('only_extra is a closed list ignoring families', () => {
  const res = resolveSelector(
    { only_extra: true, extra: ['glm-5.3', 'glm-5.3-flash'] },
    catalog,
    ['zhipu-china'],
  );
  assert.deepEqual(res.models.map(m => m.slug).sort(), ['glm-5.3', 'glm-5.3-flash']);
});

test('only_extra resolves cross-vendor models via provider-agnostic extras', () => {
  // doubao lives under 'seed' but the selector defaults to zhipu-china; extra bypasses providers.
  const res = resolveSelector(
    { only_extra: true, extra: ['doubao-seed-evolving', 'glm-5.3'] },
    catalog,
    ['zhipu-china'],
  );
  assert.deepEqual(res.models.map(m => m.slug).sort(), ['doubao-seed-evolving', 'glm-5.3']);
});

test('unknown extra slugs are reported, not silently dropped', () => {
  const res = resolveSelector({ only_extra: true, extra: ['glm-5.3', 'does-not-exist'] }, catalog, ['zhipu-china']);
  assert.deepEqual(res.unknownExtra, ['does-not-exist']);
});

test('family + exclude filters batch and pro variants', () => {
  const res = resolveSelector(
    { families: ['gpt-5'], exclude: ['*-pro'] },
    catalog,
    ['openai'],
  );
  const slugs = res.models.map(m => m.slug);
  assert.ok(slugs.includes('gpt-5'));
  assert.ok(!slugs.includes('gpt-5-pro'));
  assert.ok(!slugs.includes('gpt-4o-batch'));
});
