import { z } from 'zod';
import { currency, currencyScale, instant, moneyUnits, normalizeOffer, publicUrl, type Currency, type Offer } from './contract';

export const fxSchema = z.strictObject({
  base: currency, quote: currency,
  rate: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,12})?$/).refine(v => /[1-9]/.test(v)),
  source: publicUrl, validAt: instant, observedAt: instant,
  basis: z.string().min(1).max(120), status: z.literal('reviewed'),
}).refine(q => q.observedAt >= q.validAt, 'FX observation cannot precede valuation');
const fxBundleSchema = z.strictObject({ target: currency, source: publicUrl, validAt: instant, basis: z.string().min(1).max(120), quotes: z.array(fxSchema) });
export type FXQuote = z.infer<typeof fxSchema>;
export type ComparisonContext = {
  now: string;
  /** Explicit reviewer/coordinator cutoff, not an invented universal TTL. Null means freshness unassessed. */
  reviewedSince: string | null;
  entitlementGroup: string; entitlementVersion: string;
  billing: Offer['identity']['billing']; commitment: Offer['identity']['commitment'];
  unit: Offer['identity']['unit']; unitCount: number;
  promotion: Offer['identity']['promotion']; promotionId: string | null; eligibilityClass: string;
  /** Tax-exclusive listings can be shown but cannot rank as a final payable price. */
  tax: 'included';
  /** Exact reviewed public conditions of the intended comparison, not the visitor's credentials. */
  qualification: Offer['qualification'];
  // Caller selects a single valuation basis/time. Even target-currency rows need an explicit identity quote for mixed-currency ranking.
  fx?: { target: Currency; source: string; validAt: string; basis: string; quotes: FXQuote[] };
};
export type Rational = { numerator: string; denominator: string };
export type ComparisonResult = { cheapest: string[]; ranked: { id: string; value: Rational; currency: Currency }[];
  excluded: { id: string; reasons: string[] }[] };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function rankingReasons(o: Offer, ctx: ComparisonContext): string[] {
  const i = o.identity;
  const reasons: string[] = [];
  const now = instant.parse(ctx.now);
  const cutoff = ctx.reviewedSince === null ? null : instant.parse(ctx.reviewedSince);
  if (o.state !== 'reviewed') reasons.push(`evidence_${o.state}`);
  if (!cutoff || !o.reviewedAt || o.reviewedAt < cutoff || o.reviewedAt > now || o.observedAt > now) reasons.push('freshness_unassessed_or_stale');
  for (const scope of ['price', 'entitlement', 'market', 'channel', 'promotion', 'tax', 'eligibility', 'validity'] as const)
    if (o.reviews[scope] !== 'reviewed') reasons.push(`${scope}_unverified`);
  if (!i.entitlementGroup || !i.entitlementVersion || i.entitlementGroup !== ctx.entitlementGroup || i.entitlementVersion !== ctx.entitlementVersion) reasons.push('entitlement_not_equivalent');
  if (i.market.scope === 'unknown' || !i.merchant || i.channel === 'unknown'
    || (['app_store', 'google_play'].includes(i.channel) && !i.storefrontCountry)) reasons.push('market_or_channel_unknown');
  if (i.billing.period === 'unknown' || i.commitment.period === 'unknown' || i.unit === 'unknown'
    || !same(i.billing, ctx.billing) || !same(i.commitment, ctx.commitment) || i.unit !== ctx.unit || i.unitCount !== ctx.unitCount) reasons.push('billing_commitment_or_unit_mismatch');
  if (i.promotion === 'unknown' || i.promotion !== ctx.promotion || i.promotionId !== ctx.promotionId) reasons.push('promotion_context_mismatch');
  if (!i.eligibilityClass || i.eligibilityClass !== ctx.eligibilityClass) reasons.push('eligibility_context_mismatch');
  if (o.tax.status !== 'included' || o.tax.review !== 'reviewed' || ctx.tax !== 'included') reasons.push('tax_not_comparable');
  if (Object.values(o.qualification).some(c => c.status !== 'reviewed') || !same(o.qualification, ctx.qualification)) reasons.push('purchase_qualification_unknown_or_different');
  if (o.validity.status !== 'reviewed' || !o.validity.startsAt || o.validity.startsAt > now
    || (!o.validity.endsAt && !o.validity.openEnded) || (o.validity.endsAt && o.validity.endsAt <= now)) reasons.push('validity_unknown_or_inactive');
  if (i.promotion === 'intro' && !o.renewalOfferId) reasons.push('renewal_association_unknown');
  if (!['priced', 'free'].includes(o.price.kind) || o.price.amount === null || o.price.currency === null) reasons.push('price_unknown_or_sales');
  return reasons;
}

function valued(o: Offer, fx: ComparisonContext['fx']): { value: Rational; currency: Currency } | null {
  const code = o.price.currency!;
  let numerator = moneyUnits(o.price.amount!, code);
  let denominator = BigInt(10 ** currencyScale[code]);
  if (fx) {
    const matches = fx.quotes.filter(q => q.base === code && q.quote === fx.target);
    if (matches.length !== 1) return null;
    const parsed = fxSchema.safeParse(matches[0]);
    if (!parsed.success) return null;
    const q = parsed.data;
    if (q.source !== fx.source || q.validAt !== instant.parse(fx.validAt) || q.basis !== fx.basis) return null;
    const [whole, fraction = ''] = q.rate.split('.');
    const rate = BigInt(whole + fraction);
    const scale = BigInt(10) ** BigInt(fraction.length);
    if (code === fx.target && rate !== scale) return null;
    numerator *= rate; denominator *= scale;
  }
  return { value: { numerator: numerator.toString(), denominator: denominator.toString() }, currency: fx?.target ?? code };
}
const compare = (a: Rational, b: Rational) => {
  const difference = BigInt(a.numerator) * BigInt(b.denominator) - BigInt(b.numerator) * BigInt(a.denominator);
  return difference < BigInt(0) ? -1 : difference > BigInt(0) ? 1 : 0;
};

/** No global fallback, locale, annual-equivalent substitution, network or implicit FX=1. */
export function rankOffers(inputs: readonly unknown[], ctx: ComparisonContext): ComparisonResult {
  const excluded: ComparisonResult['excluded'] = [];
  const candidates: Offer[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    const o = normalizeOffer(input); // Invalid contract is an intake error, never silently ranked.
    if (seen.has(o.id)) throw new Error('Duplicate comparison offer');
    seen.add(o.id);
    const reasons = rankingReasons(o, ctx);
    if (reasons.length) excluded.push({ id: o.id, reasons }); else candidates.push(o);
  }
  const parsedFX = ctx.fx ? fxBundleSchema.safeParse(ctx.fx) : null;
  const validatedFX = parsedFX?.success ? parsedFX.data : undefined;
  const mixed = new Set(candidates.map(o => o.price.currency)).size > 1;
  const ranked: ComparisonResult['ranked'] = [];
  for (const o of candidates) {
    const fx = mixed ? validatedFX : undefined; // Same original currency needs no FX.
    let valuation = mixed && !fx ? null : valued(o, fx);
    if (fx && (instant.parse(fx.validAt) > instant.parse(ctx.now)
      || fx.quotes.some(q => instant.parse(q.observedAt) > instant.parse(ctx.now)))) valuation = null;
    if (!valuation) excluded.push({ id: o.id, reasons: ['fx_missing_inconsistent_or_unsupported'] });
    else ranked.push({ id: o.id, ...valuation });
  }
  // Never let a partial FX subset manufacture a cross-currency winner.
  if (mixed && ranked.length !== candidates.length) {
    for (const row of ranked) excluded.push({ id: row.id, reasons: ['fx_incomplete_comparison_set'] });
    return { cheapest: [], ranked: [], excluded };
  }
  ranked.sort((a, b) => compare(a.value, b.value) || a.id.localeCompare(b.id));
  return { cheapest: ranked.filter(r => compare(r.value, ranked[0].value) === 0).map(r => r.id), ranked, excluded };
}
