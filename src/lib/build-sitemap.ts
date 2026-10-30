import { AI_VERTICAL_CATALOG } from '@/lib/ai-vertical-catalog';
import { modelLifecycleStatus } from '@/lib/model-shutdown';
import { MetadataRoute } from 'next';
import { isIndexableVerticalDbSlug } from '@/lib/vertical-model-aliases';
import type { AiCatalogKind } from '@/lib/ai-vertical-catalog';
import { sql } from '@/lib/db';
import { selectSeoModels, selectSeoComparisons } from '@/lib/seo-index-policy';
import type { SeoIndexRow } from '@/lib/seo-index-data';
import { getSeoIndexCatalog } from '@/lib/seo-index-data';
import { STATIC_PATHS, resolveStaticLastmod, type ChangeFrequency } from '@/lib/sitemap-static-paths';
import { getVerifiedQuotaEstimates } from '@/lib/quota/data';
import { quotaChanges } from '@/lib/quota/estimates';

const BASE_URL = 'https://aiplans.dev';
const LOCALES = ['en', 'zh'] as const;

interface UrlEntry {
  url: string;
  lastModified?: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
}

/** Newest catalog write that the data-driven fixed pages render. */
async function latestDataUpdate(): Promise<Date | string | null> {
  try {
    const [row] = await sql<Array<{ updated_at: Date | string | null }>>`
      SELECT GREATEST(
        (SELECT max(updated_at) FROM api_channel_prices),
        (SELECT max(updated_at) FROM models),
        (SELECT max(updated_at) FROM plans),
        (SELECT max(updated_at) FROM providers)
      ) AS updated_at
    `;
    return row?.updated_at ?? null;
  } catch (err) {
    console.error('sitemap: failed to query latest data update', err);
    return null;
  }
}

// The read-only report can reproduce the previous candidate set on the same data.
export async function buildSitemap(applyIndexPolicy = true, catalogRows?: SeoIndexRow[], strict = false): Promise<MetadataRoute.Sitemap> {
  const urls: UrlEntry[] = [];
  const now = new Date();
  const [quotaEstimates, dataUpdatedAt] = await Promise.all([getVerifiedQuotaEstimates(), latestDataUpdate()]);
  const hasQuotaHistory = quotaChanges(quotaEstimates).length > 0;

  // Locale roots and static paths × all locales. lastmod is the page's real
  // last change (see sitemap-static-paths.ts), not the request time.
  for (const locale of LOCALES) {
    for (const { path, priority, changefreq, lastmod } of STATIC_PATHS) {
      // Match the history page's noindex policy until a reviewed revision exists.
      if (path === '/quota-changes' && !hasQuotaHistory) continue;
      const lastModified = resolveStaticLastmod(lastmod, { dataUpdatedAt, catalog: AI_VERTICAL_CATALOG, now });
      urls.push({
        url: `${BASE_URL}/${locale}${path}`,
        ...(lastModified ? { lastModified } : {}),
        changeFrequency: changefreq,
        priority,
      });
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
    if (strict) throw err;
    console.error('sitemap: failed to query providers', err);
  }

  for (const item of AI_VERTICAL_CATALOG.filter(i => ['video-model', 'music-model', 'world-model', 'decision-model', 'voice-model', 'image-model'].includes(i.kind) && i.slug
    && modelLifecycleStatus(i.shutdownDate) !== 'retired')) {
    for (const locale of LOCALES) urls.push({ url: `${BASE_URL}/${locale}/${item.kind}s/${item.slug}`,
      lastModified: item.verifiedAt ? new Date(item.verifiedAt) : now, changeFrequency: 'weekly', priority: 0.68 });
  }

  // Shared facts and pure policy also drive generateMetadata on detail pages.
  try {
    const catalog = catalogRows ?? await getSeoIndexCatalog();
    for (const m of selectSeoModels(catalog, applyIndexPolicy)) {
      const lastMod = m.updated_at ? new Date(m.updated_at) : now;
      for (const locale of LOCALES) {
        urls.push({ url: `${BASE_URL}/${locale}/models/${m.slug}`,
          lastModified: lastMod, changeFrequency: 'weekly', priority: 0.7 });
      }
    }
    for (const m of selectSeoComparisons(catalog, applyIndexPolicy)) {
      const lastMod = m.updated_at ? new Date(m.updated_at) : now;
      for (const locale of LOCALES) {
        urls.push({ url: `${BASE_URL}/${locale}/compare/plans/${m.slug}`,
          lastModified: lastMod, changeFrequency: 'weekly', priority: 0.6 });
      }
    }
  } catch (err) {
    if (strict) throw err;
    console.error('sitemap: failed to query SEO index catalog', err);
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
    // Only slugs whose detail route returns 200: Arena benchmark rows
    // (arena-t2v-*) and DB-only world models 404, aliases redirect.
    for (const row of extras.filter(row => row.slug && row.model_category && !auditedSlugs.has(row.slug)
      && isIndexableVerticalDbSlug(`${row.model_category}-model` as AiCatalogKind, row.slug))) {
      for (const locale of LOCALES) urls.push({ url: `${BASE_URL}/${locale}/${row.model_category}-models/${row.slug}`,
        lastModified: row.updated_at ? new Date(row.updated_at) : now, changeFrequency: 'weekly', priority: 0.68 });
    }
  } catch (error) { if (strict) throw error; console.error('sitemap: failed to query extra vertical models', error); }

  return urls;
}
