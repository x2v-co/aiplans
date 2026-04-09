import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { CurrencyCode } from '@/lib/currency';
import {
  convertToUSD,
  convertPrice,
  calculatePriceDifference,
  getExchangeRateDisplay,
} from '@/lib/currency-conversion';
import { getExchangeRateSync } from '@/lib/exchange-rates';
import { getPrimaryProvidersForModels, getPlanYearlyMonthly } from '@/lib/schema-adapters';
import { getProviderLogoFallback, getProviderLogoSrc } from '@/lib/provider-branding';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const modelSlug = searchParams.get('model');
  const displayCurrencyParam = searchParams.get('currency') || 'USD';
  const displayCurrency = displayCurrencyParam as CurrencyCode;

  if (!modelSlug) {
    return NextResponse.json({ error: 'Model parameter is required' }, { status: 400 });
  }

  try {
    const slugCandidates = getModelSlugCandidates(modelSlug);

    // 1. Get product/model info first (needed for other queries)
    const { data: products, error: productError } = await supabase
      .from('models')
      .select(`
        id,
        name,
        slug,
        provider_ids,
        context_window
      `)
      .in('slug', slugCandidates);

    if (productError || !products || products.length === 0) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    const product = products.find((item) => item.slug === modelSlug) || products[0];
    const relatedModelIds = products.map((item) => item.id);

    // Fetch the model's primary provider from the normalized relation first, then fallback.
    const modelProviders = await getPrimaryProvidersForModels([product as any]);
    const productProvider = modelProviders.get(product.id);

    // 2. Run remaining queries in parallel for better performance
    const [
      { data: channelPrices },
      { data: modelPlans },
    ] = await Promise.all([
      // Query 2: Get API pricing from api_channel_prices
      supabase
        .from('api_channel_prices')
        .select(`
          id,
          input_price_per_1m,
          output_price_per_1m,
          cached_input_price_per_1m,
          rate_limit,
          last_verified,
          is_available,
          providers:provider_id (
            id,
            name,
            slug,
            type,
            region,
            access_from_china,
            logo,
            logo_url,
            website,
            invite_url
          )
        `)
        .eq('model_id', product.id)
        .eq('is_available', true)
        .not('provider_id', 'is', null)
        .order('input_price_per_1m', { ascending: true }),
      // Query 3: Get subscription plans that include this model (via model_plan_mapping)
      // Schema only has: model_id, plan_id, priority
      supabase
        .from('model_plan_mapping')
        .select(`
          plan_id,
          model_id,
          priority
        `)
        .in('model_id', relatedModelIds),
    ]);

    // 3. Get unique plan IDs and fetch full plan details in parallel with provider info
    const planIds = [...new Set((modelPlans || []).map((m: any) => m.plan_id).filter(Boolean))];

    const [
      { data: rawSubscriptionPlans },
      { data: allProviders },
    ] = planIds.length > 0 ? await Promise.all([
      // Query 4: Get subscription plans
      supabase
        .from('plans')
        .select(`
          id,
          name,
          slug,
          tier,
          pricing_model,
          price,
          annual_price,
          price_unit,
          currency,
          daily_message_limit,
          requests_per_minute,
          qps,
          tokens_per_minute,
          features,
          region,
          access_from_china,
          payment_methods,
          is_official,
          last_verified,
          provider_id
        `)
        .in('id', planIds)
        .order('price', { ascending: true }),
      // Query 5: Get all provider info at once
      supabase
        .from('providers')
        .select('id, name, slug, logo, logo_url, website, invite_url'),
    ]) : [{ data: [] }, { data: [] }];

    // Build provider map
    const providerMap: Record<number, any> = {};
    (allProviders || []).forEach((p: any) => {
      providerMap[p.id] = p;
    });

    const subscriptionPlans = rawSubscriptionPlans || [];

    // Separate official and third-party subscription plans
    const officialPlans: any[] = [];
    const thirdPartyPlans: any[] = [];

    // Process subscription plans only (not API pricing)
    if (subscriptionPlans) {
      subscriptionPlans.forEach((plan: any) => {
        // Same provider as the product = official, different provider = third-party
        // product.provider_ids is an array, check if plan's provider is in it
        const isOfficial = productProvider
          ? productProvider.id === plan.provider_id
          : product.provider_ids?.includes(plan.provider_id);
        const provider = providerMap[plan.provider_id];
        const yearlyMonthly = getPlanYearlyMonthly(plan);

        const planData = {
          plan: {
            id: plan.id,
            slug: plan.slug,
            name: plan.name,
            nameZh: plan.name,
            planTier: plan.tier,
            isOfficial,
            features: plan.features || [],
          },
          channel: {
            slug: provider?.slug || 'unknown',
            name: provider?.name || 'Unknown',
            nameZh: provider?.name || 'Unknown',
            logo: getProviderLogoSrc(provider),
            logoFallback: getProviderLogoFallback(provider, getProviderLogo(provider?.slug)),
            website: provider?.website || null,
            inviteUrl: provider?.invite_url || null,
            region: plan.region,
            accessFromChina: plan.access_from_china,
            paymentMethods: plan.payment_methods || getPaymentMethods(plan.region),
          },
          pricing: {
            billingModel: plan.pricing_model || 'subscription',
            billingUnit: plan.price_unit || 'per_month',
            monthly: plan.price,
            yearly: plan.annual_price,
            yearlyMonthly,
            yearlyDiscountPercent: plan.annual_price && plan.price
              ? ((1 - (plan.annual_price / 12) / plan.price) * 100)
              : null,
            currency: plan.currency || 'USD',
            displayCurrency: displayCurrency,
            convertedMonthly: plan.price ? getExchangeRateSync(plan.currency || 'USD', displayCurrency) * plan.price : null,
            convertedYearly: plan.annual_price ? getExchangeRateSync(plan.currency || 'USD', displayCurrency) * plan.annual_price : null,
            convertedYearlyMonthly: yearlyMonthly ? convertPrice(yearlyMonthly, plan.currency || 'USD', displayCurrency) : null,
            exchangeRate: getExchangeRateDisplay(plan.currency || 'USD'),
            inputPer1m: null,
            outputPer1m: null,
            cachedInputPer1m: null,
            hasOverage: false,
            overageInputPer1m: null,
            overageOutputPer1m: null,
          },
          limits: {
            rpm: plan.requests_per_minute,
            rpd: null,
            rpm_display: plan.requests_per_minute ? `${plan.requests_per_minute} RPM` : null,
            tpm: plan.tokens_per_minute,
            tpd: null,
            tpm_display: plan.tokens_per_minute ? `${plan.tokens_per_minute.toLocaleString()} TPM` : null,
            monthlyRequests: null,
            monthlyTokens: null,
            maxTokensPerRequest: null,
            maxInputTokens: null,
            maxOutputTokens: null,
          },
          performance: {
            qps: plan.qps,
            concurrentRequests: null,
            qps_display: plan.qps ? `${plan.qps} QPS` : null,
          },
          vsOfficial: {
            priceDiffPercent: null,
            priceDiffLabel: isOfficial ? 'Official Price' : null,
            rpmDiffPercent: null,
            qpsDiffPercent: null,
          },
          lastVerified: plan.last_verified,
          sourceUrl: null,
          note: null,
        };

        if (isOfficial) {
          officialPlans.push(planData);
        } else {
          thirdPartyPlans.push(planData);
        }
      });
    }

    // Build summary for subscription plans only
    const allPlans = [...officialPlans, ...thirdPartyPlans];

    // Find cheapest subscription plan (using converted prices)
    const cheapestPlan = allPlans.length > 0
      ? allPlans.reduce((min, p) => {
          const priceToCompare = p.pricing.convertedYearlyMonthly || p.pricing.convertedMonthly || Infinity;
          const minPriceToCompare = min.pricing.convertedYearlyMonthly || min.pricing.convertedMonthly || Infinity;
          return priceToCompare < minPriceToCompare ? p : min;
        })
      : null;

    // Calculate vsOfficial for third-party plans
    const officialPlan = officialPlans[0];
    if (officialPlan) {
      thirdPartyPlans.forEach((plan: any) => {
        if (plan.vsOfficial) {
          const diff = getExchangeRateSync(plan.pricing.currency, plan.pricing.currency) *
            getExchangeRateSync(officialPlan.pricing.currency, officialPlan.pricing.currency);
          plan.vsOfficial.priceDiffPercent = ((diff - officialPlan.pricing.monthly) / officialPlan.pricing.monthly) * 100;
          plan.vsOfficial.priceDiffLabel = Math.abs(plan.vsOfficial.priceDiffPercent).toFixed(0) + '%';
        }
      });
    }

    const response = NextResponse.json({
      model: {
        slug: product.slug,
        name: product.name,
        provider: {
          slug: productProvider?.slug || 'unknown',
          name: productProvider?.name || 'Unknown',
          logo: getProviderLogoSrc(productProvider),
          logoFallback: getProviderLogoFallback(productProvider, getProviderLogo(productProvider?.slug)),
          website: productProvider?.website || null,
          inviteUrl: productProvider?.invite_url || null,
        },
        contextWindow: product.context_window,
        maxOutput: null,
        benchmarkArena: null,
        releaseDate: null,
      },
      officialPlans,
      thirdPartyPlans,
      summary: {
        totalPlans: allPlans.length,
        displayCurrency,
        cheapestPlan: cheapestPlan ? {
          name: cheapestPlan.plan.name,
          channel: cheapestPlan.channel.name,
          monthlyPrice: cheapestPlan.pricing.monthly,
          currency: cheapestPlan.pricing.currency,
          convertedMonthlyPrice: cheapestPlan.pricing.convertedMonthly,
          displayMonthlyPrice: cheapestPlan.pricing.convertedMonthly,
        } : null,
        bestRpmPlan: null,
        bestQpsPlan: null,
      },
    });

    // Cache for 5 minutes (pricing data doesn't change frequently)
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    return response;

  } catch (error) {
    console.error('Error fetching plan comparison:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getChannelLogo(slug: string): string {
  const logos: Record<string, string> = {
    'openai-api': '🤖',
    'anthropic-api': '🧠',
    'google-gemini-api': '✨',
    'deepseek-api': '🔍',
    'mistral-api': '🌪️',
    'grok-api': '🤠',
    'openrouter': '🔀',
    'together-ai': '🤝',
    'siliconflow': '🇨🇳',
  };
  return logos[slug] || '🔧';
}

function getProviderLogo(slug: string | undefined): string {
  if (!slug) return '🤖';
  const logos: Record<string, string> = {
    'openai': '🤖',
    'anthropic': '🧠',
    'google': '✨',
    'deepseek': '🔍',
    'mistral': '🌪️',
    'xai': '🤠',
    'meta': '🦙',
  };
  return logos[slug] || '🤖';
}

function getPaymentMethods(region: string): string[] {
  if (region === 'china') {
    return ['alipay', 'wechat'];
  }
  return ['credit_card'];
}

function getModelSlugCandidates(slug: string): string[] {
  const candidates = new Set<string>([slug]);

  // Support historical slug variants such as claude-opus-4.6 <-> claude-opus-4-6.
  candidates.add(slug.replace(/(\d)\.(\d)/g, '$1-$2'));
  candidates.add(slug.replace(/(\d)-(\d)(?=-|$)/g, '$1.$2'));

  return Array.from(candidates);
}
