import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product_id');
    const tier = searchParams.get('tier');
    const pricingModel = searchParams.get('pricing_model');

    let query = supabase
      .from('plans')
      .select(`
        *,
        products:product_id (
          id,
          name,
          slug,
          provider_id,
          type
        )
      `)
      .order('tier', { ascending: true })
      .order('price', { ascending: true });

    if (productId) {
      query = query.eq('product_id', parseInt(productId));
    }
    if (tier) {
      query = query.eq('tier', tier);
    }
    if (pricingModel) {
      query = query.eq('pricing_model', pricingModel);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get all provider_ids - either from plan.provider_id or plan.products.provider_id
    const providerIdsFromPlans = (data || []).map((plan: any) => plan.provider_id).filter(Boolean);
    const providerIdsFromProducts = (data || []).map((plan: any) => plan.products?.provider_id).filter(Boolean);
    const providerIds = [...new Set([...providerIdsFromPlans, ...providerIdsFromProducts])];

    // Fetch providers
    const { data: providersData } = await supabase
      .from('providers')
      .select('*')
      .in('id', providerIds);

    const providerMap = new Map((providersData || []).map(p => [p.id, p]));

    // Transform data to include provider info
    const transformed = (data || []).map((plan: any) => ({
      ...plan,
      provider: plan.provider_id
        ? providerMap.get(plan.provider_id)
        : (plan.products?.provider_id ? providerMap.get(plan.products.provider_id) : null),
      product: plan.products,
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}
