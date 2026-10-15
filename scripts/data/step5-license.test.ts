import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { getTableColumns } from 'drizzle-orm';
import type { Sql } from 'postgres';
import ts from 'typescript';
import { models } from '../../src/db/schema';
import { generateOpenRouterSlug } from '../scrapers/openrouter';
import { STEP5_METADATA, STEP5_SLUG, STEP5_SOURCE, seedStep5License, step5SeedOptions } from './step5-license';

type Row = Record<string, unknown> & { id: number };
const original: Row = {
  id: 42, slug: 'stepfun-step-5-preview', name: 'Step 5 Preview', type: 'llm', provider_ids: [45],
  open_source: false, license: null, license_url: null, offical_link: 'https://openrouter.ai/models/stepfun/step-5-preview',
  parameters: null, 'active parameters': null, context_window: 128_000,
  description: 'Existing catalog description', updated_at: new Date('2026-10-01T00:00:00Z'),
};
const expected = {
  open_source: true, license: 'StepFun Model License 1.0',
  license_url: 'https://huggingface.co/stepfun-ai/Step-5-Preview',
  offical_link: 'https://huggingface.co/stepfun-ai/Step-5-Preview',
  parameters: '600B', 'active parameters': '27B', context_window: 1_000_000,
};
const source = readFileSync(new URL('../seed-step5-license.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

/** Memory-only SQL interpreter; the real database module is never imported. */
function fixture(initial: Row[] = [original]) {
  let rows = structuredClone(initial);
  let readOnly = false;
  let ended = false;
  let writes = 0;
  let imports = 0;
  const queries: string[] = [];
  const tx = (parts: TemplateStringsArray | unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    queries.push(query);
    if (query === 'SET TRANSACTION READ ONLY') { readOnly = true; return Promise.resolve([]); }
    if (query === 'SELECT id, slug, open_source, license, license_url, offical_link, parameters, "active parameters", context_window FROM models WHERE slug = ?') {
      assert.equal(values[0], 'stepfun-step-5-preview');
      return Promise.resolve(structuredClone(rows.filter(row => row.slug === values[0])));
    }
    assert.equal(readOnly, false, `Write in read-only transaction: ${query}`);
    if (query === 'UPDATE models SET ? WHERE id = ?') {
      const payload = (values[0] as { fragment: Record<string, unknown> }).fragment;
      assert.deepEqual(Object.keys(payload).sort(), [...Object.keys(expected), 'updated_at'].sort());
      const row = rows.find(row => row.id === values[1]);
      assert.ok(row);
      Object.assign(row, payload);
      writes++;
      return Promise.resolve([]);
    }
    throw new Error(`Unexpected SQL: ${query}`);
  };
  const sql = Object.assign(tx, {
    async begin(mode: string, callback: (tx: unknown) => Promise<void>) {
      assert.equal(mode, 'isolation level serializable');
      readOnly = false;
      const before = structuredClone(rows);
      try { await callback(sql); } catch (error) { rows = before; throw error; }
    },
    async end() { ended = true; },
  }) as unknown as Sql;
  async function cli(args: string[] = []) {
    const messages: string[] = [];
    const process = { argv: ['node', 'seed-step5-license', ...args], exitCode: 0 };
    const dependencies: Record<string, unknown> = {
      './data/step5-license': { step5SeedOptions, seedStep5License },
      './db/postgres-admin': { databaseSql: sql },
    };
    await runInNewContext(compiled, {
      exports: {}, process,
      require(name: string) {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
        if (name === './db/postgres-admin') imports++;
        return dependencies[name];
      },
      console: { log: (...values: unknown[]) => messages.push(values.join(' ')), error: (error: unknown) => messages.push(String(error)) },
    });
    return { code: process.exitCode, output: messages.join('\n') };
  }
  return { cli, sql, queries, rows: () => rows, writes: () => writes, imports: () => imports,
    readOnly: () => readOnly, ended: () => ended };
}

test('exact OpenRouter identity and facts use existing parameter/context columns and registered license migration', () => {
  assert.equal(generateOpenRouterSlug('stepfun/step-5-preview'), STEP5_SLUG);
  assert.deepEqual(STEP5_METADATA, expected);
  assert.equal(STEP5_SOURCE, expected.license_url);
  const columns = getTableColumns(models);
  for (const key of Object.keys(expected)) {
    assert.ok(Object.values(columns).some(column => column.name === key), `Missing schema column: ${key}`);
  }
  const migration = readFileSync(new URL('../../drizzle/0009_model_license.sql', import.meta.url), 'utf8');
  assert.match(migration, /ALTER TABLE models ADD COLUMN IF NOT EXISTS license text;/);
  assert.match(migration, /ALTER TABLE models ADD COLUMN IF NOT EXISTS license_url text;/);
  assert.doesNotMatch(migration, /\b(?:UPDATE|INSERT|DELETE)\b/i);
  const registry = readFileSync(new URL('../migrate-data-accuracy.ts', import.meta.url), 'utf8');
  assert.match(registry, /name: '034_add_model_license',\s+sql: readFileSync\(new URL\('\.\.\/drizzle\/0009_model_license.sql'/);
});

test('CLI defaults to read-only serializable dry-run and reports one model update without mutations', async () => {
  for (const args of [[], ['--dry-run']]) {
    const f = fixture();
    const before = structuredClone(f.rows());
    const result = await f.cli(args);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /Dry-run; no writes: 1 changes\./);
    assert.match(result.output, /StepFun Model License 1\.0/);
    assert.match(result.output, /active parameters/);
    assert.match(result.output, /stepfun-step-5-preview/);
    assert.deepEqual(f.rows(), before);
    assert.equal(f.writes(), 0);
    assert.equal(f.queries[0], 'SET TRANSACTION READ ONLY');
    assert.ok(f.readOnly());
    assert.ok(f.ended());
  }
});

test('apply updates only existing model metadata, preserves unrelated data, and second run is zero changes', async () => {
  const unrelated = { ...original, id: 43, slug: 'stepfun-step-5-preview-free' };
  const f = fixture([original, unrelated]);
  const result = await f.cli(['--apply']);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /Applied: 1 changes\./);
  assert.equal(f.readOnly(), false);
  assert.equal(f.writes(), 1);
  assert.deepEqual(f.rows()[0], { ...original, ...expected, updated_at: f.rows()[0].updated_at });
  assert.notDeepEqual(f.rows()[0].updated_at, original.updated_at);
  assert.deepEqual(f.rows()[1], unrelated);
  const before = structuredClone(f.rows());
  const rerun = await f.cli(['--apply']);
  assert.equal(rerun.code, 0, rerun.output);
  assert.match(rerun.output, /Applied: 0 changes\./);
  assert.equal(f.writes(), 1);
  assert.deepEqual(f.rows(), before);
  const preview = await f.cli();
  assert.match(preview.output, /Dry-run; no writes: 0 changes\./);
  assert.equal(f.writes(), 1);
});

test('missing or ambiguous exact identities abort before writes in both modes', async () => {
  for (const args of [[], ['--apply']]) {
    for (const [rows, message] of [
      [[], /Missing models/],
      [[{ ...original, slug: 'step-5-preview' }], /Missing models/],
      [[original, { ...original, id: 43 }], /Ambiguous models/],
    ] as const) {
      const f = fixture([...rows]);
      const before = structuredClone(f.rows());
      const result = await f.cli(args);
      assert.equal(result.code, 1);
      assert.match(result.output, message);
      assert.equal(f.writes(), 0);
      assert.deepEqual(f.rows(), before);
      assert.ok(f.ended());
    }
  }
});

test('unsafe flags fail before database import and npm commands remain optional', async () => {
  assert.deepEqual(step5SeedOptions([]), { apply: false });
  assert.deepEqual(step5SeedOptions(['--dry-run']), { apply: false });
  assert.deepEqual(step5SeedOptions(['--apply']), { apply: true });
  for (const args of [['--apply', '--dry-run'], ['--unknown'], ['--apply=true']]) {
    const f = fixture();
    await assert.rejects(f.cli(args), /Usage:/);
    assert.equal(f.imports(), 0);
    assert.equal(f.queries.length, 0);
  }
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:step5-license'], 'tsx scripts/seed-step5-license.ts');
  assert.equal(pkg.scripts['seed:step5-license:apply'], `${pkg.scripts['seed:step5-license']} --apply`);
  assert.doesNotMatch(readFileSync(new URL('../../deploy/production/rollout.sh', import.meta.url), 'utf8'), /seed:step5-license|seed-step5-license/);
});
