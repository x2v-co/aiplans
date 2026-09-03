import type { Metadata } from 'next';
import { sql } from '@/lib/db';
import { buildMetadata, type Locale } from '@/lib/seo';
import { decodeSlugParam } from '@/lib/route-params';
import { formatModelName } from '@/lib/model-names';
import { selectIndexablePlanComparisons } from '@/lib/search-indexing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; model: string }>;
}): Promise<Metadata> {
  const { locale, model: rawModel } = await params;
  const modelSlug = decodeSlugParam(rawModel);

  const [models, comparable] = await Promise.all([
    sql<Array<{ name: string }>>`
      SELECT name FROM models WHERE slug = ${modelSlug} LIMIT 1
    `,
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
      WHERE models.type ILIKE '%llm%' AND plans.pricing_model = 'subscription'
      GROUP BY models.id, models.slug, models.released_at, models.updated_at
    `,
  ]);
  const model = models[0];
  const modelName = formatModelName(model?.name ?? modelSlug);
  // Old releases, operational SKUs, and pages with fewer than two plans still
  // work for existing users, but should not compete with the useful current
  // comparison in search results.
  const isIndexable = selectIndexablePlanComparisons(comparable)
    .some((candidate) => candidate.slug === modelSlug);

  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: `/compare/plans/${modelSlug}`,
    title: {
      en: `${modelName} Subscription Plans Compared | aiplans.dev`,
      zh: `${modelName} 订阅计划对比 | aiplans.dev`,
    },
    description: {
      en: `Side-by-side comparison of every subscription plan that includes ${modelName}. Monthly vs annual pricing, message limits, rate limits, and team/enterprise tiers across OpenAI, Anthropic, Google, Mistral and more.`,
      zh: `横向对比包含 ${modelName} 的全部订阅计划。月付/年付价格、消息限额、速率限制、团队/企业档位——涵盖 OpenAI、Anthropic、Google、Mistral 等。`,
    },
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
