import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildMetadata } from './seo';
import {
  isLowValueModel, isLowValuePlanComparison, modelShouldIndex, compareSeoFallback,
  selectSeoModels, selectSeoComparisons, SEO_COMPARISON_ALLOWLIST, isRouterAliasSlug, isBatchVariantSlug, modelCanonicalSlug, type SeoIndexFacts,
} from './seo-index-policy';

export const facts = (overrides: Partial<SeoIndexFacts> = {}): SeoIndexFacts => ({
  slug: 'gpt-5.2', description: null, active: true, is_llm: true,
  available_api_count: 1, api_price_count: 0, priced_plan_count: 0,
  usage_price_count: 0, plan_count: 2, priced_subscription_count: 0,
  priced_subscription_provider_count: 0, ...overrides,
});

test('model without any price or independent prose is low value; each price source is sufficient', () => {
  assert.equal(isLowValueModel(facts()), true);
  for (const field of ['api_price_count', 'priced_plan_count', 'usage_price_count'] as const) {
    assert.equal(isLowValueModel(facts({ [field]: 1 })), false, field);
  }
  assert.equal(isLowValueModel(facts({ description: 'A model trained for multilingual document retrieval.' })), false);
  for (const description of ['', ' \n ', 'TODO: write a description', 'Status: announced.', '[needs-verification] fix later']) {
    assert.equal(isLowValueModel(facts({ description })), true, description);
  }
});

test('empty, single priced vendor, and unknown price comparisons are low value', () => {
  for (const row of [facts(), facts({ priced_subscription_count: 1, priced_subscription_provider_count: 1 }),
    facts({ priced_subscription_count: 4, priced_subscription_provider_count: 1 })]) {
    assert.equal(isLowValuePlanComparison(row), true);
    assert.equal(selectSeoComparisons([row]).length, 0);
  }
  const useful = facts({ priced_subscription_count: 2, priced_subscription_provider_count: 2 });
  assert.equal(isLowValuePlanComparison(useful), false);
  assert.deepEqual(selectSeoComparisons([useful]), []);
  assert.deepEqual(selectSeoComparisons([useful], false), [useful]);
});

test('model robots and sitemap make identical low-value decisions, including free/API/usage/plan-only facts', () => {
  for (const row of [facts(), facts({ api_price_count: 1 }), facts({ usage_price_count: 1 }),
    facts({ priced_plan_count: 1 }), facts({ description: 'Independent model description.' })]) {
    const robots = buildMetadata({ locale: 'en', path: `/models/${row.slug}`,
      title: { en: row.slug, zh: row.slug }, description: { en: '', zh: '' }, noindex: !modelShouldIndex(row) }).robots;
    assert.equal(typeof robots === 'object' && robots?.index, selectSeoModels([row]).length === 1);
    assert.equal(typeof robots === 'object' && robots?.follow, true);
    assert.equal(typeof robots === 'object' && robots != null && typeof robots.googleBot === 'object' && robots.googleBot.index,
      selectSeoModels([row]).length === 1);
  }
  // Selected subscription/usage-only model pages use the same gate as metadata.
  const planOnly = facts({ available_api_count: 0, priced_plan_count: 1 });
  assert.equal(modelShouldIndex(planOnly), true);
  assert.equal(selectSeoModels([planOnly]).length, 1);
});

test('retired, glued slugs and old/operational comparison variants stay excluded', () => {
  const good = { plan_count: 3, priced_subscription_count: 3, priced_subscription_provider_count: 2 };
  const rows = [
    facts({ ...good, slug: 'claude-opus-4.5', released_at: '2025-11-01' }),
    facts({ ...good, slug: 'claude-opus-4.8', released_at: '2026-08-01' }),
    facts({ ...good, slug: 'claude-opus-4.8-(batch)', released_at: '2026-08-01' }),
    facts({ ...good, slug: 'retired-model', active: false }),
  ];
  assert.deepEqual(selectSeoComparisons(rows), []);
  assert.deepEqual(selectSeoComparisons(rows, false).map(row => row.slug), ['claude-opus-4.8']);
  assert.equal(modelShouldIndex(rows[3]), false);
  assert.ok(selectSeoComparisons(rows).every(row => !isLowValuePlanComparison(row)));
});

test('glued multi-entity rows stay outside both sitemaps while thinking/free models remain indexable', () => {
  const priced = { api_price_count: 1, plan_count: 3, priced_subscription_count: 3, priced_subscription_provider_count: 2 };
  for (const slug of ['kimi-k2-thinkingkimi-k2-instruct-0905kimi-k2-instructkimi-k2-base', 'glm-5glm-5.1',
    'z-ai-glm-5glm-5.1', 'moonshotai-kimi-k2-thinkingkimi-k2-instruct-0905kimi-k2-base']) {
    const row = facts({ ...priced, slug });
    assert.equal(modelShouldIndex(row), false);
    assert.deepEqual(selectSeoModels([row]), []);
    assert.deepEqual(selectSeoComparisons([row]), []);
  }
  for (const slug of ['moonshotai-kimi-k2-thinking', 'inclusionai-ling-3-2-flash-free']) {
    const row = facts({ ...priced, slug });
    assert.equal(modelShouldIndex(row), true);
    assert.deepEqual(selectSeoModels([row]), [row]);
    assert.equal(modelCanonicalSlug(slug), slug);
  }
});

test('historical comparison allowlist remains available to the before report, while details leave the new sitemap', () => {
  const rows = [...SEO_COMPARISON_ALLOWLIST].map(slug => facts({ slug,
    plan_count: 6, priced_subscription_count: 6, priced_subscription_provider_count: 1 }));
  assert.deepEqual(selectSeoComparisons(rows), []);
  assert.deepEqual(selectSeoComparisons(rows, false).map(row => row.slug).sort(), [...SEO_COMPARISON_ALLOWLIST].sort());
});

test('metadata and sitemap use the shared query and policy, without a second SQL eligibility implementation', () => {
  const model = readFileSync('src/app/[locale]/models/[slug]/page.tsx', 'utf8');
  const comparison = readFileSync('src/app/[locale]/compare/plans/[model]/layout.tsx', 'utf8');
  const sitemap = readFileSync('src/lib/build-sitemap.ts', 'utf8');
  for (const source of [model, sitemap]) assert.match(source, /getSeoIndexCatalog/);
  assert.match(model, /noindex: !indexFacts \|\| !modelShouldIndex\(indexFacts\)/);
  assert.match(comparison, /noindex: true/);
  assert.match(comparison, /getComparisonPage/);
  assert.match(sitemap, /selectSeoModels\(catalog, applyIndexPolicy\)/);
  assert.match(sitemap, /selectSeoComparisons\(catalog, applyIndexPolicy\)/);
});

test('comparison redirect requires integrated exact-entity content, existing eligible model and locale agreement', () => {
  const row = facts({ slug: 'glm-5.2-fast', api_price_count: 1 });
  for (const locale of ['en', 'zh']) {
    assert.equal(compareSeoFallback(locale, row.slug, [row], row.slug), `/${locale}/models/${row.slug}`);
    for (const target of [undefined, 'glm-5.3', 'glm-5.2-fast-free', 'glm-5.2-fast-preview']) {
      assert.equal(compareSeoFallback(locale, row.slug, [row], target), null);
    }
    assert.equal(compareSeoFallback(locale, row.slug, [], row.slug), null);
    assert.equal(compareSeoFallback(locale, row.slug, [{ ...row, active: false }], row.slug), null);
    const excluded = facts({ slug: 'unselected-model', api_price_count: 1 });
    assert.equal(compareSeoFallback(locale, excluded.slug, [excluded], excluded.slug), null);
  }
  const layout = readFileSync('src/app/[locale]/compare/plans/[model]/layout.tsx', 'utf8');
  const page = readFileSync('src/app/[locale]/compare/plans/[model]/page.tsx', 'utf8');
  for (const source of [layout, page]) assert.match(source, /getComparisonPage/);
});

test('OpenRouter ~alias routing pages are noindex and out of the sitemap', () => {
  const alias = facts({ slug: '~deepseek-deepseek-v4-flash-latest', api_price_count: 3 });
  const concrete = facts({ slug: 'deepseek-v4-pro', api_price_count: 3 });
  assert.equal(isRouterAliasSlug(alias.slug), true);
  assert.equal(isRouterAliasSlug(concrete.slug), false);
  assert.equal(modelShouldIndex(alias), false);
  assert.equal(modelShouldIndex(concrete), true);
  assert.deepEqual(selectSeoModels([alias, concrete]).map(row => row.slug), ['deepseek-v4-pro']);
  // The read-only report's "before" view (policy off) keeps the old candidate set.
  assert.equal(selectSeoModels([alias], false).length, 1);
});

test('batch-API variants are noindex, out of the sitemap and self-canonical', () => {
  for (const slug of ['openai-gpt-5-2-batch', 'claude-opus-5:batch', 'gpt-5.2-(batch)', 'gemma-4-31b-batch']) {
    assert.equal(isBatchVariantSlug(slug), true, slug);
  }
  for (const slug of ['gpt-5.2', 'batch-runner', 'openai-gpt-5-2']) {
    assert.equal(isBatchVariantSlug(slug), false, slug);
  }
  const priced = { api_price_count: 2 };
  const batch = facts({ slug: 'openai-gpt-5-2-batch', ...priced });
  const base = facts({ slug: 'gpt-5.2', ...priced });
  assert.equal(modelShouldIndex(batch), false);
  assert.equal(modelShouldIndex(base), true);
  assert.deepEqual(selectSeoModels([batch, base]).map(row => row.slug), ['gpt-5.2']);
  // A batch duplicate does not point its canonical at another noindex batch row.
  assert.equal(modelCanonicalSlug('gpt-5.2-(batch)'), 'gpt-5.2-(batch)');
  assert.equal(modelCanonicalSlug('openai-gpt-5-4'), 'gpt-5.4');
});
