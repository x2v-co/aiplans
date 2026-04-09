import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { attachPrimaryProvidersToModels, getAllModelIdsForProvider } from '@/lib/schema-adapters';

// Enable ISR with 5 minute revalidation
export const revalidate = 300;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const providerId = searchParams.get('provider_id');
    const featured = searchParams.get('featured');
    const includePlanCount = searchParams.get('include_plan_count');

    let query = supabase
      .from('models')
      .select('*')
      .order('name');

    if (type) {
      query = query.eq('type', type);
    }
    if (providerId) {
      const matchedModelIds = await getAllModelIdsForProvider(parseInt(providerId));
      if (matchedModelIds.length === 0) {
        return NextResponse.json([]);
      }
      query = query.in('id', matchedModelIds);
    }

    const { data, error } = await query;

    if (error) throw error;

    let products = data || [];

    // Fetch benchmark scores from model_benchmark_scores table
    const modelIds = products.map((p: any) => p.id);
    const { data: benchmarkData } = await supabase
      .from('model_benchmark_scores')
      .select('model_id, value')
      .in('model_id', modelIds)
      .order('value', { ascending: false });

    // Create benchmark map: model_id -> highest value
    const benchmarkMap = new Map<number, number>();
    (benchmarkData || []).forEach((bs: any) => {
      const modelId = bs.model_id;
      const value = bs.value;
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
      const { data: planMappings } = await supabase
        .from('model_plan_mapping')
        .select('model_id, plan_id')
        .not('plan_id', 'is', null)
        .in('model_id', modelIds);

      const planCountMap = new Map();
      (planMappings || []).forEach((m: any) => {
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
