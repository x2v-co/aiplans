import assert from 'node:assert/strict';
import test from 'node:test';
import type { GroupedProduct } from './grouped-products';
import { comparisonPickerProducts, defaultComparisonSlugs } from './compare-model-discovery';

const old = Array.from({length: 65}, (_, i) => ({slug: `old-${i}`, name: `Old ${i}`, released_at: '2025-01-01', benchmark_arena_elo: 100}) as GroupedProduct);
const fresh = {slug: 'kimi-k3.1-pro', name: 'Kimi K3.1 Pro', released_at: '2026-10-23', benchmark_arena_elo: null} as GroupedProduct;
const newer = {slug: 'new-general-model', name: 'New General Model', created_at: '2026-10-26'} as GroupedProduct;

test('unscored new releases stay visible ahead of sixty scored old models', () => {
  const result = comparisonPickerProducts([...old, fresh, newer, {...newer, slug: 'new-general-model-batch'}], '');
  assert.equal(result.length, 60);
  assert.deepEqual(result.slice(0, 2).map(x => x.slug), [newer.slug, fresh.slug]);
  assert.ok(!result.some(x => x.slug.endsWith('-batch')));
  assert.equal(comparisonPickerProducts([...old, fresh], 'kimi')[0].slug, fresh.slug);
  assert.equal(comparisonPickerProducts([{...newer, slug: 'new-general-model-batch'}], 'batch').length, 1);
});

test('default selection uses recent vendors while preserving explicit shared comparisons', () => {
  const products = [...old, fresh, newer];
  assert.deepEqual(defaultComparisonSlugs(products, [fresh.slug, newer.slug], []), [newer.slug, fresh.slug]);
  assert.deepEqual(defaultComparisonSlugs(products, [fresh.slug, newer.slug], ['old-1']), ['old-1', newer.slug]);
  assert.deepEqual(defaultComparisonSlugs(products, [], ['old-1', 'old-2', 'old-3', 'old-4', 'old-5']), ['old-1','old-2','old-3','old-4']);
  assert.deepEqual(defaultComparisonSlugs(products, [], ['not-found', fresh.slug, fresh.slug]), [fresh.slug, newer.slug]);
});
