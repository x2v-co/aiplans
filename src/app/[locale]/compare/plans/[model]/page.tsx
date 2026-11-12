import { guideForModelSlug, PRICING_GUIDES } from '@/lib/pricing-guides';
import { notFound, permanentRedirect } from "next/navigation";
import { getPlanComparison } from "@/lib/compare-plans";
import { legacySlugRedirect } from "@/lib/legacy-slug-redirects";
import { findModelSlugRedirect } from "@/lib/model-slug-redirects";
import { getActiveCouponMap } from "@/lib/coupons";
import type { CurrencyCode } from "@/lib/currency";
import { breadcrumbList, faqPage, SITE_URL } from "@/lib/seo";
import ComparePlansView from "./compare-plans-view";
import { buildCompareFaqs } from "./faqs";
import { decodeSlugParam } from "@/lib/route-params";
import { formatModelName } from '@/lib/model-names';
import { getVerifiedQuotaEstimates } from '@/lib/quota/data';
import { getSeoIndexCatalog } from '@/lib/seo-index-data';
import { compareSeoFallback } from '@/lib/seo-index-policy';

// Catalog pages are ISR (aiplans GSC 2026-11-04): rendered on first request,
// then served from the Next.js cache and regenerated in the background at most
// every 5 minutes (Cache-Control: s-maxage=300, stale-while-revalidate). Before
// this every crawler hit re-rendered the page and 16 concurrent requests queued
// for 8–28 s on the 1.5-CPU app container. Scheduled prices therefore switch
// within one revalidate window instead of on the exact request.
export const revalidate = 300;
// Empty list: nothing is prerendered at build (CI builds without a database);
// every locale/slug is rendered on demand and then cached.
export function generateStaticParams() {
  return [];
}


/**
 * Server component. This page used to be a client component that fetched
 * `/api/compare/plans` from the browser, which meant crawlers got an empty
 * document and an unknown model slug still returned HTTP 200. Fetching here
 * gives the page real HTML and lets `notFound()` produce a real 404.
 *
 * Note there must be no `loading.tsx` above this route — see the comment in
 * models/[slug]/page.tsx. A Suspense boundary would flush a shell and lock in
 * the 200 before this function runs.
 */
export default async function ComparePlansModelPage({
  params,
}: {
  params: Promise<{ locale: string; model: string }>;
}) {
  const { locale, model: rawModel } = await params;
  const modelSlug = decodeSlugParam(rawModel);
  const legacyTarget = legacySlugRedirect(`/${locale === 'zh' ? 'zh' : 'en'}/compare/plans/${modelSlug}`);
  if (legacyTarget) permanentRedirect(legacyTarget);

  const [data, couponByProvider, catalog] = await Promise.all([
    getPlanComparison(modelSlug, "USD" as CurrencyCode),
    getActiveCouponMap('plan'),
    getSeoIndexCatalog(),
  ]);
  if (!data) {
    const target = await findModelSlugRedirect(modelSlug);
    if (target) permanentRedirect(`/${locale}/compare/plans/${encodeURIComponent(target)}`);
    notFound();
  }
  const fallback = compareSeoFallback(locale, modelSlug, catalog);
  if (fallback) permanentRedirect(fallback);

  const isZh = locale === "zh";
  const guideSlug = guideForModelSlug(modelSlug);
  const pricingGuide = guideSlug ? { href: `/${locale}/guides/${guideSlug}`, label: PRICING_GUIDES[guideSlug].title[isZh ? 'zh' : 'en'] } : undefined;
  const quotaEstimates = await getVerifiedQuotaEstimates(
    [...data.officialPlans, ...data.thirdPartyPlans].map(entry => entry.plan.slug),
  );
  const crumbs = breadcrumbList([
    { name: isZh ? "首页" : "Home", url: `${SITE_URL}/${locale}` },
    { name: isZh ? "套餐对比" : "Compare Plans", url: `${SITE_URL}/${locale}/compare/plans` },
    { name: formatModelName(data.model.name), url: `${SITE_URL}/${locale}/compare/plans/${modelSlug}` },
  ]);

  // Data-driven FAQ, shared between the visible section and the JSON-LD so
  // the two stay in lockstep.
  const faqs = buildCompareFaqs(data, (isZh ? "zh" : "en") as "zh" | "en");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqPage(faqs) }} />
      <ComparePlansView pricingGuide={pricingGuide} locale={locale} data={data} faqs={faqs} couponByProvider={couponByProvider} quotaEstimates={quotaEstimates} />
    </>
  );
}
