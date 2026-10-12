import assert from 'node:assert/strict';
import test from 'node:test';
import { describePriceChange, pickCanonicalPerProduct } from './price-history';

test('collapses entries resolving to one model, preferring the exact slug', () => {
  const e = (slug: string, input: number) => ({ productId: 1, productSlug: 'gpt-3.5-turbo', scrapedSlug: slug, price: { input } });
  const { kept, dropped } = pickCanonicalPerProduct([
    e('gpt-3.5-turbo-0613', 1.5),
    e('gpt-3.5-turbo', 0.5),
    e('gpt-3.5-turbo-16k', 3),
    { productId: 2, productSlug: 'b', scrapedSlug: 'b', price: { input: 9 } },
  ]);
  assert.deepEqual(kept.map((k) => k.price.input), [0.5, 9]);
  assert.equal(dropped.length, 2);
});

test('falls back to first entry when none is exact', () => {
  const { kept } = pickCanonicalPerProduct([
    { productId: 1, productSlug: 'x', scrapedSlug: 'x-a', price: 'a' },
    { productId: 1, productSlug: 'x', scrapedSlug: 'x-b', price: 'b' },
  ]);
  assert.deepEqual(kept.map((k) => k.price), ['a']);
});

test('no history row when price is unchanged', () => {
  assert.equal(describePriceChange({ input: 0.5, output: 1.5 }, { input: 0.5, output: 1.5 }).changed, false);
});

test('small and output-only changes are recorded', () => {
  const small = describePriceChange({ input: 0.3, output: 3 }, { input: 0.32, output: 3.2 });
  assert.equal(small.changed, true);
  assert.ok(Math.abs(small.changePercent - 6.6667) < 0.01);
  const outOnly = describePriceChange({ input: 0.08, output: 0.8 }, { input: 0.08, output: 0.75 });
  assert.equal(outOnly.changed, true);
  assert.ok(Math.abs(outOnly.changePercent - -6.25) < 0.01);
});
