import assert from 'node:assert/strict';
import test from 'node:test';
import { loadQueryModule } from './test-helpers/query-module';

const provider = { id: 8, slug: 'moonshot-china', name: 'Moonshot China' };
const current = { id: 199, provider_id: 8, name: 'Kimi Pro', slug: 'kimi-pro', price: 199, notes: null };
const legacy = { ...current, id: 99, slug: 'kimi-pro-legacy-2026-04', price: 99,
  notes: 'April pricing\n[aiplans:superseded-by kimi-pro]\nSource: official' };
const oldTiers = ['Free', 'Basic', 'Team', 'Enterprise'].map((name, i) => ({
  ...legacy, id: 100 + i, name, slug: `kimi-${name.toLowerCase()}-legacy`,
}));
const basic = { ...current, id: 200, name: 'Current Basic', slug: 'kimi-basic', notes: '' };
const rows = [legacy, ...oldTiers, current, basic];
const currentPredicate = /COALESCE\((?:plans|pl|p)\.notes, ''\) NOT LIKE '%\[aiplans:superseded-by %'/;

test('provider page data keeps only current plans and passes only their IDs to model discovery', async () => {
  const calls: string[] = [];
  const sql = Object.assign(async (strings: TemplateStringsArray) => {
    const query = strings.join('?');
    calls.push(query);
    if (query.includes('FROM providers')) return [provider];
    if (query.includes('FROM plans')) {
      assert.match(query, currentPredicate);
      // Include historical rows to exercise the JS boundary as well as SQL.
      return rows;
    }
    if (query.includes('JOIN plans p')) {
      assert.match(query, currentPredicate, 'comparison counts must use current plans');
      return [];
    }
    if (query.includes('FROM models')) return [{ id: 10, slug: 'kimi-k3', name: 'Kimi K3' }];
    throw new Error(`Unexpected query: ${query}`);
  }, { array: (values: unknown[]) => values });
  const { getPlansByProvider } = loadQueryModule(new URL('./provider-plans-query.ts', import.meta.url), {
    './db': { sql, INT4_ARRAY: 1007 },
    './schema-adapters': { getAllModelIdsForProvider: async (providerId: number, planIds: number[]) => {
      assert.equal(providerId, provider.id);
      assert.deepEqual([...planIds], [199, 200]);
      return [10];
    } },
  }) as typeof import('./provider-plans-query');

  const result = await getPlansByProvider(provider.slug);
  assert.ok(result);
  assert.deepEqual(result.plans.map(plan => [plan.slug, plan.price]), [['kimi-pro', 199], ['kimi-basic', 199]]);
  assert.equal(calls.length, 4);
});

test('a provider with only superseded plans stays accessible with an empty current list', async () => {
  const { getPlansByProvider } = loadQueryModule(new URL('./provider-plans-query.ts', import.meta.url), {
    './db': { sql: async (strings: TemplateStringsArray) =>
      strings.join('').includes('FROM providers') ? [provider] : [legacy, ...oldTiers] },
    './schema-adapters': { getAllModelIdsForProvider: async (_id: number, ids: number[]) => {
      assert.deepEqual([...ids], []);
      return [];
    } },
  }) as typeof import('./provider-plans-query');
  const result = await getPlansByProvider(provider.slug);
  assert.ok(result);
  assert.equal(result.plans.length, 0);
});

test('an unknown provider still returns no data', async () => {
  const { getPlansByProvider } = loadQueryModule(new URL('./provider-plans-query.ts', import.meta.url), {
    './db': { sql: async () => [] },
  }) as typeof import('./provider-plans-query');
  assert.equal(await getPlansByProvider('missing'), null);
});

test('shared plan listing excludes superseded rows before provider and model enrichment', async () => {
  const sql = Object.assign(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?');
    if (query.includes('FROM plans')) {
      assert.match(query, currentPredicate);
      return rows;
    }
    if (query.includes('FROM providers')) return [provider];
    if (query.includes('FROM model_plan_mapping')) {
      assert.deepEqual([...values[0] as number[]], [199, 200]);
      return [];
    }
    throw new Error(`Unexpected query: ${query}`);
  }, { array: (values: unknown[]) => values });
  const { getPlans } = loadQueryModule(new URL('./plans.ts', import.meta.url), {
    '@/lib/db': { sql, INT4_ARRAY: 1007 },
  }) as typeof import('./plans');
  const plans = await getPlans({ providerId: 8, includeModels: true });
  assert.deepEqual(plans.map(plan => plan.slug), ['kimi-pro', 'kimi-basic']);
  assert.ok(plans.every(plan => plan.provider?.slug === provider.slug));
});

test('SEO prices and provider counts all apply the shared current-plan condition', async () => {
  const calls: string[] = [];
  const sql = Object.assign(async (strings: TemplateStringsArray) => {
    const query = strings.join('?');
    calls.push(query);
    if (query.includes('FROM models')) return [{ id: 10, name: 'Kimi K3', slug: 'kimi-k3' }];
    assert.match(query, currentPredicate);
    return [];
  }, { array: (values: unknown[]) => values });
  const data = loadQueryModule(new URL('./pricing-seo-data.ts', import.meta.url), {
    './db': { sql, TEXT_ARRAY: 1009 },
  }) as typeof import('./pricing-seo-data');
  await data.getProviderSeoPlans(provider.id);
  await data.getComparisonSeoData('kimi-k3');
  await data.getPlansSeoProviders();
  assert.equal(calls.length, 4);
});

test('provider index filters both plan existence and models linked through plans', async () => {
  let calls = 0;
  const { getProvidersForIndex } = loadQueryModule(new URL('./providers-index.ts', import.meta.url), {
    '@/lib/db': { sql: async (strings: TemplateStringsArray) => {
      calls++;
      const query = strings.join('?');
      assert.match(query, /pl\.provider_id = providers.id\s+AND COALESCE\(pl\.notes/);
      assert.match(query, /plans\.provider_id = providers.id AND COALESCE\(plans\.notes/);
      return [];
    } },
  }) as typeof import('./providers-index');
  await getProvidersForIndex();
  assert.equal(calls, 1);
});

test('model listing plan counts join current plans rather than counting historical mappings', async () => {
  let countedPlans = false;
  const sql = Object.assign(async (strings: TemplateStringsArray) => {
    const query = strings.join('?');
    if (query.includes('FROM models')) return [{ id: 10, name: 'Kimi K3', slug: 'kimi-k3' }];
    if (query.includes('FROM model_plan_mapping')) {
      countedPlans = true;
      assert.match(query, /JOIN plans pl ON pl.id = mpm.plan_id/);
      assert.match(query, currentPredicate);
    }
    return [];
  }, { array: (values: unknown[]) => values });
  const { getProducts } = loadQueryModule(new URL('./products.ts', import.meta.url), {
    '@/lib/db': { sql, INT4_ARRAY: 1007 },
    '@/lib/schema-adapters': { attachPrimaryProvidersToModels: async (models: unknown[]) => models },
  }) as typeof import('./products');
  const products = await getProducts({ includePlanCount: true });
  assert.equal(products[0].planCount, 0);
  assert.equal(countedPlans, true);
});

test('sitemap index facts exclude superseded plans and their usage prices', async () => {
  let calls = 0;
  const { getSeoIndexCatalog } = loadQueryModule(new URL('./seo-index-data.ts', import.meta.url), {
    './db': { sql: async (strings: TemplateStringsArray) => {
      calls++;
      const query = strings.join('?');
      assert.match(query, /FROM model_plan_mapping mpm JOIN plans p ON p.id = mpm.plan_id\s+WHERE mpm.model_id = m.id AND COALESCE\(p.notes/);
      assert.match(query, /FROM usage_prices up\s+LEFT JOIN plans pl ON pl.id = up.plan_id/);
      assert.match(query, /up.is_available = true\s+AND COALESCE\(pl.notes/);
      return [];
    } },
  }) as typeof import('./seo-index-data');
  await getSeoIndexCatalog();
  assert.equal(calls, 1);
});

test('legacy plan redirect catalog keeps superseded slugs addressable', async () => {
  const { getPlanRedirectCatalog } = loadQueryModule(new URL('./plan-redirect-data.ts', import.meta.url), {
    './db': { sql: async (strings: TemplateStringsArray) => {
      assert.doesNotMatch(strings.join('?'), /NOT LIKE|superseded/);
      return [{ kind: 'plan', slug: legacy.slug, provider_slug: provider.slug }];
    } },
  }) as typeof import('./plan-redirect-data');
  const catalog = await getPlanRedirectCatalog();
  assert.equal(catalog[0].slug, legacy.slug);
});
