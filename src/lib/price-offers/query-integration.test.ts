import test from 'node:test';
import assert from 'node:assert/strict';
import { loadQueryModule } from '../test-helpers/query-module';
import { syntheticOffer } from './synthetic-fixture';
import type { OfferReader } from './read';

// Real query-module orchestration, injected DB-free row providers. No client/credentials loaded.
for (const status of ['available', 'missing-table'] as const) test(`opt-in provider/model/catalog models attach ${status} while retaining legacy values`, async () => {
  const plan = { id: 1, name: 'Synthetic legacy plan', price: 20, currency: 'USD', provider_id: null };
  let reads = 0;
  const reader: OfferReader = { async read(ids) {
    reads++; assert.deepEqual([...ids], [1]);
    return { status, rows: status === 'available' ? [{ offer: syntheticOffer(), revision: 1 }] : [] };
  } };
  const offerModules = { './price-offers/postgres': { createPostgresOfferReader: () => reader } };
  const catalog = loadQueryModule(new URL('../plans.ts', import.meta.url), {
    ...offerModules,
    '@/lib/db': { sql: async () => [plan] },
  }) as typeof import('../plans');
  const listed = await catalog.getPlans({ includePriceOffers: true });
  assert.equal(listed[0].price, 20); assert.equal(listed[0].currency, 'USD'); assert.equal(listed[0].priceOfferStatus, status);
  const model = loadQueryModule(new URL('../model-plans-query.ts', import.meta.url), {
    ...offerModules,
    './db': { sql: Object.assign(async () => [plan], { array: (values: unknown[]) => values }) },
  }) as typeof import('../model-plans-query');
  const models = await model.getModelPlans(1, null, [], new Date('2026-11-17'), { includePriceOffers: true });
  assert.equal(models[0].priceOfferStatus, status); assert.equal(models[0].price, 20);
  const provider = loadQueryModule(new URL('../provider-plans-query.ts', import.meta.url), {
    ...offerModules,
    './db': { sql: async (strings: TemplateStringsArray) => strings.join('').includes('FROM providers') ? [{ id: 2 }] : [plan] },
    './schema-adapters': { getAllModelIdsForProvider: async () => [] },
  }) as typeof import('../provider-plans-query');
  const result = await provider.getPlansByProvider('synthetic-provider', { includePriceOffers: true });
  assert.equal(result!.plans[0].priceOfferStatus, status); assert.equal(result!.plans[0].price, 20);
  assert.equal(reads, 3);
});
