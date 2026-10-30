import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogUrls, indexReport, offlineCatalog } from './seo-index-report';
import type { SeoIndexFacts } from '../src/lib/seo-index-policy';

const row = (overrides: Partial<SeoIndexFacts> = {}): SeoIndexFacts => ({
  slug: 'example-model', description: null, active: true, is_llm: true,
  available_api_count: 1, api_price_count: 0, priced_plan_count: 0,
  usage_price_count: 0, plan_count: 3, priced_subscription_count: 3,
  priced_subscription_provider_count: 1, ...overrides,
});

test('report counts actual URLs in both locales and lists every removal and reason', () => {
  const rows = [row(), row({ slug: 'useful-model', api_price_count: 1, priced_subscription_provider_count: 2 })];
  const report = indexReport(rows, catalogUrls(rows, false), catalogUrls(rows, true));
  assert.equal(report.before, 8);
  assert.equal(report.after, 4);
  assert.deepEqual(report.added, []);
  assert.deepEqual(report.removed, [
    'https://aiplans.dev/en/compare/plans/example-model', 'https://aiplans.dev/en/models/example-model',
    'https://aiplans.dev/zh/compare/plans/example-model', 'https://aiplans.dev/zh/models/example-model',
  ]);
  assert.equal(report.noindex.length, 4);
  assert.ok(report.noindex.every(entry => entry.reason.length > 0));
});

test('offline mode reads real catalog snapshots without inventing plan mappings', async () => {
  const rows = await offlineCatalog();
  assert.ok(rows.length > 10);
  assert.ok(rows.some(row => row.api_price_count > 0));
  assert.ok(rows.some(row => row.api_price_count === 0));
  assert.ok(rows.every(row => row.plan_count === 0));
  assert.deepEqual(catalogUrls(rows, true).filter(url => url.includes('/compare/')), []);
});
