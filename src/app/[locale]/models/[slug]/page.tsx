import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CalendarDays, Check, ExternalLink, TrendingDown, Zap, Globe } from "lucide-react";
import { sql, INT4_ARRAY } from "@/lib/db";
import { use } from "react";
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
import { buildMetadata, breadcrumbList, jsonLd, pickOfferCurrency, faqPage, SITE_URL, type Locale } from "@/lib/seo";
import { buildModelCopy } from "@/lib/model-copy";
import PriceHistoryChart, { type PriceHistoryPoint } from "@/components/price-history-chart";
import { decodeSlugParam } from "@/lib/route-params";
import SiteHeader from '@/components/SiteHeader';
import { formatModelName } from '@/lib/model-names';
import { guideForModelSlug, PRICING_GUIDES } from '@/lib/pricing-guides';
import ModelBenchmarkPanel from '@/components/model-benchmark-panel';
import { isArenaBenchmark, type ModelBenchmarkScore } from '@/lib/benchmarks';

const baseUrl = SITE_URL;

/** The columns the plan cards read out of the `plans` query below. */
interface PlanRow {
  id: number;
  name: string;
  slug: string;
  tier: string | null;
  price: number | null;
  annual_price: number | null;
  currency: string | null;
  // jsonb, and not consistently an array: 12 plans (claude-max-5x, chatgpt-team,
  // claude-team, the gemini-code-assist line...) carry `{}` rather than `[]`.
  // `{}` is truthy, so an unguarded `features && features.slice()` threw and took
  // the whole plan section down. Read it through planFeatures() instead.
  features: unknown;
  access_from_china: boolean | null;
  plan_kind: string | null;
  providers: { id: number; name: string; slug: string; logo: string | null } | null;
}

/** Only string entries of an array-shaped `features`; [] for every other shape. */
function planFeatures(features: unknown): string[] {
  return Array.isArray(features) ? features.filter((f): f is string => typeof f === 'string') : [];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeSlugParam(rawSlug);

  // Get product name. An unknown slug 404s from *here*, not from the page
  // body, and there is deliberately no loading.tsx anywhere above this route.
  // Any ancestor Suspense boundary flushes a shell and locks in the 200 before
  // the page body runs, so the page's own notFound() can no longer change the
  // status — crawlers get a 200 with an empty skeleton (a soft 404). Verified:
  // with `[locale]/loading.tsx` present every unknown slug returned 200; with
  // it removed and this check here they return 404 + the not-found UI.
  const [product] = await sql<Array<{ id: number; name: string }>>`
    SELECT id, name FROM models WHERE slug = ${slug} LIMIT 1
  `;
  if (!product) notFound();
  const productName = formatModelName(product.name || slug);

  // A few real facts make the SERP snippet specific instead of a generic
  // template repeated across 400+ model pages: how many channels, and the
  // cheapest USD-normalised input price. Cheap one-row aggregate.
  const [stats] = await sql<Array<{ channel_count: number; cheapest_usd: number | null }>>`
    SELECT count(*)::int AS channel_count,
           min(
             CASE WHEN cp.input_price_per_1m > 0
               THEN cp.input_price_per_1m /
                    CASE upper(coalesce(cp.currency,'USD'))
                      WHEN 'CNY' THEN 6.90 WHEN 'EUR' THEN 0.92
                      WHEN 'GBP' THEN 0.79 WHEN 'JPY' THEN 149.5
                      WHEN 'KRW' THEN 1320 WHEN 'SGD' THEN 1.35
                      ELSE 1 END
             END
           ) AS cheapest_usd
      FROM api_channel_prices cp
     WHERE cp.model_id = ${product.id} AND cp.is_available = true
  `;
  const channelCount = stats?.channel_count ?? 0;
  const cheapestUsd = stats?.cheapest_usd;
  const cheapestLabel =
    cheapestUsd != null && Number.isFinite(cheapestUsd) && cheapestUsd > 0
      ? `$${cheapestUsd < 1 ? cheapestUsd.toFixed(3) : cheapestUsd.toFixed(2)}/1M tokens`
      : null;

  const enDesc =
    `Compare ${productName} API pricing${cheapestLabel ? ` from ${cheapestLabel}` : ''} across ${
      channelCount || 'all available'
    } channels — official, Azure, AWS Bedrock, Vertex AI, OpenRouter, SiliconFlow and more. Find the cheapest ${productName} provider, with subscription plans and daily-updated, audited prices.`;
  const zhDesc =
    `对比 ${productName} 在${channelCount || '全部'}个 API 渠道的价格${
      cheapestLabel ? `（低至 ${cheapestLabel}）` : ''
    }：官方、Azure、AWS Bedrock、Vertex AI、OpenRouter、硅基流动等，含订阅套餐。每日更新、数据经审计。`;

  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: `/models/${slug}`,
    title: {
      en: `${productName} API Price Comparison · All Channels | aiplans.dev`,
      zh: `${productName} API 价格对比 · 各渠道价格 | aiplans.dev`,
    },
    description: { en: enDesc, zh: zhDesc },
  });
}

// Channel type labels
const channelTypeLabels: Record<string, { label: string; color: string }> = {
  official: { label: "官方", color: "bg-blue-100 text-blue-800" },
  producer: { label: "官方", color: "bg-blue-100 text-blue-800" },
  cloud: { label: "云厂商", color: "bg-purple-100 text-purple-800" },
  aggregator: { label: "聚合平台", color: "bg-green-100 text-green-800" },
  reseller: { label: "转售商", color: "bg-orange-100 text-orange-800" },
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

async function getProductWithChannels(slug: string) {
  // Get model with provider info
  const [model] = await sql<any[]>`
    SELECT id, name, slug, type, description, context_window, max_output_tokens,
           provider_ids, released_at, created_at
    FROM models
    WHERE slug = ${slug}
    LIMIT 1
  `;

  if (!model) return null;

  const modelProviders = await getPrimaryProvidersForModels([model as any]);
  const modelProvider = modelProviders.get(model.id) || null;

  // Get API channel prices
  const normalizedChannelPrices = await sql<any[]>`
    SELECT
      cp.*,
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'slug', p.slug,
        'type', p.type,
        'logo', p.logo,
        'logo_url', p.logo_url,
        'website', p.website,
        'region', p.region,
        'access_from_china', p.access_from_china,
        'description', p.description
      ) AS providers
    FROM api_channel_prices cp
    JOIN providers p ON p.id = cp.provider_id
    WHERE cp.model_id = ${model.id} AND cp.is_available = true
    ORDER BY cp.input_price_per_1m ASC NULLS LAST
  `;

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
      WHERE m.id <> ${model.id}
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
  const planIds = modelPlanMappings.map((m) => m.plan_id).filter((id): id is number => id != null);

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
      pl.access_from_china,
      pl.provider_id,
      pl.plan_kind,
      pl.plan_line,
      pl.tier_rank,
      CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'slug', p.slug,
        'logo', p.logo
      ) END AS providers
    FROM plans pl
    LEFT JOIN providers p ON p.id = pl.provider_id
    WHERE pl.id = ANY(${sql.array(planIds, INT4_ARRAY)})
    ORDER BY pl.price ASC NULLS LAST
  `] : [];

  // Return the model with provider attached
  const product = {
    ...model,
    providers: modelProvider || derivedProvider
  };

  // Fetch price history for all channels of this model (latest 500 events,
  // typically ~90 days worth). Join to api_channel_prices → providers.
  const channelIds = normalizedChannelPrices.map((cp: any) => cp.id);
  const priceHistory: PriceHistoryPoint[] = [];
  if (channelIds.length > 0) {
    const historyRows = await sql<any[]>`
      SELECT channel_price_id, new_input_price, new_output_price, currency, recorded_at
      FROM price_history
      WHERE channel_price_id = ANY(${sql.array(channelIds, INT4_ARRAY)})
      ORDER BY recorded_at ASC
      LIMIT 500
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
    plans: plansData,
    arenaElo,
    benchmarkScores,
    priceHistory,
    relatedModels,
  };
}

export default async function ModelPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeSlugParam(rawSlug);
  const data = await getProductWithChannels(slug);

  if (!data) {
    notFound();
  }

  const { product, channelPrices, plans, arenaElo, benchmarkScores, priceHistory, relatedModels } = data;
  const isZh = locale === 'zh';
  const productName = formatModelName(product.name);
  const guideSlug = guideForModelSlug(product.slug);

  // Plans can come from several providers (a bundled plan may include
  // third-party models), so normalize to USD before ordering — otherwise a
  // ¥40 plan sorts above a $20 one.
  const planPriceUSD = (plan: PlanRow): number =>
    (plan.price || 0) * getExchangeRateSync(plan.currency || 'USD', 'USD');

  const planRows = plans as PlanRow[];

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
  const cheapestChannel = sortedChannelPrices[0];

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

  // JSON-LD: Product + AggregateOffer + BreadcrumbList
  // AggregateOffer packages the channel input_price_per_1m figures so Google can
  // show a price range in the SERP snippet.
  //
  // It carries a single priceCurrency, and channels are stored in whatever the
  // vendor publishes, so we quote the model in its dominant channel currency
  // (see pickOfferCurrency) and restrict both the aggregate and the per-channel
  // Offer[] to that one currency. Restricting both matters: this used to filter
  // the aggregate to USD but not the nested offers, so a ¥ Offer sat inside a
  // priceCurrency:"USD" AggregateOffer.
  const pricedChannels = (channelPrices as any[]).filter(
    (cp) => typeof cp.input_price_per_1m === 'number' && cp.input_price_per_1m > 0,
  );
  const offerCurrency = pickOfferCurrency(pricedChannels.map((cp) => cp.currency ?? 'USD'));
  const offerChannels = pricedChannels.filter((cp) => (cp.currency ?? 'USD') === offerCurrency);
  const offerPrices = offerChannels
    .map((cp) => cp.input_price_per_1m as number)
    .sort((a, b) => a - b);

  // Build individual Offer entries per channel. AggregateOffer alone can't
  // tell Google which seller has which price — the per-channel Offer array
  // is what lets the SERP show "OpenAI $2.50 / SiliconFlow $1.08 / Azure
  // $2.50" style breakdown.
  const individualOffers = offerChannels.map((cp) => ({
    '@type': 'Offer',
    priceCurrency: offerCurrency,
    price: String(cp.input_price_per_1m),
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      priceCurrency: offerCurrency,
      price: String(cp.input_price_per_1m),
      unitText: 'per 1M input tokens',
    },
    availability: cp.is_available !== false
      ? 'https://schema.org/InStock'
      : 'https://schema.org/Discontinued',
    seller: cp.providers?.name
      ? {
          '@type': 'Organization',
          name: cp.providers.name,
          url: cp.providers.website ?? undefined,
        }
      : undefined,
    url: `${baseUrl}/${locale}/models/${product.slug}`,
    category: cp.providers?.type ?? undefined,
  }));

  // No priced channel means there is no offer to advertise, and a Product with
  // no offers/review/aggregateRating is exactly what Search Console rejects
  // ("应指定 offers、review 或 aggregateRating"). Emit no Product at all in that
  // case rather than an empty shell — the breadcrumb still ships below.
  //
  // Don't reach for aggregateRating to satisfy the one-of-three rule: we have no
  // ratings, and the Arena ELO below is not a 1-5 rating scale.
  const productJsonLd = offerCurrency == null ? null : jsonLd({
    '@type': 'Product',
    name: productName,
    description: product.description ?? `${productName} — ${product.context_window?.toLocaleString() ?? 'N/A'} token context window. API pricing compared across ${channelPrices.length} channels.`,
    // Required by Google, and missing site-wide until now. The route's own
    // opengraph-image.tsx already renders a real 1200x630 card for this model,
    // and its extensionless URL serves image/png.
    image: `${SITE_URL}/${locale}/models/${product.slug}/opengraph-image`,
    brand: product.providers?.name
      ? { '@type': 'Brand', name: product.providers.name }
      : undefined,
    category: 'AI Model API',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: offerCurrency,
      lowPrice: String(offerPrices[0]),
      highPrice: String(offerPrices[offerPrices.length - 1]),
      offerCount: offerPrices.length,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        priceCurrency: offerCurrency,
        unitText: 'per 1M input tokens',
      },
      offers: individualOffers,
    },
    // Benchmarks remain custom properties, not AggregateRating: they use
    // different scales and are evaluation results rather than user ratings.
    ...(benchmarkScores.length > 0
      ? {
          additionalProperty: benchmarkScores.map((score) => ({
            '@type': 'PropertyValue',
            name: `${score.benchmark_name} (${score.version_label})`,
            value: score.value,
            unitText: score.unit || undefined,
          })),
        }
      : {}),
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
    if (!officialPrice || !price) return null;
    const priceUSD = convertToUSD(Number(price), channelCurrency(cp));
    const officialUSD = convertToUSD(Number(officialPrice), channelCurrency(officialChannel));
    if (!officialUSD) return null;
    const savings = ((officialUSD - priceUSD) / officialUSD) * 100;
    return savings > 0.1 ? savings.toFixed(1) : null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      {productJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {modelCopy.faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: faqPage(modelCopy.faqs) }}
        />
      )}
      <SiteHeader locale={locale} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link href={`/${locale}/api-pricing`} className="flex items-center gap-1 hover:text-blue-600">
            <ArrowLeft className="w-4 h-4" /> Back to API Pricing
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
              <h1 className="text-3xl font-bold">{productName}</h1>
              <p className="text-zinc-600">{product.providers?.name} • API Price Comparison</p>
            </div>
          </div>
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
          <p className="mt-4 text-zinc-700 dark:text-zinc-300 leading-relaxed max-w-4xl">
            {modelCopy.summary}
          </p>
        </div>

        <ModelBenchmarkPanel scores={benchmarkScores} locale={locale} />

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Cheapest Option */}
          <Card className={cheapestChannel?.id === officialChannel?.id ? "border-blue-500" : "border-green-500"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-600" /> 💰 Cheapest Option
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cheapestChannel?.providers?.name || 'N/A'}</div>
              <div className="text-3xl font-bold text-green-600 mt-1">
                {formatPrice(cheapestChannel?.input_price_per_1m, channelCurrency(cheapestChannel), locale)}
                <span className="text-sm font-normal text-zinc-500">/1M input</span>
              </div>
              <div className="text-xl text-zinc-600 mt-1">
                {formatPrice(cheapestChannel?.output_price_per_1m, channelCurrency(cheapestChannel), locale)}
                <span className="text-sm font-normal text-zinc-500">/1M output</span>
              </div>
              {cheapestChannel && officialChannel && cheapestChannel.id !== officialChannel.id && (
                <div className="text-sm text-green-600 mt-2 font-medium">
                  💸 Save {calculateSavings(cheapestChannel)}% vs official
                </div>
              )}
              {cheapestChannel?.providers?.access_from_china && (
                <Badge className="mt-2 bg-green-100 text-green-800">🇨🇳 China Available</Badge>
              )}
            </CardContent>
          </Card>

          {/* Official Price */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" /> 🏢 Official Price
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{officialChannel?.providers?.name || 'N/A'}</div>
              {officialChannel ? (
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
                </>
              ) : (
                <div className="text-zinc-500 mt-2">No official channel available</div>
              )}
            </CardContent>
          </Card>

          {/* China-Friendly Option */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                🇨🇳 Best in China
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
                  </>
                ) : (
                  <div className="text-zinc-500">No China-friendly options</div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

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

                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {kindPlans.map((plan) => {
                    const planCurrency = (plan.currency || 'USD') as CurrencyCode;
                    const isRecommended = recommendedPlanIds.has(plan.id);
                    const isBestValue = plan.id === bestValuePlanId;

                    return (
                      <Card
                        key={plan.id}
                        className={`relative ${
                          isRecommended
                            ? 'border-2 border-blue-500 shadow-lg'
                            : isBestValue
                            ? 'border-2 border-green-500'
                            : ''
                        }`}
                      >
                        {isRecommended && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <Badge className="bg-blue-600 text-white">⭐ Recommended</Badge>
                          </div>
                        )}
                        {isBestValue && !isRecommended && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <Badge className="bg-green-600 text-white">💰 Best Value</Badge>
                          </div>
                        )}

                        <CardHeader className="pb-4">
                          <div className="flex items-center gap-2 mb-2">
                            {plan.providers?.logo && (
                              <img
                                src={plan.providers.logo}
                                alt={plan.providers.name}
                                className="w-6 h-6 object-contain"
                              />
                            )}
                            <CardTitle className="text-lg">{plan.name}</CardTitle>
                          </div>
                          <div className="mt-2">
                            {plan.tier === 'free' ? (
                              <div className="text-3xl font-bold">Free</div>
                            ) : (
                              <>
                                <div className="text-3xl font-bold">
                                  {formatPrice(plan.price, planCurrency, locale)}
                                  <span className="text-sm font-normal text-zinc-500">/month</span>
                                </div>
                                {plan.annual_price && (
                                  <div className="text-sm text-zinc-600 mt-1">
                                    {formatPrice(plan.annual_price, planCurrency, locale)}/year
                                    {plan.price && (
                                      <span className="text-green-600 ml-1">
                                        (Save {Math.round((1 - plan.annual_price / (plan.price * 12)) * 100)}%)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`mt-2 ${
                              plan.tier === 'free'
                                ? 'bg-gray-100'
                                : plan.tier === 'pro'
                                ? 'bg-blue-100 text-blue-800'
                                : plan.tier === 'team'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {plan.tier === 'free' ? '🆓 Free Tier' :
                             plan.tier === 'pro' ? '👤 Individual' :
                             plan.tier === 'team' ? '👥 Team' :
                             '🏢 Enterprise'}
                          </Badge>
                        </CardHeader>

                        <CardContent>
                          <div className="space-y-2 mb-4">
                            {planFeatures(plan.features).slice(0, 4).map((feature, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm">
                                <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span className="text-zinc-700">{feature}</span>
                              </div>
                            ))}
                            {planFeatures(plan.features).length > 4 && (
                              <div className="text-sm text-zinc-500 ml-6">
                                +{planFeatures(plan.features).length - 4} more features
                              </div>
                            )}
                          </div>

                          {plan.access_from_china && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 mb-3">
                              🇨🇳 Available in China
                            </Badge>
                          )}

                          <Link
                            href={`/${locale}/compare/plans/${slug}`}
                            className="w-full"
                          >
                            <Button
                              className={`w-full ${
                                isRecommended
                                  ? 'bg-blue-600 hover:bg-blue-700'
                                  : ''
                              }`}
                              variant={isRecommended ? 'default' : 'outline'}
                            >
                              View Details
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    );
                  })}
                  </div>
                </div>
              ))}

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
            <CardTitle>📊 Channel Price Comparison</CardTitle>
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
                      <TableRow key={cp.id} className={isCheapest ? "bg-green-50 dark:bg-green-950/30" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {cp.providers.name}
                            {isCheapest && (
                              <Badge className="bg-green-600 text-xs">💰 Best Price</Badge>
                            )}
                            {isOfficial && (
                              <Badge variant="outline" className="text-xs">🏢 Official</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${channelTypeLabels[cp.providers.type]?.color || 'bg-gray-100'}`}>
                            {channelTypeLabels[cp.providers.type]?.label || cp.providers.type}
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
                          {cp.providers.website && (
                            <a
                              href={cp.providers.website}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="outline" size="sm" className="gap-1">
                                Visit <ExternalLink className="w-3 h-3" />
                              </Button>
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
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
            <PriceHistoryChart history={priceHistory} locale={isZh ? 'zh' : 'en'} />
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
                        const costInChannelCurrency =
                          (Number(cp.input_price_per_1m) * usage.inputTokens) / 1000000 +
                          (Number(cp.output_price_per_1m) * usage.outputTokens) / 1000000;
                        const cost = convertToUSD(costInChannelCurrency, channelCurrency(cp));
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
        {modelCopy.faqs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-bold mb-4">
              {isZh ? `关于 ${product.name} 的常见问题` : `Frequently asked questions about ${product.name}`}
            </h2>
            <div className="space-y-4">
              {modelCopy.faqs.map((faq, idx) => (
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
