/**
 * The X Subscription annual list prices, verified 2026-11-04 (SGT) against
 * https://docs.x.ai/x-subscription/pricing and https://cursor.com/docs/models-and-pricing
 * ("Annual billing is available at $80/yr for Plus, $300/yr for Premium,
 * $1,000/yr for Super, and $2,000/yr for Ultra. Prices exclude tax.").
 * Pure data; applied by scripts/seed-x-subscription-annual-2026-11-04.ts.
 * Legacy Cursor / SuperGrok / X Premium rows are intentionally untouched.
 */
export const X_ANNUAL_VERIFIED_AT_ISO = '2026-11-04T11:00:00.000Z';
export const X_ANNUAL_SOURCE = 'https://docs.x.ai/x-subscription/pricing';

export interface XAnnualPrice { slug: string; monthly: number; annual: number; usageMultiple: number }

export const X_SUBSCRIPTION_ANNUAL: XAnnualPrice[] = [
  { slug: 'x-subscription-plus', monthly: 8, annual: 80, usageMultiple: 1 },
  { slug: 'x-subscription-premium', monthly: 30, annual: 300, usageMultiple: 4 },
  { slug: 'x-subscription-super', monthly: 100, annual: 1000, usageMultiple: 15 },
  { slug: 'x-subscription-ultra', monthly: 200, annual: 2000, usageMultiple: 50 },
];

/** Plus-pool units per USD (relative; xAI publishes no absolute pool size). */
export function poolPerDollar(p: XAnnualPrice, billing: 'monthly' | 'annual'): number {
  return billing === 'monthly' ? p.usageMultiple / p.monthly : (p.usageMultiple * 12) / p.annual;
}

export function annualPlanPatch(p: XAnnualPrice) {
  return {
    annual_price: p.annual,
    price_yearly_monthly: Math.round((p.annual / 12) * 100) / 100,
    last_verified: new Date(X_ANNUAL_VERIFIED_AT_ISO),
  };
}
