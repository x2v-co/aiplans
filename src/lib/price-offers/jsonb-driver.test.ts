import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test, { after } from 'node:test';
import postgres, { type Sql } from 'postgres';
import { normalizeOffer, type Offer } from './contract';
import { createPostgresOfferReader, createPostgresOfferStore } from './postgres';
import { syntheticOffer, laterSynthetic } from './synthetic-fixture';
import { writeOffer, type StoredOffer } from './writer';

// No query is submitted to this real driver utility. The primary pool has zero connections;
// the lazy subscription helper is never used. Only json(), built-in serializers/parsers and
// handleValue run. No socket, credential/config loader, server or SQL execution is involved.
const carrierOnly = postgres({ host: '127.0.0.1', port: 1, database: 'synthetic_no_connection',
  user: 'synthetic_no_connection', password: 'synthetic_unused', max: 0, ssl: false });
after(() => carrierOnly.end());
const require = createRequire(import.meta.url);
// Deliberately use the same installed CJS instance as the public driver resolved by require.
// This internal pure function is the actual parameter-unwrapping path in 3.4.8, not a mock.
const { handleValue } = require(new URL('./types.js', pathToFileURL(require.resolve('postgres'))).pathname) as {
  handleValue(value: unknown, parameters: unknown[], types: number[], options: Sql['options']): string;
};
function bindJSONB(parameter: unknown, requireExplicitCarrier = true): unknown {
  const parameters: unknown[] = [], types: number[] = [];
  assert.equal(handleValue(parameter, parameters, types, carrierOnly.options), '$1');
  if (requireExplicitCarrier) assert.equal(types[0], 3802, 'each JSONB write must supply an explicit real-driver carrier');
  // Limited simulation of server ParameterDescription choosing JSONB for an unspecified OID.
  // Real unwrap + built-in serialize + parse; NOT protocol/server/constraint/isolation proof.
  const oid = types[0] || 3802;
  const encoded = carrierOnly.options.serializers[oid](parameters[0]);
  assert.equal(typeof encoded, 'string');
  return carrierOnly.options.parsers[3802](encoded);
}
function objectJSONB(parameter: unknown): Offer {
  const decoded = bindJSONB(parameter);
  assert.equal(typeof decoded, 'object'); assert.notEqual(decoded, null); assert.equal(Array.isArray(decoded), false);
  return normalizeOffer(decoded);
}

// SQL orchestration remains a LIMITED double. Every JSON column passes through the REAL
// installed driver's carrier/unwrap/serializer/parser, unlike the old statement-only double.
function adapterDouble(initial?: StoredOffer) {
  let current = initial;
  const snapshots: { site: 'insert' | 'update' | 'revision'; value: Offer }[] = [];
  const sources: Offer['sources'] = [];
  let transactions = 0;
  const db = { async begin(work: (tx: unknown) => Promise<unknown>) {
    transactions++;
    return work({
      json: carrierOnly.json,
      async unsafe(query: string, parameters: unknown[] = []) {
        if (query.includes('pg_advisory_xact_lock')) return [];
        if (query.startsWith('SELECT snapshot')) return current ? [{ snapshot: current.offer, revision: current.revision }] : [];
        if (query.startsWith('INSERT INTO public.plan_price_offers')) {
          const columns = query.match(/\(([^)]+)\) VALUES/)![1].split(',');
          const value = objectJSONB(parameters[columns.indexOf('snapshot')]);
          assert.equal(parameters[columns.indexOf('amount')], value.price.amount);
          current = { offer: value, revision: parameters[columns.indexOf('revision')] as number };
          snapshots.push({ site: 'insert', value }); return [];
        }
        if (query.startsWith('UPDATE public.plan_price_offers')) {
          assert.equal(parameters[7], current?.revision, 'CAS parameter retained');
          const value = objectJSONB(parameters[2]);
          assert.equal(parameters[0], value.price.amount);
          current = { offer: value, revision: parameters[3] as number };
          snapshots.push({ site: 'update', value }); return [{ id: value.id }];
        }
        if (query.startsWith('INSERT INTO public.plan_price_offer_revisions')) {
          snapshots.push({ site: 'revision', value: objectJSONB(parameters[2]) }); return [];
        }
        if (query.startsWith('INSERT INTO public.plan_price_offer_sources')) {
          const evidence = bindJSONB(parameters[3]);
          assert.equal(typeof evidence, 'object'); assert.notEqual(evidence, null); assert.equal(Array.isArray(evidence), false);
          const validated = normalizeOffer({ ...current!.offer, sources: [evidence, ...current!.offer.sources.filter(s => s.id !== parameters[2])] });
          assert.equal(validated.sources[0].id, parameters[2]);
          sources.push(validated.sources[0]); return [];
        }
        throw new Error(`Unexpected SQL in limited double: ${query}`);
      },
    });
  } } as unknown as Sql;
  return { db, snapshots, sources, current: () => current, transactions: () => transactions };
}

test('installed driver reproduces pre-stringified JSONB string and preserves original-object carriers', () => {
  const o = syntheticOffer();
  assert.equal(typeof bindJSONB(JSON.stringify(o), false), 'string', 'the old binding reproduces the reported defect');
  assert.equal(typeof bindJSONB(carrierOnly.json(JSON.stringify(o))), 'string', 'json(stringify(object)) is also wrong');
  assert.deepEqual(objectJSONB(carrierOnly.json(o)), o);
});

test('all four adapter JSONB sites retain root/nested objects, arrays, nulls and decimal strings over two observations', async () => {
  const d = adapterDouble();
  const first = syntheticOffer(); first.price.amount = '999999999999.99';
  first.sources[0].note = 'SYNTHETIC quotes " / backslash \\ / Unicode 税费; no official price';
  const stored = await writeOffer(createPostgresOfferStore(d.db), first, 0);
  assert.deepEqual(d.snapshots.map(s => s.site), ['insert', 'revision']);
  for (const { value } of d.snapshots) {
    assert.deepEqual(value, stored.offer);
    assert.equal(value.price.amount, '999999999999.99'); assert.equal(typeof value.price.amount, 'string');
    assert.equal(value.identity.storefrontCountry, null); assert.equal(value.identity.commitment.count, null);
    assert.equal(value.renewalOfferId, null); assert.ok(Array.isArray(value.sources)); assert.ok(Array.isArray(value.sources[0].scopes));
    assert.deepEqual(value.qualification, first.qualification); assert.deepEqual(value.identity, first.identity);
  }
  assert.deepEqual(d.sources, stored.offer.sources);
  const second = laterSynthetic(first); second.price.amount = '999999999998.01';
  const updated = await writeOffer(createPostgresOfferStore(d.db), second, 1);
  assert.deepEqual(d.snapshots.map(s => s.site), ['insert', 'revision', 'update', 'revision']);
  assert.deepEqual(d.snapshots[2].value, updated.offer); assert.deepEqual(d.snapshots[3].value, updated.offer);
  assert.equal(updated.offer.sources.length, 2); assert.equal(updated.revision, 2);
  assert.equal(d.snapshots[0].value.price.amount, '999999999999.99', 'first revision retains exact original decimal');
  assert.equal(d.current()!.offer.price.amount, '999999999998.01');
  assert.deepEqual(d.sources, updated.offer.sources); assert.equal(d.transactions(), 2);
});

test('unknown nullable fields remain explicit JSON nulls through the same real-driver binding path', async () => {
  const d = adapterDouble(); const o = syntheticOffer();
  o.identity.entitlementGroup = null; o.identity.entitlementVersion = null; o.identity.merchant = null;
  o.identity.market = { scope: 'unknown', country: null }; o.identity.eligibilityClass = null;
  o.identity.billing = { period: 'unknown', count: null }; o.identity.unit = 'unknown'; o.identity.unitCount = null;
  o.price = { kind: 'unknown', amount: null, currency: null };
  const result = await writeOffer(createPostgresOfferStore(d.db), o, 0);
  assert.deepEqual(d.snapshots[0].value, result.offer); assert.deepEqual(d.snapshots[1].value, result.offer);
  assert.equal(d.snapshots[0].value.price.amount, null); assert.equal(d.snapshots[0].value.identity.billing.count, null);
});

test('invalid precision/currency and manual/CAS refusals still prevent JSONB writes', async () => {
  const d = adapterDouble(); const store = createPostgresOfferStore(d.db);
  for (const price of [{ kind: 'priced', amount: '1.001', currency: 'CNY' }, { kind: 'priced', amount: '1', currency: 'XYZ' }])
    await assert.rejects(writeOffer(store, { ...syntheticOffer(), price }, 0));
  assert.equal(d.transactions(), 0); assert.deepEqual(d.snapshots, []);
  await writeOffer(store, syntheticOffer(), 0);
  const before = structuredClone(d.snapshots);
  await assert.rejects(writeOffer(store, laterSynthetic(), 0), /Revision conflict/);
  const scraped = laterSynthetic(); scraped.authority = 'scraper'; scraped.state = 'unverified'; scraped.reviewedAt = null;
  for (const key of Object.keys(scraped.reviews) as (keyof Offer['reviews'])[]) scraped.reviews[key] = 'unverified';
  scraped.tax.review = 'unverified'; scraped.validity.status = 'unverified';
  for (const condition of Object.values(scraped.qualification)) condition.status = 'unverified';
  await assert.rejects(writeOffer(store, scraped, 1), /erased review|Manual source/);
  assert.deepEqual(d.snapshots, before);
});

test('reader and writer-find reject JSONB strings/arrays/null and invalid objects, never double-parse malformed rows', async () => {
  for (const snapshot of [JSON.stringify(syntheticOffer()), [], null, { ...syntheticOffer(), price: { amount: '1.001', currency: 'CNY', kind: 'priced' } }]) {
    const rows = [{ snapshot, revision: 1 }];
    const db = { async unsafe(query: string) { return query.includes('to_regclass') ? [{ present: true }] : rows; } } as unknown as Sql;
    await assert.rejects(createPostgresOfferReader(db).read([1]));
    const store = { async begin(work: (tx: unknown) => Promise<unknown>) { return work({
      async unsafe(query: string) { if (query.includes('pg_advisory')) return []; assert.match(query, /^SELECT snapshot/); return rows; },
      json() { assert.fail('Malformed current rows must refuse before save'); },
    }); } } as unknown as Sql;
    await assert.rejects(writeOffer(createPostgresOfferStore(store), laterSynthetic(), 1));
  }
});
