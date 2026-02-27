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

    // Filter featured models (hot models)
    if (featured === 'true') {
      const hotModelSlugs = [
        'gpt-4o',
        'claude-3-5-sonnet',
        'deepseek-v3',
        'gemini-1-5-pro',
        'claude-3-opus',
        'gpt-4o-mini',
        'llama-3-1-405b',
        'qwen-max',
      ];
      products = products.filter((p: any) => hotModelSlugs.includes(p.slug));
    }

    // Include plan count if requested
    if (includePlanCount === 'true') {
      const productIds = products.map((p: any) => p.id);
      const { data: plansData } = await supabase
        .from('plans')
        .select('product_id')
        .in('product_id', productIds);

      const planCountMap = new Map();
      (plansData || []).forEach((plan: any) => {
        planCountMap.set(plan.product_id, (planCountMap.get(plan.product_id) || 0) + 1);
      });

      products = products.map((product: any) => ({
        ...product,
        planCount: planCountMap.get(product.id) || 0,
      }));
    }

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
