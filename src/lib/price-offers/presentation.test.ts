// SYNTHETIC FICTIONAL contracts only; no current official prices or merchant rights.
import assert from 'node:assert/strict';
import test from 'node:test';
import { offerDTO } from './read';
import { syntheticOffer, syntheticContext } from './synthetic-fixture';
import { presentOffers, rationalText } from './presentation';
import type { Offer } from './contract';
import type { ComparisonContext } from './compare';

const dto = (offer = syntheticOffer()) => offerDTO({ offer, revision: 1 });
const show = (offers: readonly unknown[] | null | undefined, comparison?: ComparisonContext) =>
  presentOffers({ planId: 1, offers, now: syntheticContext().now, comparison });
function second(): Offer {
  const o = syntheticOffer(); o.id = 'synthetic-fictional-second'; o.identity.merchant = 'synthetic-second-merchant';
  o.sources[0].id = 'synthetic-fictional-second-source'; return o;
}
function fxContext(): ComparisonContext {
  const fx = { target: 'CNY' as const, source: 'https://example.com/synthetic-fx', validAt: '2026-11-16T00:00:00Z', basis: 'synthetic-only' };
  return { ...syntheticContext(), fx: { ...fx, quotes: (['CNY', 'USD'] as const).map(base => ({
    base, quote: 'CNY', rate: base === 'CNY' ? '1' : '7.123456789012', source: fx.source,
    validAt: fx.validAt, observedAt: '2026-11-16T01:00:00Z', basis: fx.basis, status: 'reviewed',
  })) } };
}
test('absent/null/empty/missing-table inputs add no regional markup model', () => {
  for (const offers of [undefined, null, []]) assert.deepEqual(show(offers), []);
  assert.deepEqual(presentOffers({ planId: 1, offers: [dto()], status: 'missing-table', now: syntheticContext().now }), []);
});
test('a price-specific manual review displays original exact price; no inferred comparison context', () => {
  const [row] = show([dto()]); assert.equal(row.dto.price.amount, '10.00');
  assert.equal(row.cheapest, false); assert.deepEqual(row.reasons, ['comparison_context_required']);
});
for (const state of ['unverified', 'conflict', 'stale', 'withdrawn'] as const) test(`not displayed or ranked: ${state}`, () => {
  const o = syntheticOffer(); o.state = state; assert.deepEqual(show([dto(o)], syntheticContext()), []);
});
for (const [name, modify] of [
  ['wrong plan', (o: Offer) => { o.identity.planId = 2; }],
  ['expired', (o: Offer) => { o.validity.endsAt = '2026-11-10T00:00:00Z'; }],
  ['not started', (o: Offer) => { o.validity.startsAt = '2026-11-20T00:00:00Z'; }],
  ['sales', (o: Offer) => { o.price = { kind: 'sales', amount: null, currency: null }; }],
  ['unknown price', (o: Offer) => { o.price = { kind: 'unknown', amount: null, currency: null }; }],
] as const) test(`not displayed: ${name}`, () => { const o = syntheticOffer(); modify(o); assert.deepEqual(show([dto(o)]), []); });
test('archive/quarantine wrappers, raw offers, scraper self-approval and missing scoped source refuse', () => {
  const good = dto();
  for (const bad of [{ status: 'quarantine', offer: good }, { ...good, archive: true }, syntheticOffer(),
    { ...good, authority: 'scraper' }, { ...good, reviews: { ...good.reviews, price: 'unknown' } },
    { ...good, sources: [{ ...good.sources[0], scopes: ['tax'] }] }]) assert.deepEqual(show([bad]), []);
});
test('malicious URL, impossible precision, invalid revision and contradictory derived fields refuse', () => {
  const good = dto();
  for (const bad of [{ ...good, sources: [{ ...good.sources[0], url: 'https://example.com/?token=secret' }] },
    { ...good, sources: [{ ...good.sources[0], url: 'javascript:alert(1)' }] },
    { ...good, price: { ...good.price, amount: '0.001' } }, { ...good, revision: 0 },
    { ...good, originalPrice: { ...good.price, amount: '9999' } },
    { ...good, chargedPeriod: { period: 'year', count: 1 } }, { ...good, monthlyEquivalent: { numerator: '1' } }])
    assert.deepEqual(show([bad]), []);
});
test('forged optional conversion is discarded rather than trusted', () => {
  const rows = show([{ ...dto(), conversion: { currency: 'CNY', numerator: '999999', denominator: '1', fx: { rate: '1' } } }]);
  assert.equal(rows.length, 1); assert.equal(rows[0].dto.conversion, undefined);
});
test('duplicate ID, complete business key or cross-offer source ownership ambiguity fails closed', () => {
  const a = dto(), b = second();
  assert.deepEqual(show([a, a]), []);
  const sameKey = syntheticOffer(); sameKey.id = 'synthetic-new-id'; sameKey.sources[0].id = 'synthetic-new-source';
  assert.deepEqual(show([a, dto(sameKey)]), []);
  b.sources[0].id = a.sources[0].id; assert.deepEqual(show([a, dto(b)]), []);
});
for (const [name, modify, reason] of [
  ['unknown tax', (o: Offer) => { o.tax = { status: 'unknown', review: 'unknown', description: null }; o.reviews.tax = 'unknown'; }, 'tax_not_comparable'],
  ['unknown payment', (o: Offer) => { o.qualification.payment = { status: 'unknown', description: null }; }, 'purchase_qualification_unknown_or_different'],
  ['tax excluded', (o: Offer) => { o.tax.status = 'excluded'; }, 'tax_not_comparable'],
  ['market unverified', (o: Offer) => { o.reviews.market = 'unverified'; }, 'market_unverified'],
  ['unknown validity', (o: Offer) => { o.validity = { status: 'unknown', startsAt: null, endsAt: null, openEnded: false }; o.reviews.validity = 'unknown'; }, 'validity_unknown_or_inactive'],
] as const) test(`price can display but ${name} cannot rank`, () => {
  const o = syntheticOffer(); modify(o); const [row] = show([dto(o)], syntheticContext());
  assert.ok(row); assert.equal(row.cheapest, false); assert.ok(row.reasons.includes(reason));
});
test('freshness and comparison clock must be explicit and coherent', () => {
  for (const ctx of [{ ...syntheticContext(), reviewedSince: null }, { ...syntheticContext(), now: '2027-01-01T00:00:00Z' }]) {
    const rows = show([dto(), dto(second())], ctx); assert.ok(rows.every(r => !r.cheapest));
  }
});
test('only two or more comparable original-currency offers can show the scoped cheapest badge', () => {
  const b = second(); b.price.amount = '9.99';
  const rows = show([dto(), dto(b)], syntheticContext());
  assert.deepEqual(rows.filter(r => r.cheapest).map(r => r.dto.id), [b.id]);
  assert.equal(show([dto(b)], syntheticContext())[0].cheapest, false);
});
test('Kimi SYNTHETIC actual monthly charge stays monthly; annual equivalent cannot win monthly rank', () => {
  const annual = second(); annual.id = 'synthetic-kimi-annual'; annual.identity.billing = { period: 'year', count: 1 }; annual.price.amount = '1';
  const rows = show([dto(), dto(annual)], syntheticContext());
  assert.deepEqual(rows[0].dto.chargedPeriod, { period: 'month', count: 1 });
  assert.equal(rows[0].dto.monthlyEquivalent, null); assert.ok(rows.every(r => !r.cheapest));
  assert.equal(rows[1].dto.monthlyEquivalent?.label, 'annual_monthly_equivalent');
  assert.ok(rows[1].reasons.includes('billing_commitment_or_unit_mismatch'));
});
test('MiniMax Build SYNTHETIC 12x vs 7.5x, and same-name Go/Explore, cannot establish rights equivalence', () => {
  const a = syntheticOffer(), b = second(); a.identity.entitlementGroup = 'synthetic-build-cn-12x'; b.identity.entitlementGroup = 'synthetic-build-intl-7.5x';
  for (const pair of [[a, b], [syntheticOffer(), { ...second(), identity: { ...second().identity, entitlementGroup: null, entitlementVersion: null } }]]) {
    const rows = show(pair.map(dto), { ...syntheticContext(), entitlementGroup: pair[0].identity.entitlementGroup! });
    assert.ok(rows.every(r => !r.cheapest)); assert.ok(rows[1].reasons.includes('entitlement_not_equivalent'));
  }
});
test('GLM/Z.AI SYNTHETIC quarter / guessed-year conflict remains invisible', () => {
  const a = syntheticOffer(), b = second(); a.identity.billing.count = 3; b.identity.billing.period = 'year'; a.state = b.state = 'conflict';
  assert.deepEqual(show([dto(a), dto(b)], syntheticContext()), []);
});
test('first purchase and renewal are separate contexts; a link supplies no fabricated renewal quote', () => {
  const intro = syntheticOffer(); intro.identity.promotion = 'intro'; intro.identity.promotionId = 'synthetic-campaign'; intro.renewalOfferId = 'synthetic-renewal';
  const renewal = second(); renewal.identity.promotion = 'renewal'; renewal.identity.promotionId = 'synthetic-campaign';
  const rows = show([dto(intro), dto(renewal)], syntheticContext());
  assert.ok(rows.every(r => !r.cheapest && r.reasons.includes('promotion_context_mismatch')));
  assert.equal(show([dto(intro)])[0].dto.price.amount, '10.00');
  intro.renewalOfferId = null;
  assert.ok(show([dto(intro)], { ...syntheticContext(), promotion: 'intro', promotionId: 'synthetic-campaign' })[0].reasons.includes('renewal_association_unknown'));
});
test('mixed currencies have no cheapest or conversions without coherent FX; exact conversion stays secondary', () => {
  const usd = second(); usd.price.currency = 'USD';
  const pair = [dto(), dto(usd)];
  assert.ok(show(pair, syntheticContext()).every(r => !r.cheapest && !r.dto.conversion));
  const rows = show(pair, fxContext()); assert.equal(rows[0].cheapest, true);
  assert.equal(rows[1].dto.price.currency, 'USD'); assert.equal(rows[1].dto.price.amount, '10.00');
  assert.equal(rationalText(rows[1].dto.conversion!.numerator, rows[1].dto.conversion!.denominator), '71.23456789012');
});
for (const [name, mutate] of [
  ['missing pair', (c: ComparisonContext) => { c.fx!.quotes.pop(); }],
  ['basis mismatch', (c: ComparisonContext) => { c.fx!.quotes[1].basis = 'other'; }],
  ['future observation', (c: ComparisonContext) => { c.fx!.quotes[1].observedAt = '2027-01-01T00:00:00Z'; }],
  ['wrong pair', (c: ComparisonContext) => { c.fx!.quotes[1].quote = 'EUR'; }],
  ['false identity rate', (c: ComparisonContext) => { c.fx!.quotes[0].rate = '2'; }],
] as const) test(`no FX winner or conversion: ${name}`, () => {
  const c = fxContext(); mutate(c); const b = second(); b.price.currency = 'USD';
  assert.ok(show([dto(), dto(b)], c).every(r => !r.cheapest && !r.dto.conversion));
});
test('exact rational formatting preserves repeating equivalents, zero and large decimal precision', () => {
  assert.equal(rationalText('100', '300'), '1/3'); assert.equal(rationalText('0', '100'), '0');
  assert.equal(rationalText('99999999999999', '100'), '999999999999.99'); assert.equal(rationalText('1', '8'), '0.125');
});
