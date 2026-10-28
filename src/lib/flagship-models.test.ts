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
    benchmarks: [],
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

test('recent comparison table includes unscored Kimi and Gemini releases ahead of scored predecessors', async () => {
  const { selectLatestVendorModels } = await import('./flagship-models');
  const kimi = {id: 1, name: 'moonshotai', slug: 'moonshotai', logo: ''};
  const google = {id: 2, name: 'Google', slug: 'google', logo: ''};
  const items = [
    product({slug: 'kimi-k3', providers: kimi, released_at: '2026-07-16', benchmark_arena_elo: 9}),
    product({slug: 'moonshotai-kimi-k3-1-pro', providers: kimi, released_at: '2026-10-23'}),
    product({slug: 'kimi-k3.1-pro-highspeed', providers: kimi, created_at: '2026-10-28'}),
    product({slug: '~moonshotai-kimi-latest', providers: kimi, created_at: '2026-10-29'}),
    product({slug: 'gemini-3.8-flash', providers: google, released_at: '2026-09-02', benchmark_arena_elo: 8}),
    product({slug: 'gemini-4-argon', providers: google, released_at: '2026-10-13'}),
    product({slug: 'gemini-er-2.0', providers: google, created_at: '2026-10-27'}),
    product({slug: 'gemini-nano-banana-2.1', providers: google, modelCategory: 'image', created_at: '2026-10-28'}),
  ];
  assert.deepEqual(selectLatestVendorModels(items).map(x => x.product.slug), ['gemini-4-argon', 'moonshotai-kimi-k3-1-pro']);
  // Performance ranking remains a separate policy for callers such as the calculator.
  assert.equal(selectVendorLeaders(items).find(x => x.vendorKey === 'moonshot')?.product.slug, 'kimi-k3');
});

test('recent comparison follows catalog additions and has no fixed flagship override', async () => {
  const { selectLatestVendorModels } = await import('./flagship-models');
  const openai = {id: 1, name: 'OpenAI', slug: 'openai', logo: ''};
  const minimax = {id: 2, name: 'Minimax', slug: 'minimax', logo: ''};
  const result = selectLatestVendorModels([
    product({slug: 'gpt-6-astra', providers: openai, released_at: '2026-09-04', benchmark_arena_elo: 12}),
    product({slug: 'gpt-6.1-terra', providers: openai, released_at: '2026-10-26'}),
    product({slug: 'gpt-7', providers: openai, created_at: '2026-11-01', versionCounts: 0}),
    product({slug: 'minimax-m3', providers: minimax, released_at: '2026-05-31', benchmark_arena_elo: 3}),
    product({slug: 'minimax-m3.1', providers: minimax, created_at: '2026-10-19'}),
  ]);
  assert.deepEqual(result.map(x => x.product.slug), ['gpt-6.1-terra', 'minimax-m3.1']);
});
