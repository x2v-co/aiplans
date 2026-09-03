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
  { path: '/compare/models', priority: 0.8, changefreq: 'daily' },
  { path: '/plans', priority: 0.85, changefreq: 'daily' },
  { path: '/coupons', priority: 0.7, changefreq: 'weekly' },
  { path: '/about', priority: 0.4, changefreq: 'monthly' },
  { path: '/contact', priority: 0.3, changefreq: 'monthly' },
  { path: '/disclosure', priority: 0.3, changefreq: 'monthly' },
  { path: '/methodology', priority: 0.6, changefreq: 'monthly' },
  { path: '/privacy', priority: 0.3, changefreq: 'monthly' },
  { path: '/terms', priority: 0.3, changefreq: 'monthly' },
  // Note: /compare/api was removed — it only existed as a non-locale route
  // that got redirected into the 404 void by proxy.ts (no
  // /[locale]/compare/api target exists). Drop /calculator too until there's
  // an actual implementation. /compare/models was rebuilt as a locale route.
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
      WHERE type ILIKE '%llm%'
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

  // Dynamic: every LLM model that at least one subscription plan includes →
  // /[locale]/compare/plans/[model]. getPlanComparison only returns null for a
  // slug with no models row, so the page renders for any model that exists —
  // but one with zero model_plan_mapping rows renders a comparison of nothing.
  // Same reasoning as the two blocks above: only advertise pages with content.
  try {
    const comparable = await sql<Array<{ slug: string | null; updated_at: Date | string | null }>>`
      SELECT slug, updated_at
      FROM models
      WHERE type ILIKE '%llm%'
        AND EXISTS (
          SELECT 1 FROM model_plan_mapping mpm WHERE mpm.model_id = models.id
        )
      ORDER BY updated_at DESC NULLS LAST
    `;
    // getModelSlugCandidates() treats `claude-opus-4.6` and `claude-opus-4-6`
    // as the same model, so both slugs resolve to the same plan set and would
    // be two URLs serving one page. Collapse them to whichever row is freshest.
    const seenKey = new Set<string>();
    for (const m of comparable) {
      if (!m.slug) continue;
      const key = m.slug.replace(/(\d)\.(\d)/g, '$1-$2');
      if (seenKey.has(key)) continue;
      seenKey.add(key);
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
