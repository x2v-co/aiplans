import { MetadataRoute } from 'next';
import { sql } from '@/lib/db';

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
  { path: '/api-pricing', priority: 0.9, changefreq: 'daily' },
  { path: '/compare/plans', priority: 0.9, changefreq: 'daily' },
  { path: '/plans', priority: 0.85, changefreq: 'daily' },
  { path: '/coupons', priority: 0.7, changefreq: 'weekly' },
  // Note: /compare/models and /compare/api were removed — they only
  // existed as non-locale routes that got redirected into the 404
  // void by proxy.ts (no /[locale]/compare/{api,models} target exists).
  // Drop /calculator too until there's an actual implementation.
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: UrlEntry[] = [];
  const now = new Date();

  const push = (path: string, priority: number, changeFrequency: UrlEntry['changeFrequency']) => {
    urls.push({ url: `${BASE_URL}${path}`, lastModified: now, changeFrequency, priority });
  };

  // Locale roots and static paths × all locales
  for (const locale of LOCALES) {
    for (const { path, priority, changefreq } of STATIC_PATHS) {
      push(`/${locale}${path}`, priority, changefreq);
    }
  }
  // Non-locale convenience paths (mostly redirect to /en)
  for (const { path, priority, changefreq } of STATIC_PATHS) {
    if (path) push(path, Math.max(priority - 0.1, 0.5), changefreq);
  }

  // Dynamic: every provider that actually has plans → /plans/[provider].
  // The page renders for any existing provider slug, but one with zero plan
  // rows is a blank lineup — thin content we shouldn't be asking Google to
  // index. 17 of 29 providers were in that state when this filter was added.
  try {
    const providers = await sql<Array<{ slug: string | null; updated_at: Date | string | null }>>`
      SELECT slug, updated_at FROM providers
      WHERE EXISTS (SELECT 1 FROM plans WHERE plans.provider_id = providers.id)
      ORDER BY priority ASC NULLS LAST
    `;
    for (const p of providers) {
      if (!p.slug) continue;
      const lastMod = p.updated_at ? new Date(p.updated_at) : now;
      for (const locale of LOCALES) {
        urls.push({
          url: `${BASE_URL}/${locale}/plans/${p.slug}`,
          lastModified: lastMod,
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
      urls.push({
        url: `${BASE_URL}/plans/${p.slug}`,
        lastModified: lastMod,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
  } catch (err) {
    console.error('sitemap: failed to query providers', err);
  }

  // Dynamic: every LLM model with at least one *available* channel →
  // /[locale]/models/[slug]. The `is_available` predicate is the same one the
  // page uses to build its price table, so a model excluded here is exactly a
  // model whose page would render an empty table and no Product JSON-LD.
  try {
    const MODEL_LIMIT = 2000;
    const models = await sql<Array<{ slug: string | null; updated_at: Date | string | null }>>`
      SELECT slug, updated_at
      FROM models
      WHERE type = 'llm'
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

  return urls;
}
