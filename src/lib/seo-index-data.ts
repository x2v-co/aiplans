import { cache } from 'react';
import type { SeoIndexFacts } from './seo-index-policy';

export interface SeoIndexRow extends SeoIndexFacts {
  updated_at: Date | string | null;
}

/** One read-only snapshot feeds metadata, sitemap and the audit report.
 * Load the connection lazily so importing the policy/report remains DB-free.
 */
export const getSeoIndexCatalog = cache(async (): Promise<SeoIndexRow[]> => {
  const { sql } = await import('./db');
  return sql<SeoIndexRow[]>`
    SELECT m.slug, m.description, m.released_at, m.updated_at,
      (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date) AS active,
      COALESCE(m.type ILIKE '%llm%', false) AS is_llm,
      (SELECT count(*)::int FROM api_channel_prices cp
        WHERE cp.model_id = m.id AND cp.is_available = true) AS available_api_count,
      (SELECT count(*)::int FROM api_channel_prices cp
        WHERE cp.model_id = m.id AND cp.is_available = true AND (
          (cp.input_price_per_1m >= 0 AND cp.input_price_per_1m < 'Infinity'::real) OR
          (cp.output_price_per_1m >= 0 AND cp.output_price_per_1m < 'Infinity'::real) OR
          (cp.cached_input_price_per_1m >= 0 AND cp.cached_input_price_per_1m < 'Infinity'::real) OR
          EXISTS (SELECT 1 FROM api_channel_price_variants v
            WHERE v.model_id = cp.model_id AND v.provider_id = cp.provider_id
              AND v.is_available = true AND v.is_public = true AND (
                (v.input_price_per_1m >= 0 AND v.input_price_per_1m < 'Infinity'::real) OR
                (v.output_price_per_1m >= 0 AND v.output_price_per_1m < 'Infinity'::real) OR
                (v.cached_input_price_per_1m >= 0 AND v.cached_input_price_per_1m < 'Infinity'::real)
              ))
        )) AS api_price_count,
      (SELECT count(*)::int FROM usage_prices up
        WHERE up.model_id = m.id AND up.is_available = true
          AND up.price >= 0 AND up.price < 'Infinity'::real) AS usage_price_count,
      plans.priced_plan_count, plans.plan_count,
      plans.priced_subscription_count, plans.priced_subscription_provider_count
    FROM models m
    CROSS JOIN LATERAL (
      SELECT
        count(DISTINCT p.id) FILTER (WHERE p.pricing_model = 'subscription')::int AS plan_count,
        count(DISTINCT p.id) FILTER (WHERE NOT COALESCE(p.is_contact_sales, false)
          AND ((p.price >= 0 AND p.price < 'Infinity'::real) OR
            (p.annual_price >= 0 AND p.annual_price < 'Infinity'::real) OR
            (p.price_yearly_monthly >= 0 AND p.price_yearly_monthly < 'Infinity'::real)))::int AS priced_plan_count,
        count(DISTINCT p.id) FILTER (WHERE p.pricing_model = 'subscription'
          AND NOT COALESCE(p.is_contact_sales, false)
          AND ((p.price >= 0 AND p.price < 'Infinity'::real) OR
            (p.annual_price >= 0 AND p.annual_price < 'Infinity'::real) OR
            (p.price_yearly_monthly >= 0 AND p.price_yearly_monthly < 'Infinity'::real)))::int AS priced_subscription_count,
        count(DISTINCT p.provider_id) FILTER (WHERE p.pricing_model = 'subscription'
          AND NOT COALESCE(p.is_contact_sales, false)
          AND ((p.price >= 0 AND p.price < 'Infinity'::real) OR
            (p.annual_price >= 0 AND p.annual_price < 'Infinity'::real) OR
            (p.price_yearly_monthly >= 0 AND p.price_yearly_monthly < 'Infinity'::real)))::int AS priced_subscription_provider_count
      FROM model_plan_mapping mpm JOIN plans p ON p.id = mpm.plan_id
      WHERE mpm.model_id = m.id
    ) plans
    WHERE m.slug IS NOT NULL
    ORDER BY m.updated_at DESC NULLS LAST, m.slug
  `;
});
