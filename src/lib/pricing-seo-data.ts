import { cache } from 'react';
import { sql, TEXT_ARRAY } from './db';
import { getGroupedProducts } from './grouped-products';
import { getModelSlugCandidates } from './compare-plans';
import type { SeoPlan } from './pricing-seo';

// React cache deduplicates within a render; it does not persist prices between
// requests. These helpers only SELECT and never seed or repair catalog rows.
export const getComparisonSeoData = cache(async (slug: string) => {
  const candidates = getModelSlugCandidates(slug);
  const models = await sql<Array<{ id: number; name: string; slug: string }>>`
    SELECT id, name, slug FROM models
    WHERE (shutdown_date IS NULL OR shutdown_date > (now() AT TIME ZONE 'UTC')::date) AND slug = ANY(${sql.array(candidates, TEXT_ARRAY)})
  `;
  const model = models.find((row) => row.slug === slug) ?? models[0];
  if (!model) return null;
  // Match getPlanComparison's slug candidates and deduplicate plans mapped
  // to more than one candidate, so the snippet counts the displayed rows.
  const plans = await sql<SeoPlan[]>`
    SELECT DISTINCT p.id, p.name, p.pricing_model, p.price, p.price_unit,
           p.currency, p.is_contact_sales
    FROM plans p
    JOIN model_plan_mapping mpm ON mpm.plan_id = p.id
    JOIN models m ON m.id = mpm.model_id
    WHERE (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date) AND m.slug = ANY(${sql.array(candidates, TEXT_ARRAY)})
    ORDER BY p.id
  `;
  return { model, plans };
});

export const getProviderSeoPlans = cache(async (providerId: number) => sql<SeoPlan[]>`
  SELECT id, name, pricing_model, price, price_unit, currency, is_contact_sales
  FROM plans WHERE provider_id = ${providerId}
  ORDER BY plan_kind, plan_line NULLS LAST, tier_rank NULLS LAST, price ASC NULLS LAST, id
`);

export const getPlansSeoProviders = cache(async () => sql<Array<{ name: string; planCount: number }>>`
  SELECT p.name, count(pl.id)::int AS "planCount"
  FROM providers p JOIN plans pl ON pl.provider_id = p.id
  GROUP BY p.id ORDER BY "planCount" DESC, p.name ASC
`);

export const getApiPricingSeoData = cache(async () => {
  const [products, timestamps] = await Promise.all([
    getGroupedProducts('llm'),
    sql<Array<{ updated_at: Date | string | null }>>`
      SELECT max(updated_at) AS updated_at FROM (
        SELECT cp.updated_at FROM api_channel_prices cp
        JOIN models m ON m.id = cp.model_id
        JOIN providers p ON p.id = cp.provider_id
        WHERE (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date) AND m.type = 'llm' AND cp.is_available = true
        UNION ALL
        SELECT v.updated_at FROM api_channel_price_variants v
        JOIN models m ON m.id = v.model_id
        JOIN api_channel_prices cp ON cp.model_id = v.model_id AND cp.provider_id = v.provider_id
        JOIN providers p ON p.id = cp.provider_id
        WHERE (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date) AND m.type = 'llm' AND cp.is_available = true
          AND v.is_available = true AND v.is_public = true
      ) price_updates
    `,
  ]);
  return { products, updatedAt: timestamps[0]?.updated_at ?? null };
});
