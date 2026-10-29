import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import type { Sql } from 'postgres';
import ts from 'typescript';
import { CARBON_SLUG, CARBON_SOURCE, carbonModelRow, carbonChannelRow, carbonSeedOptions, seedCarbon } from './gemini-4-carbon';

type Row = Record<string, unknown> & { id: number };
type Tables = { providers: Row[]; models: Row[]; api_channel_prices: Row[] };

/** Whitelisted in-memory SQL boundary: never opens a connection or subprocess. */
function fixture(overrides: Partial<Tables> = {}) {
  const data: Tables = structuredClone({
    providers: [{ id: 7, slug: 'google', type: 'producer' }],
    models: [{ id: 9, slug: 'gemini-4-argon', name: 'Gemini 4 Argon', context_window: 1_000_000 }],
    api_channel_prices: [{ id: 29, model_id: 9, provider_id: 7, input_price_per_1m: 2, output_price_per_1m: 10, is_available: true }],
    ...overrides,
  });
  const queries: string[] = [];
  let writes = 0;
  let begins = 0;
  let ended = false;
  let nextId = 100;
  const fragment = (value: unknown) => (value as { fragment: unknown }).fragment;
  const tx = (parts: TemplateStringsArray | unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    queries.push(query);
    const select = (table: keyof Tables, predicate: (row: Row) => boolean) => Promise.resolve(structuredClone(data[table].filter(predicate)));
    if (query === "SELECT id, type FROM providers WHERE slug = 'google'") return select('providers', row => row.slug === 'google');
    if (query === 'SELECT * FROM models WHERE lower(slug) = ?') return select('models', row => String(row.slug).toLowerCase() === values[0]);
    if (query === 'SELECT * FROM api_channel_prices WHERE model_id = ? AND provider_id = ?') {
      return select('api_channel_prices', row => row.model_id === values[0] && row.provider_id === values[1]);
    }
    assert.ok(['INSERT INTO ? ? RETURNING id', 'UPDATE ? SET ? WHERE id = ?'].includes(query), `Unexpected SQL: ${query}`);
    const table = String(fragment(values[0]));
    assert.ok(table === 'models' || table === 'api_channel_prices');
    const payload = structuredClone(fragment(values[1])) as Record<string, unknown>;
    if (query.startsWith('INSERT')) {
      const row = { ...payload, id: nextId++ };
      data[table].push(row);
      writes++;
      return Promise.resolve([{ id: row.id }]);
    }
    const row = data[table].find(row => row.id === values[2]);
    assert.ok(row);
    Object.assign(row, payload);
    writes++;
    return Promise.resolve([]);
  };
  const sql = Object.assign(tx, {
    async begin(mode: string, callback: (tx: unknown) => Promise<unknown>) {
      assert.equal(mode, 'isolation level serializable');
      begins++;
      return callback(sql);
    },
    async end() { ended = true; },
  }) as unknown as Sql;
  return { data, sql, queries, writes: () => writes, begins: () => begins, ended: () => ended };
}

test('Carbon identity and reference prices match the announcement; unknown specs remain null', () => {
  const model = carbonModelRow(7);
  assert.equal(model.slug, CARBON_SLUG);
  assert.equal(model.name, 'Gemini 4 Carbon');
  assert.equal(model.type, 'llm');
  assert.deepEqual(model.provider_ids, [7]);
  assert.equal(model.offical_link, CARBON_SOURCE);
  assert.match(model.description, /^Status: announced\./);
  assert.match(model.description, /trusted partners through the Fairwind Program/);
  for (const key of ['context_window', 'max_output_tokens', 'released_at', 'parameters', 'active parameters',
    'input_modalities', 'output_modalities', 'capabilities', 'open_source'] as const) assert.equal(model[key], null);
  const channel = carbonChannelRow(7, null);
  assert.deepEqual([channel.input_price_per_1m, channel.output_price_per_1m, channel.cached_input_price_per_1m], [2, 10, 0.1]);
  assert.equal(channel.cached_input_price_per_1m / channel.input_price_per_1m, 0.05);
  assert.equal(channel.is_available, false);
  assert.equal(channel.availability_locked, true);
  assert.equal(channel.promo_ends_at, null);
  assert.equal(channel.regular_input_price_per_1m, null);
  assert.match(channel.notes, /reference only/);
  assert.match(channel.notes, /95% off/);
  assert.ok(channel.notes.includes(CARBON_SOURCE));
});

test('default preview performs SELECT only, makes no writes, and leaves transaction ownership to the caller', async () => {
  const f = fixture();
  const before = structuredClone(f.data);
  const steps = await seedCarbon(f.sql);
  assert.equal(steps.length, 2);
  assert.ok(steps.every(step => step.action === 'insert'));
  assert.equal(f.writes(), 0);
  assert.equal(f.begins(), 0);
  assert.ok(f.queries.every(query => query.startsWith('SELECT ')));
  assert.deepEqual(f.data, before);
});

test('apply then repeated dry-run/apply is idempotent; other models and channels remain identical', async () => {
  const f = fixture();
  const before = structuredClone(f.data);
  assert.equal((await seedCarbon(f.sql, true)).length, 2);
  const model = f.data.models.find(row => row.slug === CARBON_SLUG)!;
  const channel = f.data.api_channel_prices.find(row => row.model_id === model.id)!;
  assert.deepEqual(channel, { ...carbonChannelRow(7, model.id), id: channel.id, updated_at: channel.updated_at });
  assert.equal(channel.is_available, false);
  assert.deepEqual(f.data.models[0], before.models[0]);
  assert.deepEqual(f.data.api_channel_prices[0], before.api_channel_prices[0]);
  const seeded = structuredClone(f.data);
  const start = f.queries.length;
  assert.deepEqual(await seedCarbon(f.sql), []);
  assert.deepEqual(await seedCarbon(f.sql), []);
  assert.ok(f.queries.slice(start).every(query => query.startsWith('SELECT ')));
  assert.deepEqual(await seedCarbon(f.sql, true), []);
  assert.equal(f.writes(), 2);
  assert.deepEqual(f.data, seeded);
});

test('an existing Carbon row is corrected without deleting or updating another provider channel', async () => {
  const f = fixture({
    models: [{ ...carbonModelRow(7), id: 10, context_window: 128_000 }],
    api_channel_prices: [
      { ...carbonChannelRow(7, 10), id: 30, is_available: true, availability_locked: false },
      { id: 31, model_id: 10, provider_id: 8, notes: 'Third-party record', is_available: false },
    ],
  });
  const other = structuredClone(f.data.api_channel_prices[1]);
  const preview = await seedCarbon(f.sql);
  assert.equal(preview.length, 2);
  assert.equal(preview[0].changes.context_window.to, null);
  assert.equal(preview[1].changes.is_available.to, false);
  assert.equal(f.writes(), 0);
  await seedCarbon(f.sql, true);
  assert.deepEqual(await seedCarbon(f.sql), []);
  assert.deepEqual(f.data.api_channel_prices[1], other);
});

test('provider/model/channel ambiguity aborts before writes', async () => {
  for (const overrides of [
    { providers: [] },
    { providers: [{ id: 7, slug: 'google', type: 'reseller' }] },
    { models: [{ id: 10, slug: CARBON_SLUG }, { id: 11, slug: CARBON_SLUG.toUpperCase() }] },
    { models: [{ id: 10, slug: CARBON_SLUG }], api_channel_prices: [
      { id: 30, model_id: 10, provider_id: 7 }, { id: 31, model_id: 10, provider_id: 7 },
    ] },
  ]) {
    const f = fixture(overrides);
    await assert.rejects(seedCarbon(f.sql, true), /nothing written/);
    assert.equal(f.writes(), 0);
  }
});

test('CLI defaults and explicit dry-run use only SELECT; apply owns exactly one transaction', async () => {
  const compiled = ts.transpileModule(readFileSync(new URL('../seed-gemini-4-carbon.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const args of [[], ['--dry-run'], ['--apply']]) {
    const f = fixture();
    const process = { argv: ['node', 'seed-gemini-4-carbon', ...args], exitCode: 0 };
    const logs: string[] = [];
    const dependencies: Record<string, unknown> = {
      './db/postgres-admin': { databaseSql: f.sql },
      './data/gemini-4-carbon': { carbonSeedOptions, seedCarbon },
    };
    await runInNewContext(compiled, {
      exports: {}, process,
      require(name: string) { assert.ok(Object.hasOwn(dependencies, name)); return dependencies[name]; },
      console: { log: (...values: unknown[]) => logs.push(values.join(' ')), error: (error: unknown) => logs.push(String(error)) },
    });
    assert.equal(process.exitCode, 0, logs.join('\n'));
    assert.equal(f.ended(), true);
    assert.equal(f.begins(), args.includes('--apply') ? 1 : 0);
    assert.equal(f.writes(), args.includes('--apply') ? 2 : 0);
    if (!args.includes('--apply')) assert.ok(f.queries.every(query => query.startsWith('SELECT ')));
  }
  for (const args of [['--apply=true'], ['--slug', CARBON_SLUG], ['--apply', '--dry-run']]) assert.throws(() => carbonSeedOptions(args), /Usage/);
});

test('production slug routing keeps Carbon out of vertical seeds in dry-run and apply', () => {
  const shell = readFileSync(new URL('../../deploy/production/seed-catalog.sh', import.meta.url), 'utf8');
  const routing = shell.slice(shell.indexOf('# Route the LLM announcement seed'), shell.indexOf('run_scraper()'));
  assert.match(routing, /if \[\[ "\$slug" == gemini-4-carbon \]\]; then\s+CARBON=1/);
  assert.match(routing, /VERTICAL_SLUGS\+="\$\{VERTICAL_SLUGS:\+,\}\$slug"/);
  assert.match(routing, /extra\+=\(--slug "\$VERTICAL_SLUGS"\)/);
  assert.doesNotMatch(routing, /extra\+=\(--slug "\$SLUGS"\)/);
  const dry = shell.slice(shell.indexOf('# --- dry-run'), shell.indexOf('# --- backup'));
  const apply = shell.slice(shell.indexOf('# --- apply'));
  for (const block of [dry, apply]) {
    assert.equal((block.match(/if \[\[ -z "\$SLUGS" \|\| -n "\$VERTICAL_SLUGS" \]\]; then/g) ?? []).length, 2);
    assert.match(block, /if \[\[ "\$CARBON" == 1 \]\]; then[\s\S]+run_scraper npm run seed:gemini-4-carbon/);
  }
  assert.doesNotMatch(dry, /seed:gemini-4-carbon -- --apply/);
  assert.match(apply, /seed:gemini-4-carbon -- --apply/);
});
