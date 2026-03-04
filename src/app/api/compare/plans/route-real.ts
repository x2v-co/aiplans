import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface ComparePlansQuery {
  model: string;
  region?: 'all' | 'global' | 'china';
  billingType?: 'all' | 'subscription' | 'pay_as_you_go' | 'prepaid';
  showYearly?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'rpm_desc' | 'qps_desc' | 'value';
  usageEstimate?: {
    monthlyRequests?: number;
    avgInputTokens?: number;
    avgOutputTokens?: number;
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const modelSlug = searchParams.get('model');

  if (!modelSlug) {
    return NextResponse.json({ error: 'Model parameter is required' }, { status: 400 });
  }

  const region = searchParams.get('region') || 'all';
  const billingType = searchParams.get('billingType') || 'all';
  const showYearly = searchParams.get('showYearly') === 'true';
  const sortBy = searchParams.get('sortBy') || 'price_asc';

  // Parse usage estimate if provided
  let usageEstimate: ComparePlansQuery['usageEstimate'] | undefined;
  const usageParam = searchParams.get('usageEstimate');
  if (usageParam) {
    try {
      usageEstimate = JSON.parse(usageParam);
    } catch (e) {
      // Invalid JSON, ignore
    }
  }

  // Set a timeout for Supabase queries
  const timeout = setTimeout(() => {
    throw new Error('Database query timeout');
  }, 5000);

  try {
    // Fetch model data
    const { data: model, error: modelError } = await supabase
      .from('products')
      .select(`
        *,
        providers:provider_id (
          id,
          name,
          slug,
          logo
        )
      `)
      .eq('slug', modelSlug)
      .single();

    if (modelError) {
      console.error('Model fetch error:', modelError);
      return NextResponse.json({ error: 'Model not found: ' + modelError.message }, { status: 404 });
    }

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    // Fetch all plans for this model
    // Note: This queries the plans table directly since model_plan_mapping may not exist yet
    // TODO: Once model_plan_mapping table is created and populated, use that for many-to-many relationships
    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select(`
        *,
        products:product_id (
          id,
          name,
          slug
        )
      `)
      .eq('product_id', model.id);

    if (plansError) {
      console.error('Plans fetch error:', plansError);
      return NextResponse.json({ error: 'Failed to fetch plans: ' + plansError.message }, { status: 500 });
    }

    // Convert to mappings format for compatibility
    const mappings = (plans || []).map((plan: any) => ({
      id: plan.id,
      product_id: plan.product_id,
      plan_id: plan.id,
      plans: plan,
      override_rpm: null,
      override_qps: null,
      override_input_price_per_1m: null,
      override_output_price_per_1m: null,
      override_max_output_tokens: null,
      is_available: true,
      note: null,
    }));

    // Process and format plan data
    const allPlans = (mappings || []).map((mapping: any) => {
      const plan = mapping.plans;

      // Use existing schema fields with fallbacks
      const rpm = plan.rate_limit || null;
      const qps = null; // Not in current schema
      const inputPrice = plan.price || null;
      const outputPrice = null; // Not in current schema
      const maxOutputTokens = null; // Not in current schema

      return {
        plan: {
          id: plan.id,
          slug: plan.slug,
          name: plan.name,
          nameZh: plan.name,
          planTier: plan.tier || 'unknown',
          isOfficial: true, // Default to true until we have channel data
        },
        channel: {
          slug: 'official',
          name: model.providers?.name || 'Unknown',
          nameZh: model.providers?.name || 'Unknown',
          logo: model.providers?.logo || '',
          region: 'global',
          accessFromChina: plan.access_from_china ?? true,
          paymentMethods: plan.payment_methods || ['credit_card'],
        },
        pricing: {
          billingModel: plan.pricing_model || 'subscription',
          monthly: plan.pricing_model === 'subscription' ? plan.price : null,
          yearly: null, // Not in current schema
          yearlyMonthly: null,
          yearlyDiscountPercent: null,
          currency: 'USD',
          inputPer1m: inputPrice,
          outputPer1m: outputPrice,
          cachedInputPer1m: null,
          hasOverage: false,
          overageInputPer1m: null,
          overageOutputPer1m: null,
        },
        limits: {
          rpm: rpm,
          rpd: plan.daily_message_limit || null,
          rpm_display: rpm ? `${rpm} RPM` : 'Unlimited',
          tpm: null,
          tpd: null,
          tpm_display: 'Unlimited',
          monthlyRequests: plan.monthly_message_limit || null,
          monthlyTokens: null,
          maxTokensPerRequest: null,
          maxInputTokens: null,
          maxOutputTokens: maxOutputTokens,
        },
        performance: {
          qps: qps,
          concurrentRequests: null,
          qps_display: 'Unlimited',
        },
        vsOfficial: {
          priceDiffPercent: null,
          priceDiffLabel: 'Official Price',
          rpmDiffPercent: null,
          qpsDiffPercent: null,
        },
        estimatedCost: undefined as any,
        lastVerified: plan.updated_at,
        sourceUrl: '',
        note: mapping.note || null,
      };
    });

    // If no plans found, return empty result
    if (allPlans.length === 0) {
      return NextResponse.json({
        model: {
          slug: model.slug,
          name: model.name,
          provider: {
            slug: model.providers?.slug || '',
            name: model.providers?.name || '',
            logo: model.providers?.logo || '',
          },
          contextWindow: model.context_window || 0,
          maxOutput: 0,
          benchmarkArena: model.benchmark_arena_elo || 0,
          releaseDate: model.released_at || null,
        },
        officialPlans: [],
        thirdPartyPlans: [],
        summary: {
          totalPlans: 0,
          cheapestPlan: null,
          bestRpmPlan: null,
          bestQpsPlan: null,
          officialPrice: null,
        },
      });
    }

    // Separate official and third-party plans
    const officialPlans = allPlans.filter((p) => p.plan.isOfficial);
    const thirdPartyPlans = allPlans.filter((p) => !p.plan.isOfficial);

    // Calculate vs official comparisons
    const officialBaseline = officialPlans[0]; // Use first official plan as baseline
    if (officialBaseline) {
      thirdPartyPlans.forEach((plan) => {
        if (officialBaseline.pricing.inputPer1m && plan.pricing.inputPer1m) {
          const diff = ((plan.pricing.inputPer1m - officialBaseline.pricing.inputPer1m) / officialBaseline.pricing.inputPer1m) * 100;
          plan.vsOfficial.priceDiffPercent = Math.round(diff) as any;
          if (diff < 0) {
            plan.vsOfficial.priceDiffLabel = `${Math.abs(Math.round(diff))}% cheaper`;
          } else if (diff > 0) {
            plan.vsOfficial.priceDiffLabel = `${Math.round(diff)}% more expensive`;
          } else {
            plan.vsOfficial.priceDiffLabel = 'Same as official';
          }
        }

        if (officialBaseline.limits.rpm && plan.limits.rpm) {
          plan.vsOfficial.rpmDiffPercent = Math.round(((plan.limits.rpm - officialBaseline.limits.rpm) / officialBaseline.limits.rpm) * 100) as any;
        }

        if (officialBaseline.performance.qps && plan.performance.qps) {
          plan.vsOfficial.qpsDiffPercent = Math.round(((plan.performance.qps - officialBaseline.performance.qps) / officialBaseline.performance.qps) * 100) as any;
        }
      });
    }

    // Calculate estimated costs if usage estimate provided
    if (usageEstimate && usageEstimate.monthlyRequests && usageEstimate.avgInputTokens && usageEstimate.avgOutputTokens) {
      const monthlyRequests = usageEstimate.monthlyRequests;
      const avgInputTokens = usageEstimate.avgInputTokens;
      const avgOutputTokens = usageEstimate.avgOutputTokens;

      allPlans.forEach((plan) => {
        const totalInputTokens = monthlyRequests * avgInputTokens / 1_000_000;
        const totalOutputTokens = monthlyRequests * avgOutputTokens / 1_000_000;

        let subscriptionCost = 0;
        let tokenCost = 0;
        let overageCost = 0;

        if (plan.pricing.billingModel === 'subscription') {
          subscriptionCost = plan.pricing.monthly || 0;
        }

        if (plan.pricing.inputPer1m && plan.pricing.outputPer1m) {
          tokenCost = (totalInputTokens * plan.pricing.inputPer1m) + (totalOutputTokens * plan.pricing.outputPer1m);
        }

        const limitWarnings: string[] = [];
        let isWithinLimits = true;

        if (plan.limits.monthlyRequests && monthlyRequests > plan.limits.monthlyRequests) {
          limitWarnings.push('Monthly request limit exceeded');
          isWithinLimits = false;
        }

        plan.estimatedCost = {
          monthlyCost: subscriptionCost + tokenCost + overageCost,
          currency: 'USD',
          breakdown: {
            subscription: subscriptionCost,
            tokenUsage: tokenCost,
            overage: overageCost,
            total: subscriptionCost + tokenCost + overageCost,
          },
          isWithinLimits,
          limitWarnings,
        } as any;
      });
    }

    // Apply filters
    let filteredPlans = [...officialPlans, ...thirdPartyPlans];

    if (region !== 'all') {
      if (region === 'china') {
        filteredPlans = filteredPlans.filter(p => p.channel.accessFromChina);
      } else if (region === 'global') {
        filteredPlans = filteredPlans.filter(p => p.channel.region === 'global');
      }
    }

    if (billingType !== 'all') {
      filteredPlans = filteredPlans.filter(p => p.pricing.billingModel === billingType);
    }

    // Sort plans
    if (sortBy === 'price_asc') {
      filteredPlans.sort((a, b) => {
        const aPrice = a.pricing.monthly || a.pricing.inputPer1m || 0;
        const bPrice = b.pricing.monthly || b.pricing.inputPer1m || 0;
        return aPrice - bPrice;
      });
    } else if (sortBy === 'price_desc') {
      filteredPlans.sort((a, b) => {
        const aPrice = a.pricing.monthly || a.pricing.inputPer1m || 0;
        const bPrice = b.pricing.monthly || b.pricing.inputPer1m || 0;
        return bPrice - aPrice;
      });
    } else if (sortBy === 'rpm_desc') {
      filteredPlans.sort((a, b) => (b.limits.rpm || 0) - (a.limits.rpm || 0));
    } else if (sortBy === 'qps_desc') {
      filteredPlans.sort((a, b) => (b.performance.qps || 0) - (a.performance.qps || 0));
    }

    // Calculate summary
    const cheapestPlan = filteredPlans.reduce((min, p) => {
      const price = p.pricing.monthly || p.pricing.inputPer1m || Infinity;
      const minPrice = min.pricing.monthly || min.pricing.inputPer1m || Infinity;
      return price < minPrice ? p : min;
    }, filteredPlans[0]);

    const bestRpmPlan = filteredPlans.reduce((max, p) => {
      return (p.limits.rpm || 0) > (max.limits.rpm || 0) ? p : max;
    }, filteredPlans[0]);

    const bestQpsPlan = filteredPlans.reduce((max, p) => {
      return (p.performance.qps || 0) > (max.performance.qps || 0) ? p : max;
    }, filteredPlans[0]);

    const response = {
      model: {
        slug: model.slug,
        name: model.name,
        provider: {
          slug: model.providers?.slug || '',
          name: model.providers?.name || '',
          logo: model.providers?.logo || '',
        },
        contextWindow: model.context_window || 0,
        maxOutput: model.max_output_tokens || 0,
        benchmarkArena: model.benchmark_arena_elo || 0,
        releaseDate: model.released_at || null,
      },
      officialPlans: filteredPlans.filter(p => p.plan.isOfficial),
      thirdPartyPlans: filteredPlans.filter(p => !p.plan.isOfficial),
      summary: {
        totalPlans: filteredPlans.length,
        cheapestPlan: cheapestPlan ? {
          name: cheapestPlan.plan.name,
          channel: cheapestPlan.channel.name,
          effectiveMonthly: cheapestPlan.pricing.monthly || cheapestPlan.pricing.inputPer1m || 0,
        } : null,
        bestRpmPlan: bestRpmPlan ? {
          name: bestRpmPlan.plan.name,
          channel: bestRpmPlan.channel.name,
          rpm: bestRpmPlan.limits.rpm || 0,
        } : null,
        bestQpsPlan: bestQpsPlan ? {
          name: bestQpsPlan.plan.name,
          channel: bestQpsPlan.channel.name,
          qps: bestQpsPlan.performance.qps || 0,
        } : null,
        officialPrice: officialBaseline ? {
          inputPer1m: officialBaseline.pricing.inputPer1m || 0,
          outputPer1m: officialBaseline.pricing.outputPer1m || 0,
        } : null,
      },
    };

    clearTimeout(timeout);
    return NextResponse.json(response);
  } catch (error) {
    clearTimeout(timeout);
    console.error('Error fetching comparison data:', error);

    // Return a more helpful error message
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({
      error: errorMessage,
      _hint: 'The database may not be set up yet. Run migrations and seed data, or check Supabase connection.',
      _schema: 'See src/db/schema/index.ts for the required database schema'
    }, { status: 500 });
  }
}
