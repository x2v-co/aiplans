import { notFound } from "next/navigation";
import { getPlanComparison } from "@/lib/compare-plans";
import type { CurrencyCode } from "@/lib/currency";
import { breadcrumbList, faqPage, SITE_URL } from "@/lib/seo";
import ComparePlansView from "./compare-plans-view";
import { buildCompareFaqs } from "./faqs";
import { decodeSlugParam } from "@/lib/route-params";

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

  const data = await getPlanComparison(modelSlug, "USD" as CurrencyCode);
  if (!data) notFound();

  const isZh = locale === "zh";
  const crumbs = breadcrumbList([
    { name: isZh ? "首页" : "Home", url: `${SITE_URL}/${locale}` },
    { name: isZh ? "套餐对比" : "Compare Plans", url: `${SITE_URL}/${locale}/compare/plans` },
    { name: data.model.name, url: `${SITE_URL}/${locale}/compare/plans/${modelSlug}` },
  ]);

  // Data-driven FAQ, shared between the visible section and the JSON-LD so
  // the two stay in lockstep.
  const faqs = buildCompareFaqs(data, (isZh ? "zh" : "en") as "zh" | "en");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqPage(faqs) }} />
      <ComparePlansView locale={locale} data={data} faqs={faqs} />
    </>
  );
}
