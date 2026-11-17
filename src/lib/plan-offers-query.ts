import { sql } from './db';
import { currentPlanCondition } from './plan-lifecycle-query';
import { filterPlanOffers, type PlanOfferRow } from './plan-limited-time-offer';

/** to_jsonb keeps the read path compatible before the additive migration.
 * Missing metadata is NULL, never an inferred promotion. */
export async function getActivePlanOffers(now = new Date()) {
  const rows = await sql<Array<PlanOfferRow & { id: number; provider_id: number }>>`
    SELECT pl.id, pl.provider_id, pl.pricing_model, pl.price, pl.price_unit,
           pl.annual_price, pl.price_yearly_monthly, pl.currency, pl.tier, pl.is_contact_sales,
           to_jsonb(pl)->>'promo_ends_at' AS promo_ends_at,
           (to_jsonb(pl)->>'regular_price')::real AS regular_price,
           (to_jsonb(pl)->>'regular_annual_price')::real AS regular_annual_price,
           p.slug AS provider_slug,
           jsonb_build_object('slug', p.slug, 'region', p.region) AS providers
    FROM plans pl JOIN providers p ON p.id = pl.provider_id
    WHERE pl.pricing_model = 'subscription' AND ${currentPlanCondition('pl')}
      AND (pl.legacy_ends_on IS NULL OR pl.legacy_ends_on >= ${now.toISOString().slice(0, 10)}::date)
  `;
  return filterPlanOffers([...rows], now);
}
