import assert from 'node:assert/strict';
import test from 'node:test';
import { priceItemList, priceValidUntil, productOffer } from './seo';

test('priceValidUntil is a future ISO date 30 days out', () => {
  assert.equal(priceValidUntil(new Date('2026-10-14T10:00:00Z')), '2026-11-13');
  assert.ok(priceValidUntil() > new Date().toISOString().slice(0, 10));
});

test('priceItemList emits Offers of Services, never Product or ratings', () => {
  const ld = priceItemList('X plans', [
    { position: 1, name: 'X Pro', url: 'https://aiplans.dev/en/providers/x#pro', price: 20, currency: 'USD', seller: 'X' },
  ]);
  assert.doesNotMatch(ld, /"Product"|aggregateRating|"review"/);
  const item = JSON.parse(ld).itemListElement[0].item;
  assert.equal(item['@type'], 'Offer');
  assert.equal(item.itemOffered['@type'], 'Service');
  assert.equal(item.price, '20');
  assert.match(item.priceValidUntil, /^\d{4}-\d{2}-\d{2}$/);
});

test('productOffer keeps name/offers/brand, adds priceValidUntil, no ratings', () => {
  const ld = JSON.parse(productOffer({ name: 'M', price: 2, image: 'https://x/i', brand: 'B', url: 'https://x' }));
  assert.equal(ld.brand.name, 'B');
  assert.equal(ld.offers.price, '2');
  assert.match(ld.offers.priceValidUntil, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(ld.aggregateRating, undefined);
  assert.equal(ld.review, undefined);
  assert.equal(ld['@type'], 'Service');
  assert.equal(ld.offers.seller.name, 'B');
});
