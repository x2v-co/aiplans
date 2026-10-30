import { sql, INT4_ARRAY } from './db';
import { currentPlanCondition } from './plan-lifecycle-query';
import { isSupersededPlan } from './plan-lifecycle';
import { getAllModelIdsForProvider } from './schema-adapters';
import { providerSubscriptionComparisons } from './subscription-search';
import type { PlanComparisonCandidate } from './search-indexing';
import type { ProviderRecord, ProviderPlanRecord, ProviderModelRecord } from './provider-page';

export async function getPlansByProvider(providerSlug: string) {
  const [provider] = await sql<ProviderRecord[]>`
    SELECT * FROM providers WHERE slug = ${providerSlug} LIMIT 1
  `;

  if (!provider) return null;

  // Ordered on the product-line axis, not by price. A flat price sort
  // interleaves lines -- a ¥20 coding plan landing between two chat tiers reads
  // as the cheap end of the chat line, which it is not. tier_rank carries the
  // vendor's own Lite/Pro/Max progression, so price is only the tiebreaker.
  const planRows = await sql<ProviderPlanRecord[]>`
    SELECT * FROM plans
    WHERE provider_id = ${provider.id} AND ${currentPlanCondition()}
    ORDER BY plan_kind, plan_line NULLS LAST, tier_rank NULLS LAST, price ASC NULLS LAST
  `;

  const plans = planRows.filter(plan => !isSupersededPlan(plan));
  const planIds = plans.map(p => p.id);
  const modelIds = await getAllModelIdsForProvider(provider.id, planIds);
  const uniqueModels: ProviderModelRecord[] = modelIds.length > 0
    ? [...await sql<ProviderModelRecord[]>`
        SELECT id, name, slug, model_category
        FROM models
        WHERE id = ANY(${sql.array(modelIds, INT4_ARRAY)})
          AND (shutdown_date IS NULL OR shutdown_date > (now() AT TIME ZONE 'UTC')::date)
      `]
    : [];

  // Match the global indexability pool before narrowing to this provider.
  const comparisonCandidates = modelIds.length ? await sql<Array<PlanComparisonCandidate & { name: string; provider_ids: number[] }>>`
    SELECT m.slug, m.name, m.provider_ids, m.released_at, m.updated_at, count(DISTINCT p.id)::int AS plan_count
    FROM models m
    JOIN model_plan_mapping mpm ON mpm.model_id = m.id
    JOIN plans p ON p.id = mpm.plan_id
    WHERE m.type ILIKE '%llm%' AND p.pricing_model = 'subscription'
      AND ${currentPlanCondition('p')}
      AND (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date)
    GROUP BY m.id, m.slug, m.name, m.released_at, m.updated_at
  ` : [];
  return { provider, models: uniqueModels, plans, comparisons: providerSubscriptionComparisons(comparisonCandidates.map(model => ({ ...model, isPrimaryProvider: model.provider_ids?.[0] === provider.id })), new Set(uniqueModels.map(model => model.slug))) };
}

