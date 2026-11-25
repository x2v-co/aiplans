import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import * as navigation from 'next/navigation';
import * as glued from './glued-model-slug';
import * as legacy from './legacy-slug-redirects';
import * as routeParams from './route-params';
import * as seo from './seo';
import * as policy from './seo-index-policy';
import * as modelNames from './model-names';
import * as modelPricing from './model-pricing-seo';
import { loadQueryModule } from './test-helpers/query-module';

const modelUrl = new URL('../app/[locale]/models/[slug]/page.tsx', import.meta.url);
const compareUrl = new URL('../app/[locale]/compare/plans/[model]/page.tsx', import.meta.url);
const compareMetaUrl = new URL('../app/[locale]/compare/plans/[model]/layout.tsx', import.meta.url);

// These probes execute the real exported routes. Unrelated rendering and data
// imports are unavailable, so passing the early 404 gate would fail the test.
function loadRoute(url: URL, overrides: Record<string, unknown> = {}) {
  const source = ts.createSourceFile(url.pathname, readFileSync(url, 'utf8'), ts.ScriptTarget.Latest);
  const mocks: Record<string, unknown> = {};
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      mocks[statement.moduleSpecifier.text] = {};
    }
  }
  return loadQueryModule(url, {
    ...mocks,
    'next/navigation': navigation,
    '@/lib/glued-model-slug': glued,
    '@/lib/legacy-slug-redirects': legacy,
    '@/lib/route-params': routeParams,
    '@/lib/seo': seo,
    '@/lib/seo-index-policy': policy,
    ...overrides,
  });
}

type Params = { locale: string; slug: string; model: string };
type Route = (props: { params: Promise<Params>; searchParams?: Promise<Record<string, string>> }) => Promise<unknown>;

test('ambiguous multi-model URLs 404 in both metadata and page before catalog or alias reads', async () => {
  for (const [url, exports] of [[modelUrl, ['generateMetadata', 'default']],
    [compareUrl, ['default']], [compareMetaUrl, ['generateMetadata']]] as const) {
    const mod = loadRoute(url);
    for (const name of exports) {
      for (const locale of ['en', 'zh']) {
        for (const slug of ['kimi-k2-thinkingkimi-k2-instruct-0905kimi-k2-instructkimi-k2-base',
          'glm-5glm-5.1', '%67lm-5glm-5.1', 'glm-99glm-100', 'z-ai-glm-5glm-5.1',
          'moonshotai-kimi-k2-thinkingkimi-k2-instruct-0905kimi-k2-base', '%7A-ai-glm-5glm-5.1']) {
          await assert.rejects((mod[name] as Route)({ params: Promise.resolve({ locale, slug, model: slug }) }),
            { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' }, `${url.pathname}:${name}:${locale}:${slug}`);
        }
      }
    }
  }
});

test('prefixed concatenations stop before stale aliases or catalog reads in all four route entry points', async () => {
  let reads = 0;
  const read = async () => { reads++; return []; };
  const absent = async () => { reads++; return null; };
  for (const [url, exports] of [[modelUrl, ['generateMetadata', 'default']],
    [compareUrl, ['default']], [compareMetaUrl, ['generateMetadata']]] as const) {
    const mod = loadRoute(url, {
      '@/lib/db': { sql: read },
      '@/lib/model-slug-redirects': { findModelSlugRedirect: async () => { reads++; return 'z-ai-glm-5'; } },
      '@/lib/pricing-seo-data': { getComparisonSeoData: absent },
      '@/lib/compare-plans': { getPlanComparison: absent },
      '@/lib/seo-index-data': { getSeoIndexCatalog: read },
      '@/lib/coupons': { getActiveCouponMap: read },
    });
    for (const name of exports) for (const locale of ['en', 'zh']) {
      for (const slug of ['z-ai-glm-5glm-5.1', 'moonshotai-kimi-k2-thinkingkimi-k2-instruct-0905kimi-k2-base']) {
        await assert.rejects((mod[name] as Route)({ params: Promise.resolve({ locale, slug, model: slug }) }),
          { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });
        assert.equal(reads, 0, 'no stale alias or catalog lookup');
      }
    }
  }
});

test('exact-model legacy repairs redirect comparison metadata and bodies without reading catalog data', async () => {
  for (const url of [compareMetaUrl, compareUrl]) {
    const mod = loadRoute(url);
    const run = mod[url === compareMetaUrl ? 'generateMetadata' : 'default'] as Route;
    for (const locale of ['en', 'zh']) for (const [slug, target] of [
      ['kimi-k2-thinking', 'moonshotai-kimi-k2-thinking'],
      ['glm-4.6v', 'z-ai-glm-4-6v'], ['gpt-4.1-nano', 'gpt-4.1-nano'],
      ['kimi-k2', 'moonshotai-kimi-k2'], ['kimi-k2.5', 'moonshotai-kimi-k2-5'],
      ['glm-5', 'z-ai-glm-5'], ['glm-4.5', 'z-ai-glm-4-5'],
      ['glm-4.7-flash', 'z-ai-glm-4-7-flash'], ['glm-4.5-air', 'z-ai-glm-4-5-air'],
      ['glm-4.6', 'z-ai-glm-4-6'], ['glm-5v-turbo', 'z-ai-glm-5v-turbo'],
      ['gpt-5.1-codex-max', 'gpt-5.1-codex-max'], ['gpt-5.2-codex', 'gpt-5.2-codex'],
    ]) {
      await assert.rejects(run({ params: Promise.resolve({ locale, slug, model: slug }) }),
        { digest: `NEXT_REDIRECT;replace;/${locale}/models/${target};308;` });
    }
  }
});

test('actual sitemap builder excludes qualifying prefixed glued rows and keeps distinct single-model details', async () => {
  const malformed = ['z-ai-glm-5glm-5.1', 'moonshotai-kimi-k2-thinkingkimi-k2-instruct-0905kimi-k2-base'];
  const valid = ['qwen-qwen3-8-27b', 'deepseek-deepseek-v4', 'moonshotai-kimi-k2-thinking'];
  const catalog = [...malformed, ...valid].map(slug => ({
    slug, description: null, active: true, is_llm: true, available_api_count: 1, api_price_count: 1,
    priced_plan_count: 0, usage_price_count: 0, plan_count: 3,
    priced_subscription_count: 3, priced_subscription_provider_count: 2, updated_at: null,
  }));
  const mod = loadQueryModule(new URL('./build-sitemap.ts', import.meta.url), {
    './plan-lifecycle-query': { currentPlanCondition: () => true },
    '@/lib/ai-vertical-catalog': { AI_VERTICAL_CATALOG: [] },
    '@/lib/model-shutdown': { modelLifecycleStatus: () => 'active' },
    '@/lib/vertical-model-aliases': { isIndexableVerticalDbSlug: () => false },
    '@/lib/db': { sql: async () => [] },
    '@/lib/seo-index-policy': policy,
    '@/lib/seo-index-data': { getSeoIndexCatalog: async () => catalog },
    '@/lib/sitemap-static-paths': { STATIC_PATHS: [] },
    '@/lib/quota/data': { getVerifiedQuotaEstimates: async () => [] },
    '@/lib/quota/estimates': { quotaChanges: () => [] },
  });
  const urls = (await (mod.buildSitemap as () => Promise<Array<{ url: string }>>)()).map(row => row.url);
  for (const slug of malformed) assert.ok(urls.every(url => !url.endsWith(`/${slug}`)), slug);
  for (const locale of ['en', 'zh']) for (const slug of valid) {
    assert.ok(urls.includes(`${seo.SITE_URL}/${locale}/models/${slug}`), slug);
  }
});

test('model metadata keeps batch policy and distinct thinking/free identities with query-free alternates', async () => {
  for (const locale of ['en', 'zh']) {
    for (const slug of ['gpt-5-(batch)', 'gpt-5.2-(batch)', 'claude-opus-5:batch',
      'claude-3.7-sonnet-(thinking)', 'inclusionai-ling-3-2-flash-free',
      'moonshotai-kimi-k2-thinking', 'z-ai-glm-4-6v', 'qwen-qwen3-8-27b', 'deepseek-deepseek-v4']) {
      const row: policy.SeoIndexFacts = {
        slug, description: null, active: true, is_llm: true,
        available_api_count: 1, api_price_count: 1, priced_plan_count: 0, usage_price_count: 0,
        plan_count: 0, priced_subscription_count: 0, priced_subscription_provider_count: 0,
      };
      const mod = loadRoute(modelUrl, {
        '@/lib/db': { sql: async (strings: TemplateStringsArray) => strings.join('').includes('SELECT id, name')
          ? [{ id: 1, name: slug, updated_at: null, pricing_unit: 'per_1m_tokens' }] : [] },
        '@/lib/seo-index-data': { getSeoIndexCatalog: async () => [row] },
        '@/lib/model-names': modelNames,
        '@/lib/model-pricing-seo': modelPricing,
        '@/lib/model-usage-prices-query': { getModelUsagePrices: async () => [] },
        '@/lib/model-usage-prices': { availableUsagePrices: () => [], pricingSeoUsage: () => undefined },
      });
      const metadata = await (mod.generateMetadata as Route)({
        params: Promise.resolve({ locale, slug: encodeURIComponent(slug), model: slug }),
        searchParams: Promise.resolve({ utm_source: 'gsc', period: 'yearly', q: 'test' }),
      }) as ReturnType<typeof seo.buildMetadata>;
      assert.equal(metadata.alternates?.canonical, `${seo.SITE_URL}/${locale}/models/${slug}`);
      assert.deepEqual(metadata.alternates?.languages, {
        en: `${seo.SITE_URL}/en/models/${slug}`, 'en-US': `${seo.SITE_URL}/en/models/${slug}`,
        'zh-CN': `${seo.SITE_URL}/zh/models/${slug}`, 'zh-Hans': `${seo.SITE_URL}/zh/models/${slug}`,
        'x-default': `${seo.SITE_URL}/en/models/${slug}`,
      });
      assert.equal(typeof metadata.robots === 'object' && metadata.robots?.index, !policy.isBatchVariantSlug(slug));
      assert.equal(typeof metadata.robots === 'object' && metadata.robots?.follow, true);
      if (slug.includes('thinking')) assert.match(String(metadata.title), /Thinking/i);
      if (slug.endsWith('-free')) assert.match(String(metadata.title), /Free/i);
    }
  }
});
