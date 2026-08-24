import { getComparePlansIndexData } from "@/lib/compare-plans-index";
import { breadcrumbList, SITE_URL, type Locale } from "@/lib/seo";
import ComparePlansIndexView from "./compare-plans-index-view";

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
