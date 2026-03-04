import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const providerId = searchParams.get('provider_id');
    const featured = searchParams.get('featured');
    const includePlanCount = searchParams.get('include_plan_count');

    let query = supabase
      .from('products')
      .select(`
        *,
        providers (
          id,
          name,
          slug,
          logo_url
        )
      `)
      .order('name');

    if (type) {
      query = query.eq('type', type);
    }
    if (providerId) {
      query = query.eq('provider_id', parseInt(providerId));
    }

    const { data, error } = await query;

    if (error) throw error;

    let products = data || [];

    // Include plan count if requested (must do this before featured filtering)
    if (includePlanCount === 'true') {
      const productIds = products.map((p: any) => p.id);
      const { data: modelsData } = await supabase
        .from('models')
        .select('product_id, plan_id')
        .in('product_id', productIds);

      const planCountMap = new Map();
      (modelsData || []).forEach((model: any) => {
        planCountMap.set(model.product_id, (planCountMap.get(model.product_id) || 0) + 1);
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
        const providerId = p.provider?.id || p.provider_id;
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
