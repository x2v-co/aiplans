import { sql, INT4_ARRAY } from '@/lib/db';

/**
 * The plan listing behind /api/plans, extracted so server components can build
 * it directly. /compare/plans fetched it from an effect and therefore served
 * crawlers a page with no plans and no prices on it.
 */

export type PlanQuery = {
  tier?: string | null;
  pricingModel?: string | null;
  providerId?: number | null;
  /** Attach each plan's `models` array via model_plan_mapping. */
  includeModels?: boolean;
};

export async function getPlans(query: PlanQuery = {}): Promise<any[]> {
  const { tier = null, pricingModel = null, providerId = null, includeModels = false } = query;

  const planRows = await sql<any[]>`
    SELECT * FROM plans
    WHERE (${tier}::text IS NULL OR tier = ${tier})
      AND (${pricingModel}::text IS NULL OR pricing_model = ${pricingModel})
      AND (${providerId}::integer IS NULL OR provider_id = ${providerId})
    ORDER BY tier ASC NULLS LAST, price ASC NULLS LAST
  `;
  let plans: any[] = [...planRows];

  // Get all provider_ids from plans
  const providerIds = [...new Set(plans.map((plan: any) => plan.provider_id).filter(Boolean))];

  // Fetch providers
  const providersData = providerIds.length > 0
    ? await sql<any[]>`
        SELECT * FROM providers
        WHERE id = ANY(${sql.array(providerIds, INT4_ARRAY)})
      `
    : [];

  const providerMap = new Map(providersData.map(p => [p.id, p]));

  // Include associated models if requested
  if (includeModels) {
    const planIds = plans.map((p: any) => p.id);

    // Get models for these plans via model_plan_mapping
    // Schema: model_id, plan_id, priority
    const modelData = planIds.length > 0
      ? await sql<any[]>`
          SELECT plan_id, model_id, priority
          FROM model_plan_mapping
          WHERE plan_id = ANY(${sql.array(planIds, INT4_ARRAY)})
          ORDER BY priority ASC
        `
      : [];

    // Get unique model IDs and fetch model details
    const modelIds = [...new Set((modelData || []).map((m: any) => m.model_id).filter(Boolean))];
    const modelsData = modelIds.length > 0
      ? await sql<any[]>`
          SELECT id, name, slug, provider_ids, type, context_window
          FROM models
          WHERE id = ANY(${sql.array(modelIds, INT4_ARRAY)})
        `
      : [];

    const modelsMap = new Map(modelsData.map(m => [m.id, m]));

    // Group models by plan
    const planModelsMap = new Map();
    modelData.forEach((m: any) => {
      if (!planModelsMap.has(m.plan_id)) {
        planModelsMap.set(m.plan_id, []);
      }
      const model = modelsMap.get(m.model_id);
      if (model) {
        planModelsMap.get(m.plan_id)!.push(model);
      }
    });

    // Transform data to include models
    plans = plans.map((plan: any) => ({
      ...plan,
      models: planModelsMap.get(plan.id) || [],
    }));
  }

  // Transform data to include provider info
  return plans.map((plan: any) => ({
    ...plan,
    provider: plan.provider_id ? providerMap.get(plan.provider_id) : null,
  }));
}
