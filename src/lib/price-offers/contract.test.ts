import test from 'node:test';
import assert from 'node:assert/strict';
import { businessKey, instant, moneyUnits, normalizeOffer, publicUrl } from './contract';
import { syntheticOffer } from './synthetic-fixture';
import { identityValues } from './postgres';

test('SYNTHETIC normalized exact original money and zoned timestamps; key excludes price/time', () => {
  const o = syntheticOffer();
  assert.equal(o.price.amount, '10.00');
  assert.equal(moneyUnits('999999999999.99', 'CNY'), BigInt('99999999999999'));
  const changed = structuredClone(o); changed.price.amount = '11.25'; changed.observedAt = '2026-11-03T00:00:00Z';
  assert.equal(businessKey(o.identity), businessKey(changed.identity));
  assert.equal(instant.parse('2026-11-01T08:00:00+08:00'), o.observedAt);
});
for (const value of ['NaN', 'Infinity', '-1', '+1', '1e2', '01', '.5', '1.', '1.001', '1000000000000', ' 1', '1,000']) {
  test(`rejects invalid money ${JSON.stringify(value)}`, () => assert.throws(() => moneyUnits(value, 'USD')));
}
test('unsupported currency/precision and free versus sales/unknown are explicit', () => {
  assert.throws(() => moneyUnits('1.1', 'JPY'));
  const o = syntheticOffer();
  assert.throws(() => normalizeOffer({ ...o, price: { kind: 'priced', amount: '1', currency: 'XYZ' } }));
  for (const currency of [null, undefined]) assert.throws(() => normalizeOffer({ ...o, price: { ...o.price, currency } }));
  assert.throws(() => normalizeOffer({ ...o, price: { ...o.price, kind: 'free' } }));
  assert.throws(() => normalizeOffer({ ...o, price: { ...o.price, kind: 'sales', amount: '0' } }));
  assert.equal(normalizeOffer({ ...o, price: { kind: 'free', amount: '0', currency: 'USD' } }).price.amount, '0.00');
  assert.equal(normalizeOffer({ ...o, price: { kind: 'unknown', amount: null, currency: null } }).price.currency, null);
});
for (const value of ['2026-11-01', '2026-11-01T00:00:00', '2026-02-30T00:00:00Z', '2026-11-01T25:00:00Z']) {
  test(`rejects invalid/non-zoned instant ${value}`, () => assert.equal(instant.safeParse(value).success, false));
}
for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com?token=secret', 'https://example.com/#secret', 'https://127.0.0.1', 'https://[::1]', 'https://metadata.internal/a', 'file:///tmp/a']) {
  test(`rejects unsafe documentary URL ${url.split('?')[0]}`, () => assert.equal(publicUrl.safeParse(url).success, false));
}
test('all business identity dimensions distinguish offers, deterministic absent dimensions', () => {
  const i = syntheticOffer().identity;
  const mutations = [
    { planId: 2 }, { entitlementGroup: 'synthetic-other' }, { entitlementVersion: 'synthetic-v2' },
    { market: { scope: 'international', country: null } }, { merchant: 'synthetic-other' }, { channel: 'reseller' },
    { channel: 'app_store', storefrontCountry: 'US' }, { billing: { period: 'month', count: 3 } },
    { commitment: { period: 'year', count: 1 } }, { unit: 'seat' }, { unitCount: 2 },
    { promotion: 'intro', promotionId: 'synthetic-campaign' }, { eligibilityClass: 'synthetic-new-customers' },
  ];
  for (const patch of mutations) assert.notEqual(businessKey(i), businessKey({ ...i, ...patch } as typeof i));
  const unknown = { ...i, entitlementGroup: null, entitlementVersion: null, merchant: null, eligibilityClass: null };
  assert.equal(businessKey(unknown), businessKey(structuredClone(unknown)));
  assert.ok(identityValues(unknown).every(v => v !== null && v !== undefined));
  const missing = { ...i }; delete (missing as Partial<typeof i>).merchant;
  assert.throws(() => businessKey(missing));
  assert.throws(() => businessKey({ ...i, market: { scope: 'international', country: 'US' } }));
});
test('reviewed price does not certify tax/qualification; source scopes are enforced', () => {
  const o = syntheticOffer(); o.sources[0].scopes = ['price'];
  assert.throws(() => normalizeOffer(o), /Missing current reviewed tax evidence/);
  const scraper = syntheticOffer(); scraper.authority = 'scraper';
  assert.throws(() => normalizeOffer(scraper), /Scraped evidence/);
  const duplicate = syntheticOffer(); duplicate.sources.push(duplicate.sources[0]);
  assert.throws(() => normalizeOffer(duplicate), /Duplicate evidence/);
});

test('every normalized business dimension affects identity; absent dimensions have deterministic sentinels', () => {
  const original = syntheticOffer().identity;
  const edits: ((i: typeof original) => void)[] = [
    i => { i.planId = 2; }, i => { i.entitlementGroup = 'other'; }, i => { i.entitlementVersion = 'v2'; },
    i => { i.market.country = 'US'; }, i => { i.market = { scope: 'international', country: null }; },
    i => { i.merchant = 'other'; }, i => { i.channel = 'reseller'; },
    i => { i.channel = 'app_store'; i.storefrontCountry = 'US'; },
    i => { i.billing.period = 'year'; }, i => { i.billing.count = 3; },
    i => { i.commitment = { period: 'month', count: 1 }; },
    i => { i.unit = 'seat'; }, i => { i.unitCount = 2; },
    i => { i.promotion = 'intro'; i.promotionId = 'synthetic-campaign'; },
    i => { i.eligibilityClass = 'other'; },
  ];
  for (const edit of edits) {
    const changed = structuredClone(original); edit(changed);
    assert.notEqual(businessKey(changed), businessKey(original));
    assert.notDeepEqual(identityValues(changed), identityValues(original));
  }
  const store = structuredClone(original); store.channel = 'app_store';
  const otherStore = structuredClone(store); otherStore.storefrontCountry = 'US';
  assert.notEqual(businessKey(store), businessKey(otherStore));
  const commitment = structuredClone(original); commitment.commitment = { period: 'month', count: 1 };
  const otherCommitment = structuredClone(commitment); otherCommitment.commitment.count = 2;
  assert.notEqual(businessKey(commitment), businessKey(otherCommitment));
  const promo = structuredClone(original); promo.promotion = 'intro'; promo.promotionId = 'synthetic-one';
  const otherPromo = structuredClone(promo); otherPromo.promotionId = 'synthetic-two';
  assert.notEqual(businessKey(promo), businessKey(otherPromo));
});
test('unknown dimensions do not acquire evidence from legacy region/currency/locale or default fields', () => {
  const o = syntheticOffer();
  const unknown = { ...o, identity: { ...o.identity, market: { scope: 'unknown', country: null }, merchant: null },
    price: { kind: 'unknown', amount: null, currency: null } };
  const normalized = normalizeOffer(unknown);
  assert.equal(normalized.identity.market.scope, 'unknown'); assert.equal(normalized.price.currency, null);
  assert.throws(() => normalizeOffer({ ...unknown, supported_regions: ['CN'], region: 'both', locale: 'en' }));
  assert.throws(() => businessKey({ ...o.identity, storefrontCountry: 'US' }));
});
test('one verified price cannot certify tax or eligibility without current scoped evidence', () => {
  const o = syntheticOffer(); o.sources[0].scopes = ['price'];
  assert.throws(() => normalizeOffer(o), /Missing current reviewed tax evidence/);
  const p = syntheticOffer(); p.sources.push(p.sources[0]);
  assert.throws(() => normalizeOffer(p), /Duplicate evidence id/);
  const stale = syntheticOffer(); stale.sources[0].observedAt = '2026-10-01T00:00:00Z';
  assert.throws(() => normalizeOffer(stale), /Missing current reviewed price evidence/);
});
