import test from 'node:test';
import assert from 'node:assert/strict';
import { rankOffers, type ComparisonContext, type FXQuote } from './compare';
import { syntheticOffer, syntheticContext } from './synthetic-fixture';
import type { Offer } from './contract';
import { offerDTO } from './read';
const rank = (o: Offer, ctx = syntheticContext()) => rankOffers([o], ctx);

test('SYNTHETIC original-currency ranking uses exact amounts, ties and free; no FX required', () => {
  const a = syntheticOffer(); a.price.amount = '0.30';
  const b = syntheticOffer(); b.id = 'synthetic-b'; b.price.amount = '0.29';
  assert.deepEqual(rankOffers([a, b], syntheticContext()).cheapest, [b.id]);
  a.price.amount = '0.290'; assert.throws(() => rank(a));
  a.price.amount = '0.29'; assert.deepEqual(rankOffers([a, b], syntheticContext()).cheapest, [b.id, a.id]);
  a.price = { kind: 'free', amount: '0', currency: 'CNY' };
  assert.deepEqual(rankOffers([a, b], syntheticContext()).cheapest, [a.id]);
});
const exclusions: [string, (o: Offer) => void, string][] = [
  ['unknown tax', o => { o.tax.status = 'unknown'; }, 'tax_not_comparable'],
  ['excluded tax', o => { o.tax.status = 'excluded'; }, 'tax_not_comparable'],
  ['unknown qualification', o => { o.qualification.payment = { status: 'unknown', description: null }; }, 'purchase_qualification_unknown_or_different'],
  ['changed qualification', o => { o.qualification.account.description = 'Synthetic different requirement'; }, 'purchase_qualification_unknown_or_different'],
  ['unreviewed entitlement', o => { o.reviews.entitlement = 'unverified'; }, 'entitlement_unverified'],
  ['different entitlement version', o => { o.identity.entitlementVersion = 'synthetic-v2'; }, 'entitlement_not_equivalent'],
  ['unknown promotion', o => { o.identity.promotion = 'unknown'; }, 'promotion_context_mismatch'],
  ['different eligibility class', o => { o.identity.eligibilityClass = 'synthetic-new'; }, 'eligibility_context_mismatch'],
  ['unknown country scope', o => { o.identity.market = { scope: 'unknown', country: null }; }, 'market_or_channel_unknown'],
  ['unknown storefront', o => { o.identity.channel = 'app_store'; }, 'market_or_channel_unknown'],
  ['quarterly', o => { o.identity.billing.count = 3; }, 'billing_commitment_or_unit_mismatch'],
  ['commitment', o => { o.identity.commitment = { period: 'year', count: 1 }; }, 'billing_commitment_or_unit_mismatch'],
  ['seats', o => { o.identity.unit = 'seat'; }, 'billing_commitment_or_unit_mismatch'],
  ['expired published validity', o => { o.validity.endsAt = '2026-11-10T00:00:00Z'; }, 'validity_unknown_or_inactive'],
  ['unknown published validity', o => { o.validity = { status: 'unknown', startsAt: null, endsAt: null, openEnded: false }; }, 'validity_unknown_or_inactive'],
  ['sales', o => { o.price = { kind: 'sales', amount: null, currency: null }; }, 'price_unknown_or_sales'],
  ...(['conflict', 'stale', 'withdrawn', 'unverified'] as const).map(state => [state, (o: Offer) => { o.state = state; }, `evidence_${state}`] as [string, (o: Offer) => void, string]),
];
for (const [name, mutate, reason] of exclusions) test(`excluded with reason: ${name}`, () => {
  const o = syntheticOffer(); mutate(o); const result = rank(o);
  assert.deepEqual(result.cheapest, []); assert.ok(result.excluded[0].reasons.includes(reason));
});
test('freshness is explicit, never inferred from observed time or an invented TTL', () => {
  const o = syntheticOffer();
  for (const reviewedSince of [null, '2026-11-02T00:00:00Z']) {
    assert.deepEqual(rank(o, { ...syntheticContext(), reviewedSince }).cheapest, []);
  }
});
test('international storefront retains unknown precise country coverage without inventing global list', () => {
  const o = syntheticOffer(); o.identity.market = { scope: 'international', country: null };
  assert.deepEqual(rank(o).cheapest, [o.id]); // Synthetic reviewed qualification remains required.
  assert.equal(offerDTO({ offer: o, revision: 1 }).identity.market.country, null);
});
test('SYNTHETIC Kimi regression: monthly billing never replaced by a lower annual monthly equivalent', () => {
  const monthly = syntheticOffer(); monthly.id = 'synthetic-kimi-monthly';
  const annual = syntheticOffer(); annual.id = 'synthetic-kimi-annual'; annual.identity.billing = { period: 'year', count: 1 }; annual.price.amount = '12';
  const dto = offerDTO({ offer: annual, revision: 1 });
  assert.equal(dto.monthlyEquivalent?.label, 'annual_monthly_equivalent');
  assert.deepEqual(dto.chargedPeriod, { period: 'year', count: 1 });
  assert.deepEqual(rankOffers([monthly, annual], syntheticContext()).cheapest, [monthly.id]);
});
test('SYNTHETIC MiniMax Build CN/global known local rights difference is never equivalence by tier name', () => {
  const cn = syntheticOffer(); cn.id = 'synthetic-minimax-build-cn'; cn.identity.entitlementGroup = 'synthetic-build-cn-12x';
  const global = syntheticOffer(); global.id = 'synthetic-minimax-build-global'; global.identity.entitlementGroup = 'synthetic-build-global-7.5x';
  const ctx = { ...syntheticContext(), entitlementGroup: cn.identity.entitlementGroup };
  const result = rankOffers([cn, global], ctx);
  assert.deepEqual(result.cheapest, [cn.id]); assert.ok(result.excluded[0].reasons.includes('entitlement_not_equivalent'));
});
test('SYNTHETIC GLM/Z.AI quarterly vs guessed annual conflict remains quarantined', () => {
  const quarterly = syntheticOffer(); quarterly.id = 'synthetic-z-ai-quarter'; quarterly.identity.billing.count = 3; quarterly.state = 'conflict';
  const guessed = syntheticOffer(); guessed.id = 'synthetic-z-ai-guessed-annual'; guessed.identity.billing.period = 'year'; guessed.state = 'conflict';
  assert.deepEqual(rankOffers([quarterly, guessed], syntheticContext()).cheapest, []);
});
test('intro and renewal do not win standard ranking; unknown renewal association is excluded', () => {
  const o = syntheticOffer(); o.identity.promotion = 'intro'; o.identity.promotionId = 'synthetic-campaign';
  assert.deepEqual(rank(o).cheapest, []);
  assert.ok(rank(o, { ...syntheticContext(), promotion: 'intro', promotionId: 'synthetic-campaign' }).excluded[0].reasons.includes('renewal_association_unknown'));
});
function fxContext(): ComparisonContext {
  const quote = (base: 'CNY' | 'USD', rate: string): FXQuote => ({ base, quote: 'CNY', rate, source: 'https://example.com/synthetic-fx',
    validAt: '2026-11-16T00:00:00.000Z', observedAt: '2026-11-16T01:00:00.000Z', basis: 'synthetic-daily', status: 'reviewed' });
  return { ...syntheticContext(), fx: { target: 'CNY', source: 'https://example.com/synthetic-fx', validAt: '2026-11-16T00:00:00Z', basis: 'synthetic-daily', quotes: [quote('CNY', '1'), quote('USD', '7.123456789012')] } };
}
function mixed() { const a = syntheticOffer(); const b = syntheticOffer(); b.id = 'synthetic-usd'; b.price.currency = 'USD'; return [a, b]; }
test('mixed currencies never rank without complete consistent FX; exact rational with provenance', () => {
  assert.deepEqual(rankOffers(mixed(), syntheticContext()).cheapest, []);
  const result = rankOffers(mixed(), fxContext());
  assert.deepEqual(result.cheapest, ['synthetic-offer-a']); assert.equal(result.ranked[1].value.numerator, '7123456789012000');
});
const badFX: [string, (ctx: ComparisonContext) => void][] = [
  ['missing rate', c => { c.fx!.quotes.pop(); }], ['duplicate pair', c => { c.fx!.quotes.push(c.fx!.quotes[1]); }],
  ['source mismatch', c => { c.fx!.quotes[1].source = 'https://example.com/other'; }],
  ['basis mismatch', c => { c.fx!.quotes[1].basis = 'other'; }],
  ['valuation time mismatch', c => { c.fx!.quotes[1].validAt = '2026-11-15T00:00:00Z'; }],
  ['reversed pair', c => { c.fx!.quotes[1].base = 'CNY'; c.fx!.quotes[1].quote = 'USD'; }],
  ['zero rate', c => { c.fx!.quotes[1].rate = '0'; }], ['nonfinite rate', c => { c.fx!.quotes[1].rate = 'NaN'; }],
  ['false identity quote', c => { c.fx!.quotes[0].rate = '2'; }],
];
for (const [name, change] of badFX) test(`FX excludes complete set: ${name}`, () => {
  const ctx = fxContext(); change(ctx); assert.deepEqual(rankOffers(mixed(), ctx).cheapest, []);
});

test('FX malformed timestamps, future valuation, unsupported currency and excessive precision exclude safely', () => {
  for (const mutate of [
    (c: ComparisonContext) => { c.fx!.quotes[1].validAt = 'no-zone'; },
    (c: ComparisonContext) => { c.fx!.validAt = '2027-01-01T00:00:00Z'; },
    (c: ComparisonContext) => { c.fx!.quotes[1].rate = '1.1234567890123'; },
    (c: ComparisonContext) => { c.fx!.quotes[1].base = 'XYZ' as never; },
    (c: ComparisonContext) => { c.fx!.quotes[1].observedAt = '2026-11-15T00:00:00Z'; },
  ]) { const ctx = fxContext(); mutate(ctx); assert.deepEqual(rankOffers(mixed(), ctx).cheapest, []); }
});
