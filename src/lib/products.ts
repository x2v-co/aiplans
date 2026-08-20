import { sql, INT4_ARRAY } from '@/lib/db';
import { attachPrimaryProvidersToModels, getAllModelIdsForProvider } from '@/lib/schema-adapters';
import { pickNewestPerSeries } from '@/lib/model-series';

/**
 * The model listing behind /api/products, extracted so server components can
 * build it without an HTTP round trip. The landing page and /compare/plans both
 * used to fetch this from an effect, which meant crawlers saw no model names on
 * either page.
 */

type FeaturedModel = {
  slug: string;
  benchmark_arena_elo?: number | null;
  [key: string]: unknown;
};

export type ProductQuery = {
  type?: string | null;
  providerId?: number | null;
  /** Collapse to the top 8 models by Agent Arena score, newest per series. */
  featured?: boolean;
  /** Attach `planCount` and `hasApiPricing`. Required for `featured` filtering. */
  includePlanCount?: boolean;
};

export async function getProducts(query: ProductQuery = {}): Promise<any[]> {
  const { type = null, providerId = null, featured = false, includePlanCount = false } = query;

  let matchedModelIds: number[] | null = null;
  if (providerId != null) {
    matchedModelIds = await getAllModelIdsForProvider(providerId);
    if (matchedModelIds.length === 0) {
      return [];
    }
  }

  const productRows = matchedModelIds
    ? await sql<any[]>`
        SELECT * FROM models
        WHERE (${type}::text IS NULL OR type = ${type})
          AND id = ANY(${sql.array(matchedModelIds, INT4_ARRAY)})
        ORDER BY name
      `
    : await sql<any[]>`
        SELECT * FROM models
        WHERE (${type}::text IS NULL OR type = ${type})
        ORDER BY name
      `;
  let products: any[] = [...productRows];

  // Fetch benchmark scores from model_benchmark_scores table
  const modelIds = products.map((p: any) => p.id);
  const benchmarkData: Array<{ model_id: number; value: number | null }> = modelIds.length > 0
    ? [...await sql<Array<{ model_id: number; value: number | null }>>`
        SELECT s.model_id, s.value
        FROM model_benchmark_scores s
        JOIN benchmark_tasks bt ON bt.id = s.benchmark_task_id
        JOIN benchmark_versions bv ON bv.id = bt.benchmark_version_id
          AND bv.is_current = true
        JOIN benchmarks b ON b.id = bv.benchmark_id AND b.slug = 'arena-agent'
        JOIN benchmark_metrics bm ON bm.id = s.metric_id AND bm.name = 'AGENT_NET_IMPROVEMENT'
        WHERE s.model_id = ANY(${sql.array(modelIds, INT4_ARRAY)})
        ORDER BY value DESC NULLS LAST
      `]
    : [];

  // Create benchmark map: model_id -> highest value
  const benchmarkMap = new Map<number, number>();
  benchmarkData.forEach((bs) => {
    const modelId = bs.model_id;
    const value = bs.value;
    if (value == null) return;
    if (!benchmarkMap.has(modelId) || value > (benchmarkMap.get(modelId) || 0)) {
      benchmarkMap.set(modelId, value);
    }
  });

  // Attach benchmark_arena_elo to each product
  products = products.map((p: any) => ({
    ...p,
    benchmark_arena_elo: benchmarkMap.get(p.id) || null,
  }));

  products = await attachPrimaryProvidersToModels(products as any[]);

  // Include plan count if requested (must do this before featured filtering)
  if (includePlanCount) {
    const modelIds = products.map((p: any) => p.id);
    const planMappings: Array<{ model_id: number; plan_id: number | null }> = modelIds.length > 0
      ? [...await sql<Array<{ model_id: number; plan_id: number | null }>>`
          SELECT model_id, plan_id
          FROM model_plan_mapping
          WHERE plan_id IS NOT NULL
            AND model_id = ANY(${sql.array(modelIds, INT4_ARRAY)})
        `]
      : [];

    const planCountMap = new Map();
    planMappings.forEach((m) => {
      if (m.plan_id) {
        planCountMap.set(m.model_id, (planCountMap.get(m.model_id) || 0) + 1);
      }
    });

    products = products.map((product: any) => ({
      ...product,
      planCount: planCountMap.get(product.id) || 0,
    }));

    const apiPricedModels = modelIds.length > 0
      ? await sql<Array<{ model_id: number }>>`
          SELECT DISTINCT model_id
          FROM api_channel_prices
          WHERE is_available = true
            AND model_id = ANY(${sql.array(modelIds, INT4_ARRAY)})
        `
      : [];
    const apiPricingIds = new Set(apiPricedModels.map((row) => row.model_id));
    products = products.map((product: any) => ({
      ...product,
      hasApiPricing: apiPricingIds.has(product.id),
    }));
  }

  // Filter featured models using Agent Arena performance and availability.
  if (featured) {
    // Automatically select top models based on Agent Arena net improvement.
    products = products
      .filter((p: any) => {
        // A hot model is usable if it has either subscription plans or API
        // channel pricing. New model versions often launch API-first.
        if (includePlanCount && (p.planCount || 0) === 0 && !p.hasApiPricing) return false;
        return p.benchmark_arena_elo != null;
      })
      .sort((a: any, b: any) => {
        // Sort by Agent Arena score first, then by plan count.
        const aElo = a.benchmark_arena_elo || 0;
        const bElo = b.benchmark_arena_elo || 0;
        if (bElo !== aElo) {
          return bElo - aElo;
        }
        // Same score, sort by plan count.
        return (b.planCount || 0) - (a.planCount || 0);
      });

    // Keep only the newest version within each model series. For example,
    // claude-opus-4.6 and claude-opus-4.7 collapse into claude-opus-5 when
    // it exists. Agent Arena performance orders different series.
    products = pickNewestPerSeries(
      products as FeaturedModel[],
      (product) => product.slug,
      (product) => product.benchmark_arena_elo || 0,
    )
      .sort((a: FeaturedModel, b: FeaturedModel) =>
        (b.benchmark_arena_elo || 0) - (a.benchmark_arena_elo || 0)
      )
      .slice(0, 8);
  }

  return products;
}
