import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

const BASE_URL = 'https://aiplans.dev';
const LOCALES = ['en', 'zh'] as const;

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
  { path: '/compare/models', priority: 0.9, changefreq: 'daily' },
  { path: '/compare/api', priority: 0.9, changefreq: 'daily' },
  { path: '/plans', priority: 0.85, changefreq: 'daily' },
  { path: '/coupons', priority: 0.7, changefreq: 'weekly' },
  { path: '/calculator', priority: 0.7, changefreq: 'monthly' },
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

  // Dynamic: every provider in DB → /plans/[provider]
  try {
    const { data: providers } = await supabase
      .from('providers')
      .select('slug, updated_at')
      .order('priority', { ascending: true });
    for (const p of providers ?? []) {
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

  // Dynamic: every LLM model in DB → /[locale]/models/[slug]
  try {
    const { data: models } = await supabase
      .from('models')
      .select('slug, updated_at')
      .eq('type', 'llm')
      .order('updated_at', { ascending: false })
      .limit(500);
    const seen = new Set<string>();
    for (const m of models ?? []) {
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
