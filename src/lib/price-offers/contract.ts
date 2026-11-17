import { z } from 'zod';

// Deliberately bounded supported currencies, not defaults or inferred markets.
export const currencyScale = { CNY: 2, USD: 2, EUR: 2, GBP: 2, JPY: 0, HKD: 2, SGD: 2, CAD: 2, AUD: 2, INR: 2, KRW: 0 } as const;
export const currency = z.enum(Object.keys(currencyScale) as [keyof typeof currencyScale, ...(keyof typeof currencyScale)[]]);
const token = z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,119}$/);
const country = z.string().regex(/^[A-Z]{2}$/); // Explicit reviewed scope; never derived from currency/locale/support lists.
const count = z.number().int().min(1).max(1000000);
const zonePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
export const instant = z.string().regex(zonePattern).refine(v => {
  if (!Number.isFinite(Date.parse(v))) return false;
  const [y, m, d] = v.slice(0, 10).split('-').map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}, 'Valid instant with explicit zone required').transform(v => new Date(v).toISOString());

export const publicUrl = z.string().max(2048).refine(value => {
  try {
    const u = new URL(value);
    // Public documentary URLs only: no secrets, query tokens, fragments, local hosts or IP addresses.
    return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash
      && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(u.hostname)
      && !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(u.hostname)
      && !/^\d+(?:\.\d+){3}$/.test(u.hostname);
  } catch { return false; }
}, 'Safe public HTTPS documentary URL required');

const scopeNames = ['price', 'entitlement', 'market', 'channel', 'promotion', 'tax', 'eligibility', 'validity'] as const;
export type EvidenceScope = typeof scopeNames[number];
const review = z.enum(['reviewed', 'unverified', 'unknown']);
const condition = z.strictObject({ status: review, description: z.string().min(1).max(1000).nullable() })
  .refine(v => v.status !== 'reviewed' || v.description !== null, 'Reviewed conditions require an explicit public description');
export const identitySchema = z.strictObject({
  planId: z.number().int().min(1).max(2147483647),
  entitlementGroup: token.nullable(), entitlementVersion: token.nullable(),
  market: z.strictObject({ scope: z.enum(['country', 'international', 'unknown']), country: country.nullable() }),
  merchant: token.nullable(), channel: z.enum(['website', 'app_store', 'google_play', 'reseller', 'unknown']),
  storefrontCountry: country.nullable(),
  billing: z.strictObject({ period: z.enum(['month', 'year', 'day', 'one_time', 'unknown']), count: count.nullable() }),
  commitment: z.strictObject({ period: z.enum(['month', 'year', 'day', 'none', 'unknown']), count: count.nullable() }),
  unit: z.enum(['account', 'seat', 'credit', 'unknown']), unitCount: count.nullable(),
  promotion: z.enum(['standard', 'intro', 'renewal', 'unknown']), promotionId: token.nullable(),
  eligibilityClass: token.nullable(),
}).superRefine((v, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  if ((v.entitlementGroup === null) !== (v.entitlementVersion === null)) fail('Entitlement group and version must be known together');
  if ((v.market.scope === 'country') !== (v.market.country !== null)) fail('Only country scope carries a country; international has no invented country list');
  if (!['app_store', 'google_play'].includes(v.channel) && v.storefrontCountry !== null) fail('Storefront country belongs to store channels');
  if ((v.billing.period === 'unknown') !== (v.billing.count === null)) fail('Unknown billing has unknown count');
  if (v.billing.period === 'one_time' && v.billing.count !== 1) fail('One-time count must be one');
  if (['none', 'unknown'].includes(v.commitment.period) !== (v.commitment.count === null)) fail('Commitment count mismatch');
  if ((v.unit === 'unknown') !== (v.unitCount === null)) fail('Unknown unit has unknown count');
  if (['intro', 'renewal'].includes(v.promotion) && v.promotionId === null) fail('Intro/renewal requires an explicit campaign identity');
  if (['standard', 'unknown'].includes(v.promotion) && v.promotionId !== null) fail('No inferred campaign identity');
});
export const evidenceSchema = z.strictObject({
  id: token, url: publicUrl, scopes: z.array(z.enum(scopeNames)).min(1).refine(v => new Set(v).size === v.length),
  status: review, observedAt: instant, reviewedAt: instant.nullable(), reviewedBy: token.nullable(),
  note: z.string().min(1).max(2000), // Public evidence summary only, never account/payment credentials.
}).superRefine((v, ctx) => {
  if (v.status === 'reviewed' && (!v.reviewedBy || !v.reviewedAt || v.reviewedAt < v.observedAt))
    ctx.addIssue({ code: 'custom', message: 'Reviewed evidence needs review at/after observation' });
});
export const offerSchema = z.strictObject({
  id: token, identity: identitySchema,
  price: z.strictObject({ kind: z.enum(['priced', 'free', 'sales', 'unknown']), amount: z.string().nullable(), currency: currency.nullable() }),
  tax: z.strictObject({ status: z.enum(['included', 'excluded', 'unknown']), review, description: z.string().min(1).max(1000).nullable() }),
  qualification: z.strictObject({ account: condition, payment: condition, seat: condition }),
  reviews: z.strictObject(Object.fromEntries(scopeNames.map(s => [s, review])) as Record<EvidenceScope, typeof review>),
  state: z.enum(['reviewed', 'unverified', 'conflict', 'stale', 'withdrawn']),
  authority: z.enum(['manual', 'scraper']),
  observedAt: instant, reviewedAt: instant.nullable(),
  // Null validity is unknown, not a claim of perpetual validity. Open-ended reviewed validity must be explicit.
  validity: z.strictObject({ status: review, startsAt: instant.nullable(), endsAt: instant.nullable(), openEnded: z.boolean() }),
  renewalOfferId: token.nullable(),
  sources: z.array(evidenceSchema).min(1).max(1000),
}).superRefine((v, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (v.authority === 'scraper' && (v.reviewedAt !== null || Object.values(v.reviews).includes('reviewed') || v.state === 'reviewed')) fail('Scraped evidence cannot assert manual review');
  if (v.price.amount !== null) {
    if (!v.price.currency) fail('Amount requires explicit original currency');
    else { try { moneyUnits(v.price.amount, v.price.currency); } catch { fail('Invalid money precision/range'); } }
  }
  if (v.price.kind === 'priced' && (v.price.amount === null || !/[1-9]/.test(v.price.amount))) fail('Priced must be positive');
  if (v.price.kind === 'free' && (v.price.amount === null || /[1-9]/.test(v.price.amount))) fail('Free requires explicit zero');
  if (['sales', 'unknown'].includes(v.price.kind) && v.price.amount !== null) fail('Sales/unknown cannot supply a price');
  if (v.reviewedAt && v.reviewedAt < v.observedAt) fail('Review precedes observation');
  if (v.state === 'reviewed' && (!v.reviewedAt || v.reviews.price !== 'reviewed')) fail('Reviewed state needs a reviewed price');
  if (v.validity.startsAt && v.validity.endsAt && v.validity.startsAt >= v.validity.endsAt) fail('Invalid validity window');
  if (v.validity.openEnded && v.validity.endsAt) fail('Open-ended validity cannot have an end');
  if (v.validity.status === 'reviewed' && (!v.validity.startsAt || (!v.validity.endsAt && !v.validity.openEnded))) fail('Reviewed validity requires explicit bounds/open end');
  if (v.renewalOfferId === v.id) fail('Renewal cannot reference itself');
  if (new Set(v.sources.map(s => s.id)).size !== v.sources.length) fail('Duplicate evidence id');
  for (const scope of scopeNames) {
    // A past source cannot certify a newly changed snapshot merely by remaining in its source list.
    if (v.reviews[scope] === 'reviewed' && (!v.reviewedAt || !v.sources.some(s => s.status === 'reviewed'
      && s.scopes.includes(scope) && s.observedAt === v.observedAt && s.reviewedAt === v.reviewedAt))) fail(`Missing current reviewed ${scope} evidence`);
  }
  if (v.tax.review === 'reviewed' && v.reviews.tax !== 'reviewed') fail('Tax review lacks scoped evidence');
  if (Object.values(v.qualification).some(c => c.status === 'reviewed') && v.reviews.eligibility !== 'reviewed') fail('Qualification review lacks scoped evidence');
  if (v.validity.status === 'reviewed' && v.reviews.validity !== 'reviewed') fail('Validity lacks scoped evidence');
});
export type Offer = z.infer<typeof offerSchema>;
export type OfferIdentity = z.infer<typeof identitySchema>;
export type Currency = keyof typeof currencyScale;

// Fixed-point integer arithmetic. Never Number/parseFloat for money, never rounded at intake.
export function moneyUnits(amount: string, code: Currency): bigint {
  const scale = currencyScale[code];
  if (scale === undefined || !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(amount)) throw new Error('Invalid amount/currency');
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > scale) throw new Error('Unsupported precision');
  return BigInt(whole) * BigInt(10 ** scale) + BigInt(fraction.padEnd(scale, '0') || '0');
}
export function normalizeOffer(input: unknown): Offer {
  const v = offerSchema.parse(input);
  if (v.price.amount !== null && v.price.currency) {
    const scale = currencyScale[v.price.currency];
    const units = moneyUnits(v.price.amount, v.price.currency).toString().padStart(scale + 1, '0');
    v.price.amount = scale ? `${units.slice(0, -scale)}.${units.slice(-scale)}` : units;
  }
  return v;
}

// Explicit ordered tuple with deterministic null sentinels; no amount or observation time in the key.
// DB additionally enforces jsonb identity uniqueness (key order and whitespace independent).
export function businessKey(input: OfferIdentity): string {
  const i = identitySchema.parse(input);
  return JSON.stringify([i.planId, i.entitlementGroup, i.entitlementVersion, i.market.scope, i.market.country,
    i.merchant, i.channel, i.storefrontCountry, i.billing.period, i.billing.count,
    i.commitment.period, i.commitment.count, i.unit, i.unitCount, i.promotion, i.promotionId, i.eligibilityClass]);
}
