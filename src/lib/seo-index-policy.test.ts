import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildMetadata } from './seo';
import {
  isLowValueModel, isLowValuePlanComparison, modelShouldIndex, compareSeoFallback,
  selectSeoModels, selectSeoComparisons, SEO_COMPARISON_ALLOWLIST, type SeoIndexFacts,
} from './seo-index-policy';

export const facts = (overrides: Partial<SeoIndexFacts> = {}): SeoIndexFacts => ({
  slug: 'example-model', description: null, active: true, is_llm: true,
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
  assert.deepEqual(selectSeoComparisons([useful]), [useful]);
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
  // Prior API-only eligibility is retained, rather than expanding sitemap scope.
  const planOnly = facts({ available_api_count: 0, priced_plan_count: 1 });
  assert.equal(modelShouldIndex(planOnly), true);
  assert.equal(selectSeoModels([planOnly]).length, 0);
});

test('retired, glued slugs and old/operational comparison variants stay excluded', () => {
  const good = { plan_count: 3, priced_subscription_count: 3, priced_subscription_provider_count: 2 };
  const rows = [
    facts({ ...good, slug: 'claude-opus-4.5', released_at: '2025-11-01' }),
    facts({ ...good, slug: 'claude-opus-4.8', released_at: '2026-08-01' }),
    facts({ ...good, slug: 'claude-opus-4.8-(batch)', released_at: '2026-08-01' }),
    facts({ ...good, slug: 'retired-model', active: false }),
  ];
  assert.deepEqual(selectSeoComparisons(rows).map(row => row.slug), ['claude-opus-4.8']);
  assert.equal(modelShouldIndex(rows[3]), false);
  assert.ok(selectSeoComparisons(rows).every(row => !isLowValuePlanComparison(row)));
});

test('allowlisted older comparisons with Search demand stay indexable, bypassing only the vendor-count bar', () => {
  const good = { plan_count: 6, priced_subscription_count: 6, priced_subscription_provider_count: 3 };
  const rows = [
    facts({ ...good, slug: 'gemini-3-pro', released_at: '2025-11-18' }),
    facts({ ...good, slug: 'gemini-3.5-pro', released_at: '2026-06-01' }),
    facts({ ...good, slug: 'claude-opus-4.5', released_at: '2025-11-01' }),
    facts({ ...good, slug: 'claude-opus-4.8', released_at: '2026-08-01' }),
  ];
  assert.ok(SEO_COMPARISON_ALLOWLIST.has('gemini-3-pro'));
  assert.deepEqual(selectSeoComparisons(rows).map(row => row.slug).sort(),
    ['claude-opus-4.8', 'gemini-3-pro', 'gemini-3.5-pro']);
  // Allowlisted slugs skip only the >= 2 vendors rule (production: Google-only tiers).
  for (const slug of SEO_COMPARISON_ALLOWLIST) {
    const single = facts({ ...good, slug, priced_subscription_provider_count: 1 });
    assert.deepEqual(selectSeoComparisons([single, rows[1]]).map(r => r.slug).sort(),
      [slug, 'gemini-3.5-pro'].sort());
  }
  // A non-allowlisted page with one priced vendor still fails the bar.
  assert.deepEqual(selectSeoComparisons([
    facts({ ...good, slug: 'claude-opus-4.8', released_at: '2026-08-01', priced_subscription_provider_count: 1 }),
  ]), []);
  // Allowlisted but < 2 priced subscriptions, no longer active, or < 2 plans is excluded.
  for (const row of [
    facts({ ...good, slug: 'gemini-3-pro', priced_subscription_count: 1, priced_subscription_provider_count: 1 }),
    facts({ ...good, slug: 'gemini-3-pro', active: false }),
    facts({ ...good, slug: 'gemini-3-pro', plan_count: 1 }),
  ]) assert.deepEqual(selectSeoComparisons([row, rows[1]]).map(r => r.slug), ['gemini-3.5-pro']);
  // A report run without the policy keeps the old candidate set plus the allowlist.
  assert.equal(selectSeoComparisons(rows, false).filter(r => r.slug === 'gemini-3-pro').length, 1);
});

test('metadata and sitemap use the shared query and policy, without a second SQL eligibility implementation', () => {
  const model = readFileSync('src/app/[locale]/models/[slug]/page.tsx', 'utf8');
  const comparison = readFileSync('src/app/[locale]/compare/plans/[model]/layout.tsx', 'utf8');
  const sitemap = readFileSync('src/lib/build-sitemap.ts', 'utf8');
  for (const source of [model, comparison, sitemap]) assert.match(source, /getSeoIndexCatalog/);
  assert.match(model, /noindex: !indexFacts \|\| !modelShouldIndex\(indexFacts\)/);
  assert.match(comparison, /selectSeoComparisons\(comparable\)/);
  assert.match(sitemap, /selectSeoModels\(catalog, applyIndexPolicy\)/);
  assert.match(sitemap, /selectSeoComparisons\(catalog, applyIndexPolicy\)/);
});

test('non-indexable compare URLs 301 to the model page when it is indexable', () => {
  const emptyCompare = facts({ slug: 'glm-5.2-fast', api_price_count: 1, plan_count: 0,
    priced_subscription_count: 0, priced_subscription_provider_count: 0 });
  const newest = facts({ slug: 'glm-5.3', plan_count: 6, priced_subscription_count: 6,
    priced_subscription_provider_count: 2, released_at: '2026-10-01' });
  const catalog = [emptyCompare, newest];
  assert.equal(compareSeoFallback('en', 'glm-5.2-fast', catalog), '/en/models/glm-5.2-fast');
  assert.equal(compareSeoFallback('zh', 'glm-5.2-fast', catalog), '/zh/models/glm-5.2-fast');
  assert.equal(compareSeoFallback('en', 'glm-5.3', catalog), null);
  const retired = facts({ slug: 'openai-gpt-4', active: false, api_price_count: 0 });
  assert.equal(compareSeoFallback('en', 'openai-gpt-4', [retired, newest]), '/en/compare/plans');
  const allowlisted = facts({ slug: 'gemini-3-pro', plan_count: 6, priced_subscription_count: 6,
    priced_subscription_provider_count: 1, released_at: '2025-11-18' });
  assert.equal(compareSeoFallback('en', 'gemini-3-pro', [allowlisted, newest]), null);
  const layout = readFileSync('src/app/[locale]/compare/plans/[model]/layout.tsx', 'utf8');
  const page = readFileSync('src/app/[locale]/compare/plans/[model]/page.tsx', 'utf8');
  for (const source of [layout, page]) assert.match(source, /compareSeoFallback/);
});
