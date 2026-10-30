import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildMetadata } from './seo';
import {
  isLowValueModel, isLowValuePlanComparison, modelShouldIndex,
  selectSeoModels, selectSeoComparisons, type SeoIndexFacts,
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
