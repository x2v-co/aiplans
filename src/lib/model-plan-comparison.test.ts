import assert from 'node:assert/strict';
import test from 'node:test';
import { loadQueryModule } from './test-helpers/query-module';
import * as policy from './seo-index-policy';

const row = (slug: string, active = true) => ({ slug, active, is_llm: true, description: null,
  available_api_count: 1, api_price_count: 1, usage_price_count: 0, priced_plan_count: 1,
  plan_count: 2, priced_subscription_count: 2, priced_subscription_provider_count: 1 });

test('integration passes the original payload without projecting features, unit/tier/quota semantics', async () => {
  const slug = 'gpt-5.2';
  const payload = { model: { slug }, officialPlans: [{ plan: {
    features: ['Feature one', 'Batch access', 'Cache pricing'], quotaUnit: 'tokens',
    planKind: 'coding', planLine: 'coding-pro', tierRank: 2,
  }, pricing: { monthly: 20, yearly: 200, currency: 'USD', billingModel: 'subscription' },
  economics: { unit: 'tokens', amount: 1000000 } }], thirdPartyPlans: [] };
  let reads = 0;
  const mod = loadQueryModule(new URL('./model-plan-comparison.ts', import.meta.url), {
    react: { cache: (fn: unknown) => fn },
    './compare-plans': { getPlanComparison: async (requested: string, currency: string) => {
      reads++; assert.equal(requested, slug); assert.equal(currency, 'USD'); return payload;
    } },
    './seo-index-data': { getSeoIndexCatalog: async () => [row(slug)] },
    './seo-index-policy': policy,
  });
  const result = await (mod.getIntegratedPlanComparison as (s: string) => Promise<unknown>)(slug);
  assert.equal(result, payload, 'same object: no lost fields or recalculated quote units');
  assert.equal(reads, 1);
});

test('integration rejects unselected, inactive, missing and nonidentical entities without successor fallback', async () => {
  for (const [slug, catalog, payloadSlug] of [
    ['unselected', [row('unselected')], 'unselected'],
    ['gpt-5.2', [row('gpt-5.2', false)], 'gpt-5.2'],
    ['gpt-5.2', [], 'gpt-5.2'],
    ['gpt-5.2', [row('gpt-5.2')], 'gpt-5.3-codex'],
    ['inclusionai-ling-3-2-flash-free', [row('inclusionai-ling-3-2-flash-free')], 'inclusionai-ling-3-2-flash'],
  ] as const) {
    let reads = 0;
    const mod = loadQueryModule(new URL('./model-plan-comparison.ts', import.meta.url), {
      react: { cache: (fn: unknown) => fn },
      './compare-plans': { getPlanComparison: async () => { reads++; return { model: { slug: payloadSlug } }; } },
      './seo-index-data': { getSeoIndexCatalog: async () => catalog },
      './seo-index-policy': policy,
    });
    assert.equal(await (mod.getIntegratedPlanComparison as (s: string) => Promise<unknown>)(slug), null);
    assert.equal(reads, catalog.some(r => policy.modelShouldIndex(r)) ? 1 : 0);
  }
});
