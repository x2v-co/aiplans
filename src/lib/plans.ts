import { publicModelName } from './public-catalog-copy';
import { sql, INT4_ARRAY } from '@/lib/db';
import type { ChannelTermsFields } from '@/lib/channel-terms';
import type { PlanCoverageFields } from '@/lib/third-party-coverage';
import type { EconomicPlan } from '@/lib/plan-economics';

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

interface PlanProvider {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  logo_url: string | null;
  region: string | null;
  [field: string]: unknown;
}

interface PlanModel {
  id: number;
  name: string;
  slug: string;
  provider_ids: number[] | null;
  type: string;
  context_window: number | null;
}

export interface ListedPlan extends EconomicPlan, PlanCoverageFields, ChannelTermsFields {
  id: number;
  name: string;
  tier: string | null;
  pricing_model: string;
  provider_id: number | null;
  annual_price: number | null;
  is_official: boolean | null;
  provider?: PlanProvider | null;
  models?: PlanModel[];
  [field: string]: unknown;
}

export async function getPlans(query: PlanQuery = {}): Promise<ListedPlan[]> {
  const { tier = null, pricingModel = null, providerId = null, includeModels = false } = query;

  const planRows = await sql<ListedPlan[]>`
    SELECT plans.*,
      (to_jsonb(plans)->>'data_for_discount')::boolean AS data_for_discount,
      to_jsonb(plans)->>'data_for_discount_note' AS data_for_discount_note,
      to_jsonb(plans)->>'quota_unit' AS quota_unit
    FROM plans
    WHERE (${tier}::text IS NULL OR tier = ${tier})
      AND (${pricingModel}::text IS NULL OR pricing_model = ${pricingModel})
      AND (${providerId}::integer IS NULL OR provider_id = ${providerId})
    ORDER BY tier ASC NULLS LAST, price ASC NULLS LAST
  `;
  let plans = [...planRows];

  // Get all provider_ids from plans
  const providerIds = [...new Set(plans.map((plan) => plan.provider_id).filter((id): id is number => id != null))];

  // Fetch providers
  const providersData = providerIds.length > 0
    ? await sql<PlanProvider[]>`
        SELECT * FROM providers
        WHERE id = ANY(${sql.array(providerIds, INT4_ARRAY)})
      `
    : [];

  const providerMap = new Map(providersData.map(p => [p.id, p]));

  // Include associated models if requested
  if (includeModels) {
    const planIds = plans.map((p) => p.id);

    // Get models for these plans via model_plan_mapping
    // Schema: model_id, plan_id, priority
    const modelData = planIds.length > 0
      ? await sql<Array<{ plan_id: number; model_id: number; priority: number | null }>>`
          SELECT plan_id, model_id, priority
          FROM model_plan_mapping
          WHERE plan_id = ANY(${sql.array(planIds, INT4_ARRAY)})
          ORDER BY priority ASC
        `
      : [];

    // Get unique model IDs and fetch model details
    const modelIds = [...new Set(modelData.map((m) => m.model_id))];
    const modelsData = modelIds.length > 0
      ? await sql<PlanModel[]>`
          SELECT id, name, slug, provider_ids, type, context_window
          FROM models
          WHERE id = ANY(${sql.array(modelIds, INT4_ARRAY)})
            AND (shutdown_date IS NULL OR shutdown_date > (now() AT TIME ZONE 'UTC')::date)
        `
      : [];

    const modelsMap = new Map(modelsData.map(m => [m.id, { ...m, name: publicModelName(m.name) }]));

    // Group models by plan
    const planModelsMap = new Map<number, PlanModel[]>();
    modelData.forEach((m) => {
      if (!planModelsMap.has(m.plan_id)) {
        planModelsMap.set(m.plan_id, []);
      }
      const model = modelsMap.get(m.model_id);
      if (model) {
        planModelsMap.get(m.plan_id)!.push(model);
      }
    });

    // Transform data to include models
    plans = plans.map((plan) => ({
      ...plan,
      models: planModelsMap.get(plan.id) || [],
    }));
  }

  // Transform data to include provider info
  return plans.map((plan) => ({
    ...plan,
    provider: plan.provider_id ? providerMap.get(plan.provider_id) ?? null : null,
  }));
}
