import { getSeoIndexCatalog } from '@/lib/seo-index-data';
import { modelShouldIndex } from '@/lib/seo-index-policy';
import { publicModelDescription, publicModelName } from '@/lib/public-catalog-copy';
import { DeepSeekWindowPrices } from '@/components/deepseek-window-prices';
import { CodexModelMeasurements } from '@/components/codex-model-measurements';
import { isCodexQuotaModel } from '@/lib/codex-pro200';
import { LimitedTimeOfferMark } from '@/components/limited-time-offer';
import { effectivePrice } from '@/lib/effective-price';
import { billingRedirectNote } from '@/lib/billing-redirect';
import { modelShutdownNotice } from '@/lib/model-shutdown';
import { modelAvailabilityStatus, modelAnnouncementLabel } from '@/lib/model-announcement';
import { getTranslations } from 'next-intl/server';
import Link from "next/link";
import { AFFILIATE_LINK_REL, affiliateDisclosureText, resolveOutboundLink } from '@/lib/affiliate-links';
import { outboundChannelDataset } from '@/lib/funnel-analytics';
import { notFound, permanentRedirect } from "next/navigation";
import { legacySlugRedirect } from "@/lib/legacy-slug-redirects";
import { findModelSlugRedirect } from "@/lib/model-slug-redirects";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CalendarDays, Check, ExternalLink, TrendingDown, Zap, Globe } from "lucide-react";
import { sql, INT4_ARRAY } from "@/lib/db";
import { Fragment, use } from "react";
import { getPrimaryProvidersForModels } from "@/lib/schema-adapters";
import { getProviderLogoFallback, getProviderLogoSrc } from "@/lib/provider-branding";
import { formatPrice, type CurrencyCode } from "@/lib/currency";
import { convertToUSD } from "@/lib/currency-conversion";
import { getExchangeRateSync } from "@/lib/exchange-rates";
import {
  groupPlansByKind,
  planKindDescription,
  planKindIcon,
  planKindLabel,
} from "@/lib/plan-kinds";
import { buildMetadata, breadcrumbList, jsonLd, faqPage, SITE_URL, type Locale } from "@/lib/seo";
import { buildModelCopy } from "@/lib/model-copy";
import PriceHistoryChart, { type PriceHistoryPoint } from "@/components/price-history-chart";
import { decodeSlugParam } from "@/lib/route-params";
import SiteHeader from '@/components/SiteHeader';
import { CouponBadge } from "@/components/coupon-badge";
import { getActiveCouponMap } from "@/lib/coupons";
import { formatModelName } from '@/lib/model-names';
import { guideForModelSlug, PRICING_GUIDES } from '@/lib/pricing-guides';
import ModelBenchmarkPanel from '@/components/model-benchmark-panel';
import CodingAgentModelSection from '@/components/coding-agent-model-section';
import VariantBadges from '@/components/variant-badges';
import { isArenaBenchmark, type ModelBenchmarkScore } from '@/lib/benchmarks';
import { getCodingAgentRowsForModel } from '@/lib/coding-agents';
import { ChannelTermsBadges } from '@/components/channel-terms-badges';
import { DataTrustLabel } from '@/components/data-trust-label';
import { ModelPlanCard, type ModelPlanCardRow } from '@/components/model-plan-card';
import {
  channelListPriceTrust,
  isTrustModelSlug,
  usageEstimateTrust,
  variantPriceTrust,
} from '@/lib/data-trust';

import { buildModelPricingSeo, type PricingChannel } from '@/lib/model-pricing-seo';
import ModelPricingSummary from '@/components/model-pricing-summary';
import { ModelUsagePriceHeadline } from '@/components/model-usage-prices';
import { availableUsagePrices, officialUsageFallback, usagePriceHeadline } from '@/lib/model-usage-prices';
import { getModelUsagePrices } from '@/lib/model-usage-prices-query';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeSlugParam(rawSlug);
  const legacyTarget = legacySlugRedirect(`/${locale === 'zh' ? 'zh' : 'en'}/models/${slug}`);
  if (legacyTarget) permanentRedirect(legacyTarget);

  // Get product name. An unknown slug 404s from *here*, not from the page
  // body, and there is deliberately no loading.tsx anywhere above this route.
  // Any ancestor Suspense boundary flushes a shell and locks in the 200 before
  // the page body runs, so the page's own notFound() can no longer change the
  // status — crawlers get a 200 with an empty skeleton (a soft 404). Verified:
  // with `[locale]/loading.tsx` present every unknown slug returned 200; with
  // it removed and this check here they return 404 + the not-found UI.
  const [product] = await sql<Array<{ id: number; name: string; updated_at: Date | null }>>`
    SELECT id, name, updated_at FROM models WHERE slug = ${slug} LIMIT 1
  `;
  if (!product) {
    const target = await findModelSlugRedirect(slug);
    if (target) permanentRedirect(`/${locale}/models/${encodeURIComponent(target)}`);
    notFound();
  }
  const indexFacts = (await getSeoIndexCatalog()).find(row => row.slug === slug);
  const productName = formatModelName(product.name || slug);

  const statsRows = await sql<PricingChannel[]>`
    SELECT cp.*, jsonb_build_object('name', p.name, 'type', p.type) AS providers
    FROM api_channel_prices cp JOIN providers p ON p.id = cp.provider_id
    WHERE cp.model_id = ${product.id} AND cp.is_available = true
      AND EXISTS (SELECT 1 FROM models m WHERE m.id = cp.model_id
        AND (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date))
  `;
  const pricing = buildModelPricingSeo({ ...product, name: productName, slug }, statsRows,
    locale === 'zh' ? 'zh' : 'en');
  return {
    ...buildMetadata({
      locale: locale === 'zh' ? 'zh' : 'en',
      path: `/models/${slug}`,
      noindex: !indexFacts || !modelShouldIndex(indexFacts),
      title: {
        en: `${pricing.title} | aiplans.dev`,
        zh: `${pricing.title} | aiplans.dev`,
      },
      description: { en: pricing.description, zh: pricing.description },
    }),
    keywords: [productName, ...pricing.aliases],
  };
}

// Labels come from the same catalog as the API pricing page.
const channelTypeColors: Record<string, string> = {
  official: 'bg-blue-100 text-blue-800',
  producer: 'bg-blue-100 text-blue-800',
  cloud: 'bg-purple-100 text-purple-800',
  aggregator: 'bg-green-100 text-green-800',
  reseller: 'bg-orange-100 text-orange-800',
};

/**
 * A channel is stored in whatever currency the vendor publishes (CNY for the
 * Chinese producers, USD for everyone else). Every channel-price read below
 * must go through this instead of assuming USD — a ¥20 row used to render as
 * "$20.00", and the raw-number sort treated ¥20 (≈$2.90) as pricier than $3.
 */
function channelCurrency(cp: { currency?: string | null } | null | undefined): CurrencyCode {
  return (cp?.currency || 'USD') as CurrencyCode;
}

async function getProductWithChannels(slug: string, now = new Date()) {
  // Get model with provider info
  const [model] = await sql<any[]>`
    SELECT id, name, slug, type, description, context_window, max_output_tokens,
           open_source, license, license_url, parameters, "active parameters" AS active_parameters,
           provider_ids, offical_link, released_at, created_at, updated_at, shutdown_date::text,
           replacement_model, deprecation_source_url
    FROM models
    WHERE slug = ${slug}
    LIMIT 1
  `;

  if (!model) return null;

  const modelProviders = await getPrimaryProvidersForModels([model as any]);
  const modelProvider = modelProviders.get(model.id) || null;

  // Get API channel prices
  const rawChannelPrices = await sql<any[]>`
    SELECT
      cp.*,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', v.id,
          'variant_key', v.variant_key,
          'variant_name', v.variant_name,
          'variant_kind', v.variant_kind,
          'input_price_per_1m', v.input_price_per_1m,
          'output_price_per_1m', v.output_price_per_1m,
          'cached_input_price_per_1m', v.cached_input_price_per_1m,
          'currency', v.currency,
          'price_unit', v.price_unit,
          'is_headline', v.is_headline,
          'headline_reason', v.headline_reason,
          'constraints_json', v.constraints_json,
          'source_url', v.source_url,
          'last_verified', v.last_verified,
          'notes', v.notes
        ) ORDER BY v.is_headline DESC, v.headline_rank ASC NULLS LAST, v.input_price_per_1m ASC NULLS LAST)
        FROM api_channel_price_variants v
        WHERE v.model_id = cp.model_id
          AND v.provider_id = cp.provider_id
          AND v.is_available = true
          AND v.is_public = true
      ), '[]'::jsonb) AS price_variants,
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'slug', p.slug,
        'type', p.type,
        'logo', p.logo,
        'logo_url', p.logo_url,
        'website', p.website,
        'pricing_url', p.pricing_url,
        'api_docs_url', p.api_docs_url,
        'region', p.region,
        'access_from_china', p.access_from_china,
        'description', p.description
      ) AS providers
    FROM api_channel_prices cp
    JOIN providers p ON p.id = cp.provider_id
    WHERE cp.model_id = ${model.id} AND cp.is_available = true
      AND EXISTS (SELECT 1 FROM models m WHERE m.id = cp.model_id
        AND (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date))
    ORDER BY cp.input_price_per_1m ASC NULLS LAST
  `;

  const normalizedChannelPrices = rawChannelPrices.map(cp => effectivePrice(cp, now));
  const usagePrices = availableUsagePrices(await getModelUsagePrices(slug));

  // Reference rows never enter channelPrices, cheapest calculations, history,
  // SEO offers or the comparison table. Fetch only for explicitly announced models.
  const referencePrices = modelAvailabilityStatus(model.description) === 'announced'
    ? await sql<Array<{ id: number; input_price_per_1m: number | null; output_price_per_1m: number | null;
        cached_input_price_per_1m: number | null; currency: string | null; notes: string | null }>>`
        SELECT cp.id, cp.input_price_per_1m, cp.output_price_per_1m,
               cp.cached_input_price_per_1m, cp.currency, cp.notes
        FROM api_channel_prices cp JOIN providers p ON p.id = cp.provider_id
        WHERE cp.model_id = ${model.id} AND cp.is_available = false
          AND p.type IN ('official', 'producer') AND cp.price_unit = 'per_1m_tokens'
        ORDER BY cp.id
      ` : [];

  // Related models from the same producer (provider_ids[1] is the primary
  // producer in our data). Internal links distribute crawl equity and give
  // readers a next click instead of a dead end. We deliberately match on the
  // producer only — matching any shared aggregator would link unrelated models
  // that happen to both be on OpenRouter.
  const primaryProducerId = (model.provider_ids as number[] | null | undefined)?.[0] ?? null;
  let relatedModels: Array<{ slug: string; name: string }> = [];
  if (primaryProducerId) {
    relatedModels = await sql<Array<{ slug: string; name: string }>>`
      SELECT m.slug, m.name
      FROM models m
      WHERE (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date) AND m.id <> ${model.id}
        AND m.type ILIKE '%llm%'
        AND m.provider_ids[1] = ${primaryProducerId}
        AND EXISTS (
          SELECT 1 FROM api_channel_prices cp
          WHERE cp.model_id = m.id AND cp.is_available = true
        )
      ORDER BY m.updated_at DESC NULLS LAST
      LIMIT 8
    `;
  }

  // Fetch every current benchmark with its full scoring context. The page must
  // not compare values without retaining benchmark, version, task and metric.
  const benchmarkScores = await sql<ModelBenchmarkScore[]>`
    SELECT b.slug AS benchmark_slug, b.name AS benchmark_name,
           b.type AS benchmark_type, b.offical_url AS official_url,
           bv.version_label, bt.name AS task_name, bm.name AS metric_name,
           bm.unit, bm.higher_better, s.value, s.release_date
    FROM model_benchmark_scores s
    JOIN benchmark_tasks bt ON bt.id = s.benchmark_task_id
    JOIN benchmark_versions bv ON bv.id = bt.benchmark_version_id AND bv.is_current = true
    JOIN benchmarks b ON b.id = bv.benchmark_id
    JOIN benchmark_metrics bm ON bm.id = s.metric_id
    WHERE s.model_id = ${model.id} AND s.value IS NOT NULL
    ORDER BY b.name, bt.name, bm.name
  `;
  const arenaElo = benchmarkScores.find(isArenaBenchmark)?.value ?? null;

  const derivedProvider =
    normalizedChannelPrices.find((channel: any) => channel.providers?.type === 'producer')?.providers ||
    normalizedChannelPrices.find((channel: any) => channel.providers?.type === 'official')?.providers ||
    null;

  // Get plans that include this model via model_plan_mapping
  const modelPlanMappings = await sql<Array<{ plan_id: number | null }>>`
    SELECT plan_id FROM model_plan_mapping WHERE model_id = ${model.id}
  `;

  // Get plan IDs and fetch full plan details
  const planIds = [...new Set([...modelPlanMappings.map((m) => m.plan_id),
    ...usagePrices.map(row => row.plan_id)].filter((id): id is number => id != null))];

  const plansData: any[] = planIds.length > 0 ? [...await sql<any[]>`
    SELECT
      pl.id,
      pl.name,
      pl.slug,
      pl.tier,
      pl.price,
      pl.annual_price,
      pl.currency,
      pl.price_unit,
      pl.features,
      (to_jsonb(pl)->>'data_for_discount')::boolean AS data_for_discount,
      to_jsonb(pl)->>'data_for_discount_note' AS data_for_discount_note,
      to_jsonb(pl)->>'quota_unit' AS quota_unit,
      pl.third_party_coverage,
      pl.third_party_coverage_note,
      pl.access_from_china,
      pl.provider_id,
      pl.plan_kind,
      pl.plan_line,
      pl.tier_rank,
      pl.last_verified,
      pl.notes,
      pl.legacy_ends_on,
      pl.is_contact_sales,
      pl.monthly_api_credit_status,
      CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'slug', p.slug,
        'logo', p.logo,
        'pricing_url', p.pricing_url,
        'website', p.website
      ) END AS providers
    FROM plans pl
    LEFT JOIN providers p ON p.id = pl.provider_id
    WHERE pl.id = ANY(${sql.array(planIds, INT4_ARRAY)})
    ORDER BY pl.price ASC NULLS LAST
  `] : [];

  // Return the model with provider attached
  const product = {
    ...model,
    name: publicModelName(model.name),
    providers: modelProvider || derivedProvider
  };

  // Fetch price history for all channels of this model (latest 500 events,
  // typically ~90 days worth). Join to api_channel_prices → providers.
  const channelIds = normalizedChannelPrices.map((cp: any) => cp.id);
  const priceHistory: PriceHistoryPoint[] = [];
  if (channelIds.length > 0) {
    // Per-channel window, not one global LIMIT: a fast-changing aggregator
    // (hundreds of events) otherwise fills the cap and starves every other
    // provider, so official/CN lines never appear. 150 events/channel covers
    // months of changes and stays within chart payload limits.
    const historyRows = await sql<any[]>`
      SELECT channel_price_id, new_input_price, new_output_price, currency, recorded_at
      FROM (
        SELECT
          channel_price_id, new_input_price, new_output_price, currency, recorded_at,
          row_number() OVER (PARTITION BY channel_price_id ORDER BY recorded_at DESC) AS rn
        FROM price_history
        WHERE channel_price_id = ANY(${sql.array(channelIds, INT4_ARRAY)})
      ) ranked
      WHERE rn <= 150
      ORDER BY recorded_at ASC
    `;

    const providerByChannelId = new Map<number, { slug: string; name: string }>();
    for (const cp of normalizedChannelPrices) {
      if (cp.providers?.slug) {
        providerByChannelId.set(cp.id, {
          slug: cp.providers.slug,
          name: cp.providers.name,
        });
      }
    }

    for (const h of historyRows) {
      const prov = providerByChannelId.get(h.channel_price_id);
      if (!prov) continue;
      priceHistory.push({
        channelPriceId: h.channel_price_id,
        providerSlug: prov.slug,
        providerName: prov.name,
        recordedAt: h.recorded_at,
        newInputPrice: h.new_input_price,
        newOutputPrice: h.new_output_price,
        currency: h.currency,
      });
    }
  }

  return {
    product,
    channelPrices: normalizedChannelPrices,
    referencePrices,
    usagePrices,
    plans: plansData,
    arenaElo,
    benchmarkScores,
    priceHistory,
    relatedModels: relatedModels.map(model => ({ ...model, name: publicModelName(model.name) })),
  };
}

export default async function ModelPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeSlugParam(rawSlug);
  const legacyTarget = legacySlugRedirect(`/${locale === 'zh' ? 'zh' : 'en'}/models/${slug}`);
  if (legacyTarget) permanentRedirect(legacyTarget);
  const now = new Date();
  const [data, couponByProvider] = await Promise.all([
    getProductWithChannels(slug, now),
    getActiveCouponMap('api'),
  ]);

  if (!data) {
    const target = await findModelSlugRedirect(slug);
    if (target) permanentRedirect(`/${locale}/models/${encodeURIComponent(target)}`);
    notFound();
  }

  const { product, channelPrices, usagePrices, referencePrices, plans, arenaElo, benchmarkScores, priceHistory, relatedModels } = data;
  const officialUsagePrices = officialUsageFallback(channelPrices, usagePrices);
  const officialUsageHeadline = usagePriceHeadline(officialUsagePrices);
  // Agent-harness results (Claude Code, Codex, ...) on this host model. Renders
  // nothing for the vast majority of models that AA has not evaluated.
  const codingAgentRows = await getCodingAgentRowsForModel(product.id);
  const isZh = locale === 'zh';
  const t = await getTranslations({ locale, namespace: 'modelDetail' });
  const apiT = await getTranslations({ locale, namespace: 'apiPricing' });
  const showTrust = isTrustModelSlug(slug);
  const productName = formatModelName(product.name);
  const description = publicModelDescription(product.description);
  const shutdownMessages = await getTranslations({ locale, namespace: 'modelShutdown' });
  const shutdown = modelShutdownNotice(product.shutdown_date, locale, now);
  const announcementMessages = await getTranslations({ locale, namespace: 'modelAnnouncement' });
  const announcementLabel = modelAnnouncementLabel(product.description, { announced: announcementMessages('announced') });
  const billingNote = billingRedirectNote(product.slug, locale);
  const guideSlug = guideForModelSlug(product.slug);
  const pricing = buildModelPricingSeo({ ...product, name: productName }, channelPrices,
    isZh ? 'zh' : 'en', now);

  // Plans can come from several providers (a bundled plan may include
  // third-party models), so normalize to USD before ordering — otherwise a
  // ¥40 plan sorts above a $20 one.
  const planPriceUSD = (plan: ModelPlanCardRow): number =>
    (plan.price || 0) * getExchangeRateSync(plan.currency || 'USD', 'USD');

  const planRows = plans as ModelPlanCardRow[];

  const sortedPlans = [...planRows].sort((a, b) => {
    if (a.tier === 'free' && b.tier !== 'free') return -1;
    if (b.tier === 'free' && a.tier !== 'free') return 1;
    return planPriceUSD(a) - planPriceUSD(b);
  });

  // A model now commonly maps to several product lines at once (chat, coding,
  // agent), so the plan list is grouped instead of being one flat price ladder.
  const planKindGroups = groupPlansByKind(sortedPlans, (plan) => plan.plan_kind);

  // "Recommended" has to be per product line. `tier === 'pro'` matches the Pro
  // tier of every line, so a model sold as both a chat and a coding plan used to
  // light up two blue-bordered cards in the same grid.
  const recommendedPlanIds = new Set<number>(
    planKindGroups
      .map(({ plans: kindPlans }) =>
        kindPlans.find((plan) => plan.tier === 'pro' && !plan.name.includes('Max'))?.id,
      )
      .filter((id): id is number => id != null),
  );

  // "Best Value" is a single winner, not a predicate. The old check flagged
  // every plan with a >15% annual discount, so GLM Coding Lite and Max both
  // wore the badge on the same page.
  const annualDiscount = (plan: any): number =>
    plan.annual_price && plan.price ? 1 - plan.annual_price / (plan.price * 12) : 0;

  const bestValuePlanId: number | null = sortedPlans
    .filter((plan) => annualDiscount(plan) > 0.15)
    .sort((a, b) => annualDiscount(b) - annualDiscount(a))[0]?.id ?? null;

  // Find official and cheapest. The SQL ORDER BY is on the raw
  // input_price_per_1m number, which is wrong across currencies (a ¥6 row
  // sorts above a $1 row even though ¥6 ≈ $0.87), so re-sort by
  // USD-normalised price before picking the cheapest and before rendering.
  const officialChannel = (channelPrices as any[]).find((cp) => cp.providers?.type === 'official' || cp.providers?.type === 'producer');
  const sortedChannelPrices = [...(channelPrices as any[])].sort((a, b) => {
    const aUsd = a.input_price_per_1m == null ? Infinity : convertToUSD(Number(a.input_price_per_1m), channelCurrency(a));
    const bUsd = b.input_price_per_1m == null ? Infinity : convertToUSD(Number(b.input_price_per_1m), channelCurrency(b));
    return aUsd - bUsd;
  });
  const cheapestChannel = pricing.cheapest && sortedChannelPrices.find(cp => cp.id === pricing.cheapest!.id);
  const cheapestUsageHeadline = cheapestChannel ? undefined : usagePriceHeadline([
    ...officialUsagePrices, ...usagePrices.filter(row => row.plan_id != null),
  ]);

  const officialHistoryProviderSlugs: string[] = [...new Set(
    sortedChannelPrices
      .filter((cp) => cp.providers?.type === 'producer' || cp.providers?.type === 'official')
      .map((cp) => cp.providers?.slug as string | undefined)
      .filter((s): s is string => Boolean(s)),
  )];

  // Data-driven, localized summary + FAQ for SEO/GEO. Derived entirely from
  // the facts already queried (no invented capabilities), so every model page
  // gets unique crawlable prose and a FAQPage without hand-written blurbs.
  const modelCopy = buildModelCopy(
    {
      name: productName,
      producerName: product.providers?.name,
      modelType: product.type,
      contextWindow: product.context_window,
      maxOutputTokens: product.max_output_tokens,
      channels: channelPrices as any[],
      officialChannel,
      cheapestChannel,
      plans: plans as any[],
      arenaElo,
    },
    (locale === 'zh' ? 'zh' : 'en') as Locale,
  );

  // aiplans compares vendor prices and sells nothing itself, so this is a
  // `Service` (the model API) whose AggregateOffer points at the vendors as
  // sellers — not a `Product`. A Product+Offer opts the page into Google's
  // merchant-listing / product-snippet checks (shippingDetails,
  // hasMerchantReturnPolicy, aggregateRating, review), none of which can be
  // filled honestly. No ratings or reviews are emitted; benchmark scores stay
  // in the visible page, not in markup.
  const productJsonLd = !pricing.aggregateOffer ? null : jsonLd({
    '@type': 'Service',
    serviceType: 'AI Model API',
    name: productName,
    alternateName: pricing.aliases,
    description: description || `${productName} — ${product.context_window?.toLocaleString() ?? 'N/A'} token context window. API pricing compared across ${channelPrices.length} channels.`,
    image: `${SITE_URL}/${locale}/models/${product.slug}/opengraph-image`,
    url: `${SITE_URL}/${locale}/models/${product.slug}`,
    ...(product.providers?.name
      ? { brand: { '@type': 'Brand', name: product.providers.name },
          provider: { '@type': 'Organization', name: product.providers.name } }
      : {}),
    category: 'AI Model API',
    offers: pricing.aggregateOffer,
  });

  const breadcrumbJsonLd = breadcrumbList([
    { name: isZh ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: isZh ? 'API 价格' : 'API Pricing', url: `${SITE_URL}/${locale}/api-pricing` },
    { name: productName, url: `${SITE_URL}/${locale}/models/${product.slug}` },
  ]);

  // Savings vs the official channel, compared in USD — a ¥20 official row and
  // a $3 aggregator row cannot be subtracted directly. Returns null when there
  // is no official baseline, the channel IS the official baseline, or it is
  // not cheaper.
  const calculateSavings = (cp: any) => {
    if (!officialChannel || cp.id === officialChannel.id) return null;
    const price = cp.input_price_per_1m;
    const officialPrice = officialChannel.input_price_per_1m;
    // 0 is a real price (limited-time free), not a missing one.
    if (!officialPrice || price == null) return null;
    const priceUSD = convertToUSD(Number(price), channelCurrency(cp));
    const officialUSD = convertToUSD(Number(officialPrice), channelCurrency(officialChannel));
    if (!officialUSD) return null;
    const savings = ((officialUSD - priceUSD) / officialUSD) * 100;
    return savings > 0.1 ? savings.toFixed(1) : null;
  };
  const cheapestSavings = cheapestChannel ? calculateSavings(cheapestChannel) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      {productJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {!announcementLabel && pricing.faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: faqPage(pricing.faqs) }}
        />
      )}
      <SiteHeader locale={locale} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link href={`/${locale}/api-pricing`} className="flex items-center gap-1 hover:text-blue-600">
            <ArrowLeft className="w-4 h-4" /> {t('backToApiPricing')}
          </Link>
        </div>

        {/* Product Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            {getProviderLogoSrc(product.providers) ? (
              <img
                src={getProviderLogoSrc(product.providers)!}
                alt={product.providers?.name || productName}
                className="w-16 h-16 object-contain"
              />
            ) : (
              <span className="text-5xl">{getProviderLogoFallback(product.providers)}</span>
            )}
            <div>
              <h1 className="text-3xl font-bold flex flex-wrap items-center gap-2">
                {pricing.title}
                <VariantBadges slug={product.slug} locale={locale} />
              </h1>
              {description && <p className="mt-3 whitespace-pre-line text-zinc-600 dark:text-zinc-400">{description}</p>}
              <p className="text-zinc-600">{product.providers?.name} • {isZh ? 'API 定价对比' : 'API Price Comparison'}</p>
            </div>
          </div>
          <p className="mb-3 text-sm text-zinc-500">{isZh ? '也称' : 'Also known as'}: {pricing.aliases.join(' · ')}</p>
          {!announcementLabel && <ModelPricingSummary pricing={pricing} locale={locale} now={now} officialUsagePrices={officialUsagePrices} />}
          <div className="flex flex-wrap gap-3">
            {product.context_window && (
              <Badge variant="outline" className="text-sm">
                📏 Context: {product.context_window.toLocaleString()} tokens
              </Badge>
            )}
            {arenaElo != null && (
              <Badge variant="outline" className="text-sm">
                🏟️ Agent Arena: {arenaElo.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
              </Badge>
            )}
            {product.open_source === true && (
              <Badge variant="outline" className="text-sm">{isZh ? '开放权重' : 'Open weights'}</Badge>
            )}
            {product.parameters && (
              <Badge variant="outline" className="text-sm">
                {isZh ? '总参数' : 'Total parameters'}: {product.parameters}
                {product.active_parameters && <> · {isZh ? '激活参数' : 'Active'}: {product.active_parameters}</>}
              </Badge>
            )}
            {product.license && (
              <Badge variant="outline" className="text-sm">
                {product.license_url ? (
                  <a href={product.license_url} target="_blank" rel="noopener noreferrer" className="underline">
                    {product.license}
                  </a>
                ) : product.license}
              </Badge>
            )}
            {(product.released_at || product.created_at) && (
              <Badge variant="outline" className="gap-1.5 text-sm">
                <CalendarDays className="h-3.5 w-3.5" />
                {product.released_at
                  ? locale === 'zh' ? '发布于' : 'Released'
                  : locale === 'zh' ? '收录于' : 'Added'}{' '}
                {new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
                  dateStyle: 'medium',
                  timeZone: 'Asia/Singapore',
                }).format(new Date(product.released_at ?? product.created_at))}
              </Badge>
            )}
          </div>

          {/* Data-driven model summary — unique, factual prose for crawlers and
              answer engines (GEO). Omitted facts are simply absent, never invented. */}
          {!announcementLabel && <p className="mt-4 text-zinc-700 dark:text-zinc-300 leading-relaxed max-w-4xl">
            {modelCopy.summary}
          </p>}
        </div>

        {announcementLabel && (
          <section role="note" className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <Badge variant="outline">{announcementLabel}</Badge>
            <p className="mt-2">{announcementMessages('referenceNote')}</p>
            {referencePrices.map(reference => (
              <div key={reference.id} className="mt-4 space-y-1">
                <h2 className="font-semibold">{announcementMessages('referencePrice')}</h2>
                <p>{announcementMessages('input', { price: formatPrice(reference.input_price_per_1m, channelCurrency(reference), locale) })}</p>
                <p>{announcementMessages('output', { price: formatPrice(reference.output_price_per_1m, channelCurrency(reference), locale) })}</p>
                <p>{announcementMessages('cachedInput', { price: formatPrice(reference.cached_input_price_per_1m, channelCurrency(reference), locale) })}</p>
                {reference.notes && <p className="text-sm">{reference.notes}</p>}
              </div>
            ))}
            {product.offical_link && (
              <a href={product.offical_link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm underline">
                {announcementMessages('source')} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </section>
        )}
        {shutdown && (
          <div role="note" className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <p>
              <Badge variant="outline">{shutdownMessages(shutdown.status, { date: shutdown.date })}</Badge>
              {product.replacement_model && <>; {shutdownMessages('replacement', { model: product.replacement_model })}</>}
            </p>
            {product.deprecation_source_url && (
              <a href={product.deprecation_source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm underline">
                {shutdownMessages('source')} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}
        {billingNote && (
          <div role="note" className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            {billingNote}
          </div>
        )}

        {isCodexQuotaModel(product.slug) && <CodexModelMeasurements locale={locale} modelSlug={product.slug} />}
        <ModelBenchmarkPanel scores={benchmarkScores} locale={locale} />

        <CodingAgentModelSection rows={codingAgentRows} locale={locale} />

        {showTrust && (
          <p className="mb-6 max-w-4xl text-sm text-zinc-600 dark:text-zinc-300">
            {isZh
              ? '本页在前 10 高流量核验范围内。每条关键价格和权益都标出来源、适用条件、最近核验时间，以及是否过期或估算。估算不是确定权益。'
              : 'This page is in the top-10 traffic review set. Each key price and entitlement shows its source, conditions, last verification, and whether it is expired or an estimate. Estimates are not confirmed entitlements.'}
          </p>
        )}

        {/* Quick Stats */}
        {!announcementLabel && <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Cheapest Option */}
          <Card className={cheapestChannel?.id === officialChannel?.id ? "border-blue-500" : "border-green-500"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-600" /> 💰 {t('cheapestOption')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cheapestChannel?.providers?.name || cheapestUsageHeadline?.plan_name || cheapestUsageHeadline?.provider_name || 'N/A'}</div>
              {cheapestUsageHeadline ? <ModelUsagePriceHeadline row={cheapestUsageHeadline} locale={locale} /> : <>
                <div className="text-3xl font-bold text-green-600 mt-1">
                  {formatPrice(cheapestChannel?.input_price_per_1m, channelCurrency(cheapestChannel), locale)}
                  <span className="text-sm font-normal text-zinc-500">/1M input</span>
                </div>
                <div className="text-xl text-zinc-600 mt-1">
                  {formatPrice(cheapestChannel?.output_price_per_1m, channelCurrency(cheapestChannel), locale)}
                  <span className="text-sm font-normal text-zinc-500">/1M output</span>
                </div>
              </>}
              {cheapestSavings && (
                <div className="text-sm text-green-600 mt-2 font-medium">
                  💸 Save {cheapestSavings}% vs official
                </div>
              )}
              {cheapestChannel?.providers?.access_from_china && (
                <Badge className="mt-2 bg-green-100 text-green-800">🇨🇳 China Available</Badge>
              )}
              {showTrust && cheapestChannel && (
                <DataTrustLabel fact={channelListPriceTrust(cheapestChannel, locale, now)} locale={locale} />
              )}
              {cheapestChannel?.providers?.website && (
                <a
                  href={cheapestChannel.providers.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {isZh ? '访问官网' : 'Visit website'}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </CardContent>
          </Card>

          {/* Official Price */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" /> 🏢 {t('officialPrice')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{officialChannel?.providers?.name || officialUsageHeadline?.provider_name || 'N/A'}</div>
              {officialUsageHeadline && <ModelUsagePriceHeadline row={officialUsageHeadline} locale={locale} />}
              {officialChannel && officialUsagePrices.length === 0 ? (
                <>
                  <div className="text-3xl font-bold mt-1">
                    {formatPrice(officialChannel.input_price_per_1m, channelCurrency(officialChannel), locale)}
                    <span className="text-sm font-normal text-zinc-500">/1M input</span>
                  </div>
                  <div className="text-xl text-zinc-600 mt-1">
                    {formatPrice(officialChannel.output_price_per_1m, channelCurrency(officialChannel), locale)}
                    <span className="text-sm font-normal text-zinc-500">/1M output</span>
                  </div>
                  {officialChannel.providers?.access_from_china ? (
                    <Badge variant="outline" className="mt-2">🇨🇳 China Available</Badge>
                  ) : (
                    <Badge variant="outline" className="mt-2 bg-red-50 text-red-800">🚫 Not available in China</Badge>
                  )}
                  {showTrust && (
                    <DataTrustLabel fact={channelListPriceTrust(officialChannel, locale, now)} locale={locale} />
                  )}
                  {officialChannel.providers?.website && (
                    <a
                      href={officialChannel.providers.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {isZh ? '访问官网' : 'Visit website'}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </>
              ) : officialUsagePrices.length === 0 ? (
                <div className="text-zinc-500 mt-2">No official channel available</div>
              ) : null}
            </CardContent>
          </Card>

          {/* China-Friendly Option */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                🇨🇳 {t('bestInChina')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const chinaOptions = (channelPrices as any[])
                  .filter((cp) => cp.providers?.access_from_china)
                  .sort((a, b) => {
                    const aUsd = a.input_price_per_1m == null ? Infinity : convertToUSD(Number(a.input_price_per_1m), channelCurrency(a));
                    const bUsd = b.input_price_per_1m == null ? Infinity : convertToUSD(Number(b.input_price_per_1m), channelCurrency(b));
                    return aUsd - bUsd;
                  });
                const cheapestChina = chinaOptions[0];
                return cheapestChina ? (
                  <>
                    <div className="text-2xl font-bold">{cheapestChina.providers?.name}</div>
                    <div className="text-3xl font-bold mt-1">
                      {formatPrice(cheapestChina.input_price_per_1m, channelCurrency(cheapestChina), locale)}
                      <span className="text-sm font-normal text-zinc-500">/1M input</span>
                    </div>
                    <div className="text-xl text-zinc-600 mt-1">
                      {formatPrice(cheapestChina.output_price_per_1m, channelCurrency(cheapestChina), locale)}
                      <span className="text-sm font-normal text-zinc-500">/1M output</span>
                    </div>
                    <Badge className="mt-2 bg-green-100 text-green-800">
                      支付宝/微信可用
                    </Badge>
                    {showTrust && (
                      <DataTrustLabel fact={channelListPriceTrust(cheapestChina, locale, now)} locale={locale} />
                    )}
                    {cheapestChina.providers?.website && (
                      <a
                        href={cheapestChina.providers.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {isZh ? '访问官网' : 'Visit website'}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </>
                ) : (
                  <div className="text-zinc-500">{t('noChinaOptions')}</div>
                );
              })()}
            </CardContent>
          </Card>
        </div>}

        <Separator className="my-8" />

        {/* Subscription Plans Section */}
        {plans.length > 0 && (
          <>
            <section className="mb-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">
                  {isZh ? '💳 订阅套餐' : '💳 Subscription Plans'}
                </h2>
                <p className="text-zinc-600">
                  {isZh
                    ? `通过以下套餐使用 ${product.name}，按产品线分组。`
                    : `Access ${product.name} through these plans, grouped by product line.`}
                </p>
              </div>

              {planKindGroups.map(({ kind, plans: kindPlans }) => (
                <div key={kind} className="mb-8 last:mb-0">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-lg font-semibold">
                      {planKindIcon(kind)} {planKindLabel(kind, locale)}
                    </h3>
                    <Badge variant="secondary" className="font-normal">
                      {isZh ? `${kindPlans.length} 个套餐` : `${kindPlans.length} plan${kindPlans.length === 1 ? '' : 's'}`}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-500 mb-4">{planKindDescription(kind, locale)}</p>

                  <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {kindPlans.map(plan => (
                      <ModelPlanCard
                        key={plan.id}
                        plan={plan}
                        locale={locale}
                        now={now}
                        usagePrices={usagePrices.filter(row => row.plan_id === plan.id)}
                        recommended={recommendedPlanIds.has(plan.id)}
                        bestValue={plan.id === bestValuePlanId}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <Link href={`/${locale}/compare/plans/${slug}`} className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
                {isZh ? `${productName} 订阅套餐价格对比` : `${productName} subscription plans & pricing`}
              </Link>

              {/* Quick Comparison. With more than one product line present, "which
                  line" is the reader's first question and the Free/Pro/Max ladder is
                  the wrong axis -- those tiers repeat inside every line. */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">💡</div>
                  <div>
                    <h3 className="font-semibold mb-1">
                      {isZh ? '哪个套餐适合你？' : 'Which plan is right for you?'}
                    </h3>
                    <div className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
                      {planKindGroups.length > 1 ? (
                        planKindGroups.map(({ kind }) => (
                          <p key={kind}>
                            <strong>{planKindIcon(kind)} {planKindLabel(kind, locale)}:</strong>{' '}
                            {planKindDescription(kind, locale)}
                          </p>
                        ))
                      ) : (
                        <>
                          {planRows.find((p) => p.tier === 'free') && (
                            <p><strong>Free:</strong> Best for trying out {product.name} with basic usage</p>
                          )}
                          {planRows.find((p) => p.tier === 'pro' && !p.name.includes('Max')) && (
                            <p><strong>Pro:</strong> Ideal for individual professionals with regular usage needs</p>
                          )}
                          {planRows.find((p) => p.name.includes('Max')) && (
                            <p><strong>Max:</strong> For power users who need extended thinking and highest usage limits</p>
                          )}
                          {planRows.find((p) => p.tier === 'team') && (
                            <p><strong>Team:</strong> Perfect for teams needing collaboration and centralized billing</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <Separator className="my-8" />
          </>
        )}

        {/* Detailed Comparison Table */}
        <Card>
          <CardHeader>
            <CardTitle>📊 {t('channelPriceComparison')}</CardTitle>
            <CardDescription>
              Compare {product.name} API prices across all available channels • {channelPrices.length} channels available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Input / 1M</TableHead>
                    <TableHead className="text-right">Output / 1M</TableHead>
                    <TableHead className="text-center">Rate Limit</TableHead>
                    <TableHead className="text-center">China</TableHead>
                    <TableHead className="text-right">vs Official</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedChannelPrices.map((cp: any) => {
                    const isOfficial = cp.providers.type === 'official' || cp.providers.type === 'producer';
                    const isCheapest = cp.id === cheapestChannel?.id;
                    const savings = calculateSavings(cp);

                    return (
                      <Fragment key={cp.id}>
                      <TableRow className={isCheapest ? "bg-green-50 dark:bg-green-950/30" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {cp.providers.name}
                            {Array.isArray(cp.price_variants) && cp.price_variants.length > 1 && (
                              <Badge variant="secondary" className="text-xs">
                                {cp.price_variants.length} {isZh ? '档报价' : 'variants'}
                              </Badge>
                            )}
                            {isCheapest && (
                              <Badge className="bg-green-600 text-xs">💰 Best Price</Badge>
                            )}
                            {isOfficial && (
                              <Badge variant="outline" className="text-xs">🏢 Official</Badge>
                            )}
                          </div>
                          <ChannelTermsBadges terms={cp} />
                          <DeepSeekWindowPrices variants={cp.price_variants} />
                          <LimitedTimeOfferMark row={cp} locale={locale} now={now} />
                          {showTrust && (
                            <DataTrustLabel fact={channelListPriceTrust(cp, locale, now)} locale={locale} />
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${channelTypeColors[cp.providers.type] || 'bg-gray-100'}`}>
                            {channelTypeColors[cp.providers.type] ? apiT(`channelTypes.${cp.providers.type === 'producer' ? 'official' : cp.providers.type}`) : cp.providers.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatPrice(cp.input_price_per_1m, channelCurrency(cp), locale)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatPrice(cp.output_price_per_1m, channelCurrency(cp), locale)}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {cp.rate_limit || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {cp.providers.access_from_china ? (
                            <Check className="w-4 h-4 text-green-600 mx-auto" />
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {savings ? (
                            <span className={Number(savings) > 0 ? "text-green-600 font-medium" : "text-zinc-400"}>
                              {Number(savings) > 0 ? `-${savings}%` : '-'}
                            </span>
                          ) : isOfficial ? (
                            <span className="text-blue-600 font-medium">Baseline</span>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-end gap-1.5">
                            {cp.providers.website && (() => {
                              const outbound = resolveOutboundLink(cp.providers.website);
                              if (!outbound) return null;
                              return (
                                <>
                                  <a
                                    href={outbound.href}
                                    target="_blank"
                                    rel={outbound.affiliate ? AFFILIATE_LINK_REL : 'noopener noreferrer'}
                                    {...outboundChannelDataset({
                                      channelSlug: cp.providers.slug,
                                      channelType: cp.providers.type,
                                      modelSlug: slug,
                                    })}
                                  >
                                    <Button variant="outline" size="sm" className="gap-1">
                                      Visit <ExternalLink className="w-3 h-3" />
                                    </Button>
                                  </a>
                                  {outbound.affiliate && (
                                    <span className="text-[10px] text-zinc-500">{affiliateDisclosureText(locale)}</span>
                                  )}
                                </>
                              );
                            })()}
                            <CouponBadge
                              coupons={couponByProvider[cp.providers.slug] ?? []}
                              locale={locale}
                              size="xs"
                              align="end"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                      {cp.notes?.startsWith('[needs-verification]') && (
                        <TableRow><TableCell colSpan={8} className="text-xs text-amber-700 dark:text-amber-400">{cp.notes}</TableCell></TableRow>
                      )}
                      {Array.isArray(cp.price_variants) && cp.price_variants.length > 1 && (
                          <TableRow key={`${cp.id}-variants`} className="bg-zinc-50/70 dark:bg-zinc-900/50">
                            <TableCell colSpan={8}>
                              <details className="text-sm">
                                <summary className="cursor-pointer text-zinc-600 hover:text-blue-600">
                                  {isZh ? '查看该渠道的全部报价变体' : 'Show all price variants for this channel'}
                                </summary>
                                <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                  {cp.price_variants.map((variant: any) => (
                                    <div key={variant.id} className="rounded-md border bg-white p-3 dark:bg-zinc-950">
                                      <div className="mb-1 flex items-center gap-2">
                                        <span className="font-medium">{variant.variant_name}</span>
                                        {variant.is_headline && <Badge className="text-xs">{isZh ? '默认' : 'Default'}</Badge>}
                                      </div>
                                      <div className="font-mono text-xs text-zinc-600">
                                        {formatPrice(variant.input_price_per_1m, channelCurrency(variant), locale)} / {formatPrice(variant.output_price_per_1m, channelCurrency(variant), locale)} per 1M
                                      </div>
                                      {variant.variant_kind && (
                                        <div className="mt-1 text-xs text-zinc-500">{variant.variant_kind}</div>
                                      )}
                                      {showTrust && (
                                        <DataTrustLabel fact={variantPriceTrust(variant, cp, locale, now)} locale={locale} />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Price History Chart */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>{isZh ? '📈 历史价格曲线' : '📈 Price History'}</CardTitle>
            <CardDescription>
              {isZh
                ? '每次 scraper 检测到价格变动都会入库。相同日期的多次变动会取最后一次；未变动的渠道用最近一次价格平铺。'
                : 'Every scraper-detected price change is recorded. Same-day multiple changes take the last value; unchanged channels carry the last observed price forward.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PriceHistoryChart
              history={priceHistory}
              locale={isZh ? 'zh' : 'en'}
              officialProviderSlugs={officialHistoryProviderSlugs}
            />
          </CardContent>
        </Card>

        {/* Estimated Costs. Channels publish in different currencies (CNY vs
            USD), so each cost is normalised to USD before comparison —
            otherwise a ¥20/¥100 row is totalled as if it were $20/$100. */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3">
              <span>{isZh ? '💵 预估月度费用' : '💵 Estimated Monthly Costs'}</span>
              <Link href={`/${locale}/calculator?models=${encodeURIComponent(product.slug)}`}>
                <Button variant="outline" size="sm">{isZh ? '自定义用量计算' : 'Calculate custom usage'}</Button>
              </Link>
            </CardTitle>
            <CardDescription>
              {isZh
                ? '基于典型使用比例（输入:输出 = 2:1），所有渠道统一换算为美元对比'
                : 'Based on typical usage patterns (input:output = 2:1 ratio); all channels converted to USD for comparison'}
              {showTrust && <DataTrustLabel fact={usageEstimateTrust(locale, now)} locale={locale} />}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usage Level</TableHead>
                    <TableHead>Tokens/Month</TableHead>
                    {sortedChannelPrices.slice(0, 4).map((cp: any) => (
                      <TableHead key={cp.id} className="text-right">
                        {cp.providers.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { level: '🐣 Light', inputTokens: 100000, outputTokens: 50000 },
                    { level: '📊 Medium', inputTokens: 1000000, outputTokens: 500000 },
                    { level: '🚀 Heavy', inputTokens: 10000000, outputTokens: 5000000 },
                    { level: '🏢 Enterprise', inputTokens: 100000000, outputTokens: 50000000 },
                  ].map((usage) => (
                    <TableRow key={usage.level}>
                      <TableCell className="font-medium">{usage.level}</TableCell>
                      <TableCell>
                        {(usage.inputTokens / 1000000).toFixed(1)}M in + {(usage.outputTokens / 1000000).toFixed(1)}M out
                      </TableCell>
                      {sortedChannelPrices.slice(0, 4).map((cp: any) => {
                        const costInChannelCurrency = cp.input_price_per_1m == null || cp.output_price_per_1m == null ? null :
                          (Number(cp.input_price_per_1m) * usage.inputTokens) / 1000000 +
                          (Number(cp.output_price_per_1m) * usage.outputTokens) / 1000000;
                        const cost = costInChannelCurrency == null ? null : convertToUSD(costInChannelCurrency, channelCurrency(cp));
                        return (
                          <TableCell key={cp.id} className="text-right font-mono font-semibold">
                            {formatPrice(cost, 'USD', locale)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* FAQ — visible mirror of the FAQPage JSON-LD emitted in <head>.
            Direct, factual answers are what answer engines (GEO) extract. */}
        {!announcementLabel && pricing.faqs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-bold mb-4">
              {isZh ? `关于 ${product.name} 的常见问题` : `Frequently asked questions about ${product.name}`}
            </h2>
            <div className="space-y-4">
              {pricing.faqs.map((faq, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-lg mb-2">{faq.question}</h3>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {guideSlug && (
          <section className="mt-8 border-y py-7">
            <p className="text-sm font-medium text-blue-600">{isZh ? '相关价格研究' : 'Related pricing research'}</p>
            <h2 className="mt-2 text-xl font-bold">{PRICING_GUIDES[guideSlug].title[isZh ? 'zh' : 'en']}</h2>
            <Link href={`/${locale}/guides/${guideSlug}`} className="mt-3 inline-flex items-center text-sm font-medium text-blue-600 hover:underline">
              {isZh ? '阅读完整指南 →' : 'Read the full guide →'}
            </Link>
          </section>
        )}

        {/* Related models from the same producer — internal linking for crawl
            depth and a non-dead-end next click. */}
        {relatedModels.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-bold mb-4">
              {isZh ? '同厂商相关模型' : 'Related models from the same producer'}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedModels.map((m) => (
                <Link key={m.slug} href={`/${locale}/models/${m.slug}`}>
                  <Card className="h-full hover:border-blue-400 hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-sm text-blue-600 mt-1">
                        {isZh ? '查看价格对比 →' : 'View pricing →'}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// Scheduled API prices are resolved on each request.
export const dynamic = 'force-dynamic';
