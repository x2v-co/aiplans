import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import type { Sql } from 'postgres';
import { getTableConfig } from 'drizzle-orm/pg-core';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { providers, models, apiChannelPrices } from '../../src/db/schema';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import { DECIDER_SOURCE, PERPLEXITY_DECIDER_CATALOG } from '../../src/lib/perplexity-decider-catalog';
import { AuditedPricingFacts, DecisionModelCatalog } from '../../src/components/audited-catalog';
import { isVerifiedFreeOutput, isVerifiedFreePrice } from '../utils/audit-price-policy';
import { GLIMPSE_SLUG, GLIMPSE_SOURCE, glimpseDeciderSeedOptions, seedGlimpseDecider } from './glimpse-decider-2026-10-17';

type Row = Record<string, unknown> & { id: number };
const columns = Object.fromEntries([providers, models, apiChannelPrices].map(table => {
  const config = getTableConfig(table);
  return [config.name, new Set(config.columns.map(column => column.name))];
}));

/** Memory-only database: rejects unknown SQL/columns, duplicate keys, broken FKs and read-only writes. */
function fixture(initial: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = { providers: [], models: [], api_channel_prices: [], ...structuredClone(initial) };
  let nextId = 1000;
  let writes = 0;
  let readOnly = false;
  let ended = false;
  const fragment = (value: unknown) => (value as { fragment: unknown }).fragment;
  const tx = (parts: TemplateStringsArray | unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    if (query === 'SET TRANSACTION READ ONLY') { readOnly = true; return Promise.resolve([]); }
    for (const table of ['providers', 'models']) {
      if (query === `SELECT * FROM ${table} WHERE slug IN ?`) {
        return Promise.resolve(structuredClone(data[table].filter(row => (fragment(values[0]) as unknown[]).includes(row.slug))));
      }
    }
    if (query === 'SELECT * FROM api_channel_prices WHERE model_id = ? AND provider_id = ?') {
      return Promise.resolve(structuredClone(data.api_channel_prices.filter(row => row.model_id === values[0] && row.provider_id === values[1])));
    }
    assert.equal(readOnly, false, `Write in read-only transaction: ${query}`);
    const table = String(fragment(values[0]));
    assert.ok(Object.hasOwn(columns, table), `Unexpected table: ${table}`);
    const payload = fragment(values[1]) as Record<string, unknown>;
    for (const key of Object.keys(payload)) assert.ok(columns[table].has(key), `Unknown ${table} column: ${key}`);
    if (query === 'INSERT INTO ? ? RETURNING id') {
      const keys = table === 'api_channel_prices' ? ['model_id', 'provider_id'] : ['slug'];
      assert.ok(!data[table].some(row => keys.every(key => row[key] === payload[key])), `Duplicate ${table}`);
      for (const [key, parent] of [['model_id', 'models'], ['provider_id', 'providers']]) {
        if (payload[key] != null) assert.ok(data[parent].some(row => row.id === payload[key]), `Missing ${parent}`);
      }
      if (Array.isArray(payload.provider_ids)) {
        assert.ok(payload.provider_ids.every(id => data.providers.some(row => row.id === id)), 'Missing producer');
      }
      const row = { ...payload, id: nextId++ };
      data[table].push(row); writes++; return Promise.resolve([{ id: row.id }]);
    }
    if (query === 'UPDATE ? SET ? WHERE id = ?') {
      const row = data[table].find(row => row.id === values[2]);
      assert.ok(row); Object.assign(row, payload); writes++; return Promise.resolve([]);
    }
    throw new Error(`Unexpected SQL: ${query}`);
  };
  const sql = Object.assign(tx, {
    async begin(mode: string, callback: (tx: Sql) => Promise<unknown>) {
      assert.equal(mode, 'isolation level serializable');
      readOnly = false;
      const before = structuredClone(data);
      try { return await callback(sql); } catch (error) { Object.assign(data, before); throw error; }
    },
    async end() { ended = true; },
  }) as unknown as Sql;
  async function cli(args: string[] = []) {
    const messages: string[] = [];
    const process = { argv: ['node', 'seed-glimpse-decider', ...args], exitCode: 0 };
    const dependencies: Record<string, unknown> = {
      './data/glimpse-decider-2026-10-17': { glimpseDeciderSeedOptions, seedGlimpseDecider },
      './db/postgres-admin': { databaseSql: sql },
    };
    const compiled = ts.transpileModule(readFileSync(new URL('../seed-glimpse-decider-2026-10-17.ts', import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    await runInNewContext(compiled, {
      exports: {}, process,
      require(name: string) { assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`); return dependencies[name]; },
      console: { log: (...values: unknown[]) => messages.push(values.join(' ')), error: (error: unknown) => messages.push(String(error)) },
    });
    return { code: process.exitCode, output: messages.join('\n') };
  }
  // Exercise persistence solely in memory; the CLI never runs with --apply.
  const persist = () => sql.begin('isolation level serializable', rawTx => seedGlimpseDecider(rawTx as unknown as Sql, true));
  return { data, sql, cli, persist, writes: () => writes, readOnly: () => readOnly, ended: () => ended };
}

test('default and explicit dry-run print missing providers and all seven data rows without writes', async () => {
  for (const args of [[], ['--dry-run']]) {
    const f = fixture();
    const before = structuredClone(f.data);
    const result = await f.cli(args);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /Dry-run; no writes: 11 changes/);
    for (const slug of ['elorian', 'perplexity', 'openrouter', 'vercel-ai-gateway']) {
      assert.ok(result.output.includes(`Would create provider: ${slug}`));
    }
    assert.match(result.output, /220000/);
    assert.match(result.output, /262144/);
    assert.match(result.output, /Negative IDs/);
    assert.equal(f.writes(), 0); assert.ok(f.readOnly()); assert.ok(f.ended());
    assert.deepEqual(f.data, before);
  }
  assert.deepEqual(glimpseDeciderSeedOptions([]), { apply: false });
  assert.deepEqual(glimpseDeciderSeedOptions(['--apply']), { apply: true });
  for (const args of [['--apply', '--dry-run'], ['--unknown'], ['--apply=true']]) {
    await assert.rejects(fixture().cli(args), /Usage:/);
  }
  const f = fixture();
  assert.equal((await seedGlimpseDecider(f.sql)).length, 11);
  assert.equal(f.writes(), 0);
});

test('persistence writes only verified specs and four channel prices, and reruns are no-ops', async () => {
  const f = fixture();
  await f.persist();
  assert.deepEqual([f.data.providers.length, f.data.models.length, f.data.api_channel_prices.length], [4, 3, 4]);
  const glimpse = f.data.models.find(row => row.slug === GLIMPSE_SLUG)!;
  assert.equal(glimpse.name, 'Elorian Glimpse');
  assert.equal(glimpse.context_window, 262144);
  assert.equal(glimpse.offical_link, GLIMPSE_SOURCE);
  assert.deepEqual(glimpse.input_modalities, ['image', 'video']);
  assert.deepEqual(glimpse.output_modalities, ['text']);
  assert.equal(f.data.providers.find(row => row.id === (glimpse.provider_ids as number[])[0])!.slug, 'elorian');
  for (const row of f.data.api_channel_prices) {
    assert.equal(row.currency, 'USD'); assert.equal(row.price_unit, 'per_1m_tokens');
    assert.equal(row.is_available, true);
    assert.equal((row.last_verified as Date).toISOString(), '2026-10-17T00:00:00.000Z');
    if (row.model_id === glimpse.id) {
      assert.deepEqual([row.input_price_per_1m, row.output_price_per_1m, row.cached_input_price_per_1m], [0.6, 3, 0.06]);
      const gateway = f.data.providers.find(p => p.id === row.provider_id)!;
      assert.ok(String(row.notes).includes(gateway.slug === 'openrouter' ? '262144' : '220000'));
    }
  }
  for (const item of PERPLEXITY_DECIDER_CATALOG) {
    const model = f.data.models.find(row => row.slug === item.slug)!;
    assert.equal(model.model_category, 'decision'); assert.equal(model.type, 'llm');
    assert.equal(model.open_source, true); assert.equal(model.license, 'Apache-2.0');
    assert.equal(model.context_window, 262144); assert.equal(model.offical_link, DECIDER_SOURCE);
    assert.equal(f.data.providers.find(row => row.id === (model.provider_ids as number[])[0])!.slug, 'perplexity');
    const channels = f.data.api_channel_prices.filter(row => row.model_id === model.id);
    assert.equal(channels.length, 1);
    assert.equal(f.data.providers.find(p => p.id === channels[0].provider_id)!.slug, 'vercel-ai-gateway');
    assert.deepEqual([channels[0].input_price_per_1m, channels[0].output_price_per_1m, channels[0].cached_input_price_per_1m], [item.inputPricePer1M, 0, null]);
    assert.ok(String(channels[0].notes).includes(item.notes!));
  }
  assert.equal(f.data.models.find(row => row.slug === 'perplexity-pplx-decider-v1-2')!.parameters, '27B');
  assert.equal(f.data.models.find(row => row.slug === 'perplexity-pplx-decider-flash-v1-2')!.parameters, undefined);
  const writes = f.writes();
  assert.deepEqual(await f.persist(), []);
  assert.equal(f.writes(), writes);
  assert.deepEqual(await seedGlimpseDecider(f.sql), []);
});

test('reuses either Vercel slug and model aliases, updates stale prices and preserves unrelated rows/terms', async () => {
  for (const slug of ['vercel', 'vercel-ai-gateway']) {
    const gateway = { id: 1, slug, name: 'Existing Vercel', notes: 'Existing metadata' };
    const unrelated = { id: 2, model_id: 10, provider_id: 999, input_price_per_1m: 123, notes: 'Other channel' };
    const f = fixture({
      providers: [gateway], models: [{ id: 10, slug: 'elorian/glimpse' }],
      api_channel_prices: [{ id: 1, model_id: 10, provider_id: 1, input_price_per_1m: 9,
        output_price_per_1m: 9, data_for_discount: true, data_for_discount_note: 'Existing terms' }, unrelated],
    });
    const before = structuredClone(f.data);
    const preview = await seedGlimpseDecider(f.sql);
    assert.deepEqual(f.data, before);
    assert.ok(!preview.some(step => step.table === 'providers' && /vercel/.test(step.target)));
    await f.persist();
    assert.deepEqual(f.data.providers.find(row => row.id === 1), gateway);
    assert.equal(f.data.models.find(row => row.id === 10)!.slug, GLIMPSE_SLUG);
    const channel = f.data.api_channel_prices.find(row => row.id === 1)!;
    assert.equal(channel.input_price_per_1m, 0.6); assert.equal(channel.output_price_per_1m, 3);
    assert.equal(channel.data_for_discount, true); assert.equal(channel.data_for_discount_note, 'Existing terms');
    assert.deepEqual(f.data.api_channel_prices.find(row => row.id === 2), unrelated);
    assert.deepEqual(await f.persist(), []);
  }
});

test('duplicate providers, model aliases and channels abort atomically', async () => {
  const cases: Record<string, Row[]>[] = [
    { providers: [{ id: 1, slug: 'vercel' }, { id: 2, slug: 'vercel-ai-gateway' }] },
    { providers: [{ id: 1, slug: 'elorian' }, { id: 2, slug: 'elorian' }] },
    { models: [{ id: 1, slug: GLIMPSE_SLUG }, { id: 2, slug: 'glimpse' }] },
    { models: [{ id: 1, slug: 'perplexity-pplx-decider-v1-2' }, { id: 2, slug: 'perplexity/pplx-decider-v1.2' }] },
    { providers: [{ id: 1, slug: 'vercel' }], models: [{ id: 10, slug: GLIMPSE_SLUG }],
      api_channel_prices: [{ id: 1, model_id: 10, provider_id: 1 }, { id: 2, model_id: 10, provider_id: 1 }] },
  ];
  for (const initial of cases) {
    const f = fixture(initial);
    const before = structuredClone(f.data);
    await assert.rejects(seedGlimpseDecider(f.sql), /Ambiguous/);
    assert.equal(f.writes(), 0);
    await assert.rejects(f.persist(), /Ambiguous/);
    assert.deepEqual(f.data, before);
  }
});

test('both Deciders appear on localized decision lists/details with channel-scoped free output', () => {
  const items = catalogForKind('decision-model');
  for (const item of PERPLEXITY_DECIDER_CATALOG) {
    assert.equal(items.filter(row => row.slug === item.slug).length, 1);
    assert.equal(item.pricePer1MTasks, null);
    for (const locale of ['en', 'zh']) {
      const html = renderToStaticMarkup(createElement(DecisionModelCatalog, { items, locale }));
      assert.ok(html.includes(`/${locale}/decision-models/${item.slug}`));
      const detail = renderToStaticMarkup(createElement(AuditedPricingFacts, { item, locale }));
      assert.ok(detail.includes(`$${item.inputPricePer1M}`));
      assert.match(detail, /\$0<\/dd>/); assert.match(detail, /262144/);
      assert.match(detail, /Apache-2.0/); assert.match(detail, /Vercel AI Gateway/);
    }
    for (const gateway of ['vercel', 'vercel-ai-gateway']) {
      assert.ok(isVerifiedFreeOutput(item.slug, gateway, item.inputPricePer1M!));
      assert.equal(isVerifiedFreeOutput(item.slug, gateway, 1), false);
      assert.equal(isVerifiedFreePrice(item.slug, gateway), false);
    }
    assert.equal(isVerifiedFreeOutput(item.slug, 'perplexity', item.inputPricePer1M!), false);
    assert.equal(isVerifiedFreeOutput(item.slug, 'openrouter', item.inputPricePer1M!), false);
  }
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:glimpse-decider'], 'tsx scripts/seed-glimpse-decider-2026-10-17.ts');
  assert.equal(pkg.scripts['seed:glimpse-decider:apply'], `${pkg.scripts['seed:glimpse-decider']} --apply`);
  for (const file of ['../../deploy/production/rollout.sh', '../../deploy/production/run-scrapers.sh', '../../.github/workflows/deploy-production.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /seed:glimpse-decider|seed-glimpse-decider/);
  }
});
