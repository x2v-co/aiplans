import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filteredCatalogPath, publicPathForFilteredRoute } from './catalog-query-routes';

const q = (search: string) => new URLSearchParams(search);

test('unfiltered catalog requests stay on the cached page', () => {
  assert.equal(filteredCatalogPath('/en/models', q('')), null);
  assert.equal(filteredCatalogPath('/en/models', q('utm_source=x')), null);
  assert.equal(filteredCatalogPath('/en/models/gpt-5', q('promo=1')), null);
  assert.equal(filteredCatalogPath('/en/compare/plans/kimi-k3', q('models=a')), null);
});

test('filter query strings are rewritten to the per-request route', () => {
  assert.equal(filteredCatalogPath('/en/models', q('promo=1')), '/en/filtered/models');
  assert.equal(filteredCatalogPath('/zh/plans', q('kind=coding')), '/zh/filtered/plans');
  assert.equal(filteredCatalogPath('/en/api-pricing', q('q=claude&sort=price')), '/en/filtered/api-pricing');
  assert.equal(filteredCatalogPath('/en/compare/models', q('models=a,b')), '/en/filtered/compare/models');
  assert.equal(filteredCatalogPath('/en/providers/google', q('period=yearly')), '/en/filtered/providers/google');
  assert.equal(filteredCatalogPath('/en/providers', q('period=yearly')), null);
});

test('direct hits on the internal route map back to the public URL', () => {
  assert.equal(publicPathForFilteredRoute('/en/filtered/models'), '/en/models');
  assert.equal(publicPathForFilteredRoute('/zh/filtered/providers/google'), '/zh/providers/google');
  assert.equal(publicPathForFilteredRoute('/en/filtered'), '/en');
  assert.equal(publicPathForFilteredRoute('/en/models'), null);
  assert.equal(publicPathForFilteredRoute('/en/filtered-models'), null);
  assert.equal(publicPathForFilteredRoute('/en/filtered/plans/opengraph-image'), null);
});
