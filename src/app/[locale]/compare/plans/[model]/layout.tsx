import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { legacySlugRedirect } from '@/lib/legacy-slug-redirects';
import { findModelSlugRedirect } from '@/lib/model-slug-redirects';
import { buildMetadata, type Locale } from '@/lib/seo';
import { decodeSlugParam } from '@/lib/route-params';
import { formatModelName } from '@/lib/model-names';
import { selectIndexablePlanComparisons } from '@/lib/search-indexing';
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
    sql<Array<{
      slug: string;
      released_at: Date | string | null;
      updated_at: Date | string | null;
      plan_count: number;
    }>>`
      SELECT models.slug, models.released_at, models.updated_at,
             count(DISTINCT plans.id)::int AS plan_count
      FROM models
      JOIN model_plan_mapping mpm ON mpm.model_id = models.id
      JOIN plans ON plans.id = mpm.plan_id
      WHERE (models.shutdown_date IS NULL OR models.shutdown_date > (now() AT TIME ZONE 'UTC')::date) AND models.type ILIKE '%llm%' AND plans.pricing_model = 'subscription'
      GROUP BY models.id, models.slug, models.released_at, models.updated_at
    `,
  ]);
  if (!data) {
    const target = await findModelSlugRedirect(modelSlug);
    if (target) permanentRedirect(`/${locale}/compare/plans/${encodeURIComponent(target)}`);
    notFound();
  }
  const modelName = formatModelName(data.model.name);
  const en = buildComparisonPricingCopy(modelName, data.plans, 'en', undefined, modelSlug);
  const zh = buildComparisonPricingCopy(modelName, data.plans, 'zh', undefined, modelSlug);
  // Old releases, operational SKUs, and pages with fewer than two plans still
  // work for existing users, but should not compete with the useful current
  // comparison in search results.
  const isIndexable = selectIndexablePlanComparisons(comparable)
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
