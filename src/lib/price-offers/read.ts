import { fxSchema, type FXQuote } from './compare';
import { moneyUnits, normalizeOffer, currencyScale, type Offer } from './contract';
import type { StoredOffer } from './writer';

export interface OfferReader {
  read(planIds: readonly number[]): Promise<{ status: 'available' | 'missing-table'; rows: StoredOffer[] }>;
}
export type OfferDTO = Offer & {
  revision: number;
  conversion?: { numerator: string; denominator: string; currency: FXQuote['quote']; fx: FXQuote };
  originalPrice: Offer['price'];
  chargedPeriod: Offer['identity']['billing'];
  monthlyEquivalent: null | { label: 'annual_monthly_equivalent' | 'quarterly_monthly_equivalent';
    numerator: string; denominator: string; currency: NonNullable<Offer['price']['currency']> };
};
export interface PlanOfferFields {
  priceOffers?: OfferDTO[];
  priceOfferStatus?: 'available' | 'missing-table';
}
export function offerDTO(stored: StoredOffer, fx?: FXQuote): OfferDTO {
  const o = normalizeOffer(stored.offer);
  const b = o.identity.billing;
  let monthlyEquivalent: OfferDTO['monthlyEquivalent'] = null;
  if (o.price.amount !== null && o.price.currency && ((b.period === 'year' && b.count === 1) || (b.period === 'month' && b.count === 3))) {
    // Exact rational, not a rounded monthly charge; repeating decimals remain exact.
    monthlyEquivalent = { label: b.period === 'year' ? 'annual_monthly_equivalent' : 'quarterly_monthly_equivalent',
      numerator: moneyUnits(o.price.amount, o.price.currency).toString(),
      denominator: (BigInt(10 ** currencyScale[o.price.currency]) * BigInt(b.period === 'year' ? 12 : 3)).toString(), currency: o.price.currency };
  }
  let conversion: OfferDTO['conversion'];
  if (fx) {
    const quote = fxSchema.parse(fx);
    if (quote.base !== o.price.currency || o.price.amount === null) throw new Error('FX pair does not match original price');
    const [whole, fraction = ''] = quote.rate.split('.');
    const rate = BigInt(whole + fraction);
    const scale = BigInt(10) ** BigInt(fraction.length);
    if (quote.base === quote.quote && rate !== scale) throw new Error('Invalid identity FX quote');
    conversion = { numerator: (moneyUnits(o.price.amount, quote.base) * rate).toString(),
      denominator: (BigInt(10 ** currencyScale[quote.base]) * scale).toString(), currency: quote.quote, fx: quote };
  }
  return { ...o, ...(conversion ? { conversion } : {}), revision: stored.revision, originalPrice: o.price, chargedPeriod: b, monthlyEquivalent };
}

/** Opt-in augmentation for provider/model/catalog/API rows; legacy prices and availability are untouched. */
export async function attachPriceOffers<T extends { id: number }>(plans: readonly T[], reader: OfferReader): Promise<(T & PlanOfferFields)[]> {
  if (!plans.length) return [];
  const result = await reader.read([...new Set(plans.map(p => p.id))]);
  if (result.status === 'missing-table' && result.rows.length) throw new Error('Invalid missing-table response');
  const byPlan = new Map<number, OfferDTO[]>();
  const ids = new Set(plans.map(p => p.id));
  for (const row of result.rows) {
    const dto = offerDTO(row);
    if (!ids.has(dto.identity.planId)) throw new Error('Loader returned an unrequested plan');
    const list = byPlan.get(dto.identity.planId) ?? [];
    if (list.some(o => o.id === dto.id)) throw new Error('Duplicate loaded offer');
    list.push(dto); byPlan.set(dto.identity.planId, list);
  }
  return plans.map(p => ({ ...p, priceOffers: byPlan.get(p.id) ?? [], priceOfferStatus: result.status }));
}
