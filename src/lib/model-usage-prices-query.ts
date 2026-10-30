import { currentPlanCondition } from './plan-lifecycle-query';
import { sql } from './db';
import type { ModelUsagePriceRow } from './model-usage-prices';

/** Shared by LLM and video details; only reads rows for this exact model. */
export async function getModelUsagePrices(slug: string): Promise<ModelUsagePriceRow[]> {
  return [...await sql<ModelUsagePriceRow[]>`
    SELECT up.*, up.last_verified::text AS last_verified,
           p.name AS provider_name, p.slug AS provider_slug, p.type AS provider_type,
           pl.name AS plan_name, pl.slug AS plan_slug
    FROM usage_prices up
    JOIN models m ON m.id = up.model_id
    LEFT JOIN providers p ON p.id = up.provider_id
    LEFT JOIN plans pl ON pl.id = up.plan_id
    WHERE m.slug = ${slug} AND COALESCE(up.is_available, true)
      AND ${currentPlanCondition('pl')}
      AND (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date)
    ORDER BY up.id
  `];
}
