import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import type { Sql } from 'postgres';
import ts from 'typescript';
import { ARGON_AI_PRO_NOTE, ARGON_AI_PRO_SOURCE, ARGON_UNENTITLED_PLANS, argonChannelRow } from './gemini-4-argon';
import { argonProNote, argonProSeedOptions, seedArgonPro } from './google-ai-pro-argon-2026-10-17';

type Row = Record<string, unknown> & { id: number };
const oldNote = 'Keep API pricing and context. No Free API tier or Google AI Pro entitlement.';
const initial: Record<string, Row[]> = {
  providers: [{ id: 7, slug: 'google', type: 'producer' }],
  models: [{ id: 10, slug: 'gemini-4-argon', description: 'Model details. No Google AI Pro entitlement.' }],
  plans: [
    { id: 20, provider_id: 7, slug: 'google-ai-pro', notes: 'Existing plan terms.', monthly_price: null,
      model_selector: { families: ['gemini'], exclude: ['*-preview*', 'gemini-4-argon', 'gemini-pro'], providers: ['google'] } },
    ...['gemini-free', 'gemini-advanced', 'google-ai-plus'].map((slug, index) => ({
      id: 21 + index, provider_id: 7, slug, notes: 'Keep other plan.', model_selector: { exclude: ['gemini-4-argon'] },
    })),
    { id: 24, provider_id: 8, slug: 'google-ai-pro', notes: 'Different provider.', model_selector: null },
  ],
  api_channel_prices: [
    { ...argonChannelRow(7, 10, new Date('2026-10-17')), id: 30, notes: oldNote, is_available: false },
    { id: 31, model_id: 10, provider_id: 8, notes: 'Third party terms.', input_price_per_1m: null },
  ],
  model_plan_mapping: [{ id: 40, plan_id: 20, model_id: 10, source: 'derived' }],
};

/** Memory-only database; reject all queries outside the reviewed read/update scope. */
function fixture() {
  const data = structuredClone(initial);
  let writes = 0;
  let readOnly = false;
  let ended = false;
  const fragment = (value: unknown) => (value as { fragment: unknown }).fragment;
  const tx = (parts: TemplateStringsArray | unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    if (query === 'SET TRANSACTION READ ONLY') { readOnly = true; return Promise.resolve([]); }
    const select = (table: string, predicate: (row: Row) => boolean) => Promise.resolve(structuredClone(data[table].filter(predicate)));
    if (query === "SELECT id, type FROM providers WHERE slug = 'google'") return select('providers', row => row.slug === 'google');
    if (query === 'SELECT id, description FROM models WHERE slug = ?') return select('models', row => row.slug === values[0]);
    if (query === "SELECT id, notes, model_selector FROM plans WHERE provider_id = ? AND slug = 'google-ai-pro'") {
      return select('plans', row => row.provider_id === values[0] && row.slug === 'google-ai-pro');
    }
    if (query === 'SELECT id, notes FROM api_channel_prices WHERE model_id = ? AND provider_id = ?') {
      return select('api_channel_prices', row => row.model_id === values[0] && row.provider_id === values[1]);
    }
    assert.equal(readOnly, false, `Write during dry-run: ${query}`);
    assert.equal(query, 'UPDATE ? SET ? WHERE id = ?');
    const table = String(fragment(values[0]));
    const payload = fragment(values[1]) as Record<string, unknown>;
    const allowed: Record<string, string[]> = { models: ['description', 'updated_at'],
      plans: ['notes', 'model_selector', 'updated_at'], api_channel_prices: ['notes', 'updated_at'] };
    assert.ok(Object.hasOwn(allowed, table));
    for (const key of Object.keys(payload)) assert.ok(allowed[table].includes(key), `Unexpected write: ${table}.${key}`);
    const row = data[table].find(row => row.id === values[2]);
    assert.ok(row);
    Object.assign(row, payload); writes++;
    return Promise.resolve([]);
  };
  const sql = Object.assign(tx, {
    async begin(mode: string, callback: (tx: unknown) => Promise<void>) {
      assert.equal(mode, 'isolation level serializable');
      await callback(sql);
    },
    async end() { ended = true; },
  }) as unknown as Sql;
  return { data, sql, writes: () => writes, readOnly: () => readOnly, ended: () => ended };
}

test('CLI defaults and explicit dry-run use a serializable READ ONLY transaction without any database connection', async () => {
  const compiled = ts.transpileModule(readFileSync(new URL('../seed-google-ai-pro-argon-2026-10-17.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const args of [[], ['--dry-run']]) {
    const f = fixture();
    const before = structuredClone(f.data);
    const messages: string[] = [];
    const process = { argv: ['node', 'seed-google-ai-pro-argon', ...args], exitCode: 0 };
    const dependencies: Record<string, unknown> = {
      './data/google-ai-pro-argon-2026-10-17': { argonProSeedOptions, seedArgonPro },
      './db/postgres-admin': { databaseSql: f.sql },
    };
    await runInNewContext(compiled, {
      exports: {}, process,
      require(name: string) { assert.ok(Object.hasOwn(dependencies, name)); return dependencies[name]; },
      console: { log: (...values: unknown[]) => messages.push(values.join(' ')), error: (error: unknown) => messages.push(String(error)) },
    });
    assert.equal(process.exitCode, 0, messages.join('\n'));
    assert.equal(f.readOnly(), true);
    assert.equal(f.ended(), true);
    assert.equal(f.writes(), 0);
    assert.deepEqual(f.data, before);
    const steps = JSON.parse(messages[0]);
    assert.equal(steps.length, 3);
    assert.equal(steps[1].changes.notes.from, oldNote);
    assert.match(steps[1].changes.notes.to, /including trials.*AI Studio Build and Playground/);
    assert.match(messages.join('\n'), /Dry-run; no writes/);
  }
});

test('only explicit apply opts in; conflicting or unknown flags fail closed', () => {
  assert.deepEqual(argonProSeedOptions([]), { apply: false });
  assert.deepEqual(argonProSeedOptions(['--dry-run']), { apply: false });
  assert.deepEqual(argonProSeedOptions(['--apply']), { apply: true });
  for (const args of [['--apply', '--dry-run'], ['--force']]) assert.throws(() => argonProSeedOptions(args), /Usage:/);
});

test('memory-only write simulation preserves every price, other plan, other channel and mapping; rerun is a no-op', async () => {
  const f = fixture();
  const before = structuredClone(f.data);
  const preview = await seedArgonPro(f.sql);
  assert.equal(f.writes(), 0);
  const applied = await seedArgonPro(f.sql, true);
  assert.deepEqual(applied, preview);
  assert.equal(f.writes(), 3);
  assert.deepEqual(f.data.plans[0].model_selector, { families: ['gemini'], exclude: ['*-preview*', 'gemini-pro'], providers: ['google'] });
  for (const table of Object.keys(f.data)) {
    for (let index = 0; index < f.data[table].length; index++) {
      const row = { ...f.data[table][index] };
      const original = { ...before[table][index] };
      const permitted = table === 'models' ? ['description', 'updated_at']
        : table === 'plans' && index === 0 ? ['model_selector', 'notes', 'updated_at']
        : table === 'api_channel_prices' && index === 0 ? ['notes', 'updated_at'] : [];
      for (const key of permitted) { delete row[key]; delete original[key]; }
      assert.deepEqual(row, original, `${table}/${index}`);
    }
  }
  assert.deepEqual(await seedArgonPro(f.sql, true), []);
  assert.equal(f.writes(), 3);
});

test('missing plan is not invented; null selector uses the classification; ambiguous identities fail before writes', async () => {
  const absent = fixture();
  absent.data.plans = [];
  assert.equal((await seedArgonPro(absent.sql)).length, 2);
  assert.equal(absent.data.plans.length, 0);
  const unset = fixture();
  unset.data.plans[0].model_selector = null;
  const steps = await seedArgonPro(unset.sql);
  assert.deepEqual(steps.find(step => step.table === 'plans')?.changes.model_selector.to,
    { families: ['gemini'], exclude: ['gemini-pro', 'gemini-flash', '*-preview*'] });
  for (const table of ['providers', 'models', 'plans', 'api_channel_prices']) {
    const f = fixture();
    f.data[table].push({ ...f.data[table][0], id: 100 });
    await assert.rejects(seedArgonPro(f.sql, true), /Ambiguous/);
    assert.equal(f.writes(), 0);
  }
  for (const table of ['providers', 'models']) {
    const f = fixture();
    f.data[table] = [];
    await assert.rejects(seedArgonPro(f.sql), /nothing written/);
    assert.equal(f.writes(), 0);
  }
});

test('current and repaired notes cite scoped access and preserve Free API restrictions; old seed cannot revoke Pro', () => {
  assert.deepEqual(ARGON_UNENTITLED_PLANS, ['gemini-free']);
  for (const note of [null, oldNote, 'No Google AI Pro entitlement.', 'No AI Pro entitlement.', ARGON_AI_PRO_NOTE]) {
    const corrected = argonProNote(note);
    assert.ok(corrected.includes(ARGON_AI_PRO_SOURCE));
    assert.match(corrected, /Since 2026-10-17.*including trials.*AI Studio Build and Playground/);
    assert.match(corrected, /Gemini App access is unconfirmed/);
    assert.doesNotMatch(corrected, /No (?:Google )?AI Pro entitlement/);
    assert.equal(argonProNote(corrected), corrected);
  }
  assert.match(argonProNote(oldNote), /Keep API pricing and context\. No Free API tier\./);
  const current = argonChannelRow(7, 10, new Date('2026-10-17')).notes;
  assert.ok(current.includes(ARGON_AI_PRO_NOTE));
  assert.doesNotMatch(current, /No Free API tier or Google AI Pro entitlement/);
});
