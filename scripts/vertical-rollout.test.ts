import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as catalog from '../src/lib/ai-vertical-catalog';
import * as logos from '../src/lib/vertical-provider-logos';
import * as auditVertical from './data/catalog-audit-vertical';
import type { Sql } from 'postgres';
import { seedImageModels, seedNonLlm } from './data/non-llm-seed';

type Row = Record<string, unknown> & { id: number };

/** Memory-only query adapter; script imports cannot reach a real DB. */
function fixture(initial: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = {
    providers: [], models: [], plans: [], model_plan_mapping: [], usage_prices: [],
    ...structuredClone(initial),
  };
  let nextId = 10000;
  let writes = 0;
  const db = {
    from(table: string) {
      assert.ok(Object.hasOwn(data, table), `Unexpected table: ${table}`);
      let operation = 'select';
      let selection = '*';
      let payload: Record<string, unknown> = {};
      let single = false;
      const filters: Array<(row: Row) => boolean> = [];
      const query = {
        select(columns = '*') { selection = columns; return query; },
        insert(row: Record<string, unknown>) { operation = 'insert'; payload = row; return query; },
        update(row: Record<string, unknown>) { operation = 'update'; payload = row; return query; },
        eq(column: string, value: unknown) { filters.push(row => row[column] === value); return query; },
        in(column: string, values: unknown[]) { filters.push(row => values.includes(row[column])); return query; },
        single() { single = true; return query; },
        maybeSingle() { single = true; return query; },
        then(resolve: (result: { data: unknown; error: null }) => unknown) {
          let rows = data[table].filter(row => filters.every(filter => filter(row)));
          const values = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
          if (operation === 'insert') {
            // Enforce the identities the rollout relies on.
            if (['providers', 'models', 'plans'].includes(table)) {
              assert.ok(!data[table].some(row => row.slug === values.slug &&
                (table !== 'plans' || row.provider_id === values.provider_id)), `Duplicate ${table}/${values.slug}`);
            }
            rows = [{ ...values, id: nextId++ }];
            data[table].push(...rows);
            writes++;
          } else if (operation === 'update') {
            rows.forEach(row => Object.assign(row, values));
            writes++;
          }
          const selected = rows.map(row => selection === '*' ? { ...row } :
            Object.fromEntries(selection.split(',').map(column => [column.trim(), row[column.trim()] ?? null])));
          if (single) assert.ok(selected.length <= 1, `Ambiguous ${table}`);
          return Promise.resolve(resolve({ data: single ? selected[0] ?? null : selected, error: null }));
        },
      };
      return query;
    },
  };

  // Follow world-models.test.ts: run the actual script with explicit dependency stubs.
  async function run(name: string, args = ['--apply']) {
    const source = readFileSync(new URL(`./${name}.ts`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const messages: string[] = [];
    const process = { argv: ['node', name, ...args], exitCode: 0, exit(code: number) { throw new Error(`Script exited ${code}: ${messages.join('\n')}`); } };
    const dependencies: Record<string, unknown> = {
      './db/queries': { db },
      '../src/lib/ai-vertical-catalog': catalog,
      '../src/lib/vertical-provider-logos': logos,
      './data/catalog-audit-vertical': auditVertical,
    };
    await runInNewContext(compiled, {
      exports: {}, process, URL,
      require(id: string) {
        assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
        return dependencies[id];
      },
      console: { log: (...values: unknown[]) => messages.push(values.join(' ')), error: (...values: unknown[]) => messages.push(values.join(' ')) },
      Date: class extends Date { constructor(value: string | number = '2026-10-15T00:00:00Z') { super(value); } },
    });
    return { code: process.exitCode, output: messages.join('\n') };
  }

  async function seed(args = ['--apply']) {
    for (const name of ['seed-vertical-models', 'seed-vertical-provider-logos', 'seed-vertical-pricing-references', 'seed-verified-creative-plan-prices']) {
      const result = await run(name, args);
      assert.equal(result.code, 0, result.output);
    }
  }
  async function seedNonLlmRows() {
    // Adapt the same memory-only query store to the optional seed's SQL API.
    const tx = async (parts: TemplateStringsArray | unknown, ...values: unknown[]): Promise<unknown> => {
      if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
      const fragment = async (value: unknown) => ((await value) as { fragment: unknown }).fragment;
      const table = String(await fragment(values[0]));
      const query = parts.join('?').trim();
      if (query === 'SELECT * FROM ?') return (await db.from(table).select()).data;
      const payload = await fragment(values[1]) as Record<string, unknown>;
      if (query === 'INSERT INTO ? ? RETURNING id') {
        const result = await db.from(table).insert(payload).select('id').single();
        return [result.data];
      }
      assert.equal(query, 'UPDATE ? SET ? WHERE id = ?');
      await db.from(table).update(payload).eq('id', values[2]);
      return [];
    };
    return [...await seedNonLlm(tx as unknown as Sql, true), ...await seedImageModels(tx as unknown as Sql, true)];
  }
  return { data, run, seed, seedNonLlmRows, writeCount: () => writes };
}

test('rollout seeds repair missing/stale audited rows and pass the actual DB audit idempotently', async () => {
  const f = fixture({
    providers: [{ id: 1, slug: 'google', name: 'Google' }],
    models: [{ id: 2, slug: 'gemini-omni-flash', name: 'Stale Omni', model_category: 'video', provider_ids: [1] }],
  });
  const before = await f.run('audit-vertical-catalog', ['--db']);
  assert.equal(before.code, 1);
  assert.match(before.output, /missing models row/);
  assert.match(before.output, /input_modalities mismatch/);

  await f.seed();
  const audited = catalog.AI_VERTICAL_CATALOG.filter(item => ['video-model', 'music-model', 'decision-model'].includes(item.kind) && !item.deferredDbSeed);
  for (const item of audited) {
    const model = f.data.models.find(row => row.slug === item.slug)!;
    assert.ok(model, item.slug);
    assert.equal(model.name, item.name);
    assert.equal(model.model_category, item.modelCategory);
    const plan = f.data.plans.find(row => row.slug === `${item.slug}-official-pricing`)!;
    assert.ok(plan, item.slug);
    assert.equal(plan.price, null);
    assert.equal(plan.annual_price, null);
    const usage = f.data.usage_prices.filter(row => row.model_id === model.id);
    assert.ok(usage.every(row => row.plan_id === plan.id));
    if (item.kind === 'decision-model') {
      for (const [kind, price] of [['input_tokens', item.inputPricePer1M ?? null], ['output_tokens', item.outputPricePer1M ?? null], ['tasks', item.pricePer1MTasks ?? null]]) {
        const rows = usage.filter(row => row.price_kind === kind);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].price, price, `${item.slug}/${kind}`);
      }
    } else {
      assert.equal(usage.length, 1);
      assert.equal(usage[0].price, item.pricePerUnit ?? null, item.slug);
      const constraints = usage[0].constraints_json as Record<string, unknown>;
      assert.equal(constraints.price_high, item.pricePerUnitHigh);
      assert.equal(constraints.approximate, item.approximatePrice);
    }
  }
  assert.equal(f.data.models.find(row => row.slug === 'gemini-omni-flash')!.id, 2);
  const after = await f.run('audit-vertical-catalog', ['--db']);
  assert.equal(after.code, 0, after.output);
  assert.doesNotMatch(after.output, /CRITICAL/);
  const snapshot = JSON.stringify(f.data);
  await f.seed();
  assert.equal(JSON.stringify(f.data), snapshot);
  const writes = f.writeCount();
  await f.seed([]);
  assert.equal(f.writeCount(), writes);
  assert.equal(JSON.stringify(f.data), snapshot);

  // Existing derived mappings must be repaired to satisfy the manual reference contract.
  f.data.model_plan_mapping[0].source = 'derived';
  await f.seed();
  assert.equal(f.data.model_plan_mapping[0].source, 'manual');
  const repeatedAudit = await f.run('audit-vertical-catalog', ['--db']);
  assert.equal(repeatedAudit.code, 0, repeatedAudit.output);
});

test('SubQ P0 SQL and rollout seeds share a slug in either order without clobbering catalog metadata', async () => {
  const sql = readFileSync(new URL('./sql/2026-10-15-p0-pricing.sql', import.meta.url), 'utf8');
  const identity = sql.match(/SELECT 'SubQ Snap', '([^']+)', '([^']+)', '([^']+)', (\d+), ARRAY\[id\]/)!;
  assert.ok(identity);
  const [, slug, type, category, context] = identity;
  const snap = catalog.AI_VERTICAL_CATALOG.find(item => item.slug === slug)!;
  assert.equal(Number(context), snap.contextWindow);
  const insert = sql.slice(sql.indexOf('INSERT INTO models'), sql.indexOf('DELETE FROM model_plan_mapping'));
  const conflict = insert.match(/ON CONFLICT \(slug\) DO UPDATE SET ([^;]+);/)!;
  assert.ok(conflict, 'SQL must upsert a pre-existing seed row');
  assert.equal(conflict[1].trim(), 'context_window = EXCLUDED.context_window');

  for (const sqlFirst of [true, false]) {
    const f = fixture({ providers: [{ id: 1, slug: 'subq', name: 'SubQ' }],
      models: sqlFirst ? [{ id: 2, slug, type, model_category: category, context_window: Number(context), provider_ids: [1] }] : [],
    });
    await f.seed();
    const rows = f.data.models.filter(row => row.slug === slug);
    assert.equal(rows.length, 1);
    const model = rows[0];
    if (sqlFirst) assert.equal(model.id, 2);
    assert.equal(model.type, type);
    assert.equal(model.model_category, snap.modelCategory);
    assert.equal(model.context_window, snap.contextWindow);
    // Replay the SQL's conflict assignment twice; retain the ID and audited fields.
    const snapshot = JSON.stringify(f.data);
    for (let i = 0; i < 2; i++) Object.assign(model, { context_window: Number(context) });
    assert.equal(JSON.stringify(f.data), snapshot);
    const audit = await f.run('audit-vertical-catalog', ['--db']);
    assert.equal(audit.code, 0, audit.output);
    await f.seed();
    assert.equal(JSON.stringify(f.data), snapshot);
  }
});


test('new non-LLM catalog rows are soft during rollout, including partially seeded rows', async () => {
  const f = fixture();
  await f.seed();
  const pending = await f.run('audit-vertical-catalog', ['--db']);
  assert.equal(pending.code, 0, pending.output);
  for (const item of catalog.AI_VERTICAL_CATALOG.filter(item => item.deferredDbSeed)) {
    assert.ok(pending.output.includes(`WARNING ${item.kind}:${item.slug}: DB drift: missing models row`));
  }
  f.data.models.push({ id: 999, slug: 'grok-voice-3.0', name: 'Partial seed', model_category: null });
  const partial = await f.run('audit-vertical-catalog', ['--db']);
  assert.equal(partial.code, 0, partial.output);
  assert.match(partial.output, /WARNING voice-model:grok-voice-3.0: DB drift: model_category/);
  assert.doesNotMatch(partial.output, /CRITICAL/);
  await f.seedNonLlmRows();
  const seeded = await f.run('audit-vertical-catalog', ['--db']);
  assert.equal(seeded.code, 0, seeded.output);
  assert.doesNotMatch(seeded.output, /WARNING|CRITICAL/);
  const writes = f.writeCount();
  assert.deepEqual(await f.seedNonLlmRows(), []);
  assert.equal(f.writeCount(), writes);
});
