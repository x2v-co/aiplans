import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { createProxy } from '../proxy';
import { loadQueryModule } from './test-helpers/query-module';
import * as policy from './seo-index-policy';
import * as legacy from './legacy-slug-redirects';
import type { AiCatalogItem } from './ai-vertical-catalog';

const row = (slug: string, active = true): policy.SeoIndexFacts => ({ slug, active, is_llm: true,
  description: null, api_price_count: 1, available_api_count: 1, priced_plan_count: 0,
  usage_price_count: 0, plan_count: 0, priced_subscription_count: 0, priced_subscription_provider_count: 0 });

function gate(rows: policy.SeoIndexFacts[], providers: string[] = [], verticalRows: AiCatalogItem[] = []) {
  const mod = loadQueryModule(new URL('./seo-redirects.ts', import.meta.url), {
    './seo-index-data': { getSeoIndexCatalog: async () => rows,
      getSeoProviderCatalog: async () => providers.map(slug => ({ slug })) },
    './vertical-models': { getVerticalModelCatalog: async () => verticalRows },
  });
  return mod.seoDestinationIndexable as (path: string) => Promise<boolean>;
}

function comparison(rows: policy.SeoIndexFacts[], payload: unknown, rename: string | null = null) {
  const mod = loadQueryModule(new URL('./model-plan-comparison.ts', import.meta.url), {
    react: { cache: (fn: unknown) => fn },
    './compare-plans': { getPlanComparison: async () => payload },
    './seo-index-data': { getSeoIndexCatalog: async () => rows },
    './legacy-slug-redirects': legacy,
    './model-slug-redirects': { findModelSlugRedirect: async () => rename },
  });
  return mod.getComparisonPage as (slug: string) => Promise<{ slug: string; data: unknown; redirect: string | null } | null>;
}

test('every known legacy model/proxy target has the real shared existence and quality gate', async () => {
  const rows = Object.values(legacy.LEGACY_MODEL_SLUGS).flatMap(entry => entry.models ? [row(entry.models)] : []);
  const eligible = gate(rows, [...policy.SEO_PROVIDER_ALLOWLIST]);
  const proxy = createProxy(async () => [], [], eligible);
  for (const alias of Object.keys(legacy.LEGACY_MODEL_SLUGS)) for (const locale of ['en', 'zh']) {
    const path = `/${locale}/models/${alias}`;
    const target = legacy.legacySlugRedirect(path);
    if (!target) continue;
    const response = await proxy(new NextRequest(`https://aiplans.dev${path}?source=fixture`));
    const canIndex = await eligible(target);
    assert.equal(response.status, canIndex ? 301 : 200, path);
    assert.equal(response.headers.get('location'), canIndex ? `https://aiplans.dev${target}?source=fixture` : null, path);
    if (!canIndex) assert.equal(response.headers.get('x-middleware-rewrite'), `https://aiplans.dev${target}?source=fixture`);
  }
  for (const rows of [[], [row('gpt-5.2', false)], [{ ...row('gpt-5.2'), api_price_count: 0 }]]) {
    assert.equal(await gate(rows)('/en/models/gpt-5.2'), false);
  }
  assert.equal(await gate([row('gpt-5.2')])('/en/models/gpt-5.2'), true);
  assert.equal(await gate([row('openai-gpt-5-2-batch')])('/en/models/openai-gpt-5-2-batch'), false);
});

test('locale-normalization eligibility uses actual existing curated items across all seven modalities', async () => {
  const { AI_VERTICAL_CATALOG } = await import('./ai-vertical-catalog');
  for (const [kind, slugs] of Object.entries(policy.SEO_VERTICAL_ALLOWLIST)) {
    const slug = slugs[0];
    const item = AI_VERTICAL_CATALOG.find(item => item.kind === kind && item.slug === slug)!;
    for (const locale of ['en', 'zh']) {
      const path = `/${locale}/${kind}s/${slug}`;
      assert.equal(await gate([], [], [item])(path), true);
      assert.equal(await gate([], [], [{ ...item, shutdownDate: '2000-01-01' }])(path), false);
      assert.equal(await gate([], [], [])(path), false);
    }
  }
});

test('providers including cysuo and pre-route Cursor are gated by actual existence/content', async () => {
  for (const locale of ['en', 'zh']) for (const slug of ['cysuo', 'openai', 'cursor']) {
    for (const exists of [false, true]) {
      const targetSlug = slug === 'cursor' ? 'xai' : slug;
      const eligible = gate([], exists ? [targetSlug] : []);
      const proxy = createProxy(async () => [{ kind: 'provider', slug, provider_slug: slug }], [], eligible);
      const response = await proxy(new NextRequest(`https://aiplans.dev/${locale}/plans/${slug}`));
      const expected = exists && policy.providerShouldIndex(targetSlug);
      assert.equal(response.status, expected ? 301 : 200);
      assert.equal(response.headers.get('location'), expected ? `https://aiplans.dev/${locale}/providers/${targetSlug}` : null);
      if (!expected) assert.equal(response.headers.get('x-middleware-rewrite'), `https://aiplans.dev/${locale}/providers/${targetSlug}`);
    }
  }
});

test('legacy comparisons go directly to final model only after parity; missing/mismatched payloads stay accessible', async () => {
  for (const locale of ['en', 'zh']) for (const alias of ['gpt-6.1-sol', 'kimi-k2-thinking', 'claude-opus-5-batch']) {
    const identity = legacy.LEGACY_MODEL_SLUGS[alias].models!;
    const rows = [row(identity)];
    for (const payload of [null, { model: { slug: identity } }, { model: { slug: 'wrong-successor' } }]) {
      const resolver = comparison(rows, payload);
      const proxy = createProxy(async () => [], [], gate(rows), resolver);
      for (const prefix of [`/${locale}`, ...(locale === 'en' ? [''] : [])]) {
        const response = await proxy(new NextRequest(`https://aiplans.dev${prefix}/compare/plans/${alias}?source=fixture`));
        const canRedirect = payload?.model.slug === identity && policy.modelShouldIndex(rows[0]);
        assert.equal(response.status, canRedirect ? 301 : 200);
        assert.equal(response.headers.get('location'), canRedirect ? `https://aiplans.dev/${locale}/models/${identity}?source=fixture` : null);
        if (!canRedirect && !prefix) assert.equal(response.headers.get('x-middleware-rewrite'), `https://aiplans.dev/en/compare/plans/${alias}?source=fixture`);
      }
    }
  }
});

test('DB-renamed comparisons share parity checks and unknown/variant identities have no guessed successor', async () => {
  const target = 'openai-gpt-6-1-sol';
  const rows = [row(target)];
  for (const payload of [null, { model: { slug: target } }, { model: { slug: 'gpt-6-luna' } }]) {
    // First request is missing; only the exact model-id rename supplies payload.
    let reads = 0;
    const mod = loadQueryModule(new URL('./model-plan-comparison.ts', import.meta.url), {
      react: { cache: (fn: unknown) => fn },
      './compare-plans': { getPlanComparison: async (slug: string) => { reads++; return slug === target ? payload : null; } },
      './seo-index-data': { getSeoIndexCatalog: async () => rows },
      './legacy-slug-redirects': legacy,
      './model-slug-redirects': { findModelSlugRedirect: async () => target },
    });
    const result = await (mod.getComparisonPage as ReturnType<typeof comparison>)('old-db-name');
    assert.equal(reads, 2);
    assert.equal(result?.redirect, payload?.model.slug === target ? `/en/models/${target}` : null);
    assert.equal(result?.slug, target);
  }
  assert.equal(await comparison([], null)('unknown-free-preview-thinking'), null);
});

test('all vertical family and benchmark aliases check destination existence, selection and lifecycle before a permanent hop', async () => {
  const { AI_VERTICAL_CATALOG } = await import('./ai-vertical-catalog');
  const { VERTICAL_MODEL_PARENT } = await import('./vertical-model-aliases');
  for (const locale of ['en', 'zh']) for (const [alias, target] of Object.entries(VERTICAL_MODEL_PARENT['video-model']!)) {
    const sourceItem = AI_VERTICAL_CATALOG.find(item => item.kind === 'video-model' && item.slug === target);
    assert.ok(sourceItem, target);
    for (const retired of [false, true]) {
      const item: AiCatalogItem = { ...sourceItem, shutdownDate: retired ? '2000-01-01' : undefined };
      const mod = loadQueryModule(new URL('./vertical-model-detail.ts', import.meta.url), {
        '@/lib/vertical-models': { getVerticalModelCatalog: async () => [item] },
        '@/lib/model-usage-prices-query': { getModelUsagePrices: async (slug: string) => {
          assert.equal(slug, target); return [];
        } },
      });
      const getDetail = mod.getVerticalModelDetail as (kind: string, slug: string, locale: string) => Promise<{ item: unknown }>;
      for (const slug of [alias, `arena-t2v-${alias}`]) {
        if (policy.verticalShouldIndex('video-model', target, item.shutdownDate)) {
          await assert.rejects(getDetail('video-model', slug, locale),
            { digest: `NEXT_REDIRECT;replace;/${locale}/video-models/${target};308;` });
        } else assert.equal((await getDetail('video-model', slug, locale)).item, item);
      }
    }
  }
});
