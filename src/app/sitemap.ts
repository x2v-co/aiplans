import { AI_VERTICAL_CATALOG } from '@/lib/ai-vertical-catalog';
import { MetadataRoute } from 'next';
import { sql } from '@/lib/db';
import { selectIndexablePlanComparisons } from '@/lib/search-indexing';
import { PRICING_GUIDE_SLUGS } from '@/lib/pricing-guides';
import { getVerifiedQuotaEstimates } from '@/lib/quota/data';
import { quotaChanges } from '@/lib/quota/estimates';

const BASE_URL = 'https://aiplans.dev';
const LOCALES = ['en', 'zh'] as const;

export const dynamic = 'force-dynamic';

interface UrlEntry {
  url: string;
  lastModified: Date;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

const STATIC_PATHS: { path: string; priority: number; changefreq: UrlEntry['changeFrequency'] }[] = [
  { path: '', priority: 1.0, changefreq: 'daily' },
  { path: '/models', priority: 0.9, changefreq: 'daily' },
  { path: '/api-pricing', priority: 0.9, changefreq: 'daily' },
  { path: '/calculator', priority: 0.9, changefreq: 'daily' },
  { path: '/compare/plans', priority: 0.9, changefreq: 'daily' },
  { path: '/quota-changes', priority: 0.6, changefreq: 'daily' },
  { path: '/compare/models', priority: 0.8, changefreq: 'daily' },
  { path: '/compare/video-models', priority: 0.82, changefreq: 'weekly' },
  { path: '/coding-agents', priority: 0.84, changefreq: 'weekly' },
  { path: '/plans', priority: 0.85, changefreq: 'daily' },
  { path: '/providers', priority: 0.85, changefreq: 'daily' },
  { path: '/agents', priority: 0.86, changefreq: 'weekly' },
  { path: '/creative-plans', priority: 0.82, changefreq: 'weekly' },
  { path: '/video-models', priority: 0.84, changefreq: 'weekly' },
  { path: '/music-models', priority: 0.8, changefreq: 'weekly' },
  { path: '/voice-models', priority: 0.78, changefreq: 'weekly' },
  { path: '/image-models', priority: 0.78, changefreq: 'weekly' },
  { path: '/decision-models', priority: 0.78, changefreq: 'weekly' },
  { path: '/world-models', priority: 0.78, changefreq: 'weekly' },
  { path: '/coupons', priority: 0.7, changefreq: 'weekly' },
  { path: '/about', priority: 0.4, changefreq: 'monthly' },
  { path: '/contact', priority: 0.3, changefreq: 'monthly' },
  { path: '/disclosure', priority: 0.3, changefreq: 'monthly' },
  { path: '/methodology', priority: 0.6, changefreq: 'monthly' },
  { path: '/guides', priority: 0.75, changefreq: 'weekly' },
  ...PRICING_GUIDE_SLUGS.map((slug) => ({ path: `/guides/${slug}`, priority: 0.75, changefreq: 'daily' as const })),
  { path: '/reports/api-price-index', priority: 0.8, changefreq: 'daily' },
  { path: '/privacy', priority: 0.3, changefreq: 'monthly' },
  { path: '/terms', priority: 0.3, changefreq: 'monthly' },
  { path: '/submit-provider', priority: 0.4, changefreq: 'monthly' },
  // Note: /compare/api was removed because it only existed as a non-locale
  // route that proxy.ts redirected into a 404. /compare/models and /calculator
  // are locale routes and intentionally remain in the sitemap.
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: UrlEntry[] = [];
  const now = new Date();
  const hasQuotaHistory = quotaChanges(await getVerifiedQuotaEstimates()).length > 0;

  const push = (path: string, priority: number, changeFrequency: UrlEntry['changeFrequency']) => {
    urls.push({ url: `${BASE_URL}${path}`, lastModified: now, changeFrequency, priority });
  };

  // Locale roots and static paths × all locales
  for (const locale of LOCALES) {
    for (const { path, priority, changefreq } of STATIC_PATHS) {
      // Match the history page's noindex policy until a reviewed revision exists.
      if (path === '/quota-changes' && !hasQuotaHistory) continue;
      push(`/${locale}${path}`, priority, changefreq);
    }
  }
  // Provider pages have useful content with plans or available API pricing.
  try {
    const providers = await sql<Array<{ slug: string | null; updated_at: Date | string | null }>>`
      SELECT slug, updated_at FROM providers
      WHERE EXISTS (SELECT 1 FROM plans WHERE plans.provider_id = providers.id)
         OR EXISTS (SELECT 1 FROM api_channel_prices cp WHERE cp.provider_id = providers.id AND cp.is_available = true
           AND EXISTS (SELECT 1 FROM models m WHERE m.id = cp.model_id
             AND (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date)))
      ORDER BY priority ASC NULLS LAST
    `;
    for (const p of providers) {
      if (!p.slug) continue;
      const lastMod = p.updated_at ? new Date(p.updated_at) : now;
      for (const locale of LOCALES) {
        urls.push({
          url: `${BASE_URL}/${locale}/providers/${p.slug}`,
          lastModified: lastMod,
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    }
  } catch (err) {
    console.error('sitemap: failed to query providers', err);
  }

  for (const item of AI_VERTICAL_CATALOG.filter(i => ['video-model', 'music-model', 'world-model', 'decision-model', 'voice-model', 'image-model'].includes(i.kind) && i.slug)) {
    for (const locale of LOCALES) urls.push({ url: `${BASE_URL}/${locale}/${item.kind}s/${item.slug}`,
      lastModified: item.verifiedAt ? new Date(item.verifiedAt) : now, changeFrequency: 'weekly', priority: 0.68 });
  }

  // Dynamic: every LLM model with at least one *available* channel →
  // /[locale]/models/[slug]. The `is_available` predicate is the same one the
  // page uses to build its price table, so a model excluded here is exactly a
  // model whose page would render an empty table and no Product JSON-LD.
  //
  // `type ILIKE '%llm%'` rather than `type = 'llm'`: the column holds
  // 'thinking llm' for the GLM reasoning models and one row is literally 'llm '
  // with a trailing space (gpt-5). An exact match silently dropped all five
  // from the sitemap even though every one of them has channels and renders a
  // full page.
  try {
    const MODEL_LIMIT = 2000;
    const models = await sql<Array<{ slug: string | null; updated_at: Date | string | null }>>`
      SELECT slug, updated_at
      FROM models
      WHERE (shutdown_date IS NULL OR shutdown_date > (now() AT TIME ZONE 'UTC')::date)
        AND type ILIKE '%llm%'
        AND EXISTS (
          SELECT 1 FROM api_channel_prices cp
          WHERE cp.model_id = models.id AND cp.is_available = true
        )
      ORDER BY updated_at DESC NULLS LAST
      LIMIT ${MODEL_LIMIT}
    `;
    if (models.length === MODEL_LIMIT) {
      console.warn(`sitemap: model list hit the ${MODEL_LIMIT} cap — raise it or split the sitemap`);
    }
    const seen = new Set<string>();
    for (const m of models) {
      if (!m.slug || seen.has(m.slug)) continue;
      seen.add(m.slug);
      const lastMod = m.updated_at ? new Date(m.updated_at) : now;
      for (const locale of LOCALES) {
        urls.push({
          url: `${BASE_URL}/${locale}/models/${m.slug}`,
          lastModified: lastMod,
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    }
  } catch (err) {
    console.error('sitemap: failed to query models', err);
  }

  // Keep active DB-only vertical detail URLs alongside the audited catalog.
  try {
    const extras = await sql<Array<{
      slug: string | null;
      model_category: string | null;
      updated_at: Date | string | null;
    }>>`
      SELECT slug, model_category, updated_at
      FROM models
      WHERE (shutdown_date IS NULL OR shutdown_date > (now() AT TIME ZONE 'UTC')::date)
        AND model_category IN ('video', 'music', 'world')
      ORDER BY updated_at DESC NULLS LAST
    `;
    const auditedSlugs = new Set(AI_VERTICAL_CATALOG.map(item => item.slug));
    for (const row of extras.filter(row => row.slug && row.model_category && !auditedSlugs.has(row.slug))) {
      for (const locale of LOCALES) urls.push({ url: `${BASE_URL}/${locale}/${row.model_category}-models/${row.slug}`,
        lastModified: row.updated_at ? new Date(row.updated_at) : now, changeFrequency: 'weekly', priority: 0.68 });
    }
  } catch (error) { console.error('sitemap: failed to query extra vertical models', error); }

  // Dynamic: every LLM model that at least one subscription plan includes →
  // /[locale]/compare/plans/[model]. getPlanComparison only returns null for a
  // slug with no models row, so the page renders for any model that exists —
  // but one with zero model_plan_mapping rows renders a comparison of nothing.
  // Same reasoning as the two blocks above: only advertise pages with content.
  try {
    const comparable = await sql<Array<{
      slug: string;
      released_at: Date | string | null;
      updated_at: Date | string | null;
      plan_count: number;
    }>>`
      SELECT models.slug, models.released_at, models.updated_at,
             count(DISTINCT mpm.plan_id)::int AS plan_count
      FROM models
      JOIN model_plan_mapping mpm ON mpm.model_id = models.id
      JOIN plans ON plans.id = mpm.plan_id
      WHERE (models.shutdown_date IS NULL OR models.shutdown_date > (now() AT TIME ZONE 'UTC')::date)
        AND models.type ILIKE '%llm%'
        AND plans.pricing_model = 'subscription'
      GROUP BY models.id, models.slug, models.released_at, models.updated_at
      ORDER BY models.updated_at DESC NULLS LAST
    `;

    for (const m of selectIndexablePlanComparisons(comparable)) {
      const lastMod = m.updated_at ? new Date(m.updated_at) : now;
      for (const locale of LOCALES) {
        urls.push({
          url: `${BASE_URL}/${locale}/compare/plans/${m.slug}`,
          lastModified: lastMod,
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
    }
  } catch (err) {
    console.error('sitemap: failed to query comparable models', err);
  }

  return urls;
}
