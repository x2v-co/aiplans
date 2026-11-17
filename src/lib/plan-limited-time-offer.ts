import { introductoryEndDate, isIntroductoryPriceActive, promoTimeZone, type PromoProviderRef } from './effective-price';

/** Optional, display-only subscription metadata. Never infer a promotion from
 * monthly vs annual billing, notes, or coupons; never rewrite a plan price. */
export interface PlanOfferRow extends PromoProviderRef {
  pricing_model?: string | null;
  price?: number | null;
  price_unit?: string | null;
  annual_price?: number | null;
  price_yearly_monthly?: number | null;
  regular_price?: number | null;
  regular_annual_price?: number | null;
  promo_ends_at?: Date | string | null;
  currency?: string | null;
  tier?: string | null;
  is_contact_sales?: boolean | null;
}

export function planLimitedTimeOffer(row: PlanOfferRow, now = new Date(), locale = 'en', yearly = false) {
  if (row.pricing_model !== 'subscription' || row.is_contact_sales || row.tier === 'enterprise'
    || !isIntroductoryPriceActive(row, now) || row.promo_ends_at == null) return null;
  const annual = row.annual_price ?? (row.price_yearly_monthly == null ? null : row.price_yearly_monthly * 12);
  const useAnnual = yearly && annual != null;
  const current = useAnnual ? annual : row.price;
  const regular = useAnnual ? row.regular_annual_price : row.regular_price;
  const unit = useAnnual ? 'per_year' : row.price_unit;
  // Unknown billing periods cannot be compared, and equal/higher prices are not offers.
  if (unit !== 'per_month' && unit !== 'per_year') return null;
  if (typeof current !== 'number' || !Number.isFinite(current) || current < 0
    || typeof regular !== 'number' || !Number.isFinite(regular) || regular <= current) return null;
  const timeZone = promoTimeZone(row);
  return { current, regular, unit, currency: row.currency || 'USD',
    endsAt: new Date(row.promo_ends_at).toISOString(),
    endsOn: introductoryEndDate(row.promo_ends_at, locale, timeZone), timeZone };
}

/** Either billing period can qualify a subscription for a list filter. */
export function planHasLimitedTimeOffer(row: PlanOfferRow, now = new Date()): boolean {
  return planLimitedTimeOffer(row, now) != null || planLimitedTimeOffer(row, now, 'en', true) != null;
}

export function filterPlanOffers<T extends PlanOfferRow>(rows: T[], now = new Date()): T[] {
  return rows.filter(row => planHasLimitedTimeOffer(row, now));
}
