import assert from 'node:assert/strict';
import test from 'node:test';
import type { GroupedProduct } from './grouped-products';
import { selectVendorLeaders } from './flagship-models';

function product(overrides: Partial<GroupedProduct> & Pick<GroupedProduct, 'slug'>): GroupedProduct {
  return {
    id: 1,
    name: overrides.slug,
    provider_ids: [],
    context_window: 128_000,
    benchmark_arena_elo: null,
    released_at: null,
    created_at: null,
    baseName: overrides.slug,
    versions: [],
    hasChinaVersion: false,
    hasGlobalVersion: true,
    versionCounts: 1,
    ...overrides,
  };
}

test('prefers the stronger scored model over the newest model', () => {
  const leaders = selectVendorLeaders([
    product({
      slug: 'grok-4.6',
      providers: { id: 1, name: 'Grok / X.AI', slug: 'xai', logo: '' },
      benchmark_arena_elo: 5.33,
      released_at: '2026-08-12',
    }),
    product({
      slug: 'grok-4.5',
      providers: { id: 1, name: 'Grok / X.AI', slug: 'xai', logo: '' },
      benchmark_arena_elo: 6.17,
      released_at: '2026-07-08',
    }),
  ]);

  assert.equal(leaders[0]?.product.slug, 'grok-4.5');
  assert.equal(leaders[0]?.selectionBasis, 'agent-arena');
});

test('falls back to the newest available general-purpose model', () => {
  const leaders = selectVendorLeaders([
    product({
      slug: 'minimax-m2',
      providers: { id: 1, name: 'Minimax', slug: 'minimax', logo: '' },
      released_at: '2025-10-23',
    }),
    product({
      slug: 'minimax-m3',
      providers: { id: 1, name: 'Minimax', slug: 'minimax', logo: '' },
      released_at: '2026-05-31',
    }),
    product({
      slug: 'minimax-m4-vision',
      providers: { id: 1, name: 'Minimax', slug: 'minimax', logo: '' },
      released_at: '2026-08-01',
    }),
  ]);

  assert.equal(leaders[0]?.product.slug, 'minimax-m3');
  assert.equal(leaders[0]?.selectionBasis, 'latest-available');
});

test('uses a verified official flagship once it has an available priced product', () => {
  const leaders = selectVendorLeaders([
    product({
      slug: 'gpt-5.6-sol',
      providers: { id: 1, name: 'OpenAI', slug: 'openai', logo: '' },
      benchmark_arena_elo: 9.49,
      released_at: '2026-07-09',
    }),
    product({
      slug: 'gpt-6-astra',
      providers: { id: 1, name: 'OpenAI', slug: 'openai', logo: '' },
      released_at: '2026-09-04',
    }),
  ]);

  assert.equal(leaders[0]?.product.slug, 'gpt-6-astra');
  assert.equal(leaders[0]?.selectionBasis, 'official-flagship');
});
