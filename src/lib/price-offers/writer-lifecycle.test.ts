import assert from 'node:assert/strict';
import test from 'node:test';
import { businessKey, normalizeOffer, type Offer } from './contract';
import { rankOffers } from './compare';
import { offerDTO } from './read';
import { syntheticOffer, laterSynthetic, syntheticContext } from './synthetic-fixture';
import { writeOffer, type OfferStore, type StoredOffer } from './writer';

// SYNTHETIC, LIMITED transactional contract model. No driver, DB config, SQL or socket.
// Draft rollback and per-offer ledger model intent, not PG constraints/isolation/role proof.
function model() {
  let data = { current: [] as StoredOffer[], revisions: [] as StoredOffer[],
    sources: [] as { offerId: string; revision: number; evidence: Offer['sources'][number] }[] };
  let failure: 'revision' | 'source' | undefined;
  const store: OfferStore = { async transaction(work) {
    const draft = structuredClone(data);
    const result = await work({
      async lock() {},
      async find(id, identity) { return draft.current.filter(r => r.offer.id === id || businessKey(r.offer.identity) === businessKey(identity)); },
      async save(offer, expected, sources) {
        assert.equal(draft.current.find(r => r.offer.id === offer.id)?.revision ?? 0, expected);
        const row = { offer: structuredClone(offer), revision: expected + 1 };
        draft.current = draft.current.filter(r => r.offer.id !== offer.id).concat(row);
        if (failure === 'revision') throw new Error('Synthetic revision insertion failure');
        draft.revisions.push(structuredClone(row));
        for (const source of sources) {
          draft.sources.push({ offerId: offer.id, revision: row.revision, evidence: structuredClone(source) });
          if (failure === 'source') throw new Error('Synthetic source insertion failure');
        }
      },
    });
    data = draft; return result;
  } };
  return { store, data: () => structuredClone(data), fail: (stage: typeof failure) => { failure = stage; } };
}
const enrichments: [string, (o: Offer) => void][] = [
  ['tax metadata', o => { o.tax.review = 'unknown'; o.reviews.tax = 'unknown'; }],
  ['unknown original price', o => { o.price = { kind: 'unknown', amount: null, currency: null }; o.reviews.price = 'unknown'; o.state = 'unverified'; }],
  ['unknown validity', o => { o.validity = { status: 'unknown', startsAt: null, endsAt: null, openEnded: false }; o.reviews.validity = 'unknown'; }],
  ['qualification metadata', o => { for (const c of Object.values(o.qualification)) c.status = 'unverified'; o.reviews.eligibility = 'unknown'; }],
];
for (const [name, initial] of enrichments) {
  test(`B1 ${name} enriches same ID/key to revision2 with full immutable snapshots and source ownership`, async () => {
    const m = model(), a = syntheticOffer(); initial(a);
    const first = await writeOffer(m.store, normalizeOffer(a), 0);
    const next = normalizeOffer(laterSynthetic());
    assert.equal(businessKey(first.offer.identity), businessKey(next.identity));
    assert.deepEqual(rankOffers([first.offer], syntheticContext()).cheapest, []);
    const before = m.data(), alternate = structuredClone(next); alternate.id = 'synthetic-alternate';
    await assert.rejects(writeOffer(m.store, alternate, 0), /Stable id\/business identity mismatch/);
    assert.deepEqual(m.data(), before);
    const second = await writeOffer(m.store, next, 1);
    const expected = { ...next, sources: [...first.offer.sources, ...next.sources] };
    assert.equal(second.revision, 2); assert.equal(second.offer.id, first.offer.id);
    assert.deepEqual(second.offer, expected);
    assert.deepEqual(m.data(), { current: [second], revisions: [first, second], sources: [
      { offerId: first.offer.id, revision: 1, evidence: first.offer.sources[0] },
      { offerId: first.offer.id, revision: 2, evidence: next.sources[0] },
    ] });
    assert.deepEqual(offerDTO(second).originalPrice, next.price);
    assert.deepEqual(offerDTO(second).qualification, next.qualification);
    assert.deepEqual(rankOffers([second.offer], syntheticContext()).cheapest, [first.offer.id]);
    // The caller's current-scope evidence is not mutated to become the historical ledger.
    assert.equal(next.sources.length, 1); assert.equal(first.offer.sources.length, 1);
  });
  for (const stage of ['revision', 'source'] as const) test(`LIMITED model ${name} ${stage} failure conserves all current/history/source`, async () => {
    const m = model(), a = syntheticOffer(); initial(a); await writeOffer(m.store, a, 0);
    const before = m.data(); m.fail(stage);
    await assert.rejects(writeOffer(m.store, laterSynthetic(), 1), /Synthetic .* insertion failure/);
    assert.deepEqual(m.data(), before);
  });
}

test('same-currency price control retains exact decimal charge, history and original identity', async () => {
  const m = model(), a = syntheticOffer(); a.price.amount = '999999999999.99';
  const first = await writeOffer(m.store, a, 0), next = laterSynthetic(); next.price.amount = '999999999998.01';
  const second = await writeOffer(m.store, next, 1);
  assert.equal(second.offer.price.amount, '999999999998.01');
  assert.equal(m.data().revisions[0].offer.price.amount, '999999999999.99');
  assert.equal(businessKey(first.offer.identity), businessKey(second.offer.identity));
});

const completions: [string, (o: Offer) => void, (o: Offer) => void][] = [
  ['tax facts', o => { o.tax = { status: 'unknown', review: 'unknown', description: null }; o.reviews.tax = 'unknown'; }, () => {}],
  ['qualification descriptions', o => { for (const c of Object.values(o.qualification)) { c.status = 'unknown'; c.description = null; } o.reviews.eligibility = 'unknown'; }, () => {}],
  ['partial validity', o => { o.validity.endsAt = null; o.validity.status = 'unverified'; o.reviews.validity = 'unknown'; }, () => {}],
  ['unknown no-end assertion', o => { o.validity.endsAt = null; o.validity.status = 'unknown'; o.reviews.validity = 'unknown'; }, o => { o.validity.endsAt = null; o.validity.openEnded = true; }],
  ['explicit free price', o => { o.price = { kind: 'unknown', amount: null, currency: null }; o.reviews.price = 'unknown'; o.state = 'unverified'; }, o => { o.price.kind = 'free'; o.price.amount = '0'; }],
];
for (const [name, initial, incoming] of completions) test(`reviewed unknown completion: ${name}`, async () => {
  const m = model(), a = syntheticOffer(); initial(a); await writeOffer(m.store, a, 0);
  const next = laterSynthetic(); incoming(next);
  const second = await writeOffer(m.store, next, 1);
  assert.equal(second.revision, 2); assert.equal(second.offer.id, a.id);
  assert.deepEqual(second.offer.tax, normalizeOffer(next).tax);
  assert.deepEqual(second.offer.validity, normalizeOffer(next).validity);
  assert.equal(m.data().revisions.length, 2); assert.equal(m.data().sources.length, 2);
});

const conflicts: [string, (o: Offer) => void, (o: Offer) => void, RegExp][] = [
  ['known original currency', () => {}, o => { o.price.currency = 'USD'; }, /Conflicting conditions/],
  ['erase known currency/charge', () => {}, o => { o.price = { kind: 'unknown', amount: null, currency: null }; }, /Conflicting conditions/],
  ['sales is not a missing price', o => { o.price = { kind: 'sales', amount: null, currency: 'CNY' }; }, () => {}, /Conflicting conditions/],
  ['known tax inclusion', () => {}, o => { o.tax.status = 'excluded'; }, /Conflicting conditions/],
  ['erase known tax inclusion', () => {}, o => { o.tax.status = 'unknown'; }, /Conflicting conditions/],
  ['known tax text', () => {}, o => { o.tax.description = 'Synthetic different terms'; }, /Conflicting conditions/],
  ['erase known tax text', () => {}, o => { o.tax.description = null; }, /Conflicting conditions/],
  ...(['account', 'payment', 'seat'] as const).map(field => [
    `known ${field} description`, () => {}, (o: Offer) => { o.qualification[field].description = 'Synthetic changed qualification'; }, /Conflicting conditions/,
  ] as [string, (o: Offer) => void, (o: Offer) => void, RegExp]),
  ['known start', () => {}, o => { o.validity.startsAt = '2026-10-31T00:00:00Z'; }, /Conflicting conditions/],
  ['known end', () => {}, o => { o.validity.endsAt = '2026-12-02T00:00:00Z'; }, /Conflicting conditions/],
  ['bounded is not open ended', () => {}, o => { o.validity.endsAt = null; o.validity.openEnded = true; }, /Conflicting conditions/],
  ['reviewed no-end is known', o => { o.validity.endsAt = null; o.validity.openEnded = true; }, () => {}, /Conflicting conditions/],
  ['unverified no-end is still an explicit fact', o => { o.validity.endsAt = null; o.validity.openEnded = true; o.validity.status = 'unverified'; o.reviews.validity = 'unknown'; }, () => {}, /Conflicting conditions/],
  ['null renewal association stays outside B1', () => {}, o => { o.renewalOfferId = 'synthetic-renewal'; }, /Conflicting conditions/],
  ['known renewal association', o => { o.renewalOfferId = 'synthetic-renewal'; }, () => {}, /Conflicting conditions/],
  ['tax review inverse', () => {}, o => { o.tax.review = 'unverified'; }, /Review.*downgraded/],
  ['qualification review inverse', () => {}, o => { o.qualification.payment.status = 'unknown'; }, /Review.*downgraded/],
  ['validity review inverse', () => {}, o => { o.validity.status = 'unknown'; }, /Review.*downgraded/],
  ['unverified scope cannot become unknown', o => { o.reviews.tax = 'unverified'; o.tax.review = 'unverified'; }, o => { o.reviews.tax = 'unknown'; o.tax.review = 'unverified'; }, /Review.*downgraded/],
  ['unverified tax metadata cannot become unknown', o => { o.reviews.tax = 'unknown'; o.tax.review = 'unverified'; }, o => { o.reviews.tax = 'unknown'; o.tax.review = 'unknown'; }, /Review.*downgraded/],
];
for (const [name, initial, incoming, error] of conflicts) test(`B1 refuses ${name} with individually valid contracts and no record changes`, async () => {
  const m = model(), a = syntheticOffer(); initial(a); await writeOffer(m.store, normalizeOffer(a), 0);
  const before = m.data(), next = laterSynthetic(); incoming(next); normalizeOffer(next);
  await assert.rejects(writeOffer(m.store, next, 1), error); assert.deepEqual(m.data(), before);
});

for (const scope of ['tax', 'price', 'validity', 'eligibility'] as const) test(`approval missing fresh ${scope} source scope refuses`, async () => {
  const m = model(), a = syntheticOffer();
  if (scope === 'tax') enrichments[0][1](a);
  if (scope === 'price') enrichments[1][1](a);
  if (scope === 'validity') enrichments[2][1](a);
  if (scope === 'eligibility') enrichments[3][1](a);
  await writeOffer(m.store, a, 0); const before = m.data(), next = laterSynthetic();
  next.sources[0].scopes = next.sources[0].scopes.filter(s => s !== scope);
  await assert.rejects(writeOffer(m.store, next, 1), /Missing current reviewed/); assert.deepEqual(m.data(), before);
});
for (const [name, mutate] of [
  ['stale source', (o: Offer) => { o.sources[0].observedAt = '2026-11-01T00:00:00Z'; }],
  ['unverified source', (o: Offer) => { o.sources[0].status = 'unverified'; }],
  ['missing manual reviewer', (o: Offer) => { o.sources[0].reviewedBy = null; }],
  ['scraper self approval', (o: Offer) => { o.authority = 'scraper'; }],
  ['immutable source ID content', (o: Offer) => { o.sources[0].id = 'synthetic-source-a'; }],
] as const) test(`B1 rejects ${name} without audit changes`, async () => {
  const m = model(), a = syntheticOffer(); enrichments[0][1](a); await writeOffer(m.store, a, 0);
  const before = m.data(), next = laterSynthetic(); mutate(next);
  await assert.rejects(writeOffer(m.store, next, 1)); assert.deepEqual(m.data(), before);
});

test('known price completion cannot use unreviewed price scope despite other reviewed fields', async () => {
  const m = model(), a = syntheticOffer(); enrichments[1][1](a); await writeOffer(m.store, a, 0);
  const before = m.data(), next = laterSynthetic(); next.reviews.price = 'unknown'; next.state = 'unverified';
  next.sources[0].scopes = next.sources[0].scopes.filter(s => s !== 'price'); normalizeOffer(next);
  await assert.rejects(writeOffer(m.store, next, 1), /Enrichment requires.*price evidence/);
  assert.deepEqual(m.data(), before);
});

test('new source cannot compensate for stale CAS or older observation/review', async () => {
  const m = model(), a = syntheticOffer(); enrichments[0][1](a);
  a.reviewedAt = '2026-11-05T01:00:00Z'; a.sources[0].reviewedAt = a.reviewedAt;
  await writeOffer(m.store, a, 0); const before = m.data();
  await assert.rejects(writeOffer(m.store, laterSynthetic(), 0), /Revision conflict/);
  await assert.rejects(writeOffer(m.store, laterSynthetic(), 1), /Older or erased review/);
  const old = structuredClone(a); old.sources[0].id = 'synthetic-fresh-id-old-observation';
  await assert.rejects(writeOffer(m.store, old, 1), /older observation/); assert.deepEqual(m.data(), before);
});

test('identity unknown completion is refused, even with current manual evidence', async () => {
  const m = model(), a = syntheticOffer(); a.identity.market = { scope: 'unknown', country: null };
  await writeOffer(m.store, a, 0); const before = m.data();
  await assert.rejects(writeOffer(m.store, laterSynthetic(), 1), /Stable id\/business identity mismatch/); assert.deepEqual(m.data(), before);
});

test('source IDs belong to each offer; enriching one offer preserves the other ledger', async () => {
  const m = model(), a = syntheticOffer(); enrichments[0][1](a); await writeOffer(m.store, a, 0);
  const other = syntheticOffer(); other.id = 'synthetic-other'; other.identity.merchant = 'synthetic-other-merchant';
  await writeOffer(m.store, other, 0); const otherBefore = m.data().current[1];
  await writeOffer(m.store, laterSynthetic(), 1);
  assert.deepEqual(m.data().current.find(r => r.offer.id === other.id), otherBefore);
  assert.deepEqual(m.data().sources.filter(s => s.offerId === other.id), [
    { offerId: other.id, revision: 1, evidence: other.sources[0] },
  ]);
  assert.equal(m.data().sources.filter(s => s.evidence.id === 'synthetic-source-a').length, 2);
  assert.equal(m.data().sources.filter(s => s.offerId === a.id).length, 2);
});

test('one field enrichment does not approve remaining unknown purchase qualifications', async () => {
  const m = model(), a = syntheticOffer(); enrichments[0][1](a);
  a.qualification.payment.status = 'unknown'; await writeOffer(m.store, a, 0);
  const next = laterSynthetic(); next.qualification.payment.status = 'unknown';
  const second = await writeOffer(m.store, next, 1);
  const result = rankOffers([second.offer], syntheticContext());
  assert.deepEqual(result.cheapest, []); assert.ok(result.excluded[0].reasons.includes('purchase_qualification_unknown_or_different'));
  assert.equal(offerDTO(second).qualification.payment.status, 'unknown');
});
