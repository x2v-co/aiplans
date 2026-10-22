import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import type { Sql } from 'postgres';
import ts from 'typescript';
import { deepseekSeedOptions, seedDeepSeekWindows } from './deepseek-windows';

type Row = Record<string, unknown> & { id: number };
function fixture() {
  const data: Record<string, Row[]> = {
    providers: [{ id: 3, slug: 'deepseek' }],
    models: [{ id: 10, slug: 'deepseek-v4.1-flash' }, { id: 11, slug: 'deepseek-v4-pro' }],
    api_channel_prices: [], api_channel_price_variants: [{ id: 12, model_id: 10, provider_id: 3, variant_key: 'old', is_headline: true }],
  };
  let writes = 0;
  let readOnly = false;
  let id = 100;
  const fragment = (value: unknown) => (value as { fragment: unknown }).fragment;
  const tx = (parts: TemplateStringsArray | unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const query = parts.join('?').trim();
    if (query === 'SET TRANSACTION READ ONLY') { readOnly = true; return Promise.resolve([]); }
    if (query === "SELECT * FROM providers WHERE slug = 'deepseek'") return Promise.resolve(structuredClone(data.providers));
    if (query === 'SELECT * FROM models WHERE slug IN ?') return Promise.resolve(structuredClone(data.models));
    if (query === 'SELECT * FROM ? WHERE provider_id = ?') return Promise.resolve(structuredClone(data[String(fragment(values[0]))].filter(row => row.provider_id === values[1])));
    assert.equal(readOnly, false, 'Read-only preview attempted a mutation');
    const table = String(fragment(values[0]));
    const payload = fragment(values[1]) as Record<string, unknown>;
    writes++;
    if (query === 'INSERT INTO ? ? RETURNING id') {
      const row = { ...payload, id: id++ }; data[table].push(row); return Promise.resolve([{ id: row.id }]);
    }
    if (query === 'UPDATE ? SET ? WHERE id = ?') {
      Object.assign(data[table].find(row => row.id === values[2])!, payload); return Promise.resolve([]);
    }
    throw new Error(`Unexpected SQL: ${query}`);
  };
  const sql = Object.assign(tx, {
    begin: async (_mode: string, callback: (tx: unknown) => Promise<void>) => callback(tx), end: async () => {},
  }) as unknown as Sql;
  async function cli(args: string[] = []) {
    const source = readFileSync(new URL('../seed-deepseek-windows.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const process = { argv: ['node', 'seed', ...args], exitCode: 0 };
    const dependencies: Record<string, unknown> = {
      './data/deepseek-windows': { deepseekSeedOptions, seedDeepSeekWindows }, './db/postgres-admin': { databaseSql: sql },
    };
    await runInNewContext(compiled, { exports: {}, process,
      require(name: string) { assert.ok(Object.hasOwn(dependencies, name)); return dependencies[name]; },
      console: { log() {}, error(error: unknown) { throw error; } },
    });
    assert.equal(process.exitCode, 0);
  }
  return { data, sql, cli, writes: () => writes, readOnly: () => readOnly };
}

test('actual seed CLI is read-only by default; explicit apply is repeatable and preserves observations', async () => {
  const dry = fixture();
  const before = structuredClone(dry.data);
  await dry.cli();
  assert.equal(dry.readOnly(), true);
  assert.equal(dry.writes(), 0);
  assert.deepEqual(dry.data, before);
  const applied = fixture();
  await applied.cli(['--apply']);
  assert.equal(applied.data.api_channel_prices.length, 2);
  assert.deepEqual(applied.data.api_channel_price_variants.filter(v => v.variant_key !== 'old').map(v =>
    [v.variant_key, v.input_price_per_1m, v.output_price_per_1m, v.cached_input_price_per_1m, v.is_headline]), [
    ['peak', 0.3, 1.2, 0.006, true], ['off-peak', 0.15, 0.6, 0.003, false],
    ['peak', 1.32, 3.96, 0.044, true], ['off-peak', 0.66, 1.98, 0.022, false],
  ]);
  assert.equal(applied.data.api_channel_price_variants[0].is_headline, false);
  applied.data.api_channel_price_variants[1].raw_json = { pricing_observations: { peak: { input: 0.3 } } };
  const snapshot = structuredClone(applied.data);
  const writes = applied.writes();
  await applied.cli(['--apply']);
  assert.deepEqual(applied.data, snapshot);
  assert.equal(applied.writes(), writes);
});

test('seed flags fail closed; deployment has no requirement for optional DeepSeek rows', () => {
  assert.deepEqual(deepseekSeedOptions([]), { apply: false });
  assert.deepEqual(deepseekSeedOptions(['--apply']), { apply: true });
  for (const args of [['--apply', '--dry-run'], ['--apply=true'], ['--unknown']]) assert.throws(() => deepseekSeedOptions(args));
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:deepseek-windows'], 'tsx scripts/seed-deepseek-windows.ts');
  assert.equal(pkg.scripts['seed:deepseek-windows:apply'], 'tsx scripts/seed-deepseek-windows.ts --apply');
  for (const path of ['../../deploy/production/rollout.sh', '../audit-vertical-catalog.ts']) {
    assert.doesNotMatch(readFileSync(new URL(path, import.meta.url), 'utf8'), /seed:deepseek-windows|deepseek-v4-flash|deepseek-v4-pro/);
  }
});
