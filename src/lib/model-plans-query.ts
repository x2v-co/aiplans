import { sql, INT4_ARRAY } from './db';
import type { ModelPlanCardRow } from '@/components/model-plan-card';

/**
 * Keep explicit model/usage links, and supplement them with subscriptions from
 * this model's primary producer only. Provider membership is not an entitlement
 * claim; the UI tells readers to check the vendor's current model availability.
 * A single SELECT avoids duplicate cards when both paths match.
 */
export async function getModelPlans(
  modelId: number,
  producerId: number | null,
  usagePlanIds: number[] = [],
  now = new Date(),
): Promise<ModelPlanCardRow[]> {
  return [...await sql<ModelPlanCardRow[]>`
    SELECT
      pl.id,
      pl.name,
      pl.slug,
      pl.tier,
      pl.price,
      pl.annual_price,
      pl.currency,
      pl.price_unit,
      pl.features,
      (to_jsonb(pl)->>'data_for_discount')::boolean AS data_for_discount,
      to_jsonb(pl)->>'data_for_discount_note' AS data_for_discount_note,
      to_jsonb(pl)->>'quota_unit' AS quota_unit,
      pl.third_party_coverage,
      pl.third_party_coverage_note,
      pl.access_from_china,
      pl.provider_id,
      pl.plan_kind,
      pl.plan_line,
      pl.tier_rank,
      pl.last_verified,
      pl.notes,
      pl.legacy_ends_on,
      pl.is_contact_sales,
      pl.monthly_api_credit_status,
      CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'slug', p.slug,
        'logo', p.logo,
        'pricing_url', p.pricing_url,
        'website', p.website
      ) END AS providers
    FROM plans pl
    LEFT JOIN providers p ON p.id = pl.provider_id
    WHERE EXISTS (
      SELECT 1 FROM model_plan_mapping mapping
      WHERE mapping.model_id = ${modelId} AND mapping.plan_id = pl.id
    ) OR pl.id = ANY(${sql.array(usagePlanIds, INT4_ARRAY)})
      OR (
        pl.provider_id = ${producerId}
        AND pl.pricing_model = 'subscription'
        AND (pl.legacy_ends_on IS NULL OR pl.legacy_ends_on >= ${now.toISOString().slice(0, 10)}::date)
        AND COALESCE(pl.notes, '') NOT LIKE '%[aiplans:superseded-by %'
      )
    ORDER BY pl.price ASC NULLS LAST, pl.id
  `];
}
