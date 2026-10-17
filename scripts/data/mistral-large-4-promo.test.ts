import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import type { Sql } from 'postgres';
import ts from 'typescript';
import { effectivePrice } from '../../src/lib/effective-price';
import {
  MISTRAL_LARGE_4_PROMO, MISTRAL_LARGE_4_SOURCE,
  mistralLarge4SeedOptions, seedMistralLarge4Promo,
} from './mistral-large-4-promo';

type Row = Record<string, unknown> & { id: number };
function fixture() {
  const models: Row[] = [{ id: 11, slug: 'mistral-large-4' }];
  const providers: Row[] = [{ id: 22, slug: 'mistral', type: 'producer' }];
  const official = { id: 33, model_id: 11, provider_id: 22,
    input_price_per_1m: 0.68, output_price_per_1m: 2.09, cached_input_price_per_1m: 0.07,
    is_available: false, notes: 'Old notes', promo_ends_at: new Date('2026-10-20T00:00:00Z') };
  const channels: Row[] = [official,
    { ...official, id: 34, provider_id: 23, notes: 'OpenRouter' },
    { ...official, id: 35, provider_id: 24, notes: 'Other third-party channel' },
    { ...official, id: 36, model_id: 12, notes: 'Old Mistral Large official' }];
  const writes: unknown[] = [];
  const queries: string[] = [];
  let readOnly = false;
  let ended = false;
  const tx = (parts: unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    queries.push(query);
    if (query === 'SET TRANSACTION READ ONLY') { readOnly = true; return Promise.resolve([]); }
    if (query === 'SELECT id FROM models WHERE slug = ?') {
      return Promise.resolve(structuredClone(models.filter(row => row.slug === values[0])));
    }
    if (query === 'SELECT id, type FROM providers WHERE slug = ?') {
      return Promise.resolve(structuredClone(providers.filter(row => row.slug === values[0])));
    }
    if (query === 'SELECT * FROM api_channel_prices WHERE model_id = ? AND provider_id = ?') {
      return Promise.resolve(structuredClone(channels.filter(row => row.model_id === values[0] && row.provider_id === values[1])));
    }
    assert.equal(readOnly, false, `Write in read-only transaction: ${query}`);
    assert.equal(query, 'UPDATE api_channel_prices SET ? WHERE id = ? AND model_id = ? AND provider_id = ?');
    const payload = (values[0] as { fragment: Record<string, unknown> }).fragment;
    assert.deepEqual(Object.keys(payload).sort(), [...Object.keys(MISTRAL_LARGE_4_PROMO), 'updated_at'].sort());
    const row = channels.find(row => row.id === values[1] && row.model_id === values[2] && row.provider_id === values[3]);
    assert.ok(row);
    Object.assign(row, payload);
    writes.push(payload);
    return Promise.resolve([]);
  };
  const sql = Object.assign(tx, {
    async begin(mode: string, callback: (tx: unknown) => Promise<void>) {
      assert.equal(mode, 'isolation level serializable');
      await callback(sql);
    },
    async end() { ended = true; },
  }) as unknown as Sql;
  return { sql, models, providers, channels, queries, writes, ended: () => ended };
}

test('verified prices and originalPrice fields keep the unpublished cutoff null', () => {
  const row = MISTRAL_LARGE_4_PROMO;
  assert.deepEqual([row.input_price_per_1m, row.output_price_per_1m, row.cached_input_price_per_1m], [0.68, 2.09, 0.07]);
  assert.deepEqual([row.regular_input_price_per_1m, row.regular_output_price_per_1m, row.regular_cached_input_price_per_1m], [1.36, 4.18, 0.14]);
  assert.equal(row.promo_ends_at, null);
  assert.equal(row.last_verified.toISOString(), '2026-10-17T00:00:00.000Z');
  assert.equal(MISTRAL_LARGE_4_SOURCE, 'https://docs.mistral.ai/models/mistral-large-4');
  assert.ok(row.notes.includes(MISTRAL_LARGE_4_SOURCE));
  assert.match(row.notes, /50% off/);
  assert.match(row.notes, /end date has not been announced; refer to the official model page/);
  assert.doesNotMatch(row.notes, /10-20|October 20/);
  assert.deepEqual(effectivePrice(row, new Date('2026-12-01')), row);
});

test('default preview reports exact changes without any mutations', async () => {
  const f = fixture();
  const before = structuredClone(f.channels);
  const steps = await seedMistralLarge4Promo(f.sql);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].target, 'mistral/mistral-large-4');
  assert.deepEqual(steps[0].changes.regular_input_price_per_1m, { from: null, to: 1.36 });
  assert.deepEqual(steps[0].changes.promo_ends_at, { from: before[0].promo_ends_at, to: null });
  assert.deepEqual(f.channels, before);
  assert.equal(f.writes.length, 0);
});

test('write path updates only official Large 4, preserves availability, then is idempotent', async () => {
  for (const type of ['official', 'producer']) {
    const f = fixture();
    f.providers[0].type = type;
    const original = structuredClone(f.channels[0]);
    const untouched = structuredClone(f.channels.slice(1));
    await seedMistralLarge4Promo(f.sql, true);
    assert.equal(f.writes.length, 1);
    assert.equal(f.channels[0].is_available, false);
    assert.deepEqual(f.channels[0], { ...original, ...MISTRAL_LARGE_4_PROMO, updated_at: f.channels[0].updated_at });
    assert.ok(f.channels[0].updated_at instanceof Date);
    assert.deepEqual(f.channels.slice(1), untouched);
    assert.deepEqual(await seedMistralLarge4Promo(f.sql, true), []);
    assert.deepEqual(await seedMistralLarge4Promo(f.sql), []);
    assert.equal(f.writes.length, 1);
  }
});

test('missing, ambiguous or non-official identities fail before writes', async () => {
  for (const apply of [false, true]) {
    for (const table of ['models', 'providers', 'channels'] as const) {
      for (const duplicate of [false, true]) {
        const f = fixture();
        if (duplicate) f[table].push({ ...f[table][0], id: 99 });
        else f[table].splice(0, 1);
        await assert.rejects(seedMistralLarge4Promo(f.sql, apply), duplicate ? /Ambiguous/ : /Missing/);
        assert.equal(f.writes.length, 0);
      }
    }
    const f = fixture();
    f.providers[0].type = 'aggregator';
    await assert.rejects(seedMistralLarge4Promo(f.sql, apply), /Expected official\/producer/);
    assert.equal(f.writes.length, 0);
  }
});

test('CLI defaults to read-only serializable dry-run; flags require explicit apply', async () => {
  assert.deepEqual(mistralLarge4SeedOptions([]), { apply: false });
  assert.deepEqual(mistralLarge4SeedOptions(['--dry-run']), { apply: false });
  assert.deepEqual(mistralLarge4SeedOptions(['--apply']), { apply: true });
  for (const args of [['--apply', '--dry-run'], ['--unknown'], ['--apply=true']]) {
    assert.throws(() => mistralLarge4SeedOptions(args), /Usage:/);
  }
  const source = readFileSync(new URL('../seed-mistral-large-4-promo.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const args of [[], ['--dry-run']]) {
    const f = fixture();
    const before = structuredClone(f.channels);
    const process = { argv: ['node', 'seed-mistral-large-4-promo', ...args], exitCode: 0 };
    const messages: string[] = [];
    await runInNewContext(compiled, {
      exports: {}, process,
      require(name: string) {
        if (name === './data/mistral-large-4-promo') return { mistralLarge4SeedOptions, seedMistralLarge4Promo };
        assert.equal(name, './db/postgres-admin');
        return { databaseSql: f.sql };
      },
      console: { log: (...values: unknown[]) => messages.push(values.join(' ')), error: (error: unknown) => messages.push(String(error)) },
    });
    assert.equal(process.exitCode, 0, messages.join('\n'));
    assert.match(messages.join('\n'), /Dry-run; no writes: 1 changes\./);
    assert.equal(f.queries[0], 'SET TRANSACTION READ ONLY');
    assert.deepEqual(f.channels, before);
    assert.equal(f.writes.length, 0);
    assert.ok(f.ended());
  }
});
