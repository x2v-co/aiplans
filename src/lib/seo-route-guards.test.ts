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
      for (const locale of ['en', 'zh'] as const) {
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
    for (const name of exports) for (const locale of ['en', 'zh'] as const) {
      for (const slug of ['z-ai-glm-5glm-5.1', 'moonshotai-kimi-k2-thinkingkimi-k2-instruct-0905kimi-k2-base']) {
        await assert.rejects((mod[name] as Route)({ params: Promise.resolve({ locale, slug, model: slug }) }),
          { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });
        assert.equal(reads, 0, 'no stale alias or catalog lookup');
      }
    }
  }
});

function comparisonLoader(rows: policy.SeoIndexFacts[], data: unknown, renamed: string | null = null) {
  return loadQueryModule(new URL('./model-plan-comparison.ts', import.meta.url), {
    react: { cache: (fn: unknown) => fn },
    './compare-plans': { getPlanComparison: async () => data },
    './seo-index-data': { getSeoIndexCatalog: async () => rows },
    './legacy-slug-redirects': legacy,
    './model-slug-redirects': { findModelSlugRedirect: async () => renamed },
  });
}

test('legacy comparison metadata and bodies require actual eligibility and identical shared payload before redirecting', async () => {
  for (const locale of ['en', 'zh'] as const) for (const [slug, target] of [
    ['kimi-k2-thinking', 'moonshotai-kimi-k2-thinking'],
    ['glm-4.6v', 'z-ai-glm-4-6v'], ['gpt-4.1-nano', 'gpt-4.1-nano'],
    ['kimi-k2', 'moonshotai-kimi-k2'], ['kimi-k2.5', 'moonshotai-kimi-k2-5'],
    ['glm-5', 'z-ai-glm-5'], ['glm-4.5', 'z-ai-glm-4-5'],
    ['glm-4.7-flash', 'z-ai-glm-4-7-flash'], ['glm-4.5-air', 'z-ai-glm-4-5-air'],
    ['glm-4.6', 'z-ai-glm-4-6'], ['glm-5v-turbo', 'z-ai-glm-5v-turbo'],
    ['gpt-5.1-codex-max', 'gpt-5.1-codex-max'], ['gpt-5.2-codex', 'gpt-5.2-codex'],
    ['gpt-6.1-sol', 'openai-gpt-6-1-sol'],
  ]) for (const hasPayload of [false, true]) {
    const row: policy.SeoIndexFacts = { slug: target, description: null, active: true, is_llm: true,
      available_api_count: 1, api_price_count: 1, priced_plan_count: 0, usage_price_count: 0,
      plan_count: 0, priced_subscription_count: 0, priced_subscription_provider_count: 0 };
    const data = hasPayload ? { model: { slug: target, name: target }, officialPlans: [], thirdPartyPlans: [] } : null;
    const mocks = { '@/lib/model-plan-comparison': comparisonLoader([row], data),
      '@/lib/model-names': modelNames,
      '@/lib/coupons': { getActiveCouponMap: async () => ({}) },
      '@/lib/pricing-guides': { guideForModelSlug: () => null },
      '@/lib/quota/data': { getVerifiedQuotaEstimates: async () => [] },
      './faqs': { buildCompareFaqs: () => [] },
    };
    for (const [url, name] of [[compareMetaUrl, 'generateMetadata'], [compareUrl, 'default']] as const) {
      const run = loadRoute(url, mocks)[name] as Route;
      const params = Promise.resolve({ locale, slug, model: slug });
      if (hasPayload && policy.modelShouldIndex(row)) await assert.rejects(run({ params }),
        { digest: `NEXT_REDIRECT;replace;/${locale}/models/${target};308;` });
      else {
        const result = await run({ params });
        assert.ok(result, 'accessible fallback');
        if (name === 'generateMetadata') {
          const metadata = result as ReturnType<typeof seo.buildMetadata>;
          assert.equal(typeof metadata.robots === 'object' && metadata.robots?.index, false);
          assert.equal(typeof metadata.robots === 'object' && metadata.robots?.follow, true);
        }
      }
    }
  }
});

test('actual sitemap builder excludes qualifying prefixed glued rows and keeps distinct single-model details', async () => {
  const malformed = ['z-ai-glm-5glm-5.1', 'moonshotai-kimi-k2-thinkingkimi-k2-instruct-0905kimi-k2-base'];
  const valid = ['qwen-qwen3-8-27b', 'deepseek-v4-pro', 'moonshotai-kimi-k2-thinking'];
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
    '@/lib/seo-index-data': { getSeoIndexCatalog: async () => catalog, getSeoProviderCatalog: async () => [] },
    '@/lib/sitemap-static-paths': { STATIC_PATHS: [] },
    '@/lib/quota/data': { getVerifiedQuotaEstimates: async () => [] },
    '@/lib/quota/estimates': { quotaChanges: () => [] },
  });
  const urls = (await (mod.buildSitemap as () => Promise<Array<{ url: string }>>)()).map(row => row.url);
  for (const slug of malformed) assert.ok(urls.every(url => !url.endsWith(`/${slug}`)), slug);
  for (const locale of ['en', 'zh'] as const) for (const slug of valid) {
    assert.ok(urls.includes(`${seo.SITE_URL}/${locale}/models/${slug}`), slug);
  }
});

test('model metadata keeps batch policy and distinct thinking/free identities with query-free alternates', async () => {
  for (const locale of ['en', 'zh'] as const) {
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
      assert.equal(typeof metadata.robots === 'object' && metadata.robots?.index, policy.modelShouldIndex(row));
      assert.equal(typeof metadata.robots === 'object' && metadata.robots?.follow, true);
      if (slug.includes('thinking')) assert.match(String(metadata.title), /Thinking/i);
      if (slug.endsWith('-free')) assert.match(String(metadata.title), /Free/i);
    }
  }
});

test('comparison route metadata and body redirect only after exact shared payload parity, otherwise keep a noindex page', async () => {
  for (const locale of ['en', 'zh'] as const) for (const [slug, payloadSlug, indexable] of [
    ['gpt-5.2', 'gpt-5.2', true],
    ['gpt-5.2', 'gpt-5.3-codex', false],
    ['inclusionai-ling-3-2-flash-free', 'inclusionai-ling-3-2-flash', false],
    ['qwen-qwen3-next-80b-a3b-instruct', 'qwen-qwen3-next-80b-a3b-instruct', false],
    ['an-existing-unselected-model', 'an-existing-unselected-model', false],
    ['claude-3.7-sonnet-(thinking)', 'claude-3.7-sonnet', false],
  ] as const) {
    const row: policy.SeoIndexFacts = { slug, description: null, active: true, is_llm: true,
      available_api_count: 1, api_price_count: 1, priced_plan_count: 0, usage_price_count: 0,
      plan_count: 2, priced_subscription_count: 2, priced_subscription_provider_count: 2 };
    const comparison = { model: { slug: payloadSlug, name: payloadSlug }, officialPlans: [], thirdPartyPlans: [] };
    const mocks = {
      '@/lib/seo-index-data': { getSeoIndexCatalog: async () => [row] },
      '@/lib/model-plan-comparison': comparisonLoader([row], comparison),
      '@/lib/pricing-seo-data': { getComparisonSeoData: async () => ({ model: comparison.model, plans: [] }) },
      '@/lib/pricing-seo': { buildComparisonPricingCopy: () => ({ title: slug, description: slug }) },
      '@/lib/coupons': { getActiveCouponMap: async () => ({}) },
      '@/lib/pricing-guides': { guideForModelSlug: () => null },
      '@/lib/quota/data': { getVerifiedQuotaEstimates: async () => [] },
      '@/lib/model-names': modelNames,
      './faqs': { buildCompareFaqs: () => [] },
      './compare-plans-view': { __esModule: true, default: () => null },
    };
    const params = Promise.resolve({ locale, slug, model: encodeURIComponent(slug) });
    const metadataRoute = loadRoute(compareMetaUrl, mocks).generateMetadata as Route;
    const bodyRoute = loadRoute(compareUrl, mocks).default as Route;
    if (indexable) {
      for (const route of [metadataRoute, bodyRoute]) await assert.rejects(route({ params }),
        { digest: `NEXT_REDIRECT;replace;/${locale}/models/${slug};308;` });
    } else {
      const metadata = await metadataRoute({ params }) as ReturnType<typeof seo.buildMetadata>;
      assert.equal(typeof metadata.robots === 'object' && metadata.robots?.index, false);
      assert.equal(typeof metadata.robots === 'object' && metadata.robots?.follow, true);
      assert.equal(metadata.alternates?.canonical, `${seo.SITE_URL}/${locale}/compare/plans/${slug}`);
      assert.ok(await bodyRoute({ params }), 'existing comparison renders without redirect/notFound');
    }
  }
});

test('DB renames and direct legacy model entry points render same identity noindex when the target is excluded', async () => {
  const long = 'an-existing-model-with-a-legitimate-provider-prefixed-identity-over-fifty-five-characters';
  for (const [slug, target, legacyAlias] of [['old-id', long, false],
    ['minimax-m3.1', 'minimax-m3.1-flash', true],
    ['embeddinggemma-2', 'cloudflare-embeddinggemma-2', true],
    ['qwen3-coder-next', 'qwen-qwen3-coder-next', true],
    ['glm-5.1', 'z-ai-glm-5-1', true]] as const) {
    for (const locale of ['en', 'zh'] as const) {
      let targetRead = false;
      const mod = loadRoute(modelUrl, {
        '@/lib/db': { sql: async (strings: TemplateStringsArray, value: string) => {
          if (strings.join('').includes('SELECT id, name') && value === target) {
            targetRead = true; return [{ id: 1, name: target, updated_at: null, pricing_unit: 'per_1m_tokens' }];
          }
          return [];
        } },
        '@/lib/seo-redirects': { seoDestinationIndexable: async () => false },
        '@/lib/model-slug-redirects': { findModelSlugRedirect: async () => legacyAlias ? null : target },
        '@/lib/seo-index-data': { getSeoIndexCatalog: async () => [] },
        '@/lib/model-names': modelNames,
        '@/lib/model-pricing-seo': modelPricing,
        '@/lib/model-usage-prices-query': { getModelUsagePrices: async () => [] },
        '@/lib/model-usage-prices': { availableUsagePrices: () => [], pricingSeoUsage: () => undefined },
      });
      const metadata = await (mod.generateMetadata as Route)({ params: Promise.resolve({ locale, slug, model: slug }) }) as ReturnType<typeof seo.buildMetadata>;
      assert.equal(targetRead, true, target);
      assert.equal(typeof metadata.robots === 'object' && metadata.robots?.index, false);
      assert.equal(typeof metadata.robots === 'object' && metadata.robots?.follow, true);
      assert.equal(metadata.alternates?.canonical, `${seo.SITE_URL}/${locale}/models/${target}`);
    }
  }
});

test('provider metadata uses the same existence/content candidate set and stable selection as the sitemap', async () => {
  const url = new URL('../app/[locale]/providers/[slug]/catalog-page.tsx', import.meta.url);
  for (const locale of ['en', 'zh'] as const) for (const [slug, available, expected] of [
    ['openai', true, true], ['openai', false, false], ['unselected-existing-provider', true, false],
  ] as const) {
    const mod = loadRoute(url, {
      '@/lib/db': { sql: async () => [{ id: 1, name: slug }] },
      '@/lib/seo-index-data': { getSeoProviderCatalog: async () => available ? [{ slug }] : [] },
      '@/lib/pricing-seo-data': { getProviderSeoPlans: async () => [] },
      '@/lib/pricing-seo': { buildProviderPricingCopy: () => ({ title: slug, description: slug }) },
    });
    const metadata = await (mod.generateMetadata as Route)({ params: Promise.resolve({ locale, slug, model: slug }) }) as ReturnType<typeof seo.buildMetadata>;
    assert.equal(typeof metadata.robots === 'object' && metadata.robots?.index, expected);
    assert.equal(typeof metadata.robots === 'object' && metadata.robots?.follow, true);
    assert.equal(metadata.alternates?.canonical, `${seo.SITE_URL}/${locale}/providers/${slug}`);
  }
});

test('all seven modality metadata routes serve excluded details with noindex/follow and selected details with index/follow', async () => {
  const selected: Record<string, string> = { video: 'veo-3-1', music: 'suno', world: 'genie-3',
    decision: 'cloudflare-clef', embedding: 'gemini-embedding-2', voice: 'eleven-v4', image: 'gpt-image-2' };
  for (const locale of ['en', 'zh'] as const) for (const [kind, chosen] of Object.entries(selected)) {
    const shared = ['voice', 'image'].includes(kind);
    const url = shared ? new URL('../components/non-llm-pages.tsx', import.meta.url)
      : new URL(`../app/[locale]/${kind}-models/[slug]/page.tsx`, import.meta.url);
    for (const [slug, retired, expected] of [[chosen, false, true], [chosen, true, false], ['unselected-existing-detail', false, false]] as const) {
      const mod = loadRoute(url, {
        '@/lib/vertical-model-detail': { getVerticalModelDetail: async () => ({ item: {
          slug, name: slug, shutdownDate: retired ? '2000-01-01' : undefined,
        } }) },
        '@/components/non-llm-catalog': { nonLlmCopy: () => ({}) },
      });
      const params = Promise.resolve({ locale, slug, model: slug });
      const metadata = await (shared
        ? (mod.nonLlmMetadata as (kind: string, params: Promise<Params>) => Promise<unknown>)(`${kind}-model`, params)
        : (mod.generateMetadata as Route)({ params })) as ReturnType<typeof seo.buildMetadata>;
      assert.equal(typeof metadata.robots === 'object' && metadata.robots?.index, expected, `${kind}/${slug}`);
      assert.equal(typeof metadata.robots === 'object' && metadata.robots?.follow, true);
      assert.equal(metadata.alternates?.canonical, `${seo.SITE_URL}/${locale}/${kind}-models/${slug}`);
    }
  }
});
