import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import type { Sql } from 'postgres';
import ts from 'typescript';
import { resolveSelector, type ModelSelector } from '../../src/lib/plan-selector';
import { generateOpenRouterSlug } from '../scrapers/openrouter';
import { GO_MODELS, GO_SOURCE, goSeedOptions, seedOpenCodeGo } from './opencode-go-2026-10-15';

type Row = Record<string, unknown> & { id: number };
/** Execute the real seed against memory only; unexpected SQL fails closed. */
function fixture(initial: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = {
    providers: [], models: [], plans: [], api_channel_prices: [], api_channel_price_variants: [], model_plan_mapping: [],
    ...structuredClone(initial),
  };
  let id = 10000;
  let readOnly = false;
  let ended = false;
  const writes: string[] = [];
  const fragment = (value: unknown) => (value as { fragment: unknown }).fragment;
  const tx = (parts: TemplateStringsArray | unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const query = parts.join('?').trim();
    if (query === 'SET TRANSACTION READ ONLY') { readOnly = true; return Promise.resolve([]); }
    if (query === "SELECT * FROM providers WHERE slug = 'opencode-go'") return Promise.resolve(structuredClone(data.providers.filter(row => row.slug === 'opencode-go')));
    if (query === 'SELECT * FROM models WHERE slug IN ?') return Promise.resolve(structuredClone(data.models.filter(row => (fragment(values[0]) as unknown[]).includes(row.slug))));
    if (query === 'SELECT * FROM ? WHERE provider_id = ?') return Promise.resolve(structuredClone(data[String(fragment(values[0]))].filter(row => row.provider_id === values[1])));
    if (query === 'SELECT * FROM model_plan_mapping WHERE plan_id IN ?') return Promise.resolve(structuredClone(data.model_plan_mapping.filter(row => (fragment(values[0]) as unknown[]).includes(row.plan_id))));
    assert.equal(readOnly, false, `Write attempted in read-only transaction: ${query}`);
    const table = String(fragment(values[0]));
    const payload = fragment(values[1]) as Record<string, unknown>;
    if (table === 'model_plan_mapping') assert.ok(!('updated_at' in payload), 'mapping table has no updated_at');
    if (query === 'INSERT INTO ? ? RETURNING id') {
      const identity = table === 'plans' ? ['provider_id', 'slug']
        : table === 'api_channel_prices' ? ['provider_id', 'model_id']
          : table === 'api_channel_price_variants' ? ['provider_id', 'model_id', 'variant_key']
            : table === 'model_plan_mapping' ? ['plan_id', 'model_id'] : ['slug'];
      assert.ok(!data[table].some(row => identity.every(key => row[key] === payload[key])), `Duplicate ${table}`);
      for (const [key, parent] of [['provider_id', 'providers'], ['model_id', 'models'], ['plan_id', 'plans']]) {
        if (payload[key] !== undefined) assert.ok(data[parent].some(row => row.id === payload[key]), `Missing ${parent} reference`);
      }
      const row = { ...payload, id: id++ };
      data[table].push(row); writes.push(query); return Promise.resolve([{ id: row.id }]);
    }
    if (query === 'UPDATE ? SET ? WHERE id = ?') {
      const row = data[table].find(row => row.id === values[2]);
      assert.ok(row); Object.assign(row, payload); writes.push(query); return Promise.resolve([]);
    }
    throw new Error(`Unexpected SQL: ${query}`);
  };
  const sql = Object.assign(tx, {
    async begin(mode: string, callback: (tx: unknown) => Promise<void>) {
      assert.equal(mode, 'isolation level serializable');
      const before = structuredClone(data);
      try { await callback(tx); } catch (error) { Object.assign(data, before); throw error; }
    },
    async end() { ended = true; },
  }) as unknown as Sql;

  async function cli(args: string[] = []) {
    const source = readFileSync(new URL('../seed-opencode-go-2026-10-15.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const messages: string[] = [];
    const process = { argv: ['node', 'seed-opencode-go', ...args], exitCode: 0 };
    const dependencies: Record<string, unknown> = {
      './data/opencode-go-2026-10-15': { goSeedOptions, seedOpenCodeGo }, './db/postgres-admin': { databaseSql: sql },
    };
    await runInNewContext(compiled, {
      exports: {}, process,
      require(name: string) { assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`); return dependencies[name]; },
      console: { log: (...values: unknown[]) => messages.push(values.join(' ')), error: (error: unknown) => messages.push(String(error)) },
    });
    return { code: process.exitCode, output: messages.join('\n') };
  }
  return { sql, data, writes, cli, isReadOnly: () => readOnly, ended: () => ended };
}

test('actual CLI defaults to a read-only preview, rejects unsafe flags, and closes its client', async () => {
  const f = fixture();
  const before = structuredClone(f.data);
  const result = await f.cli();
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /Dry-run; no writes/);
  assert.match(result.output, /opencode-go-plus/);
  assert.equal(f.isReadOnly(), true);
  assert.equal(f.ended(), true);
  assert.deepEqual(f.data, before);
  assert.equal(f.writes.length, 0);
  assert.deepEqual(goSeedOptions([]), { apply: false });
  assert.deepEqual(goSeedOptions(['--dry-run']), { apply: false });
  assert.deepEqual(goSeedOptions(['--apply']), { apply: true });
  for (const args of [['--apply', '--dry-run'], ['--unknown'], ['--apply=true']]) assert.throws(() => goSeedOptions(args), /Usage:/);
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:opencode-go'], 'tsx scripts/seed-opencode-go-2026-10-15.ts');
  assert.equal(pkg.scripts['seed:opencode-go:apply'], `${pkg.scripts['seed:opencode-go']} --apply`);
});

test('applies verified plans, per-model limits, Contributor terms and both DeepSeek windows idempotently', async () => {
  const f = fixture();
  const result = await f.cli(['--apply']);
  assert.equal(result.code, 0, result.output);
  assert.equal(f.data.providers.length, 1);
  assert.equal(f.data.providers[0].name, 'OpenCode Go');
  assert.equal(f.data.providers[0].pricing_url, GO_SOURCE);
  assert.equal(f.data.models.length, 5);
  assert.equal(f.data.plans.length, 2);
  assert.equal(f.data.api_channel_prices.length, 5);
  assert.equal(f.data.api_channel_price_variants.length, 4);
  assert.equal(f.data.model_plan_mapping.length, 10);

  for (const [index, plan] of f.data.plans.entries()) {
    assert.equal(plan.name, index === 0 ? 'Go' : 'Go Plus');
    assert.equal(plan.price, index === 0 ? 10 : 40);
    assert.equal(plan.quota_unit, 'usd');
    assert.equal(plan.source, 'manual');
    assert.equal(plan.annual_price, null);
    assert.equal(plan.monthly_api_credit_usd, null, 'separate per-model limits must not become a shared pool');
    assert.equal(plan.access_from_china, null);
    assert.match(String(plan.notes), /5-hour = 20%, weekly = 50%, monthly = 100%/);
    assert.match(String(plan.notes), /Single-member workspaces only/);
    for (const [name, limits] of [['Gemini 4 Argon Contributor', [60, 240]], ['Muse Spark 1.3 Contributor', [60, 120]], ['Muse Spark 1.2 Contributor', [60, 120]], ['DeepSeek V4.1 Flash', [80, 160]], ['DeepSeek V4 Pro', [15, 60]]] as const) {
      assert.ok(String(plan.notes).includes(`${name}: $${limits[index]}/month`));
    }
    const resolved = resolveSelector(plan.model_selector as ModelSelector, f.data.models.map(model => ({ id: model.id, slug: String(model.slug), providerSlugs: [], elo: null })));
    assert.equal(resolved.models.length, 5);
    assert.deepEqual(resolved.unknownExtra, []);
  }
  const expected = [
    [4, 20, 0.2], [0.1, 0.2, 0.002], [0.1, 0.2, 0.002], [0.15, 0.6, 0.003], [0.66, 1.98, 0.022],
  ];
  for (const [index, channel] of f.data.api_channel_prices.entries()) {
    assert.deepEqual([channel.input_price_per_1m, channel.output_price_per_1m, channel.cached_input_price_per_1m], expected[index]);
    assert.equal(channel.currency, 'USD');
    assert.equal(channel.quota_unit, 'usd');
    assert.equal(channel.data_for_discount, index < 3 ? true : null);
    assert.equal(channel.promo_ends_at, null);
    assert.equal(new Date(channel.last_verified as Date).toISOString().slice(0, 10), '2026-10-15');
    assert.ok(String(channel.notes).includes(GO_SOURCE));
  }
  const argon = f.data.api_channel_prices[0];
  assert.match(String(argon.data_for_discount_note), /Google.*not ZDR/);
  assert.match(String(argon.notes), /\$30 -> \$60.*\$120 -> \$240/);
  for (const channel of f.data.api_channel_prices.slice(1, 3)) assert.match(String(channel.data_for_discount_note), /Meta training.*Limited regions/);
  assert.deepEqual(f.data.api_channel_price_variants.map(row => [row.variant_key, row.input_price_per_1m, row.output_price_per_1m, row.cached_input_price_per_1m]), [
    ['off-peak', 0.15, 0.6, 0.003], ['peak', 0.3, 1.2, 0.006], ['off-peak', 0.66, 1.98, 0.022], ['peak', 1.32, 3.96, 0.044],
  ]);
  for (const variant of f.data.api_channel_price_variants) {
    assert.equal((variant.constraints_json as Record<string, unknown>).schedule_status, 'needs-verification');
    assert.equal(variant.is_headline, variant.variant_key === 'off-peak');
  }
  for (const model of f.data.models) {
    assert.deepEqual(model.provider_ids, []);
    assert.equal(model.context_window, null);
    assert.equal(model.open_source, null);
  }
  const before = structuredClone(f.data);
  const writes = f.writes.length;
  assert.deepEqual(await seedOpenCodeGo(f.sql, true), []);
  assert.equal(f.writes.length, writes);
  assert.deepEqual(await seedOpenCodeGo(f.sql), []);
  assert.deepEqual(f.data, before);
});

test('reuses existing catalog aliases, repairs owned rows, and preserves producer metadata and other channels', async () => {
  const existingModels = GO_MODELS.map((model, index) => ({ id: 100 + index, slug: model.slugs.at(-1)!, name: 'Existing name', provider_ids: [999], context_window: 123456 }));
  const f = fixture({
    providers: [{ id: 1, slug: 'opencode-go', name: 'OpenCode Go', logo_url: '/existing-logo.svg' }],
    models: [...existingModels, { id: 200, slug: 'deepseek-v4-flash', name: 'Older Flash' }],
    plans: [{ id: 10, provider_id: 1, slug: 'opencode-go', price: 9 }],
    api_channel_prices: [{ id: 20, model_id: 100, provider_id: 1, input_price_per_1m: 999 }, { id: 21, model_id: 100, provider_id: 999, input_price_per_1m: 2 }],
    model_plan_mapping: [{ id: 30, plan_id: 10, model_id: 100, source: 'derived', priority: 5 }],
  });
  const before = structuredClone(f.data);
  assert.ok((await seedOpenCodeGo(f.sql)).length > 0);
  assert.deepEqual(f.data, before);
  await seedOpenCodeGo(f.sql, true);
  assert.deepEqual(f.data.models, before.models);
  assert.deepEqual(f.data.providers, before.providers);
  assert.deepEqual(f.data.api_channel_prices.find(row => row.id === 21), before.api_channel_prices[1]);
  assert.equal(f.data.api_channel_prices.find(row => row.id === 20)?.input_price_per_1m, 4);
  assert.equal(f.data.model_plan_mapping.find(row => row.id === 30)?.source, 'manual');
  assert.equal(f.data.model_plan_mapping.find(row => row.id === 30)?.priority, 5);
  assert.ok(!f.data.api_channel_prices.some(row => row.model_id === 200));
  assert.deepEqual(await seedOpenCodeGo(f.sql, true), []);
  // Match #120's existing OpenRouter Contributor identities; no duplicate Muse models.
  for (const version of ['1.3', '1.2']) assert.ok(GO_MODELS.some(model => model.slugs.includes(generateOpenRouterSlug(`meta/muse-spark-${version}-contributor`))));
});

test('duplicate channel identities abort and roll back the entire apply', async () => {
  const f = fixture({ providers: [{ id: 1, slug: 'opencode-go' }], models: [{ id: 2, slug: 'gemini-4-argon' }],
    api_channel_prices: [{ id: 3, provider_id: 1, model_id: 2 }, { id: 4, provider_id: 1, model_id: 2 }],
  });
  const before = structuredClone(f.data);
  const result = await f.cli(['--apply']);
  assert.equal(result.code, 1);
  assert.match(result.output, /Ambiguous api_channel_prices/);
  assert.deepEqual(f.data, before);
  assert.equal(f.ended(), true);
  const ambiguousModels = fixture({ models: [{ id: 1, slug: 'deepseek-v4.1-flash' }, { id: 2, slug: 'deepseek-v4-1-flash' }] });
  await assert.rejects(seedOpenCodeGo(ambiguousModels.sql), /Ambiguous models/);
  assert.equal(ambiguousModels.writes.length, 0);
});
