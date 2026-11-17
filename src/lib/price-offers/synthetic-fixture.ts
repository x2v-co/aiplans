// SYNTHETIC ONLY. No current/fresh official prices or entitlements; never import into a database.
import { normalizeOffer, type Offer } from './contract';
import type { ComparisonContext } from './compare';
export function syntheticOffer(): Offer {
  return normalizeOffer({
    id: 'synthetic-offer-a',
    identity: { planId: 1, entitlementGroup: 'synthetic-rights', entitlementVersion: 'synthetic-v1',
      market: { scope: 'country', country: 'CN' }, merchant: 'synthetic-merchant', channel: 'website', storefrontCountry: null,
      billing: { period: 'month', count: 1 }, commitment: { period: 'none', count: null }, unit: 'account', unitCount: 1,
      promotion: 'standard', promotionId: null, eligibilityClass: 'synthetic-public-context' },
    price: { kind: 'priced', amount: '10', currency: 'CNY' },
    tax: { status: 'included', review: 'reviewed', description: 'Synthetic included tax statement' },
    qualification: {
      account: { status: 'reviewed', description: 'Synthetic reviewed account condition' },
      payment: { status: 'reviewed', description: 'Synthetic reviewed payment condition' },
      seat: { status: 'reviewed', description: 'Synthetic reviewed single account condition' },
    },
    reviews: { price: 'reviewed', entitlement: 'reviewed', market: 'reviewed', channel: 'reviewed', promotion: 'reviewed', tax: 'reviewed', eligibility: 'reviewed', validity: 'reviewed' },
    state: 'reviewed', authority: 'manual', observedAt: '2026-11-01T00:00:00Z', reviewedAt: '2026-11-01T01:00:00Z',
    validity: { status: 'reviewed', startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z', openEnded: false },
    renewalOfferId: null,
    sources: [{ id: 'synthetic-source-a', url: 'https://example.com/synthetic-offer',
      reviewedBy: 'synthetic-reviewer', scopes: ['price', 'entitlement', 'market', 'channel', 'promotion', 'tax', 'eligibility', 'validity'], status: 'reviewed',
      observedAt: '2026-11-01T00:00:00Z', reviewedAt: '2026-11-01T01:00:00Z', note: 'SYNTHETIC evidence only. Not an official observed price.' }],
  });
}
export function syntheticContext(): ComparisonContext {
  const o = syntheticOffer();
  return { now: '2026-11-17T00:00:00Z', reviewedSince: '2026-11-01T00:00:00Z',
    entitlementGroup: o.identity.entitlementGroup!, entitlementVersion: o.identity.entitlementVersion!,
    billing: o.identity.billing, commitment: o.identity.commitment, unit: o.identity.unit, unitCount: 1,
    promotion: 'standard', promotionId: null, eligibilityClass: o.identity.eligibilityClass!, tax: 'included', qualification: o.qualification };
}
export function laterSynthetic(o = syntheticOffer()): Offer {
  o.observedAt = '2026-11-02T00:00:00.000Z'; o.reviewedAt = '2026-11-02T01:00:00.000Z';
  o.sources = [{ ...o.sources[0], id: 'synthetic-source-b', observedAt: o.observedAt, reviewedAt: o.reviewedAt }];
  return o;
}
