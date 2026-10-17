import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import type { Sql } from 'postgres';
import { getTableConfig } from 'drizzle-orm/pg-core';
import ts from 'typescript';
import { providers, models, apiChannelPrices, apiChannelPriceVariants } from '../../src/db/schema';
import { isVerifiedFreePrice } from '../utils/audit-price-policy';
import { BEAM_SOURCE, BEAM_ENDPOINTS, BEAM_MODEL_SLUGS, beamSeedOptions, seedReflectionBeam } from './reflection-beam-2026-10-17';

type Row = Record<string, unknown> & { id: number };
const columns = Object.fromEntries([providers, models, apiChannelPrices, apiChannelPriceVariants].map(table => {
  const config = getTableConfig(table);
  return [config.name, new Set(config.columns.map(column => column.name))];
}));
const initialCatalog = {
  providers: [{ id: 1, slug: 'vercel-ai-gateway', type: 'aggregator' }, { id: 2, slug: 'openrouter' }],
  models: [{ id: 3, slug: BEAM_MODEL_SLUGS[0], name: 'Reflection: Beam 1.0 501B A23B', provider_ids: [99] }],
  api_channel_prices: [{ id: 4, model_id: 3, provider_id: 2, input_price_per_1m: 12, notes: 'Preserve OpenRouter' }],
  api_channel_price_variants: [{ id: 5, model_id: 3, provider_id: 2, variant_key: 'openrouter-auto', is_headline: true }],
};

/** Memory-only SQL interpreter: no postgres client, environment file or network. */
function fixture(initial: Record<string, Row[]> = initialCatalog) {
  const data: Record<string, Row[]> = {
    providers: [], models: [], api_channel_prices: [], api_channel_price_variants: [], ...structuredClone(initial),
  };
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
    for (const table of ['api_channel_prices', 'api_channel_price_variants']) {
      if (query === `SELECT * FROM ${table} WHERE model_id = ? AND provider_id = ?`) {
        return Promise.resolve(structuredClone(data[table].filter(row => row.model_id === values[0] && row.provider_id === values[1])));
      }
    }
    assert.equal(readOnly, false, `Write in read-only transaction: ${query}`);
    const table = String(fragment(values[0]));
    assert.ok(Object.hasOwn(columns, table), `Unexpected table: ${table}`);
    const raw = fragment(values[1]) as Record<string, unknown>;
    for (const key of Object.keys(raw)) assert.ok(columns[table].has(key), `Unknown ${table} column: ${key}`);
    if (raw.constraints_json != null) assert.ok('json' in (raw.constraints_json as object), 'Use tx.json for JSON columns');
    const payload = Object.fromEntries(Object.entries(raw).map(([key, value]) =>
      [key, key === 'constraints_json' && value != null ? (value as { json: unknown }).json : value]));
    if (query === 'INSERT INTO ? ? RETURNING id') {
      const keys = table === 'providers' ? ['slug'] : table === 'api_channel_prices'
        ? ['model_id', 'provider_id'] : ['model_id', 'provider_id', 'variant_key'];
      assert.ok(!data[table].some(row => keys.every(key => row[key] === payload[key])), `Duplicate ${table}`);
      for (const [key, parent] of [['model_id', 'models'], ['provider_id', 'providers']]) {
        if (payload[key] != null) assert.ok(data[parent].some(row => row.id === payload[key]), `Missing ${parent}`);
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
    json: (value: unknown) => ({ json: value }),
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
    const process = { argv: ['node', 'seed-reflection-beam', ...args], exitCode: 0 };
    const dependencies: Record<string, unknown> = {
      './data/reflection-beam-2026-10-17': { beamSeedOptions, seedReflectionBeam },
      './db/postgres-admin': { databaseSql: sql },
    };
    const compiled = ts.transpileModule(readFileSync(new URL('../seed-reflection-beam-2026-10-17.ts', import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    await runInNewContext(compiled, {
      exports: {}, process,
      require(name: string) { assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`); return dependencies[name]; },
      console: { log: (...values: unknown[]) => messages.push(values.join(' ')), error: (error: unknown) => messages.push(String(error)) },
    });
    return { code: process.exitCode, output: messages.join('\n') };
  }
  return { data, sql, cli, writes: () => writes, readOnly: () => readOnly, ended: () => ended };
}

test('CLI default and explicit dry-run are serializable READ ONLY previews and close the client', async () => {
  for (const args of [[], ['--dry-run']]) {
    const f = fixture(); const before = structuredClone(f.data);
    const result = await f.cli(args);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /Dry-run; no writes: 6 changes/);
    assert.match(result.output, /upstream-togetherai/);
    assert.match(result.output, /date\/rates unknown/);
    assert.match(result.output, /beam-free: stops/);
    assert.ok(f.readOnly()); assert.ok(f.ended()); assert.equal(f.writes(), 0);
    assert.deepEqual(f.data, before);
  }
  assert.deepEqual(beamSeedOptions([]), { apply: false });
  assert.deepEqual(beamSeedOptions(['--apply']), { apply: true });
  for (const args of [['--unknown'], ['--apply=true'], ['--apply', '--dry-run']]) {
    assert.throws(() => beamSeedOptions(args), /Usage:/);
    await assert.rejects(fixture().cli(args), /Usage:/);
  }
});

test('memory writes record only supplied rates, distinguish promo endings and are idempotent', async () => {
  const f = fixture(); const before = structuredClone(f.data);
  await seedReflectionBeam(f.sql, true);
  assert.deepEqual(f.data.models, before.models);
  assert.deepEqual(f.data.providers, before.providers);
  assert.deepEqual(f.data.api_channel_prices[0], before.api_channel_prices[0]);
  assert.deepEqual(f.data.api_channel_price_variants[0], before.api_channel_price_variants[0]);
  const channel = f.data.api_channel_prices.find(row => row.provider_id === 1)!;
  assert.deepEqual([channel.input_price_per_1m, channel.output_price_per_1m, channel.cached_input_price_per_1m], [0, 0, 0]);
  for (const key of ['promo_ends_at', 'regular_input_price_per_1m', 'regular_output_price_per_1m', 'regular_cached_input_price_per_1m']) assert.equal(channel[key], null);
  assert.match(String(channel.notes), /explicitly selecting provider reflection/);
  assert.match(String(channel.notes), /no end date or future rates published/);
  const variants = f.data.api_channel_price_variants.filter(row => row.provider_id === 1);
  assert.deepEqual(variants.map(row => [row.variant_key, row.input_price_per_1m, row.output_price_per_1m, row.cached_input_price_per_1m]), [
    ['upstream-reflection', 0, 0, 0], ['upstream-nebius', 0.25, 1, null],
    ['upstream-togetherai', 0.4, 1.2, 0.04], ['upstream-baseten', 1.3, 4.3, 0.13], ['vercel-beam-free', 0, 0, null],
  ]);
  const headline = variants.filter(row => row.is_headline);
  assert.equal(headline.length, 1); assert.equal(headline[0].variant_key, 'upstream-reflection');
  assert.match(String(headline[0].headline_reason), /explicit provider reflection/);
  for (const row of [channel, ...variants]) {
    assert.equal(row.model_id, 3); assert.equal(row.currency, 'USD'); assert.equal(row.price_unit, 'per_1m_tokens');
    assert.equal(row.is_available, true); assert.equal((row.last_verified as Date).toISOString(), '2026-10-17T00:00:00.000Z');
    assert.ok(String(row.notes).includes(BEAM_SOURCE));
  }
  for (const row of variants.slice(0, 4)) {
    assert.equal(row.variant_kind, 'upstream_provider'); assert.equal(row.source_url, BEAM_ENDPOINTS);
    assert.equal((row.constraints_json as Record<string, unknown>).upstream_provider, row.source_group_key);
  }
  assert.deepEqual(headline[0].constraints_json, { gateway_model_id: 'reflection/beam', upstream_provider: 'reflection', limited_time_free: true, promo_ends_at: null, after_promo: 'paid' });
  assert.deepEqual(variants[4].constraints_json, { gateway_model_id: 'reflection/beam-free', limited_time_free: true, promo_ends_at: null, after_promo: 'unavailable' });
  assert.match(String(variants[4].notes), /does not switch to paid pricing/);
  const writes = f.writes();
  // PostgreSQL may return UTC-midnight timestamps as strings; JSON key order is immaterial.
  channel.last_verified = '2026-10-17';
  variants[0].constraints_json = Object.fromEntries(Object.entries(variants[0].constraints_json as object).reverse());
  assert.deepEqual(await seedReflectionBeam(f.sql, true), []);
  assert.deepEqual(await seedReflectionBeam(f.sql), []);
  assert.equal(f.writes(), writes);
});

test('reuses either Vercel identity and every catalog alias; creates only a missing gateway', async () => {
  for (const slug of BEAM_MODEL_SLUGS) {
    for (const gateway of ['vercel', 'vercel-ai-gateway', null]) {
      const f = fixture({ models: [{ id: 3, slug, provider_ids: [99] }],
        providers: gateway ? [{ id: 1, slug: gateway, type: 'aggregator', logo_url: '/keep.svg' }] : [] });
      const before = structuredClone(f.data);
      const steps = await seedReflectionBeam(f.sql);
      assert.equal(steps.length, gateway ? 6 : 7);
      assert.deepEqual(f.data, before); assert.equal(f.writes(), 0);
      await seedReflectionBeam(f.sql, true);
      assert.equal(f.data.providers.length, 1);
      assert.equal(f.data.models.length, 1); assert.deepEqual(f.data.models, before.models);
      const provider = f.data.providers[0];
      assert.equal(provider.slug, gateway ?? 'vercel-ai-gateway');
      if (gateway) assert.deepEqual(f.data.providers, before.providers);
      assert.ok(f.data.api_channel_prices.every(row => row.provider_id === provider.id));
      assert.ok(f.data.api_channel_price_variants.every(row => row.provider_id === provider.id));
      assert.deepEqual(await seedReflectionBeam(f.sql, true), []);
    }
  }
});

test('repairs stale prices and promo metadata, demotes other headlines, preserves unrelated data', async () => {
  const f = fixture(); await seedReflectionBeam(f.sql, true);
  const channel = f.data.api_channel_prices.find(row => row.provider_id === 1)!;
  Object.assign(channel, { input_price_per_1m: 99, promo_ends_at: '2027-01-01', regular_input_price_per_1m: 10, rate_limit: 42 });
  const nebius = f.data.api_channel_price_variants.find(row => row.variant_key === 'upstream-nebius')!;
  Object.assign(nebius, { input_price_per_1m: 99, cached_input_price_per_1m: 0, is_headline: true });
  const stale = { id: 900, model_id: 3, provider_id: 1, variant_key: 'old-default', is_headline: true, notes: 'Keep me' };
  f.data.api_channel_price_variants.push(stale);
  f.data.api_channel_prices.push({ id: 901, model_id: 88, provider_id: 1, input_price_per_1m: 10 });
  const unrelated = structuredClone(f.data.api_channel_prices.at(-1));
  await seedReflectionBeam(f.sql, true);
  assert.equal(channel.input_price_per_1m, 0); assert.equal(channel.promo_ends_at, null);
  assert.equal(channel.regular_input_price_per_1m, null); assert.equal(channel.rate_limit, 42);
  assert.equal(nebius.input_price_per_1m, 0.25); assert.equal(nebius.cached_input_price_per_1m, null);
  assert.equal(nebius.is_headline, false); assert.equal(stale.is_headline, false); assert.equal(stale.notes, 'Keep me');
  assert.deepEqual(f.data.api_channel_prices.at(-1), unrelated);
  assert.deepEqual(await seedReflectionBeam(f.sql, true), []);
});

test('missing or ambiguous identities abort before any writes; CLI errors close the client', async () => {
  const cases: Record<string, Row[]>[] = [
    {},
    { ...initialCatalog, models: [{ id: 3, slug: BEAM_MODEL_SLUGS[0] }, { id: 8, slug: 'reflection-beam' }] },
    { ...initialCatalog, providers: [{ id: 1, slug: 'vercel' }, { id: 8, slug: 'vercel-ai-gateway' }] },
    { ...initialCatalog, providers: [{ id: 1, slug: 'vercel', type: 'official' }] },
    { ...initialCatalog, api_channel_prices: [{ id: 7, model_id: 3, provider_id: 1 }, { id: 8, model_id: 3, provider_id: 1 }] },
    { ...initialCatalog, api_channel_price_variants: [{ id: 7, model_id: 3, provider_id: 1, variant_key: 'upstream-nebius' },
      { id: 8, model_id: 3, provider_id: 1, variant_key: 'upstream-nebius' }] },
  ];
  for (const initial of cases) {
    for (const apply of [false, true]) {
      const f = fixture(initial); const before = structuredClone(f.data);
      await assert.rejects(seedReflectionBeam(f.sql, apply), /Missing|Ambiguous|Expected Vercel/);
      assert.deepEqual(f.data, before); assert.equal(f.writes(), 0);
    }
    const f = fixture(initial); const result = await f.cli();
    assert.equal(result.code, 1); assert.ok(f.ended()); assert.equal(f.writes(), 0);
  }
});

test('free audit exemption is limited to Beam on Vercel, and seed is opt-in', () => {
  for (const model of BEAM_MODEL_SLUGS) {
    for (const provider of ['vercel', 'vercel-ai-gateway']) assert.equal(isVerifiedFreePrice(model, provider), true);
    for (const provider of ['reflection', 'openrouter', 'nebius', 'togetherai', 'baseten', 'opencode-go', 'opencode-zen', undefined]) {
      assert.equal(isVerifiedFreePrice(model, provider), false);
    }
  }
  assert.equal(isVerifiedFreePrice('other-model', 'vercel'), false);
  assert.equal(isVerifiedFreePrice(undefined, 'vercel'), false);
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:reflection-beam'], 'tsx scripts/seed-reflection-beam-2026-10-17.ts');
  for (const file of ['../../deploy/production/rollout.sh', '../../deploy/production/run-scrapers.sh', '../../.github/workflows/deploy-production.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /seed:reflection-beam|seed-reflection-beam/);
  }
});
