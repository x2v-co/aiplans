import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier');
    const pricingModel = searchParams.get('pricing_model');
    const providerId = searchParams.get('provider_id');
    const includeModels = searchParams.get('include_models');

    // Build base query for plans
    let query = supabase
      .from('plans')
      .select('*')
      .order('tier', { ascending: true })
      .order('price', { ascending: true });

    if (tier) {
      query = query.eq('tier', tier);
    }
    if (pricingModel) {
      query = query.eq('pricing_model', pricingModel);
    }
    if (providerId) {
      query = query.eq('provider_id', parseInt(providerId));
    }

    const { data, error } = await query;

    if (error) throw error;

    let plans = data || [];

    // Get all provider_ids from plans
    const providerIds = [...new Set(plans.map((plan: any) => plan.provider_id).filter(Boolean))];

    // Fetch providers
    const { data: providersData } = await supabase
      .from('providers')
      .select('*')
      .in('id', providerIds);

    const providerMap = new Map((providersData || []).map(p => [p.id, p]));

    // Include associated models if requested
    if (includeModels === 'true') {
      const planIds = plans.map((p: any) => p.id);

      // Get models for these plans via model_plan_mapping
      // Schema: model_id, plan_id, priority
      const { data: modelData } = await supabase
        .from('model_plan_mapping')
        .select(`
          plan_id,
          model_id,
          priority
        `)
        .in('plan_id', planIds)
        .order('priority', { ascending: true });

      // Get unique model IDs and fetch model details
      const modelIds = [...new Set((modelData || []).map((m: any) => m.model_id).filter(Boolean))];
      const { data: modelsData } = await supabase
        .from('models')
        .select('id, name, slug, provider_ids, type, context_window')
        .in('id', modelIds);

      const modelsMap = new Map((modelsData || []).map(m => [m.id, m]));

      // Group models by plan
      const planModelsMap = new Map();
      (modelData || []).forEach((m: any) => {
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
    const transformed = plans.map((plan: any) => ({
      ...plan,
      provider: plan.provider_id ? providerMap.get(plan.provider_id) : null,
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}
