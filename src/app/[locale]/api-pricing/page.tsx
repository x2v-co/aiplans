import { getGroupedProducts } from "@/lib/grouped-products";
import { breadcrumbList, faqPage, jsonLd, SITE_URL, type Locale } from "@/lib/seo";
import { computeApiPricingStats, buildApiPricingFaqs } from "@/lib/api-pricing-copy";
import ApiPricingView from "./api-pricing-view";

/**
 * Server component. The whole page used to be a client component that fetched
 * /api/products/grouped in an effect, so crawlers received a spinner and not one
 * model name — on the page CLAUDE.md calls the site's core SEO surface. Querying
 * here puts all ~320 models and their channel prices in the served HTML.
 *
 * The interactive parts (search, sort, filters) live in api-pricing-view.tsx and
 * are unchanged; only where the data comes from moved.
 */
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
  }>;
}) {
  const { locale } = await params;
  const { q, sort, order, china, region, channel } = await searchParams;
  const products = await getGroupedProducts("llm");

  // The capability cards on /compare/plans deep-link here (Arena ranking,
  // longest context, cheapest, China-reachable). Validate whitelist-style so
  // an arbitrary query string can't put the sort select in an unknown state.
  const initialFilters = {
    ...(sort && ["price", "name", "elo", "latest", "context"].includes(sort)
      ? { sortBy: sort as "price" | "name" | "elo" | "latest" | "context" }
      : {}),
    ...(order && ["asc", "desc"].includes(order) ? { sortOrder: order as "asc" | "desc" } : {}),
    ...(china === "1" ? { chinaAccessOnly: true } : {}),
    ...(region && ["global", "china"].includes(region)
      ? { regionFilter: region as "global" | "china" }
      : {}),
    ...(channel && ["official", "cloud", "aggregator", "reseller"].includes(channel)
      ? { channelTypeFilter: channel as "official" | "cloud" | "aggregator" | "reseller" }
      : {}),
  };

  // Data-driven FAQ + stats, shared between the visible section and the JSON-LD.
  const loc = (locale === "zh" ? "zh" : "en") as Locale;
  const stats = computeApiPricingStats(products);
  const faqs = buildApiPricingFaqs(stats, loc);

  const crumbs = breadcrumbList([
    { name: loc === "zh" ? "首页" : "Home", url: `${SITE_URL}/${locale}` },
    { name: loc === "zh" ? "API 价格对比" : "API pricing", url: `${SITE_URL}/${locale}/api-pricing` },
  ]);

  // ItemList of the models shown on this category page. ListItems point at the
  // per-model pages (which carry the full Product/Offer graph), so this is a
  // compact collection-page index rather than ~320 duplicated Product blobs.
  const itemList = jsonLd({
    "@type": "ItemList",
    name:
      loc === "zh"
        ? "AI 模型 API 价格一览"
        : "AI model API price list",
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
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
      <ApiPricingView
        locale={locale}
        products={products}
        initialQuery={q}
        initialFilters={initialFilters}
        stats={stats}
        faqs={faqs}
      />
    </>
  );
}
