import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getSeoIndexCatalog } from '@/lib/seo-index-data';
import { legacySlugRedirect } from '@/lib/legacy-slug-redirects';
import { findModelSlugRedirect } from '@/lib/model-slug-redirects';
import { buildMetadata, type Locale } from '@/lib/seo';
import { decodeSlugParam } from '@/lib/route-params';
import { formatModelName } from '@/lib/model-names';
import { selectSeoComparisons } from '@/lib/seo-index-policy';
import { buildComparisonPricingCopy } from '@/lib/pricing-seo';
import { getComparisonSeoData } from '@/lib/pricing-seo-data';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; model: string }>;
}): Promise<Metadata> {
  const { locale, model: rawModel } = await params;
  const modelSlug = decodeSlugParam(rawModel);
  const legacyTarget = legacySlugRedirect(`/${locale === 'zh' ? 'zh' : 'en'}/compare/plans/${modelSlug}`);
  if (legacyTarget) permanentRedirect(legacyTarget);

  const [data, comparable] = await Promise.all([
    getComparisonSeoData(modelSlug),
    getSeoIndexCatalog(),
  ]);
  if (!data) {
    const target = await findModelSlugRedirect(modelSlug);
    if (target) permanentRedirect(`/${locale}/compare/plans/${encodeURIComponent(target)}`);
    notFound();
  }
  const modelName = formatModelName(data.model.name);
  const en = buildComparisonPricingCopy(modelName, data.plans, 'en', undefined, modelSlug);
  const zh = buildComparisonPricingCopy(modelName, data.plans, 'zh', undefined, modelSlug);
  // Reuse sitemap eligibility: current primary releases need at least two
  // priced subscriptions across two vendors. Other detail pages remain usable
  // through existing links and pass crawlers on to useful pages.
  const isIndexable = selectSeoComparisons(comparable)
    .some((candidate) => candidate.slug === modelSlug);

  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: `/compare/plans/${modelSlug}`,
    title: { en: en.title, zh: zh.title },
    description: { en: en.description, zh: zh.description },
    noindex: !isIndexable,
  });
}

export default function ComparePlansModelLayout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; model: string }>;
}) {
  return <>{children}</>;
}
