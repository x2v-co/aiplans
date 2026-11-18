import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { planPriceOffers, planPriceOfferRevisions, planPriceOfferSources } from './index';
import { identityColumns, identityValues } from '../../lib/price-offers/postgres';
import { syntheticOffer } from '../../lib/price-offers/synthetic-fixture';
const migration = readFileSync(new URL('../../../drizzle/0017_plan_price_offers.sql', import.meta.url), 'utf8');

test('migration definition is explicit additive storage, never backfills legacy/API prices or auto-runs', () => {
  const sql = migration.replace(/--[^\n]*/g, '');
  assert.equal([...sql.matchAll(/CREATE TABLE /g)].length, 3);
  assert.doesNotMatch(sql, /\b(UPDATE|DELETE|DROP|TRUNCATE|INSERT|ALTER)\b/i);
  for (const table of [planPriceOffers, planPriceOfferRevisions, planPriceOfferSources]) {
    const config = getTableConfig(table);
    assert.match(sql, new RegExp(`CREATE TABLE ${config.name} \\(`));
    for (const column of config.columns) assert.ok(sql.includes(column.name), column.name);
    for (const constraint of [...config.checks, ...config.uniqueConstraints]) assert.ok(sql.includes(constraint.name!), constraint.name);
    for (const fk of config.foreignKeys) assert.ok(fk.reference().foreignColumns.length > 0);
  }
  const journal = readFileSync(new URL('../../../drizzle/meta/_journal.json', import.meta.url), 'utf8');
  const runner = readFileSync(new URL('../../../scripts/migrate-data-accuracy.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(journal + runner, /0017_plan_price_offers/);
});
test('complete normalized identity uses NOT NULL sentinels and a full SQL unique constraint', () => {
  const config = getTableConfig(planPriceOffers);
  const unique = config.uniqueConstraints.find(c => c.name === 'plan_price_offers_identity_unique')!;
  assert.deepEqual(unique.columns.map(c => c.name), identityColumns);
  for (const column of unique.columns) {
    assert.equal(column.notNull, true);
    assert.match(migration, new RegExp(`\\b${column.name} (?:text|integer) NOT NULL`));
  }
  const unknown = syntheticOffer().identity;
  unknown.entitlementGroup = null; unknown.entitlementVersion = null; unknown.eligibilityClass = null;
  unknown.market = { scope: 'unknown', country: null };
  const values = identityValues(unknown);
  assert.equal(values.length, identityColumns.length); assert.equal(values.includes(null as never), false);
  assert.match(migration, /snapshot->'identity' = jsonb_build_object/);
  assert.match(migration, /scale\(amount\) <= CASE/);
  assert.match(migration, /amount numeric,/); assert.doesNotMatch(migration, /numeric\(\d/);
});
