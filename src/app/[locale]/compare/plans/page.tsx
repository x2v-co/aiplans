import { getComparePlansIndexData } from "@/lib/compare-plans-index";
import { breadcrumbList, SITE_URL, type Locale } from "@/lib/seo";
import ComparePlansIndexView from "./compare-plans-index-view";

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
 * Server component — see compare-plans-index-view.tsx. The lists were assembled
 * in an effect from three API calls, so this page shipped crawlers 85 characters
 * and a "Loading..." string.
 */
export default async function ComparePlansIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = (locale === "zh" ? "zh" : "en") as Locale;
  const data = await getComparePlansIndexData();

  const crumbs = breadcrumbList([
    { name: loc === "zh" ? "首页" : "Home", url: `${SITE_URL}/${locale}` },
    { name: loc === "zh" ? "套餐对比" : "Compare plans", url: `${SITE_URL}/${locale}/compare/plans` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: crumbs }}
      />
      <ComparePlansIndexView locale={locale} data={data} />
    </>
  );
}
