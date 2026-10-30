import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { AI_VERTICAL_CATALOG } from '../src/lib/ai-vertical-catalog';
import { modelLifecycleStatus } from '../src/lib/model-shutdown';
import { STATIC_PATHS } from '../src/lib/sitemap-static-paths';
import {
  isLowValueModel, isLowValuePlanComparison, modelShouldIndex,
  selectSeoModels, selectSeoComparisons, type SeoIndexFacts,
} from '../src/lib/seo-index-policy';

const BASE = 'https://aiplans.dev';
const localized = (path: string) => ['en', 'zh'].map(locale => `${BASE}/${locale}${path}`);

export function catalogUrls(rows: SeoIndexFacts[], applyPolicy: boolean): string[] {
  return [
    ...selectSeoModels(rows, applyPolicy).flatMap(row => localized(`/models/${row.slug}`)),
    ...selectSeoComparisons(rows, applyPolicy).flatMap(row => localized(`/compare/plans/${row.slug}`)),
  ];
}

export function indexReport(rows: SeoIndexFacts[], beforeUrls: string[], afterUrls: string[]) {
  const before = new Set(beforeUrls);
  const after = new Set(afterUrls);
  const comparisonSlugs = new Set(selectSeoComparisons(rows).map(row => row.slug));
  return {
    before: before.size,
    after: after.size,
    removed: [...before].filter(url => !after.has(url)).sort(),
    added: [...after].filter(url => !before.has(url)).sort(),
    // Includes noindex pages that were already absent from the old sitemap.
    noindex: rows.flatMap(row => {
      const entries: Array<{ url: string; reason: string }> = [];
      if (!modelShouldIndex(row)) {
        for (const url of localized(`/models/${row.slug}`)) entries.push({ url,
          reason: isLowValueModel(row) ? 'no prices and no independent description' : 'retired or invalid slug' });
      }
      if (!comparisonSlugs.has(row.slug)) {
        for (const url of localized(`/compare/plans/${row.slug}`)) entries.push({ url,
          reason: isLowValuePlanComparison(row) ? 'fewer than two priced subscriptions or two priced vendors'
            : 'retired, non-LLM, invalid/operational variant, or superseded release' });
      }
      return entries;
    }).sort((a, b) => a.url.localeCompare(b.url)),
  };
}

/** Real checked-in snapshots, not an invented production model/plan inventory.
 * Arena contains names/benchmarks but no prices or authored descriptions.
 * Only the Anthropic pricing snapshot proves API availability here. No offline
 * snapshot establishes subscription mappings, so none are invented.
 */
export async function offlineCatalog(): Promise<SeoIndexFacts[]> {
  const arena = JSON.parse(await readFile(new URL('../ARENA_LEADERBOARD_DATA.json', import.meta.url), 'utf8')) as {
    categories: Array<{ models: Array<{ modelName: string }> }>;
  };
  const pricing = JSON.parse(await readFile(new URL('../ANTHROPIC_PRICING_DATA.json', import.meta.url), 'utf8')) as {
    models: Array<{ alias: string; inputPricePer1M?: number; outputPricePer1M?: number }>;
  };
  const knownPrice = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const slugs = new Set([...arena.categories.flatMap(category => category.models.map(model => model.modelName)),
    ...pricing.models.map(model => model.alias)]);
  return [...slugs].map(slug => {
    const prices = pricing.models.filter(model => model.alias === slug
      && (knownPrice(model.inputPricePer1M) || knownPrice(model.outputPricePer1M)));
    return { slug, description: null, active: true, is_llm: true,
      available_api_count: prices.length, api_price_count: prices.length,
      priced_plan_count: 0, usage_price_count: 0, plan_count: 0,
      priced_subscription_count: 0, priced_subscription_provider_count: 0 };
  });
}

export async function runReport() {
  if (process.env.DATABASE_URL && !process.argv.includes('--offline')) {
    // Imports are lazy: offline mode never opens a database connection.
    const { sql } = await import('../src/lib/db');
    try {
      const { getSeoIndexCatalog } = await import('../src/lib/seo-index-data');
      const { buildSitemap } = await import('../src/lib/build-sitemap');
      const rows = await getSeoIndexCatalog();
      const before = (await buildSitemap(false, rows, true)).map(entry => entry.url);
      const policyUrls = new Set(catalogUrls(rows, true));
      const dynamicDetail = /^https:\/\/aiplans\.dev\/(en|zh)\/(models\/[^/]+|compare\/plans\/[^/]+)$/;
      const after = before.filter(url => !dynamicDetail.test(url) || policyUrls.has(url));
      return { source: 'DATABASE_URL (read-only)', scope: 'full sitemap, same data snapshot for both policies',
        ...indexReport(rows, before, after) };
    } finally {
      await sql.end();
    }
  }
  const rows = await offlineCatalog();
  const unchanged = [
    ...STATIC_PATHS.filter(entry => entry.path !== '/quota-changes').flatMap(entry => localized(entry.path)),
    ...AI_VERTICAL_CATALOG.filter(item => item.slug
      && ['video-model', 'music-model', 'world-model', 'decision-model', 'voice-model', 'image-model'].includes(item.kind)
      && modelLifecycleStatus(item.shutdownDate) !== 'retired')
      .flatMap(item => localized(`/${item.kind}s/${item.slug}`)),
  ];
  return {
    source: 'offline: ARENA_LEADERBOARD_DATA.json, ANTHROPIC_PRICING_DATA.json, STATIC_PATHS, AI_VERTICAL_CATALOG',
    scope: 'partial offline sitemap only; NOT production totals or evidence of current availability',
    limitations: 'No DATABASE_URL: historical snapshots lack subscription mappings, provider pages, DB-only verticals and quota history. Counts apply only to reconstructable URLs; noindex lists missing evidence in these snapshots, not confirmed production removals. Use DATABASE_URL for actionable totals.',
    ...indexReport(rows, [...unchanged, ...catalogUrls(rows, false)], [...unchanged, ...catalogUrls(rows, true)]),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReport().then(report => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
    .catch(error => { console.error('SEO index report failed:', error.message); process.exitCode = 1; });
}
