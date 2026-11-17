import { businessKey, instant, normalizeOffer, type Offer } from './contract';
import { fxSchema, rankOffers, type ComparisonContext, type ComparisonResult } from './compare';
import { offerDTO, type OfferDTO } from './read';

export interface PresentedOffer {
  dto: OfferDTO;
  cheapest: boolean;
  reasons: string[];
}

/** Exact rational text, including repeating equivalents; never a floating point price. */
export function rationalText(numerator: string, denominator: string): string {
  let n = BigInt(numerator), d = BigInt(denominator);
  if (n < BigInt(0) || d <= BigInt(0)) throw new Error('Invalid nonnegative rational');
  let a = n, b = d;
  while (b) { const r = a % b; a = b; b = r; }
  n /= a; d /= a;
  // Finite base-ten fractions are exact. Repeating fractions stay explicitly fractional.
  let rest = d;
  for (const factor of [BigInt(2), BigInt(5)]) while (rest % factor === BigInt(0)) rest /= factor;
  if (rest !== BigInt(1)) return `${n}/${d}`;
  const whole = n / d;
  let remainder = n % d, fraction = '';
  while (remainder) { remainder *= BigInt(10); fraction += remainder / d; remainder %= d; }
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}

function offerPayload(input: Record<string, unknown>): Record<string, unknown> {
  const raw = { ...input };
  for (const field of ['revision', 'originalPrice', 'chargedPeriod', 'monthlyEquivalent', 'conversion']) delete raw[field];
  return raw;
}

function canonicalDTO(input: unknown): OfferDTO | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const revision = value.revision;
  // Derived DTO fields never authorize a price or conversion. Require the actual read shape.
  if (!Number.isSafeInteger(revision) || (revision as number) < 1) return null;
  try {
    const dto = offerDTO({ offer: normalizeOffer(offerPayload(value)), revision: revision as number });
    if (JSON.stringify(value.originalPrice) !== JSON.stringify(dto.originalPrice)
      || JSON.stringify(value.chargedPeriod) !== JSON.stringify(dto.chargedPeriod)
      || JSON.stringify(value.monthlyEquivalent) !== JSON.stringify(dto.monthlyEquivalent)) return null;
    return dto;
  } catch { return null; } // Malformed/curation/archive input is never a current quote.
}

export function originalOffer(dto: OfferDTO): Offer {
  return normalizeOffer(offerPayload(dto));
}

function displayable(o: Offer, planId: number, now: string): boolean {
  return o.identity.planId === planId && o.authority === 'manual' && o.state === 'reviewed'
    && o.reviews.price === 'reviewed' && o.reviewedAt !== null && o.reviewedAt <= now && o.observedAt <= now
    && ['priced', 'free'].includes(o.price.kind) && o.price.amount !== null && o.price.currency !== null
    && (!o.validity.startsAt || o.validity.startsAt <= now) && (!o.validity.endsAt || o.validity.endsAt > now)
    && o.sources.every(s => s.observedAt <= now && (!s.reviewedAt || s.reviewedAt <= now));
}

/** No implicit FX from a DTO, visitor locale, or currency. A complete, coherent CNY basis is optional. */
function conversions(dtos: OfferDTO[], ctx: ComparisonContext | undefined, now: string): OfferDTO[] {
  if (!ctx?.fx || ctx.fx.target !== 'CNY') return dtos;
  const fx = ctx.fx;
  try {
    const at = instant.parse(fx.validAt);
    if (at > now) return dtos;
    const quotes = fx.quotes.map(q => fxSchema.parse(q));
    if (quotes.some(q => q.quote !== fx.target || q.source !== fx.source || q.validAt !== at
      || q.basis !== fx.basis || q.observedAt > now)) return dtos;
    const codes = new Set(dtos.map(o => o.price.currency!));
    // Refuse duplicate pairs, including unused ones; no partial conversion of a mixed set.
    if (new Set(quotes.map(q => `${q.base}/${q.quote}`)).size !== quotes.length) return dtos;
    if ([...codes].some(code => quotes.filter(q => q.base === code).length !== 1)) return dtos;
    return dtos.map(dto => {
      const converted = offerDTO({ offer: originalOffer(dto), revision: dto.revision }, quotes.find(q => q.base === dto.price.currency)!);
      return dto.price.currency === 'CNY' ? dto : converted;
    });
  } catch { return dtos; }
}

/** Display approval is price-specific. Ranking remains exclusively PR1 rankOffers with explicit reviewer context.
 * No universal stale-day policy or comparison context is inferred by the UI.
 */
export function presentOffers(input: {
  planId: number; offers?: readonly unknown[] | null; status?: 'available' | 'missing-table';
  now: string; comparison?: ComparisonContext;
}): PresentedOffer[] {
  const parsedNow = instant.safeParse(input.now);
  if (!parsedNow.success || input.status === 'missing-table' || !Array.isArray(input.offers)) return [];
  const now = parsedNow.data;
  const dtos = input.offers.map(canonicalDTO).filter((o): o is OfferDTO => o !== null);
  const ids = new Set<string>(), keys = new Set<string>(), sources = new Set<string>();
  for (const dto of dtos) {
    const key = businessKey(dto.identity);
    if (ids.has(dto.id) || keys.has(key) || dto.sources.some(s => sources.has(s.id))) return [];
    ids.add(dto.id); keys.add(key); dto.sources.forEach(s => sources.add(s.id));
  }
  const visible = dtos.filter(o => displayable(o, input.planId, now));
  let result: ComparisonResult | undefined;
  // The page's clock must match the explicit comparison clock; never accept a separate future basis.
  try {
    if (input.comparison && instant.parse(input.comparison.now) === now)
      result = rankOffers(visible.map(originalOffer), input.comparison);
  } catch { /* Invalid comparison context cannot authorize a badge. */ }
  return conversions(visible, result ? input.comparison : undefined, now).map(dto => ({ dto,
    // A singleton is not advertised as a cheapest comparison.
    cheapest: !!result && result.ranked.length > 1 && result.cheapest.includes(dto.id),
    reasons: result?.excluded.find(row => row.id === dto.id)?.reasons ?? (result ? [] : ['comparison_context_required']),
  }));
}
