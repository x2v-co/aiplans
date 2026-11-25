import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import snapshot from './fixtures/seo-public-sitemap-2026-11-25.json';
import { AI_VERTICAL_CATALOG, type AiCatalogKind } from './ai-vertical-catalog';
import { STATIC_PATHS } from './sitemap-static-paths';
import * as staticPaths from './sitemap-static-paths';
import * as policy from './seo-index-policy';
import * as verticalAliases from './vertical-model-aliases';
import * as lifecycle from './model-shutdown';
import * as seo from './seo';
import { loadQueryModule } from './test-helpers/query-module';

// Synthetic quality facts exercise the real builder against public URL identities.
// The frozen sitemap proves these rows were eligible at collection, but this
// fixture is not a DB export and does not claim live prices or HTTP status.
const row = (slug: string): policy.SeoIndexFacts => ({ slug, description: null,
  active: true, is_llm: true, available_api_count: 1, api_price_count: 1,
  priced_plan_count: 0, usage_price_count: 0, plan_count: 0,
  priced_subscription_count: 0, priced_subscription_provider_count: 0,
});
const catalog = snapshot.sections.models.map(slug => ({ ...row(slug), updated_at: null }));

async function sitemap(rows = catalog) {
  const mod = loadQueryModule(new URL('./build-sitemap.ts', import.meta.url), {
    '@/lib/ai-vertical-catalog': { AI_VERTICAL_CATALOG },
    '@/lib/model-shutdown': lifecycle,
    '@/lib/vertical-model-aliases': verticalAliases,
    '@/lib/db': { sql: async () => [] },
    '@/lib/seo-index-policy': policy,
    '@/lib/seo-index-data': { getSeoIndexCatalog: async () => rows,
      getSeoProviderCatalog: async () => snapshot.sections.providers.map(slug => ({ slug, updated_at: null })) },
    '@/lib/sitemap-static-paths': staticPaths,
    '@/lib/quota/data': { getVerifiedQuotaEstimates: async () => [] },
    '@/lib/quota/estimates': { quotaChanges: () => [] },
  });
  return (mod.buildSitemap as () => Promise<Array<{ url: string }>>)();
}

test('frozen public snapshot budget is deterministic, localized and has no comparison details', async () => {
  const first = Array.from(await sitemap()).map(entry => entry.url).sort();
  const reordered = Array.from(await sitemap([...catalog].reverse())).map(entry => entry.url).sort();
  assert.deepEqual(first, reordered);
  assert.equal(first.length, new Set(first).size);
  assert.equal(first.length, 326);
  assert.ok(first.length >= 250 && first.length <= 350, String(first.length));
  assert.ok(first.length <= 400);
  assert.ok(first.every(url => !url.includes('/compare/plans/')));
  assert.equal(first.filter(url => url.includes('/en/')).length, first.filter(url => url.includes('/zh/')).length);
  for (const locale of ['en', 'zh'] as const) for (const { path } of STATIC_PATHS.filter(p => p.path !== '/quota-changes')) {
    assert.ok(first.includes(`${seo.SITE_URL}/${locale}${path}`), path);
  }
  const upperBound = 2 * (STATIC_PATHS.length + policy.SEO_MODEL_ALLOWLIST.size
    + policy.SEO_PROVIDER_ALLOWLIST.size + Object.values(policy.SEO_VERTICAL_ALLOWLIST).flat().length);
  assert.ok(upperBound <= 350, String(upperBound));
});

test('selected IDs are actual public snapshot/catalog identities, with two explicitly known Kimi details', () => {
  const publicModels = new Set(snapshot.sections.models);
  const knownProviderLinks = new Set(['moonshotai-kimi-k2', 'moonshotai-kimi-k2-thinking']);
  for (const slug of policy.SEO_MODEL_ALLOWLIST) assert.ok(publicModels.has(slug) || knownProviderLinks.has(slug), slug);
  for (const slug of policy.SEO_PROVIDER_ALLOWLIST) assert.ok(snapshot.sections.providers.includes(slug), slug);
  for (const [kind, slugs] of Object.entries(policy.SEO_VERTICAL_ALLOWLIST)) for (const slug of slugs) {
    assert.ok(AI_VERTICAL_CATALOG.some(item => item.kind === kind && item.slug === slug), `${kind}/${slug}`);
    assert.ok((snapshot.sections as Record<string, string[]>)[`${kind}s`].includes(slug), slug);
  }
});

test('model sitemap/metadata policy agrees for selected, excluded, retired, plan-only and real long identities', async () => {
  const long = 'cognitivecomputations-dolphin-mistral-24b-venice-edition';
  assert.ok(long.length > 55);
  const inputs = [row('gpt-5.2'), row('unselected-priced-model'), row(long),
    { ...row('glm-5.2-fast'), active: false },
    { ...row('moonshotai-kimi-k2-thinking'), available_api_count: 0, api_price_count: 0, priced_plan_count: 2 },
    { ...row('moonshotai-kimi-k2'), available_api_count: 0, api_price_count: 0 },
    row('inclusionai-ling-3-2-flash-free'), row('openai-gpt-5-2-batch')];
  const actual = new Set((await sitemap(inputs.map(r => ({ ...r, updated_at: null })))).map(r => r.url));
  for (const locale of ['en', 'zh'] as const) for (const r of inputs) {
    const metadata = seo.buildMetadata({ locale, path: `/models/${r.slug}`, title: { en: r.slug, zh: r.slug },
      description: { en: '', zh: '' }, noindex: !policy.modelShouldIndex(r) });
    assert.equal(typeof metadata.robots === 'object' && metadata.robots?.index,
      actual.has(`${seo.SITE_URL}/${locale}/models/${r.slug}`), r.slug);
  }
  assert.equal(policy.modelShouldIndex(inputs[2]), true);
  assert.equal(policy.modelShouldIndex(inputs[4]), true);
  assert.equal(policy.modelCanonicalSlug('moonshotai-kimi-k2-thinking'), 'moonshotai-kimi-k2-thinking');
  assert.equal(policy.modelCanonicalSlug('inclusionai-ling-3-2-flash-free'), 'inclusionai-ling-3-2-flash-free');
});

test('all seven modality metadata entry points and providers call the shared policy', () => {
  for (const kind of ['video', 'music', 'world', 'decision', 'embedding']) {
    const source = readFileSync(`src/app/[locale]/${kind}-models/[slug]/page.tsx`, 'utf8');
    assert.match(source, new RegExp(`noindex: !verticalShouldIndex\\('${kind}-model', slug, item.shutdownDate\\)`));
  }
  assert.match(readFileSync('src/components/non-llm-pages.tsx', 'utf8'), /noindex: slug != null && !verticalShouldIndex/);
  assert.match(readFileSync('src/app/[locale]/providers/[slug]/catalog-page.tsx', 'utf8'), /noindex: !providerShouldIndex\(providerSlug\) \|\| !indexProviders.some/);
  for (const [kind, slugs] of Object.entries(policy.SEO_VERTICAL_ALLOWLIST)) {
    assert.equal(policy.verticalShouldIndex(kind as AiCatalogKind, slugs[0]), true);
    assert.equal(policy.verticalShouldIndex(kind as AiCatalogKind, slugs[0], '2000-01-01'), false);
    assert.equal(policy.verticalShouldIndex(kind as AiCatalogKind, 'unselected-existing-detail'), false);
  }
});

test('real retained K2 identities have positive zero-price metadata/sitemap eligibility, while retired/missing/thin rows stay excluded', async () => {
  const inputs = ['moonshotai-kimi-k2', 'moonshotai-kimi-k2-thinking'].map(slug => ({ ...row(slug),
    api_price_count: 0, available_api_count: 0, priced_plan_count: 0, description: null }));
  const urls = new Set((await sitemap(inputs.map(r => ({ ...r, updated_at: null })))).map(r => r.url));
  for (const r of inputs) {
    assert.equal(policy.modelShouldIndex(r), true, r.slug);
    assert.equal(policy.modelShouldIndex({ ...r, active: false }), false, 'retired overrides retained prose');
    assert.equal(policy.modelShouldIndex({ ...r, is_llm: false }), false);
    for (const locale of ['en', 'zh'] as const) {
      const metadata = seo.buildMetadata({ locale, path: `/models/${r.slug}`, title: { en: r.slug, zh: r.slug },
        description: { en: '', zh: '' }, noindex: !policy.modelShouldIndex(r) });
      assert.equal(typeof metadata.robots === 'object' && metadata.robots?.index, true);
      assert.ok(urls.has(`${seo.SITE_URL}/${locale}/models/${r.slug}`));
    }
  }
  assert.equal(policy.modelShouldIndex({ ...row('gpt-5.2'), api_price_count: 0 }), false);
  const absent = new Set((await sitemap([])).map(r => r.url));
  for (const r of inputs) assert.ok(!absent.has(`${seo.SITE_URL}/en/models/${r.slug}`));
});
