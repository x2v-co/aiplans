import { NextRequest, NextResponse } from 'next/server';
import { sql, INT4_ARRAY, TEXT_ARRAY } from '@/lib/db';
import type { CurrencyCode } from '@/lib/currency';
import {
  convertPrice,
  calculatePriceDifference,
  getExchangeRateDisplay,
} from '@/lib/currency-conversion';
import { getExchangeRateSync } from '@/lib/exchange-rates';
import { getPrimaryProvidersForModels, getPlanYearlyMonthly } from '@/lib/schema-adapters';
import { getProviderLogoFallback, getProviderLogoSrc } from '@/lib/provider-branding';
import { groupPlansByKind, normalizePlanKind, type PlanKind } from '@/lib/plan-kinds';

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
    const products = await sql<any[]>`
      SELECT id, name, slug, provider_ids, context_window
      FROM models
      WHERE slug = ANY(${sql.array(slugCandidates, TEXT_ARRAY)})
    `;

    if (products.length === 0) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    const product = products.find((item) => item.slug === modelSlug) || products[0];
    const relatedModelIds = products.map((item) => item.id);

    // Fetch the model's primary provider from the normalized relation first, then fallback.
    const modelProviders = await getPrimaryProvidersForModels([product as any]);
    const productProvider = modelProviders.get(product.id);

    // 2. Run remaining queries in parallel for better performance
    // Get subscription plans that include this model (via model_plan_mapping).
    const modelPlans = await sql<any[]>`
      SELECT plan_id, model_id, priority
      FROM model_plan_mapping
      WHERE model_id = ANY(${sql.array(relatedModelIds, INT4_ARRAY)})
    `;

    // 3. Get unique plan IDs and fetch full plan details in parallel with provider info
    const planIds = [...new Set(modelPlans.map((m: any) => m.plan_id).filter(Boolean))];

    const [rawSubscriptionPlans, allProviders] = planIds.length > 0
      ? await Promise.all([
          sql<any[]>`
            SELECT id, name, slug, tier, pricing_model, price, annual_price,
              price_unit, currency, daily_message_limit, requests_per_minute,
              qps, tokens_per_minute, features, region, access_from_china,
              payment_methods, is_official, last_verified, provider_id,
              plan_kind, plan_line, tier_rank
            FROM plans
            WHERE id = ANY(${sql.array(planIds, INT4_ARRAY)})
            ORDER BY plan_kind, plan_line NULLS LAST, tier_rank NULLS LAST, price ASC NULLS LAST
          `,
          sql<any[]>`
            SELECT id, name, slug, logo, logo_url, website, invite_url
            FROM providers
          `,
        ])
      : [[], []];

    // Build provider map
    const providerMap: Record<number, any> = {};
    allProviders.forEach((p: any) => {
      providerMap[p.id] = p;
    });

    const subscriptionPlans = rawSubscriptionPlans;

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
            planKind: normalizePlanKind(plan.plan_kind),
            planLine: plan.plan_line ?? null,
            tierRank: plan.tier_rank ?? null,
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

    // The slice of a planData row that the summary math actually reads. The
    // arrays themselves stay `any[]` (they carry a much wider shape assembled
    // above), but every comparison below goes through this contract.
    interface ComparablePlan {
      plan: { name: string; slug: string; planKind: PlanKind };
      channel: { name: string };
      pricing: {
        monthly: number;
        currency: string;
        convertedMonthly?: number;
        convertedYearlyMonthly?: number;
      };
    }

    const planMonthlyUSD = (p: ComparablePlan): number =>
      p.pricing.convertedYearlyMonthly || p.pricing.convertedMonthly || Infinity;

    const cheapestOf = <T extends ComparablePlan>(candidates: readonly T[]): T | null =>
      candidates.length > 0
        ? candidates.reduce((min, p) => (planMonthlyUSD(p) < planMonthlyUSD(min) ? p : min))
        : null;

    // One cheapest per product line, plus a global one kept for compatibility.
    //
    // A single global cheapest is what made this endpoint misleading: a ¥20
    // coding plan and a $20 chat subscription are not competing offers, but the
    // cheaper number won and got labelled "cheapest plan" for the model. Now
    // each kind reports its own winner, so a caller can say "cheapest chat
    // subscription" and "cheapest coding plan" without implying they are
    // substitutes. `cheapestPlan` still answers "the lowest price on this page"
    // for existing callers, which is a defensible question -- it just is not the
    // recommendation it used to be presented as.
    const cheapestByKind = groupPlansByKind<ComparablePlan>(allPlans, (p) => p.plan.planKind)
      .flatMap(({ kind, plans: kindPlans }) => {
        const winner = cheapestOf(kindPlans);
        return winner
          ? [{
              kind,
              name: winner.plan.name,
              planSlug: winner.plan.slug,
              channel: winner.channel.name,
              monthlyPrice: winner.pricing.monthly,
              currency: winner.pricing.currency,
              convertedMonthlyPrice: winner.pricing.convertedMonthly,
            }]
          : [];
      });

    const cheapestPlan = cheapestOf(allPlans);

    // Calculate vsOfficial for third-party plans. Both sides are normalized to
    // USD first — the previous version multiplied getExchangeRateSync(x, x)
    // (always 1) by itself, so every plan reported the same meaningless number.
    //
    // The baseline is the cheapest official plan *of the same kind*. Using
    // officialPlans[0] regardless of kind meant a third-party coding plan was
    // scored against a chat subscription, producing a discount percentage
    // against a product nobody was choosing between.
    const officialByKind = new Map<PlanKind, ComparablePlan>(
      groupPlansByKind<ComparablePlan>(officialPlans, (p) => p.plan.planKind)
        .flatMap(({ kind, plans: kindPlans }) => {
          const priced = kindPlans.filter((p) => typeof p.pricing.monthly === 'number' && p.pricing.monthly);
          const baseline = cheapestOf(priced);
          return baseline ? [[kind, baseline] as [PlanKind, ComparablePlan]] : [];
        }),
    );

    thirdPartyPlans.forEach((plan: any) => {
      if (!plan.vsOfficial || typeof plan.pricing.monthly !== 'number') return;

      const officialPlan = officialByKind.get(plan.plan.planKind);
      if (!officialPlan) return;

      const diffPercent = calculatePriceDifference(
        plan.pricing.monthly,
        plan.pricing.currency as CurrencyCode,
        officialPlan.pricing.monthly,
        officialPlan.pricing.currency as CurrencyCode,
      );

      if (!Number.isFinite(diffPercent)) return;

      plan.vsOfficial.priceDiffPercent = diffPercent;
      plan.vsOfficial.priceDiffLabel = diffPercent >= 0
        ? `+${diffPercent.toFixed(0)}%`
        : `${diffPercent.toFixed(0)}%`;
    });

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
        cheapestByKind,
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
