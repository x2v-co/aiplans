import test from 'node:test';
import assert from 'node:assert/strict';
import { businessKey, type Offer } from './contract';
import { writeOffer, type OfferStore, type StoredOffer } from './writer';
import { syntheticOffer, laterSynthetic } from './synthetic-fixture';

// Transactional in-memory CONTRACT MODEL only, not PostgreSQL isolation/race/rollback proof.
function modelStore() {
  let data = { current: [] as StoredOffer[], revisions: [] as StoredOffer[], sources: [] as Offer['sources'] };
  let failSource = false;
  const locks: string[] = [];
  const store: OfferStore = { async transaction(work) {
    const draft = structuredClone(data);
    const result = await work({
      async lock(id, identity) { locks.push(id, businessKey(identity)); },
      async find(id, identity) { return draft.current.filter(r => r.offer.id === id || businessKey(r.offer.identity) === businessKey(identity)); },
      async save(offer, expected, sources) {
        const row = { offer: structuredClone(offer), revision: expected + 1 };
        draft.current = draft.current.filter(r => r.offer.id !== offer.id).concat(row);
        draft.revisions.push(row);
        if (failSource) throw new Error('Synthetic source insert failure');
        draft.sources.push(...sources);
      },
    });
    data = draft; return result;
  } };
  return { store, locks, data: () => data, fail: () => { failSource = true; }, duplicate: (row: StoredOffer) => { data.current.push(row); } };
}
test('source-protecting writer preserves stable id, revisions and all historical evidence', async () => {
  const m = modelStore(); const a = syntheticOffer();
  await writeOffer(m.store, a, 0);
  const b = laterSynthetic(); b.price.amount = '11';
  const row = await writeOffer(m.store, b, 1);
  assert.equal(row.revision, 2); assert.equal(row.offer.id, a.id); assert.equal(row.offer.sources.length, 2);
  assert.equal(m.data().revisions.length, 2); assert.equal(m.data().sources.length, 2); assert.equal(m.locks.length, 4);
});
test('model transaction source failure leaves current + revision + sources unchanged', async () => {
  const m = modelStore(); await writeOffer(m.store, syntheticOffer(), 0); const before = structuredClone(m.data()); m.fail();
  await assert.rejects(writeOffer(m.store, laterSynthetic(), 1), /source insert failure/);
  assert.deepEqual(m.data(), before);
});
const rejectionCases: [string, (o: Offer) => void, number, RegExp][] = [
  ['older', o => { o.observedAt = '2026-10-01T00:00:00Z'; o.sources[0].observedAt = o.observedAt; }, 1, /older observation/],
  ['same observation', () => {}, 1, /older observation/],
  ['stale CAS', o => Object.assign(o, laterSynthetic()), 0, /Revision conflict/],
  ['identity mismatch', o => { Object.assign(o, laterSynthetic()); o.identity.billing.count = 3; }, 1, /identity mismatch/],
  ['different id same identity', o => { Object.assign(o, laterSynthetic()); o.id = 'synthetic-different-id'; }, 1, /identity mismatch/],
  ['older review', o => { Object.assign(o, laterSynthetic()); o.reviewedAt = '2026-10-01T00:00:00Z'; }, 1, /Review precedes|Missing current reviewed/],
  ['conditions conflict', o => { Object.assign(o, laterSynthetic()); o.qualification.payment.description = 'Synthetic changed'; }, 1, /Conflicting conditions/],
  ['erased tax evidence', o => { Object.assign(o, laterSynthetic()); o.reviews.tax = 'unknown'; o.tax.review = 'unknown'; }, 1, /cannot be downgraded/],
  ['scraper over manual', o => {
    Object.assign(o, laterSynthetic()); o.authority = 'scraper'; o.state = 'unverified'; o.reviewedAt = null;
    for (const key of Object.keys(o.reviews) as (keyof Offer['reviews'])[]) o.reviews[key] = 'unverified';
    o.tax.review = 'unverified'; o.validity.status = 'unverified';
    for (const c of Object.values(o.qualification)) c.status = 'unverified';
  }, 1, /erased review|Manual source/],
  ['immutable source', o => { Object.assign(o, laterSynthetic()); o.sources[0].id = 'synthetic-source-a'; }, 1, /Immutable source/],
];
for (const [name, mutate, revision, error] of rejectionCases) test(`writer refuses ${name} without touching any records`, async () => {
  const m = modelStore(); await writeOffer(m.store, syntheticOffer(), 0); const before = structuredClone(m.data());
  const b = syntheticOffer(); mutate(b); await assert.rejects(writeOffer(m.store, b, revision), error); assert.deepEqual(m.data(), before);
});
test('duplicate database keys refuse rather than overwrite', async () => {
  const m = modelStore(); await writeOffer(m.store, syntheticOffer(), 0); m.duplicate(m.data().current[0]);
  await assert.rejects(writeOffer(m.store, laterSynthetic(), 1), /Duplicate identity/);
});
test('same plan multi-channel offers do not replace each other', async () => {
  const m = modelStore(); const a = syntheticOffer(); await writeOffer(m.store, a, 0);
  const b = syntheticOffer(); b.id = 'synthetic-store-us'; b.identity.channel = 'app_store'; b.identity.storefrontCountry = 'US';
  await writeOffer(m.store, b, 0); assert.equal(m.data().current.length, 2);
});
test('conflicting conditions refuse even when incoming data claims quarantine', async () => {
  const m = modelStore(); await writeOffer(m.store, syntheticOffer(), 0); const before = structuredClone(m.data());
  const b = laterSynthetic(); b.qualification.payment.description = 'Synthetic conflicting requirement'; b.state = 'conflict';
  await assert.rejects(writeOffer(m.store, b, 1), /Conflicting conditions/); assert.deepEqual(m.data(), before);
});
test('current evidence can be explicitly marked conflict without replacing its terms or losing audit sources', async () => {
  const m = modelStore(); await writeOffer(m.store, syntheticOffer(), 0);
  const b = laterSynthetic(); b.state = 'conflict'; await writeOffer(m.store, b, 1);
  assert.equal(m.data().current[0].offer.state, 'conflict'); assert.equal(m.data().sources.length, 2);
});
test('original denomination changes are conflicting terms, not an amount update', async () => {
  const m = modelStore(); await writeOffer(m.store, syntheticOffer(), 0); const before = structuredClone(m.data());
  const b = laterSynthetic(); b.price.currency = 'USD';
  await assert.rejects(writeOffer(m.store, b, 1), /Conflicting conditions/); assert.deepEqual(m.data(), before);
});
