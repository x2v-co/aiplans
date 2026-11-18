import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPriceOffers, offerDTO, type OfferReader } from './read';
import { syntheticOffer } from './synthetic-fixture';
import { createPostgresOfferReader, createPostgresOfferStore } from './postgres';
import type { Sql } from 'postgres';
import { writeOffer } from './writer';

test('no offer and pre-migration reads preserve all legacy prices/support metadata, never manufacture offers', async () => {
  const plans = [{ id: 1, price: 20, currency: 'USD', region: 'global', supported_regions: ['CN'], access_from_china: true }];
  for (const status of ['available', 'missing-table'] as const) {
    const result = await attachPriceOffers(plans, { async read() { return { status, rows: [] }; } });
    assert.deepEqual(result, [{ ...plans[0], priceOffers: [], priceOfferStatus: status }]);
    assert.equal((plans[0] as { priceOffers?: unknown }).priceOffers, undefined);
  }
});
test('typed original price, tax/qualification, scoped source review/observation and labeled quarterly equivalent', async () => {
  const o = syntheticOffer(); o.identity.billing.count = 3;
  const [row] = await attachPriceOffers([{ id: 1 }], { async read() { return { status: 'available', rows: [{ offer: o, revision: 1 }] }; } });
  const dto = row.priceOffers![0];
  assert.equal(dto.originalPrice.amount, '10.00'); assert.equal(dto.monthlyEquivalent?.label, 'quarterly_monthly_equivalent');
  assert.equal(dto.monthlyEquivalent?.denominator, '300'); assert.equal(dto.tax.status, 'included');
  assert.equal(dto.qualification.payment.status, 'reviewed'); assert.notEqual(dto.observedAt, dto.reviewedAt);
  assert.equal('fx' in dto, false); // FX is separate provenance, never a fabricated original price.
});
test('loader errors propagate; empty requests do not query; unrequested/duplicate rows refuse', async () => {
  const reader: OfferReader = { async read() { throw new Error('permission denied'); } };
  await assert.rejects(attachPriceOffers([{ id: 1 }], reader), /permission denied/);
  assert.deepEqual(await attachPriceOffers([], reader), []);
  const o = syntheticOffer();
  await assert.rejects(attachPriceOffers([{ id: 2 }], { async read() { return { status: 'available', rows: [{ offer: o, revision: 1 }] }; } }), /unrequested/);
  const row = { offer: o, revision: 1 };
  await assert.rejects(attachPriceOffers([{ id: 1 }], { async read() { return { status: 'available', rows: [row, row] }; } }), /Duplicate/);
  assert.equal(offerDTO(row).monthlyEquivalent, null);
});
test('Postgres reader uses exact relation probe; permission/syntax/other missing-relation failures are never swallowed', async () => {
  // Scripted SQL contract double; no client creation or real PG claims.
  let calls = 0;
  const absent = { async unsafe(query: string) { calls++; assert.equal(query, "SELECT to_regclass('public.plan_price_offers') IS NOT NULL AS present"); return [{ present: false }]; } } as unknown as Sql;
  assert.equal((await createPostgresOfferReader(absent).read([1])).status, 'missing-table'); assert.equal(calls, 1);
  for (const code of ['42501', '42601', '42P01', '08006']) {
    const db = { async unsafe() { throw Object.assign(new Error('unrelated database error'), { code }); } } as unknown as Sql;
    await assert.rejects(createPostgresOfferReader(db).read([1]), /unrelated database error/);
  }
});
test('Postgres writer issues locks + current/revision/source SQL in a single injected transaction, no ON CONFLICT overwrite', async () => {
  const statements: string[] = []; let transactions = 0;
  const db = { async begin(work: (tx: unknown) => Promise<unknown>) {
    transactions++;
    // Statement-order double only; real carrier/serializer coverage is in jsonb-driver.test.ts.
    return work({ json: (value: unknown) => ({ type: 3802, value }),
      async unsafe(query: string) { statements.push(query); return []; } });
  } } as unknown as Sql;
  await writeOffer(createPostgresOfferStore(db), syntheticOffer(), 0);
  assert.equal(transactions, 1);
  assert.equal(statements.filter(q => q.includes('pg_advisory_xact_lock')).length, 2);
  assert.match(statements[2], /FOR UPDATE/);
  assert.match(statements[3], /INSERT INTO public.plan_price_offers/);
  assert.match(statements[4], /INSERT INTO public.plan_price_offer_revisions/);
  assert.match(statements[5], /INSERT INTO public.plan_price_offer_sources/);
  assert.doesNotMatch(statements.join('\n'), /ON CONFLICT|price_history|UPDATE plans/);
});

test('optional exact FX read value retains pair/source/valuation time separate from price review', () => {
  const o = syntheticOffer();
  const fx = { base: 'CNY', quote: 'USD', rate: '0.14', source: 'https://example.com/synthetic-fx',
    validAt: '2026-11-16T00:00:00Z', observedAt: '2026-11-16T01:00:00Z', basis: 'synthetic', status: 'reviewed' } as const;
  const dto = offerDTO({ offer: o, revision: 1 }, fx);
  assert.equal(dto.originalPrice.currency, 'CNY'); assert.equal(dto.conversion?.currency, 'USD');
  assert.notEqual(dto.conversion?.fx.validAt, dto.reviewedAt); assert.equal(dto.conversion?.fx.source, fx.source);
  assert.throws(() => offerDTO({ offer: o, revision: 1 }, { ...fx, base: 'USD' }), /pair does not match/);
});
