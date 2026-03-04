import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product_id');
    const tier = searchParams.get('tier');
    const pricingModel = searchParams.get('pricing_model');
    const includeModels = searchParams.get('include_models');

    let query = supabase
      .from('plans')
      .select(`
        *,
        products:product_id (
          id,
          name,
          slug,
          provider_id,
          type,
          benchmark_arena_elo
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

    let plans = data || [];

    // Get all provider_ids - either from plan.provider_id or plan.products.provider_id
    const providerIdsFromPlans = plans.map((plan: any) => plan.provider_id).filter(Boolean);
    const providerIdsFromProducts = plans.map((plan: any) => plan.products?.provider_id).filter(Boolean);
    const providerIds = [...new Set([...providerIdsFromPlans, ...providerIdsFromProducts])];

    // Fetch providers
    const { data: providersData } = await supabase
      .from('providers')
      .select('*')
      .in('id', providerIds);

    const providerMap = new Map((providersData || []).map(p => [p.id, p]));

    // Include associated models if requested
    if (includeModels === 'true') {
      const planIds = plans.map((p: any) => p.id);

      // Get models for these plans
      const { data: modelData } = await supabase
        .from('models')
        .select(`
          plan_id,
          product_id,
          provider_id,
          is_available,
          is_default,
          display_order,
          override_rpm,
          override_qps,
          override_tpm,
          override_input_price_per_1m,
          override_output_price_per_1m,
          max_input_tokens,
          max_output_tokens,
          note,
          display_name,
          products:product_id (
            id,
            name,
            slug,
            provider_id,
            type,
            benchmark_arena_elo
          )
        `)
        .in('plan_id', planIds)
        .order('display_order', { ascending: true });

      // Group models by plan
      const planModelsMap = new Map();
      (modelData || []).forEach((m: any) => {
        if (!planModelsMap.has(m.plan_id)) {
          planModelsMap.set(m.plan_id, []);
        }
        planModelsMap.get(m.plan_id)!.push({
          ...m.products,
          mapping: {
            overrideRpm: m.override_rpm,
            overrideQps: m.override_qps,
            overrideTpm: m.override_tpm,
            overrideInputPricePer1m: m.override_input_price_per_1m,
            overrideOutputPricePer1m: m.override_output_price_per_1m,
            maxInputTokens: m.max_input_tokens,
            maxOutputTokens: m.max_output_tokens,
            isAvailable: m.is_available,
            isDefault: m.is_default,
            displayOrder: m.display_order,
            displayName: m.display_name,
            note: m.note,
          }
        });
      });

      // Transform data to include models
      plans = plans.map((plan: any) => ({
        ...plan,
        models: planModelsMap.get(plan.id) || [],
      }));
    }

    // Transform data to include provider info
    const transformed = plans.map((plan: any) => ({
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
