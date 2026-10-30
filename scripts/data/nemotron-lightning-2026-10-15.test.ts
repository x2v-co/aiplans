import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import type { Sql } from 'postgres';
import { getTableConfig } from 'drizzle-orm/pg-core';
import ts from 'typescript';
import { providers, models, apiChannelPrices } from '../../src/db/schema';
import { channelTermBadges } from '../../src/lib/channel-terms';
import { isExplicitlyUnverifiedPrice, isVerifiedFreeOutput, isVerifiedFreePrice } from '../utils/audit-price-policy';
import { NEMOTRON_SLUG, NEMOTRON_SOURCE, NEMOTRON_ENDPOINT, NEMOTRON_DATA_NOTE, nemotronSeedOptions, seedNemotronLightning } from './nemotron-lightning-2026-10-15';
import { auditExitCode, missingPlanFields } from '../utils/audit-plan-policy';
import { isSupersededPlan } from '../../src/lib/plan-lifecycle';

type Row = Record<string, unknown> & { id: number };
const columns = Object.fromEntries([providers, models, apiChannelPrices].map(table => {
  const config = getTableConfig(table);
  return [config.name, new Set(config.columns.map(column => column.name))];
}));
const compile = (path: string) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

/** Memory-only SQL interpreter. No real database client is imported. */
function fixture(initial: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = { providers: [], models: [], api_channel_prices: [], ...structuredClone(initial) };
  let nextId = 1000;
  let readOnly = false;
  let ended = false;
  let writes = 0;
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
        assert.ok(payload.provider_ids.every(id => data.providers.some(row => row.id === id)), 'Missing model producer');
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
    async begin(mode: string, callback: (tx: unknown) => Promise<void>) {
      assert.equal(mode, 'isolation level serializable');
      readOnly = false;
      const before = structuredClone(data);
      try { await callback(sql); } catch (error) { Object.assign(data, before); throw error; }
    },
    async end() { ended = true; },
  }) as unknown as Sql;
  async function cli(args: string[] = []) {
    const messages: string[] = [];
    const process = { argv: ['node', 'seed-nemotron-lightning', ...args], exitCode: 0 };
    const dependencies: Record<string, unknown> = {
      './data/nemotron-lightning-2026-10-15': { nemotronSeedOptions, seedNemotronLightning },
      './db/postgres-admin': { databaseSql: sql },
    };
    await runInNewContext(compile('../seed-nemotron-lightning-2026-10-15.ts'), {
      exports: {}, process,
      require(name: string) { assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`); return dependencies[name]; },
      console: { log: (...values: unknown[]) => messages.push(values.join(' ')), error: (error: unknown) => messages.push(String(error)) },
    });
    return { code: process.exitCode, output: messages.join('\n') };
  }
  return { data, sql, cli, writes: () => writes, readOnly: () => readOnly, ended: () => ended };
}

test('CLI defaults to a serializable READ ONLY dry-run and remains optional', async () => {
  for (const args of [[], ['--dry-run']]) {
    const f = fixture();
    const before = structuredClone(f.data);
    const result = await f.cli(args);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /Dry-run; no writes: 4 changes/);
    assert.match(result.output, /\[free\]/);
    assert.match(result.output, /may retain prompts/);
    assert.equal(f.writes(), 0); assert.ok(f.readOnly()); assert.ok(f.ended());
    assert.deepEqual(f.data, before);
  }
  assert.deepEqual(nemotronSeedOptions([]), { apply: false });
  assert.deepEqual(nemotronSeedOptions(['--apply']), { apply: true });
  for (const args of [['--apply', '--dry-run'], ['--unknown'], ['--apply=true']]) {
    assert.throws(() => nemotronSeedOptions(args), /Usage:/);
    await assert.rejects(fixture().cli(args), /Usage:/);
  }
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:nemotron-lightning'], 'tsx scripts/seed-nemotron-lightning-2026-10-15.ts');
  assert.equal(pkg.scripts['seed:nemotron-lightning:apply'], `${pkg.scripts['seed:nemotron-lightning']} --apply`);
  for (const file of ['../../deploy/production/rollout.sh', '../../deploy/production/run-scrapers.sh', '../../.github/workflows/deploy-production.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /seed:nemotron-lightning|seed-nemotron-lightning/);
  }
});

test('apply creates NVIDIA model specs and a verified free Vercel channel; reruns report zero changes', async () => {
  const f = fixture();
  const result = await f.cli(['--apply']);
  assert.equal(result.code, 0, result.output);
  assert.equal(f.data.providers.length, 2);
  assert.equal(f.data.models.length, 1);
  assert.equal(f.data.api_channel_prices.length, 1);
  const nvidia = f.data.providers.find(row => row.slug === 'nvidia')!;
  const gateway = f.data.providers.find(row => row.slug === 'vercel-ai-gateway')!;
  const model = f.data.models[0];
  const channel = f.data.api_channel_prices[0];
  assert.equal(model.slug, NEMOTRON_SLUG); assert.equal(model.name, 'Nemotron 3.5 Lightning');
  assert.deepEqual(model.provider_ids, [nvidia.id]); assert.equal(nvidia.name, 'NVIDIA');
  assert.equal(model.open_source, true); assert.equal(model.context_window, 1_000_000);
  assert.equal(model.parameters, '30B'); assert.equal(model['active parameters'], '3B');
  assert.match(String(model.description), /hybrid Mamba-2 MoE/);
  assert.equal(model.type, 'llm'); assert.equal(model.model_category, 'text');
  assert.equal(channel.model_id, model.id); assert.equal(channel.provider_id, gateway.id);
  assert.equal(gateway.type, 'aggregator');
  assert.equal(channel.input_price_per_1m, 0); assert.equal(channel.output_price_per_1m, 0);
  assert.equal(channel.cached_input_price_per_1m, null);
  assert.equal(channel.currency, 'USD'); assert.equal(channel.price_unit, 'per_1m_tokens');
  assert.equal(channel.data_for_discount, true); assert.equal(channel.data_for_discount_note, NEMOTRON_DATA_NOTE);
  assert.equal(channel.is_available, true);
  assert.equal((channel.last_verified as Date).toISOString(), '2026-10-15T00:00:00.000Z');
  assert.match(String(channel.notes), /^\[free\]/);
  assert.ok(String(channel.notes).includes(NEMOTRON_ENDPOINT));
  assert.ok(String(channel.notes).includes(NEMOTRON_SOURCE));
  for (const key of ['promo_ends_at', 'regular_input_price_per_1m', 'regular_output_price_per_1m', 'regular_cached_input_price_per_1m']) assert.equal(channel[key], null);
  assert.deepEqual(channelTermBadges(channel), [{ kind: 'training', note: NEMOTRON_DATA_NOTE }]);
  const writes = f.writes();
  // Simulate PostgreSQL decoding a date as a string instead of a Date.
  channel.last_verified = '2026-10-15';
  assert.deepEqual(await seedNemotronLightning(f.sql, true), []);
  assert.deepEqual(await seedNemotronLightning(f.sql), []);
  const rerun = await f.cli(['--apply']);
  assert.equal(rerun.code, 0, rerun.output); assert.match(rerun.output, /Applied: 0 changes/);
  assert.equal(f.writes(), writes);
});

test('reuses either Vercel provider, repairs stale owned fields and preserves unrelated data', async () => {
  for (const slug of ['vercel', 'vercel-ai-gateway']) {
    const f = fixture({
      providers: [{ id: 1, slug: 'nvidia', name: 'NVIDIA', logo_url: '/nvidia.svg' },
        { id: 2, slug, name: 'Vercel AI Gateway', logo_url: '/vercel.svg', pricing_url: '/keep' }],
      models: [{ id: 3, slug: 'nvidia-nemotron-3-5-lightning', context_window: 10, open_source: false, max_output_tokens: 123 },
        { id: 4, slug: 'unrelated', provider_ids: [1] }],
      api_channel_prices: [{ id: 5, model_id: 3, provider_id: 2, input_price_per_1m: 99, promo_ends_at: '2026-10-01' },
        { id: 6, model_id: 4, provider_id: 2, input_price_per_1m: 9 },
        { id: 7, model_id: 3, provider_id: 1, input_price_per_1m: 7 }],
    });
    const before = structuredClone(f.data);
    assert.equal((await seedNemotronLightning(f.sql)).length, 2);
    assert.equal(f.writes(), 0); assert.deepEqual(f.data, before);
    await seedNemotronLightning(f.sql, true);
    assert.deepEqual(f.data.providers, before.providers);
    assert.equal(f.data.models.length, 2); assert.equal(f.data.models[0].id, 3);
    assert.equal(f.data.models[0].slug, NEMOTRON_SLUG);
    assert.equal(f.data.models[0].max_output_tokens, 123);
    assert.deepEqual(f.data.models[1], before.models[1]);
    assert.equal(f.data.api_channel_prices[0].id, 5);
    assert.equal(f.data.api_channel_prices[0].input_price_per_1m, 0);
    assert.deepEqual(f.data.api_channel_prices.slice(1), before.api_channel_prices.slice(1));
    assert.deepEqual(await seedNemotronLightning(f.sql, true), []);
  }
});

test('ambiguous providers, model aliases and channel rows abort before writes and close the client', async () => {
  const cases = [
    { providers: [{ id: 1, slug: 'vercel' }, { id: 2, slug: 'vercel-ai-gateway' }] },
    { providers: [{ id: 1, slug: 'nvidia' }, { id: 2, slug: 'nvidia' }] },
    { models: [{ id: 1, slug: NEMOTRON_SLUG }, { id: 2, slug: NEMOTRON_ENDPOINT }] },
    { providers: [{ id: 1, slug: 'vercel' }], models: [{ id: 2, slug: NEMOTRON_SLUG }],
      api_channel_prices: [{ id: 3, model_id: 2, provider_id: 1 }, { id: 4, model_id: 2, provider_id: 1 }] },
  ];
  for (const initial of cases) {
    for (const args of [[], ['--apply']]) {
      const f = fixture(initial); const before = structuredClone(f.data);
      const result = await f.cli(args);
      assert.equal(result.code, 1); assert.match(result.output, /Ambiguous/);
      assert.deepEqual(f.data, before); assert.equal(f.writes(), 0); assert.ok(f.ended());
    }
  }
});

test('free policy is specific to the verified model and Vercel channel and preserves existing free exceptions', () => {
  for (const slug of ['vercel', 'vercel-ai-gateway']) assert.equal(isVerifiedFreePrice(NEMOTRON_SLUG, slug), true);
  for (const slug of ['nvidia', 'openrouter', undefined]) assert.equal(isVerifiedFreePrice(NEMOTRON_SLUG, slug), false);
  assert.equal(isVerifiedFreePrice('other-model', 'vercel'), false);
  assert.equal(isVerifiedFreePrice(undefined, 'vercel'), false);
  for (const slug of ['glm-4.7-flash', 'glm-4.6v-flash']) assert.equal(isVerifiedFreePrice(slug, 'zhipu-china'), true);
  assert.equal(isExplicitlyUnverifiedPrice({ input_price_per_1m: 0, output_price_per_1m: 0, last_verified: '2026-10-15', notes: '[free]' }), false);
});

test('real audit accepts the free channel while another zero-priced channel remains critical (memory only)', async () => {
  const f = fixture(); await seedNemotronLightning(f.sql, true);
  const model = f.data.models[0]; const free = f.data.api_channel_prices[0];
  for (const otherChannel of [false, true]) {
    const messages: string[] = [];
    const process = { argv: ['node', 'audit-data', '--json'], exitCode: 0, exit(code: number) { throw new Error(`Audit exited ${code}: ${messages.join('\n')}`); } };
    const prices = [free, ...(otherChannel ? [{ ...free, id: 999, provider_id: model.provider_ids instanceof Array ? model.provider_ids[0] : null }] : [])];
    const tables = { ...f.data, api_channel_prices: prices, plans: [], model_plan_mapping: [], exchange_rates: [] };
    const db = { from(table: string) {
      assert.ok(Object.hasOwn(tables, table));
      const builder = {
        select: () => builder, eq: () => builder, order: () => builder,
        then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: tables[table as keyof typeof tables], error: null }).then(resolve),
      };
      return builder;
    } };
    const databaseSql = async (parts: TemplateStringsArray) => {
      assert.match(parts.join('?'), /information_schema.columns|FROM model_benchmark_scores AS score/);
      return [];
    };
    const dependencies: Record<string, unknown> = {
      './utils/audit-price-policy': { isExplicitlyUnverifiedPrice, isVerifiedFreeOutput, isVerifiedFreePrice },
      './utils/audit-plan-policy': { auditExitCode, missingPlanFields },
      './db/queries': { db }, './db/postgres-admin': { databaseSql },
      '../src/lib/plan-lifecycle': { isSupersededPlan },
      '../src/lib/plan-selector': { resolveSelector() { throw new Error('Unexpected selector resolution'); } },
      './scrapers/modelsdev': { fetchModelsDevCatalog: async () => { throw new Error('Offline test'); }, PLAN_DRIFT_SKIP: new Set() },
    };
    await runInNewContext(compile('../audit-data.ts'), {
      exports: {}, process,
      require(name: string) { assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`); return dependencies[name]; },
      console: { log: (message: string) => messages.push(message), error: (error: unknown) => messages.push(String(error)) },
    });
    const report = JSON.parse(messages.join('\n')) as { findings: { check: string; severity: string; ref?: { price_id: number } }[] };
    assert.ok(!report.findings.some(finding => finding.ref?.price_id === free.id && finding.severity === 'critical'));
    const zeroFindings = report.findings.filter(finding => finding.check === 'prices.zero_or_null');
    assert.equal(zeroFindings.length, otherChannel ? 2 : 0);
    assert.ok(zeroFindings.every(finding => finding.ref?.price_id === 999));
  }
});
