import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { attachPrimaryProvidersToModels, getAllModelIdsForProvider } from '@/lib/schema-adapters';

// The response varies by query string, so it cannot be statically rendered.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const providerId = searchParams.get('provider_id');
    const featured = searchParams.get('featured');
    const includePlanCount = searchParams.get('include_plan_count');

    let matchedModelIds: number[] | null = null;
    if (providerId) {
      matchedModelIds = await getAllModelIdsForProvider(parseInt(providerId));
      if (matchedModelIds.length === 0) {
        return NextResponse.json([]);
      }
    }

    const productRows = matchedModelIds
      ? await sql<any[]>`
          SELECT * FROM models
          WHERE (${type}::text IS NULL OR type = ${type})
            AND id = ANY(${sql.array(matchedModelIds, 23)})
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
          SELECT model_id, value
          FROM model_benchmark_scores
          WHERE model_id = ANY(${sql.array(modelIds, 23)})
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
    if (includePlanCount === 'true') {
      const modelIds = products.map((p: any) => p.id);
      const planMappings: Array<{ model_id: number; plan_id: number | null }> = modelIds.length > 0
        ? [...await sql<Array<{ model_id: number; plan_id: number | null }>>`
            SELECT model_id, plan_id
            FROM model_plan_mapping
            WHERE plan_id IS NOT NULL
              AND model_id = ANY(${sql.array(modelIds, 23)})
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
    }

    // Filter featured models (hot models) - based on Arena ELO AND planCount
    if (featured === 'true') {
      // Automatically select top models based on Arena ELO score and plan availability
      products = products
        .filter((p: any) => {
          // Only include models that have plans available
          if (includePlanCount === 'true' && (p.planCount || 0) === 0) return false;
          return true;
        })
        .sort((a: any, b: any) => {
          // Sort by Arena ELO first, then by plan count
          const aElo = a.benchmark_arena_elo || 0;
          const bElo = b.benchmark_arena_elo || 0;
          if (bElo !== aElo) {
            return bElo - aElo;
          }
          // Same ELO, sort by plan count
          return (b.planCount || 0) - (a.planCount || 0);
        });

      // Keep only the highest ELO model per provider
      const providerTopModels = new Map();
      products.forEach((p: any) => {
        const providerId = p.providers?.id || p.provider_ids?.[0];
        const currentTop = providerTopModels.get(providerId);
        const currentElo = currentTop?.benchmark_arena_elo || 0;
        const newElo = p.benchmark_arena_elo || 0;
        if (newElo > currentElo) {
          providerTopModels.set(providerId, p);
        }
      });

      // Sort by ELO descending and take top 8
      products = Array.from(providerTopModels.values())
        .sort((a: any, b: any) => {
          return (b.benchmark_arena_elo || 0) - (a.benchmark_arena_elo || 0);
        })
        .slice(0, 8);
    }

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
