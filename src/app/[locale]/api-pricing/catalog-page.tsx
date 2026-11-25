import { getApiPricingSeoData } from "@/lib/pricing-seo-data";
import { buildApiPricingSeo } from "@/lib/pricing-seo";
import { getActiveCouponMap } from "@/lib/coupons";
import { applyPromoFilter, filteredListMetadata } from "@/lib/limited-time-offer";
import { breadcrumbList, faqPage, jsonLd, SITE_URL, type Locale } from "@/lib/seo";
import type { Metadata } from "next";
import { computeApiPricingStats } from "@/lib/api-pricing-copy";
import ApiPricingView from "./api-pricing-view";
import { ToolApiPricingSection } from "@/components/tool-api-pricing-section";
import { catalogPage } from "@/lib/api-pricing-catalog";
import { parseCatalogRequest } from "@/lib/api-pricing-query";
import { effectivePrice } from "@/lib/effective-price";
import SiteHeader from "@/components/SiteHeader";

/** SSR keeps a compact, useful page; full channel and variant pages load only on interaction. */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ promo?: string | string[] }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { promo } = await searchParams;
  const { filtered } = applyPromoFilter([], promo);
  return filteredListMetadata(locale, '/api-pricing', filtered);
}

export default async function ApiPricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    sort?: string;
    order?: string;
    china?: string;
    region?: string;
    channel?: string;
    promo?: string | string[];
    offset?: string;
  }>;
}) {
  const { locale } = await params;
  const raw = await searchParams;
  const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const q = scalar(raw.q), sort = scalar(raw.sort), order = scalar(raw.order), china = scalar(raw.china);
  const region = scalar(raw.region), channel = scalar(raw.channel), offset = scalar(raw.offset), promo = raw.promo;
  const [{ products, updatedAt }, couponByProvider] = await Promise.all([
    getApiPricingSeoData(),
    getActiveCouponMap('api'),
  ]);
  const now = new Date();
  // A backend wait can cross a cutoff after the service normalized its rows.
  // Share one nonmutating request-time dataset across table, filters and FAQ/JSON-LD.
  const effectiveProducts = products.map(product => ({ ...product,
    versions: product.versions.map(channel => effectivePrice(channel, now)),
  }));
  const { models: listedProducts, filtered: promoOnly } = applyPromoFilter(effectiveProducts, promo, now);

  // Public deep links stay tolerant of unknown values. The API validates strictly.
  const queryParams = new URLSearchParams({ locale: locale === 'zh' ? 'zh' : 'en' });
  if (q) queryParams.set('q', q.slice(0, 128).replace(/[\u0000-\u001f\u007f]/g, ''));
  for (const [key, value, allowed] of [
    ['sort', sort, ['selected', 'price', 'name', 'elo', 'latest', 'context']],
    ['order', order, ['asc', 'desc']], ['region', region, ['all', 'global', 'china']],
    ['channel', channel, ['all', 'official', 'cloud', 'aggregator', 'reseller']],
  ] as const) if (value && (allowed as readonly string[]).includes(value)) queryParams.set(key, value);
  if (china === '1') queryParams.set('china', '1');
  if (promoOnly) queryParams.set('promo', '1');
  if (offset && /^(0|[1-9]\d{0,5})$/.test(offset) && Number(offset) <= 100_000) queryParams.set('offset', offset);
  const initialQuery = parseCatalogRequest(queryParams).query;
  const initialPage = catalogPage(listedProducts, initialQuery, now);
  const visibleProviders = new Set(initialPage.rows.flatMap(row => row.quote?.providers.slug ?? []));
  const visibleCoupons = Object.fromEntries(Object.entries(couponByProvider).filter(([slug]) => visibleProviders.has(slug))
    .map(([slug, offers]) => [slug, offers.filter(offer => offer.expiresAt === null || new Date(offer.expiresAt).getTime() > now.getTime())]));

  // Data-driven FAQ + stats, shared between the visible section and the JSON-LD.
  const loc = (locale === "zh" ? "zh" : "en") as Locale;
  const stats = computeApiPricingStats(listedProducts);
  const copy = buildApiPricingSeo(listedProducts, updatedAt, loc);
  const faqs = copy.faqs;

  const crumbs = breadcrumbList([
    { name: loc === "zh" ? "首页" : "Home", url: `${SITE_URL}/${locale}` },
    { name: loc === "zh" ? "API 价格对比" : "API pricing", url: `${SITE_URL}/${locale}/api-pricing` },
  ]);

  // JSON-LD describes the visible page only, not the full undisplayed catalog.
  const itemList = jsonLd({
    "@type": "ItemList",
    name:
      loc === "zh"
        ? "AI 模型 API 价格一览"
        : "AI model API price list",
    numberOfItems: initialPage.rows.length,
    itemListElement: initialPage.rows.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/${locale}/models/${p.slug}`,
      name: p.name,
    })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemList }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqPage(faqs) }} />
      <SiteHeader locale={locale} />
      <main className="container mx-auto px-4 py-8">
        <h1 className="mb-3 text-3xl font-bold">{copy.heading}</h1>
        <p className="mb-4 text-zinc-600 dark:text-zinc-400">{copy.introduction}</p>
        {copy.updatedOn && <p className="mb-4 text-sm text-zinc-500">{loc === 'zh' ? '价格数据更新于：' : 'Price data updated on: '}<time dateTime={copy.updatedOn}>{copy.updatedOn}</time> (UTC)</p>}
        <p className="mb-4 text-sm">{stats.modelCount} {loc === 'zh' ? '个模型组' : 'model groups'} · {stats.channelCount} {loc === 'zh' ? '个 API 渠道报价' : 'channel prices'} · {stats.providerCount} {loc === 'zh' ? '家供应商' : 'providers'}</p>
        <p className="mb-5 flex flex-wrap gap-4 text-sm text-blue-600 underline">
          <a href={`/${locale}/guides`}>{loc === 'zh' ? '阅读价格指南' : 'Read pricing guides'}</a>
          <a href={`/${locale}/reports/api-price-index`}>{loc === 'zh' ? 'API 价格指数' : 'API Price Index'}</a>
          <a href={`/${locale}/compare/plans`}>{loc === 'zh' ? '订阅套餐对比' : 'Compare subscription plans'}</a>
        </p>
        <ApiPricingView key={queryParams.toString()} locale={locale} initialPage={initialPage} initialQuery={initialQuery}
          couponByProvider={visibleCoupons} requestedAt={now.toISOString()} />
        <section className="my-8 space-y-4" aria-label={loc === 'zh' ? '常见问题' : 'Frequently asked questions'}>
          <h2 className="text-xl font-semibold">{loc === 'zh' ? '常见问题' : 'Frequently asked questions'}</h2>
          {faqs.map(faq => <details key={faq.question}><summary className="cursor-pointer font-medium">{faq.question}</summary><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{faq.answer}</p></details>)}
        </section>
      </main>
      <ToolApiPricingSection locale={locale} />
    </>
  );
}

