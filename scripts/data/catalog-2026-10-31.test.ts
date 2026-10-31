import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  CLAUDE_REPLACEMENTS, LAW_SLUG, VERIFIED_AT, catalog20261031SeedOptions,
  currentClaudePlan, lawChannel, lawModel, seedCatalog20261031,
} from './catalog-2026-10-31';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';
import { isSupersededPlan } from '../../src/lib/plan-lifecycle';
import { resolvePlanRedirect } from '../../src/lib/provider-redirects';
import { loadQueryModule } from '../../src/lib/test-helpers/query-module';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';

const providers = [{ id: 2, slug: 'anthropic', type: 'official' }, { id: 1, slug: 'openai', type: 'official' }];
const plans: FakeRow[] = [
  { id: 10, provider_id: 2, slug: 'claude-max-5x', name: 'Claude Max (5x)', notes: 'Historical $100 tier', price: 100 },
  { id: 11, provider_id: 2, slug: 'claude-max-20x', name: 'Claude Max (20x)', notes: 'Historical $200 tier', price: 200 },
  { id: 12, provider_id: 2, slug: 'claude-team', name: 'Claude Team', price: 25 },
  { id: 13, provider_id: 99, slug: 'claude-max-5x', name: 'Unrelated provider', notes: null },
];

test('default dry-run previews both changes with no writes and exact provider scoping', async () => {
  const f = fakeSeedTx({ providers, plans });
  const before = structuredClone(f.data);
  const steps = await seedCatalog20261031(f.tx);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  assert.equal(steps.length, 6);
  assert.deepEqual(steps.filter(s => s.action === 'insert').map(s => s.target), [
    'anthropic/claude-max', 'anthropic/claude-ultra', LAW_SLUG, `openai/${LAW_SLUG}`,
  ]);
  assert.equal(steps.find(s => s.table === 'api_channel_prices')?.changes.model_id.to, -3);
  assert.equal(catalog20261031SeedOptions([]).apply, false);
  assert.equal(catalog20261031SeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261031SeedOptions(['--apply']).apply, true);
  for (const args of [['--force'], ['--dry-run', '--apply']]) assert.throws(() => catalog20261031SeedOptions(args), /Usage/);
});

test('writer is repeatable; retains old IDs/references, generic Max, and unrelated data', async () => {
  const generic = { id: 14, provider_id: 2, slug: 'claude-max', name: 'Old generic Max', notes: 'Stale', annual_price: 1200 };
  const mappings = [{ id: 44, plan_id: 10, model_id: 77, source: 'manual' }];
  const f = fakeSeedTx({ providers, plans: [...plans, generic], model_plan_mapping: mappings });
  await seedCatalog20261031(f.tx, true);
  assert.deepEqual(f.data.model_plan_mapping, mappings);
  assert.deepEqual(f.data.plans.filter(p => p.id === 12 || p.id === 13), plans.filter(p => p.id === 12 || p.id === 13));
  assert.equal(f.data.plans.find(p => p.slug === 'claude-max')?.id, 14);
  for (const p of CLAUDE_REPLACEMENTS) {
    const legacy = f.data.plans.find(row => row.slug === p.oldSlug && row.provider_id === 2)!;
    assert.equal(legacy.id, p.oldSlug.endsWith('5x') ? 10 : 11);
    assert.ok(String(legacy.notes).startsWith('Historical'));
    assert.ok(isSupersededPlan(legacy));
    assert.ok(String(legacy.notes).includes(`[aiplans:superseded-by ${p.slug}]`));
  }
  const [model] = f.data.models;
  const [channel] = f.data.api_channel_prices;
  assert.equal(model.slug, LAW_SLUG);
  assert.deepEqual(model.provider_ids, [1]);
  assert.equal(model.type, 'llm');
  assert.equal(channel.model_id, model.id);
  assert.deepEqual([channel.input_price_per_1m, channel.output_price_per_1m, channel.cached_input_price_per_1m], [10, 50, 1]);
  assert.equal(channel.last_verified instanceof Date && channel.last_verified.toISOString(), VERIFIED_AT.toISOString());
  assert.equal(f.data.api_channel_price_variants.length, 0);
  const writes = f.writes();
  assert.deepEqual(await seedCatalog20261031(f.tx, true), []);
  assert.equal(f.writes(), writes);
});

test('Max and Ultra use monthly-only pricing, existing API-credit fields, and qualified usage notes', () => {
  for (const [slug, price, usage] of [
    ['claude-max', 100, /5x Pro usage every 5 hours and every week/],
    ['claude-ultra', 200, /10x Pro usage every week\. No 5-hour limit for verified accounts/],
  ] as const) {
    const row = currentClaudePlan(2, slug);
    assert.equal(row.price, price);
    assert.equal(row.monthly_api_credit_usd, price);
    assert.equal(row.monthly_api_credit_status, null);
    assert.equal(row.annual_price, null);
    assert.equal(row.price_yearly_monthly, null);
    assert.equal(row['5_hours_message_limit'], null);
    assert.deepEqual(row.quotas, []);
    assert.match(row.notes, usage);
    assert.match(row.notes, /Fable included, up to half the weekly usage limit/);
    assert.match(row.notes, /API credits to build on the Claude Platform/);
    assert.match(row.notes, /Monthly billing only/);
    assert.match(row.notes, /verified 2026-10-31/);
  }
  const channel = lawChannel(1, 88);
  assert.match(channel.notes, /促销价至少至 2026-12-31/);
  assert.equal(channel.promo_ends_at, null);
  assert.equal(channel.regular_input_price_per_1m, null);
  assert.equal(channel.regular_output_price_per_1m, null);
  assert.equal(channel.regular_cached_input_price_per_1m, null);
  assert.equal('context_window' in lawModel(1), false);
});

test('existing Law row/channel are repaired without touching Astra or other channels', async () => {
  const models = [{ id: 30, slug: LAW_SLUG, name: 'Wrong name' }, { id: 31, slug: 'openai-gpt-6-astra', name: 'GPT-6 Astra' }];
  const channels = [{ id: 40, provider_id: 1, model_id: 30, input_price_per_1m: 1 }, { id: 41, provider_id: 9, model_id: 30 }];
  const f = fakeSeedTx({ providers, plans: [], models, api_channel_prices: channels });
  await seedCatalog20261031(f.tx, true);
  assert.equal(f.data.models.length, 2);
  assert.equal(f.data.api_channel_prices.length, 2);
  assert.deepEqual(f.data.models[1], models[1]);
  assert.deepEqual(f.data.api_channel_prices[1], channels[1]);
  assert.equal(f.data.api_channel_prices[0].input_price_per_1m, 10);
});

test('missing/ambiguous providers, plan slugs, models and channels abort before any write', async () => {
  const cases = [
    { providers: [providers[0]], plans },
    { providers: [...providers, { ...providers[0], id: 3 }], plans },
    { providers: providers.map(p => ({ ...p, type: 'reseller' })), plans },
    { providers, plans: [...plans, { ...plans[0], id: 15 }] },
    { providers, plans, models: [{ id: 20, slug: LAW_SLUG }, { id: 21, slug: LAW_SLUG }] },
    { providers, plans, models: [{ id: 20, slug: LAW_SLUG }], api_channel_prices: [
      { id: 30, model_id: 20, provider_id: 1 }, { id: 31, model_id: 20, provider_id: 1 },
    ] },
  ];
  for (const initial of cases) {
    const f = fakeSeedTx(initial);
    await assert.rejects(seedCatalog20261031(f.tx, true), /nothing written/);
    assert.equal(f.writes(), 0);
  }
});

test('real provider query hides superseded names; old plan slugs still resolve to Anthropic', async () => {
  const f = fakeSeedTx({ providers, plans });
  await seedCatalog20261031(f.tx, true);
  const { getPlansByProvider } = loadQueryModule(new URL('../../src/lib/provider-plans-query.ts', import.meta.url), {
    './db': { sql: async (parts: TemplateStringsArray) => {
      const q = parts.join('?');
      if (q.includes('FROM providers')) return [providers[0]];
      assert.match(q, /COALESCE\(plans.notes, ''\) NOT LIKE/);
      return f.data.plans.filter(p => p.provider_id === 2);
    } },
    './schema-adapters': { getAllModelIdsForProvider: async () => [] },
  }) as typeof import('../../src/lib/provider-plans-query');
  const result = await getPlansByProvider('anthropic');
  assert.ok(result);
  assert.deepEqual(result.plans.map(p => p.name), ['Claude Team', 'Claude Max', 'Claude Ultra']);
  const catalog = f.data.plans.filter(p => p.provider_id === 2).map(p => ({
    kind: 'plan' as const, slug: String(p.slug), provider_slug: 'anthropic',
  }));
  for (const locale of ['en', 'zh']) for (const { oldSlug } of CLAUDE_REPLACEMENTS) {
    assert.equal(resolvePlanRedirect({ locale, slug: oldSlug }, catalog), `/${locale}/providers/anthropic#${oldSlug}`);
  }
});

test('seeded Law slug passes the real model route metadata and renders a priced page in both locales', async () => {
  const f = fakeSeedTx({ providers, plans: [] });
  await seedCatalog20261031(f.tx, true);
  const producer = { ...providers[1], name: 'OpenAI' };
  const channel = { ...f.data.api_channel_prices[0], providers: producer };
  for (const locale of ['en', 'zh']) {
    const sql = Object.assign(async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const q = parts.join('?');
      if (/FROM models\s+WHERE slug/.test(q)) return f.data.models.filter(m => m.slug === values[0]);
      if (q.includes('SELECT m.slug, m.name')) return [];
      if (q.includes('FROM api_channel_prices cp')) return [channel];
      return [];
    }, { array: (values: unknown[]) => values });
    const route = loadQueryModule(new URL('../../src/app/[locale]/models/[slug]/page.tsx', import.meta.url), {
      '@/lib/db': { sql, INT4_ARRAY: 1007 },
      '@/lib/seo-index-data': { getSeoIndexCatalog: async () => [] },
      '@/lib/model-plans-query': { getModelPlans: async () => [] },
      '@/lib/schema-adapters': { getPrimaryProvidersForModels: async () => new Map([[f.data.models[0].id, producer]]) },
      '@/lib/model-usage-prices-query': { getModelUsagePrices: async () => [] },
      '@/lib/coupons': { getActiveCouponMap: async () => new Map() },
      '@/lib/coding-agents': { getCodingAgentRowsForModel: async () => [] },
      'next-intl/server': { getTranslations: async ({ namespace }: { namespace: string }) => createTranslator({
        locale, messages: locale === 'zh' ? zh : en, namespace: namespace as 'modelDetail',
      }) },
      'next/navigation': { notFound: () => assert.fail('Law model must not 404'), permanentRedirect: () => assert.fail('Law slug must be canonical') },
      '@/components/SiteHeader': { default: () => null, __esModule: true },
    });
    const params = Promise.resolve({ locale, slug: LAW_SLUG });
    const metadata = await (route.generateMetadata as (p: { params: typeof params }) => Promise<{ title: string }>)({ params });
    assert.match(metadata.title, /GPT[ -]6 Astra for Law/);
    const content = await (route.default as (p: { params: typeof params }) => Promise<ReactElement>)({ params });
    const html = renderToStaticMarkup(createElement(NextIntlClientProvider, {
      locale, timeZone: 'UTC', messages: locale === 'zh' ? zh : en, children: content,
    }));
    assert.match(html, /GPT[ -]6 Astra for Law/);
    assert.match(html, /促销价至少至 2026-12-31/);
    assert.match(html, /USD 10/);
    assert.match(html, /USD 50/);
  }
});

test('CLI defaults to a serializable READ ONLY transaction without loading environment or connecting', async () => {
  const source = readFileSync(new URL('../seed-catalog-2026-10-31.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const queries: string[] = [];
  let ended = false;
  let resolveDone!: () => void;
  const done = new Promise<void>(resolve => { resolveDone = resolve; });
  const sql = Object.assign(async (parts: TemplateStringsArray) => { queries.push(parts.join('')); }, {
    begin: async (isolation: string, run: (tx: unknown) => Promise<void>) => {
      assert.equal(isolation, 'isolation level serializable');
      await run(sql);
    },
    end: async () => { ended = true; resolveDone(); },
  });
  runInNewContext(compiled, {
    exports: {}, process: { argv: ['node', 'seed'] }, console: { log() {}, error: assert.fail },
    require: (id: string) => {
      if (id === './data/catalog-2026-10-31') return {
        catalog20261031SeedOptions,
        seedCatalog20261031: async (_tx: unknown, apply: boolean) => {
          assert.equal(apply, false);
          assert.deepEqual(queries, ['SET TRANSACTION READ ONLY']);
          return [];
        },
      };
      assert.equal(id, './db/postgres-admin');
      return { databaseSql: sql };
    },
  });
  await done;
  assert.ok(ended);
});
