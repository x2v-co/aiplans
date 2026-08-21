import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Check, ExternalLink, TrendingDown, Zap, Globe } from "lucide-react";
import { sql, INT4_ARRAY } from "@/lib/db";
import { use } from "react";
import { getPrimaryProvidersForModels } from "@/lib/schema-adapters";
import { getProviderLogoFallback, getProviderLogoSrc } from "@/lib/provider-branding";
import { formatPrice, type CurrencyCode } from "@/lib/currency";
import { getExchangeRateSync } from "@/lib/exchange-rates";
import {
  groupPlansByKind,
  planKindDescription,
  planKindIcon,
  planKindLabel,
} from "@/lib/plan-kinds";
import { buildMetadata, breadcrumbList, jsonLd, pickOfferCurrency, SITE_URL, type Locale } from "@/lib/seo";
import PriceHistoryChart, { type PriceHistoryPoint } from "@/components/price-history-chart";
import { decodeSlugParam } from "@/lib/route-params";

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
  const [product] = await sql<Array<{ name: string }>>`
    SELECT name FROM models WHERE slug = ${slug} LIMIT 1
  `;
  if (!product) notFound();
  const productName = product.name || slug;

  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: `/models/${slug}`,
    title: {
      en: `${productName} API Price Comparison · All Channels | aiplans.dev`,
      zh: `${productName} API 价格对比 · 各渠道价格 | aiplans.dev`,
    },
    description: {
      en: `Compare ${productName} API prices across official, Azure, AWS Bedrock, Vertex AI, OpenRouter, SiliconFlow and other channels. Find the cheapest ${productName} API provider. Updated hourly.`,
      zh: `对比 ${productName} 在官方、Azure、AWS Bedrock、Vertex AI、OpenRouter、硅基流动等渠道的 API 价格。找到最便宜的 ${productName} API 供应商。每小时更新。`,
    },
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

async function getProductWithChannels(slug: string) {
  // Get model with provider info
  const [model] = await sql<any[]>`
    SELECT id, name, slug, type, description, context_window, max_output_tokens, provider_ids
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

  // Fetch Arena ELO score for this model (used in JSON-LD + visible badge)
  const arenaScores = await sql<Array<{ value: number | null }>>`
    SELECT s.value
    FROM model_benchmark_scores s
    JOIN benchmark_metrics bm ON bm.id = s.metric_id
    WHERE s.model_id = ${model.id} AND bm.name = 'ELO'
    ORDER BY s.value DESC NULLS LAST
    LIMIT 1
  `;
  const arenaElo = arenaScores?.[0]?.value ?? null;

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
    priceHistory,
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

  const { product, channelPrices, plans, arenaElo, priceHistory } = data;
  const isZh = locale === 'zh';

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

  // Find official and cheapest
  const officialChannel = (channelPrices as any[]).find((cp) => cp.providers?.type === 'official' || cp.providers?.type === 'producer');
  const cheapestChannel = (channelPrices as any[])[0];

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
    name: product.name,
    description: product.description ?? `${product.name} — ${product.context_window?.toLocaleString() ?? 'N/A'} token context window. API pricing compared across ${channelPrices.length} channels.`,
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
    // Arena ELO as an additional property (Google accepts custom numeric
    // metrics; we don't use AggregateRating because ELO isn't a 1-5 scale)
    ...(arenaElo != null
      ? {
          additionalProperty: [
            {
              '@type': 'PropertyValue',
              name: 'Chatbot Arena ELO',
              value: arenaElo,
              unitText: 'ELO',
            },
          ],
        }
      : {}),
  });

  const breadcrumbJsonLd = breadcrumbList([
    { name: isZh ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: isZh ? 'API 价格' : 'API Pricing', url: `${SITE_URL}/${locale}/api-pricing` },
    { name: product.name, url: `${SITE_URL}/${locale}/models/${product.slug}` },
  ]);

  // Calculate savings
  const calculateSavings = (price: number, officialPrice: number) => {
    if (!officialPrice || !price) return null;
    const savings = ((officialPrice - price) / officialPrice) * 100;
    return savings > 0 ? savings.toFixed(1) : null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      {productJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 dark:bg-black/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="text-xl font-bold">aiplans.dev</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href={`/${locale}/compare/plans`} className="text-sm font-medium hover:text-blue-600">
              Compare Plans
            </Link>
            <Link href={`/${locale}/api-pricing`} className="text-sm font-medium text-blue-600">
              API Pricing
            </Link>
            <Link href={`/${locale}/coupons`} className="text-sm font-medium hover:text-blue-600">
              Coupons
            </Link>
          </nav>
        </div>
      </header>

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
                alt={product.providers?.name || product.name}
                className="w-16 h-16 object-contain"
              />
            ) : (
              <span className="text-5xl">{getProviderLogoFallback(product.providers)}</span>
            )}
            <div>
              <h1 className="text-3xl font-bold">{product.name}</h1>
              <p className="text-zinc-600">{product.providers?.name} • API Price Comparison</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {product.context_window && (
              <Badge variant="outline" className="text-sm">
                📏 Context: {product.context_window.toLocaleString()} tokens
              </Badge>
            )}
            </div>
        </div>

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
                ${cheapestChannel?.input_price_per_1m?.toFixed(2)}
                <span className="text-sm font-normal text-zinc-500">/1M input</span>
              </div>
              <div className="text-xl text-zinc-600 mt-1">
                ${cheapestChannel?.output_price_per_1m?.toFixed(2)}
                <span className="text-sm font-normal text-zinc-500">/1M output</span>
              </div>
              {cheapestChannel?.id !== officialChannel?.id && officialChannel && (
                <div className="text-sm text-green-600 mt-2 font-medium">
                  💸 Save {calculateSavings(cheapestChannel?.input_price_per_1m, officialChannel?.input_price_per_1m)}% vs official
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
                    ${officialChannel.input_price_per_1m?.toFixed(2)}
                    <span className="text-sm font-normal text-zinc-500">/1M input</span>
                  </div>
                  <div className="text-xl text-zinc-600 mt-1">
                    ${officialChannel.output_price_per_1m?.toFixed(2)}
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
                const chinaOptions = (channelPrices as any[]).filter((cp) => cp.providers?.access_from_china);
                const cheapestChina = chinaOptions[0];
                return cheapestChina ? (
                  <>
                    <div className="text-2xl font-bold">{cheapestChina.providers?.name}</div>
                    <div className="text-3xl font-bold mt-1">
                      ${cheapestChina.input_price_per_1m?.toFixed(2)}
                      <span className="text-sm font-normal text-zinc-500">/1M input</span>
                    </div>
                    <div className="text-xl text-zinc-600 mt-1">
                      ${cheapestChina.output_price_per_1m?.toFixed(2)}
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
                  {channelPrices.map((cp: any, idx: number) => {
                    const isOfficial = cp.providers.type === 'official' || cp.providers.type === 'producer';
                    const isCheapest = idx === 0;
                    const savings = calculateSavings(cp.input_price_per_1m, officialChannel?.input_price_per_1m);

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
                          ${cp.input_price_per_1m?.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${cp.output_price_per_1m?.toFixed(2)}
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

        {/* Estimated Costs */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>💵 Estimated Monthly Costs</CardTitle>
            <CardDescription>
              Based on typical usage patterns (input:output = 2:1 ratio)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usage Level</TableHead>
                    <TableHead>Tokens/Month</TableHead>
                    {channelPrices.slice(0, 4).map((cp: any) => (
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
                      {channelPrices.slice(0, 4).map((cp: any) => {
                        const cost =
                          (cp.input_price_per_1m * usage.inputTokens) / 1000000 +
                          (cp.output_price_per_1m * usage.outputTokens) / 1000000;
                        return (
                          <TableCell key={cp.id} className="text-right font-mono font-semibold">
                            ${cost.toFixed(2)}
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
      </main>
    </div>
  );
}
