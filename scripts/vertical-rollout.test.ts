import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as catalog from '../src/lib/ai-vertical-catalog';
import * as logos from '../src/lib/vertical-provider-logos';
import { PERPLEXITY_DECIDER_CATALOG } from '../src/lib/perplexity-decider-catalog';
import * as auditVertical from './data/catalog-audit-vertical';
import * as catalog20261029 from './data/catalog-2026-10-29';
import * as seedDiff from './utils/seed-diff';
import type { Sql } from 'postgres';
import { seedImageModels, seedNonLlm } from './data/non-llm-seed';
import * as modelShutdown from '../src/lib/model-shutdown';

type Row = Record<string, unknown> & { id: number };

/** Memory-only query adapter; script imports cannot reach a real DB. */
function fixture(initial: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = {
    providers: [], models: [], plans: [], model_plan_mapping: [], usage_prices: [],
    ...structuredClone(initial),
  };
  let nextId = 10000;
  let writes = 0;
  let clock = '2026-10-15T00:00:00Z';
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
      './data/catalog-2026-10-29': catalog20261029,
      './utils/seed-diff': seedDiff,
      '../src/lib/model-shutdown': modelShutdown,
    };
    await runInNewContext(compiled, {
      exports: {}, process, URL,
      require(id: string) {
        assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
        return dependencies[id];
      },
      console: { log: (...values: unknown[]) => messages.push(values.join(' ')), error: (...values: unknown[]) => messages.push(values.join(' ')) },
      Date: class extends Date { constructor(value: string | number = clock) { super(value); } },
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
  return { data, run, seed, seedNonLlmRows, writeCount: () => writes, setClock: (value: string) => { clock = value; } };
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
    } else if (item.kind === 'video-model' && item.billingUnit === 'per_1m_tokens' && item.usageRates?.length) {
      assert.equal(usage.length, item.usageRates.length, item.slug);
      for (const rate of item.usageRates) {
        const rows = usage.filter(row => row.price_kind === rate.priceKind);
        assert.equal(rows.length, 1, `${item.slug}/${rate.priceKind}`);
        const row = rows[0];
        assert.equal(row.unit, 'per_1m_tokens');
        assert.equal(row.price, rate.price);
        assert.equal(row.currency, item.currency);
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
  // Deciders belong to a separate deferred seed; the two applied groups must be clean.
  assert.deepEqual(
    seeded.output.split('\n').filter(line => /WARNING|CRITICAL/.test(line)),
    PERPLEXITY_DECIDER_CATALOG.map(item =>
      `WARNING ${item.kind}:${item.slug}: DB drift: missing models row; run npm run seed:glimpse-decider:apply`),
  );
  const writes = f.writeCount();
  assert.deepEqual(await f.seedNonLlmRows(), []);
  assert.equal(f.writeCount(), writes);
});

test('deferred catalog rows point at their image, non-LLM or glimpse-decider seed', async () => {
  const { IMAGE_MODEL_CATALOG } = await import('../src/lib/image-model-catalog');
  const { NON_LLM_CATALOG } = await import('../src/lib/non-llm-catalog');
  for (const item of IMAGE_MODEL_CATALOG) assert.equal(item.deferredDbSeedScript, 'seed:image-models-2026-10-15:apply', item.slug);
  for (const item of NON_LLM_CATALOG) assert.equal(item.deferredDbSeedScript, undefined, item.slug);
  for (const item of PERPLEXITY_DECIDER_CATALOG) {
    assert.equal(item.deferredDbSeed, true, item.slug);
    assert.equal(item.deferredDbSeedScript, 'seed:glimpse-decider:apply', item.slug);
  }
});

test('vertical model/pricing seeds default to dry-run and --slug narrows the run', async () => {
  const f = fixture({ providers: [{ id: 1, slug: 'byteplus', name: 'BytePlus' }] });
  for (const name of ['seed-vertical-models', 'seed-vertical-pricing-references']) {
    const dry = await f.run(name, ['--slug', 'omnihuman-2-0']);
    assert.match(dry.output, /\[DRY-RUN\]/);
  }
  assert.equal(f.writeCount(), 0);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.doesNotMatch(pkg.scripts['seed:vertical-models'], /--apply/);
  assert.doesNotMatch(pkg.scripts['seed:vertical-pricing'], /--apply/);
  const rollout = readFileSync(new URL('../deploy/production/rollout.sh', import.meta.url), 'utf8');
  const rolloutCode = rollout.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');
  assert.doesNotMatch(rolloutCode, /seed:vertical-models|seed:vertical-pricing/);
  const manual = readFileSync(new URL('../deploy/production/seed-catalog.sh', import.meta.url), 'utf8');
  assert.match(manual, /seed:vertical-models -- --apply/);
  assert.match(manual, /seed:vertical-pricing -- --apply/);
  const bad = await f.run('seed-vertical-pricing-references', ['--slug', 'no-such-model']);
  assert.equal(bad.code, 1);
});

test('production --slug kimi-k3 repairs only context, previews without writes and is idempotent', async () => {
  const variants = ['kimi-k3.1-pro', 'kimi-k3.1-pro-highspeed', 'moonshotai-kimi-k3-1-pro',
    'kimi-k3-fast', 'kimi-k3-batch', 'kimi-k3-us', 'moonshotai-kimi-k3'];
  const f = fixture({ models: [
    { id: 1, slug: 'kimi-k3', name: 'Kimi K3', type: 'llm', context_window: 128_000,
      provider_ids: [33], description: 'Keep metadata', updated_at: '2026-10-01T00:00:00Z' },
    ...variants.map((slug, i) => ({ id: i + 2, slug, context_window: 128_000 })),
    { id: 100, slug: 'gpt-5', context_window: 128_000 },
  ] });
  const before = structuredClone(f.data);
  const scripts = ['seed-vertical-models', 'seed-vertical-pricing-references'];
  for (const name of scripts) {
    const dry = await f.run(name, ['--slug', 'kimi-k3']);
    assert.equal(dry.code, 0, dry.output);
    if (name === 'seed-vertical-models') {
      assert.match(dry.output, /\[DRY-RUN\]/);
      assert.match(dry.output, /context_window: 128000 → 1048576/);
    } else assert.match(dry.output, /no vertical pricing references/);
  }
  assert.equal(f.writeCount(), 0);
  assert.deepEqual(f.data, before);
  for (const name of scripts) {
    const applied = await f.run(name, ['--apply', '--slug', 'kimi-k3']);
    assert.equal(applied.code, 0, applied.output);
  }
  assert.equal(f.writeCount(), 1);
  assert.deepEqual(f.data, { ...before, models: [
    { ...before.models[0], context_window: 1_048_576, updated_at: '2026-10-15T00:00:00.000Z' },
    ...before.models.slice(1),
  ] });
  for (const name of scripts) assert.equal((await f.run(name, ['--apply', '--slug=kimi-k3'])).code, 0);
  assert.equal(f.writeCount(), 1);
});

test('Kimi context seed handles NULL, missing/duplicate rows, unexpected context and slug scope', async () => {
  const blank = fixture({ models: [{ id: 1, slug: 'kimi-k3', context_window: null }] });
  assert.equal((await blank.run('seed-vertical-models', ['--apply', '--slug', 'kimi-k3'])).code, 0);
  assert.equal(blank.data.models[0].context_window, 1_048_576);
  const missing = fixture();
  const skip = await missing.run('seed-vertical-models', ['--apply', '--slug', 'kimi-k3']);
  assert.equal(skip.code, 0, skip.output);
  assert.match(skip.output, /model row not found/);
  assert.equal(missing.writeCount(), 0);
  const duplicate = fixture({ models: [
    { id: 1, slug: 'kimi-k3', context_window: 128_000 },
    { id: 2, slug: 'kimi-k3', context_window: 128_000 },
  ] });
  await assert.rejects(duplicate.run('seed-vertical-models', ['--apply', '--slug', 'kimi-k3']), /Duplicate rows for kimi-k3/);
  assert.equal(duplicate.writeCount(), 0);
  const f = fixture({ models: [{ id: 1, slug: 'kimi-k3', context_window: 262_144 }] });
  const unexpected = await f.run('seed-vertical-models', ['--apply', '--slug', 'kimi-k3']);
  assert.equal(unexpected.code, 0, unexpected.output);
  assert.match(unexpected.output, /262144.*left for review/);
  assert.equal(f.writeCount(), 0);
  f.data.models[0].context_window = 128_000;
  for (const name of ['seed-vertical-models', 'seed-vertical-pricing-references']) {
    const writes = f.writeCount();
    const invalid = await f.run(name, ['--apply', '--slug', 'kimi-k3,no-such-model']);
    assert.equal(invalid.code, 1);
    assert.equal(f.writeCount(), writes);
    const unrelated = await f.run(name, ['--apply', '--slug', 'omnihuman-2-0']);
    assert.equal(unrelated.code, 0, unrelated.output);
    assert.equal(f.data.models[0].context_window, 128_000);
  }
  const mixed = ['--apply', '--slug', 'kimi-k3,omnihuman-2-0'];
  for (const name of ['seed-vertical-models', 'seed-vertical-pricing-references']) {
    const result = await f.run(name, mixed);
    assert.equal(result.code, 0, result.output);
  }
  assert.equal(f.data.models[0].context_window, 1_048_576);
  assert.ok(f.data.models.some(row => row.slug === 'omnihuman-2-0'));
});

test('vertical pricing seed only touches the requested slug, prints field diffs, keeps newer last_verified and is_available', async () => {
  const f = fixture();
  await f.seed();
  const omni = catalog.AI_VERTICAL_CATALOG.find(item => item.slug === 'omnihuman-2-0')!;
  assert.ok(omni && !omni.deferredDbSeed, 'omnihuman-2-0 must be a seedable vertical row');
  const model = f.data.models.find(row => row.slug === 'omnihuman-2-0')!;
  const other = f.data.usage_prices.find(row => row.model_id !== model.id)!;
  const usage = f.data.usage_prices.find(row => row.model_id === model.id)!;
  const plan = f.data.plans.find(row => row.slug === 'omnihuman-2-0-official-pricing')!;

  // Drift: stale price, a newer verification date and a manual unavailability flag.
  usage.price = 0.5;
  usage.last_verified = new Date('2030-01-01T00:00:00Z');
  usage.is_available = false;
  other.price = 123;
  plan.last_verified = '2030-01-01T00:00:00.000Z';
  const otherSnapshot = JSON.stringify(other);
  const writes = f.writeCount();

  const dry = await f.run('seed-vertical-pricing-references', ['--slug', 'omnihuman-2-0']);
  assert.equal(dry.code, 0, dry.output);
  assert.equal(f.writeCount(), writes, 'dry-run must not write');
  assert.match(dry.output, /price: 0\.5 → 0\.07/);
  assert.match(dry.output, /plan .*omnihuman-2-0-official-pricing: unchanged/);
  assert.doesNotMatch(dry.output, /last_verified|is_available/);
  assert.match(dry.output, /0 insert, 1 update/);

  await f.run('seed-vertical-pricing-references', ['--slug', 'omnihuman-2-0', '--apply']);
  assert.equal(f.writeCount(), writes + 1, 'only the changed row is written');
  assert.equal(usage.price, omni.pricePerUnit);
  assert.equal((usage.last_verified as Date).toISOString(), '2030-01-01T00:00:00.000Z');
  assert.equal(usage.is_available, false);
  assert.equal(plan.last_verified, '2030-01-01T00:00:00.000Z');
  assert.equal(JSON.stringify(other), otherSnapshot, 'other slugs untouched');

  // A full run with nothing stale besides the other row writes exactly that row.
  const full = f.writeCount();
  await f.run('seed-vertical-pricing-references', ['--apply']);
  assert.equal(f.writeCount(), full + 1);
  assert.equal(usage.is_available, false, 'is_available only syncs with --sync-availability');
  await f.run('seed-vertical-pricing-references', ['--apply', '--slug=omnihuman-2-0', '--sync-availability']);
  assert.equal(usage.is_available, true);
});

test('discontinued usage rows are marked unavailable by the pricing seed and then pass the DB audit', async () => {
  const f = fixture();
  await f.seed();
  const retiredStatuses = new Set(['discontinued', 'retired']);
  const retired = catalog.AI_VERTICAL_CATALOG.filter(item => retiredStatuses.has(item.status) && !item.deferredDbSeed);
  assert.deepEqual(retired.map(item => item.slug).sort(), ['gemini-omni-flash', 'minimax-audio', 'sora', 'veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite']);
  const flipped: (typeof f.data.usage_prices)[number][] = [];
  for (const item of retired) {
    const model = f.data.models.find(row => row.slug === item.slug)!;
    const rows = f.data.usage_prices.filter(row => row.model_id === model.id);
    assert.ok(rows.length > 0, item.slug);
    for (const row of rows) {
      row.is_available = true;
      flipped.push(row);
    }
  }
  const live = f.data.usage_prices.find(row => !flipped.includes(row))!;
  assert.equal(live.is_available, true);
  const before = await f.run('audit-vertical-catalog', ['--db']);
  assert.equal(before.code, 1);
  assert.match(before.output, /music-model:minimax-audio: DB drift: missing usage_prices reference generation\/generation/);
  assert.match(before.output, /video-model:sora: DB drift: missing usage_prices reference generation\/generation/);

  const seeded = await f.run('seed-vertical-pricing-references', ['--apply']);
  assert.equal(seeded.code, 0, seeded.output);
  assert.match(seeded.output, /minimax-audio\/generation\/generation[\s\S]*is_available: true → false/);
  assert.doesNotMatch(seeded.output, /--sync-availability/);
  for (const row of flipped) assert.equal(row.is_available, false);
  assert.equal(live.is_available, true, 'available models keep their existing availability');

  const after = await f.run('audit-vertical-catalog', ['--db']);
  assert.equal(after.code, 0, after.output);
  assert.doesNotMatch(after.output, /CRITICAL/);
});

test('usage references of a model past its shutdown_date go unavailable one way, and the DB audit agrees', async t => {
  const ending = catalog.AI_VERTICAL_CATALOG.filter(item => item.shutdownDate === '2026-10-22' && !item.deferredDbSeed);
  assert.ok(ending.length > 0, 'catalog has rows retiring 2026-10-22');
  // Since 2026-10-29 these rows are 'discontinued'; replay them as the 'deprecated' rows they were
  // before shutdown so this test still covers the shutdown_date path on its own.
  const statuses = ending.map(item => item.status);
  for (const item of ending) (item as { status: string }).status = 'deprecated';
  t.after(() => ending.forEach((item, i) => { (item as { status: string }).status = statuses[i]; }));
  const f = fixture();
  await f.seed();
  const usageOf = (slug: string) => {
    const model = f.data.models.find(row => row.slug === slug)!;
    return f.data.usage_prices.filter(row => row.model_id === model.id);
  };
  for (const item of ending) for (const row of usageOf(item.slug!)) assert.equal(row.is_available, true, item.slug);
  assert.equal((await f.run('audit-vertical-catalog', ['--db'])).code, 0);

  // 2026-10-22 00:00 UTC: on the shutdown day the audit expects the reference off.
  f.setClock('2026-10-22T00:00:00Z');
  const stale = await f.run('audit-vertical-catalog', ['--db']);
  assert.equal(stale.code, 1);
  assert.match(stale.output, new RegExp(`${ending[0].slug}: DB drift: missing usage_prices reference`));

  const seeded = await f.run('seed-vertical-pricing-references', ['--apply']);
  assert.equal(seeded.code, 0, seeded.output);
  assert.match(seeded.output, /is_available: true → false/);
  for (const item of ending) for (const row of usageOf(item.slug!)) assert.equal(row.is_available, false, item.slug);
  const live = catalog.AI_VERTICAL_CATALOG.find(item => !item.shutdownDate && item.status === 'available' && !item.deferredDbSeed
    && f.data.models.some(row => row.slug === item.slug));
  if (live) for (const row of usageOf(live.slug!)) assert.equal(row.is_available, true, live.slug);
  const after = await f.run('audit-vertical-catalog', ['--db']);
  assert.equal(after.code, 0, after.output);

  // One way: winding the clock back never turns the rows on again.
  f.setClock('2026-10-15T00:00:00Z');
  assert.equal((await f.run('seed-vertical-pricing-references', ['--apply'])).code, 0);
  for (const item of ending) for (const row of usageOf(item.slug!)) assert.equal(row.is_available, false, item.slug);
});

test('vertical models seed writes only changed fields', async () => {
  const f = fixture();
  await f.seed();
  const model = f.data.models.find(row => row.slug === 'omnihuman-2-0')!;
  model.name = 'Stale';
  (model.capabilities as string[]).reverse();
  const writes = f.writeCount();
  const dry = await f.run('seed-vertical-models', ['--slug', 'omnihuman-2-0']);
  assert.match(dry.output, /name: "Stale" → /);
  assert.doesNotMatch(dry.output, /capabilities/);
  assert.equal(f.writeCount(), writes);
  await f.run('seed-vertical-models', ['--slug', 'omnihuman-2-0', '--apply']);
  assert.equal(f.writeCount(), writes + 1);
  assert.notEqual(model.name, 'Stale');
});

test('video token seeds repair old reference rows in place, stay scoped and are idempotent', async () => {
  const f = fixture();
  await f.seed();
  const slugs = ['gemini-omni-1-1-flash', 'seedance'];
  const ids: number[] = [];
  const modelIds: number[] = [];
  for (const slug of slugs) {
    const model = f.data.models.find(row => row.slug === slug)!;
    modelIds.push(model.id);
    const usage = f.data.usage_prices.find(row => row.model_id === model.id && row.price_kind === 'video_output_tokens')!;
    ids.push(usage.id);
    Object.assign(usage, slug === 'seedance'
      ? { price_kind: 'generation', unit: 'generation', price: 0.46 }
      : { price_kind: 'availability', unit: 'availability', price: 17.5 });
    model.pricing_unit = 'per_second';
  }
  const unrelated = JSON.stringify(f.data.usage_prices.filter(row => !modelIds.includes(Number(row.model_id))));
  const count = f.data.usage_prices.length;
  const writes = f.writeCount();
  for (const name of ['seed-vertical-models', 'seed-vertical-pricing-references']) {
    const dry = await f.run(name, ['--slug', slugs.join(',')]);
    assert.equal(dry.code, 0, dry.output);
    assert.equal(f.writeCount(), writes);
  }
  for (const name of ['seed-vertical-models', 'seed-vertical-pricing-references']) {
    const result = await f.run(name, ['--apply', '--slug', slugs.join(',')]);
    assert.equal(result.code, 0, result.output);
  }
  for (const [i, slug] of slugs.entries()) {
    const item = catalog.AI_VERTICAL_CATALOG.find(row => row.slug === slug)!;
    assert.equal(f.data.models.find(row => row.slug === slug)!.pricing_unit, 'per_1m_tokens');
    const usage = f.data.usage_prices.find(row => row.id === ids[i])!;
    assert.equal(usage.unit, 'per_1m_tokens');
    assert.equal(usage.price_kind, 'video_output_tokens');
    assert.equal(usage.price, item.pricePerUnit);
    assert.equal(usage.currency, item.currency);
    assert.equal(f.data.plans.find(row => row.slug === `${slug}-official-pricing`)!.price_unit, 'per_1m_tokens');
  }
  assert.equal(f.data.usage_prices.length, count);
  assert.equal(JSON.stringify(f.data.usage_prices.filter(row => !modelIds.includes(Number(row.model_id)))), unrelated);
  const applied = f.writeCount();
  await f.run('seed-vertical-models', ['--apply', '--slug', slugs.join(',')]);
  await f.run('seed-vertical-pricing-references', ['--apply', '--slug', slugs.join(',')]);
  assert.equal(f.writeCount(), applied);
  const audit = await f.run('audit-vertical-catalog', ['--db']);
  assert.equal(audit.code, 0, audit.output);
});

test('Gemini pricing seed also repairs explicit per_second units without adding a duplicate', async () => {
  for (const kind of ['video_second', 'video_output_tokens']) {
    const f = fixture();
    const slug = 'gemini-omni-1-1-flash';
    await f.seed();
    const model = f.data.models.find(row => row.slug === slug)!;
    const usage = f.data.usage_prices.find(row => row.model_id === model.id && row.price_kind === 'video_output_tokens')!;
    const id = usage.id;
    const count = f.data.usage_prices.length;
    Object.assign(usage, { price_kind: kind, unit: 'per_second' });
    const result = await f.run('seed-vertical-pricing-references', ['--apply', '--slug', slug]);
    assert.equal(result.code, 0, result.output);
    assert.equal(f.data.usage_prices.length, count);
    const repaired = f.data.usage_prices.find(row => row.id === id)!;
    assert.equal(repaired.price_kind, 'video_output_tokens');
    assert.equal(repaired.unit, 'per_1m_tokens');
    assert.equal(repaired.price, 17.5);
  }
});

test('pricing updates preserve unspecified currency and constraints; inserts still default to USD', async () => {
  const slug = 'sora'; // This catalog entry deliberately has no currency or price range.
  assert.equal(catalog.AI_VERTICAL_CATALOG.find(item => item.slug === slug)!.currency, undefined);
  const f = fixture({ providers: [{ id: 1, slug: 'openai', name: 'OpenAI' }],
    models: [{ id: 2, slug, name: 'Sora', provider_ids: [1] }] });
  assert.equal((await f.run('seed-vertical-pricing-references', ['--apply', '--slug', slug])).code, 0);
  const plan = f.data.plans[0];
  const usage = f.data.usage_prices[0];
  assert.equal(plan.currency, 'USD');
  assert.equal(usage.currency, 'USD');
  plan.currency = usage.currency = 'CNY';
  plan.name = 'Stale name'; // Exercise an actual update alongside omitted fields.
  const extra = { region: 'china', price_high: 12, approximate: true, custom: { resolution: '720p' } };
  Object.assign(usage.constraints_json as object, extra);
  const before = JSON.stringify(f.data);
  const writes = f.writeCount();
  const preview = await f.run('seed-vertical-pricing-references', ['--slug', slug]);
  assert.equal(preview.code, 0, preview.output);
  assert.doesNotMatch(preview.output, /currency:|constraints_json:/);
  assert.equal(JSON.stringify(f.data), before);
  assert.equal(f.writeCount(), writes);
  const applied = await f.run('seed-vertical-pricing-references', ['--apply', '--slug', slug]);
  assert.equal(applied.code, 0, applied.output);
  assert.equal(plan.currency, 'CNY');
  assert.equal(usage.currency, 'CNY');
  assert.equal(plan.name, 'Sora official pricing');
  for (const [key, value] of Object.entries(extra)) {
    assert.deepEqual((usage.constraints_json as Record<string, unknown>)[key], value);
  }
});

test('Gemini pricing slug limits plan and usage changes and writes the October 30 verification date', async () => {
  const slug = 'gemini-omni-1-1-flash';
  const f = fixture();
  await f.seed();
  const model = f.data.models.find(row => row.slug === slug)!;
  const plan = f.data.plans.find(row => row.slug === `${slug}-official-pricing`)!;
  const usage = f.data.usage_prices.filter(row => row.model_id === model.id);
  assert.deepEqual(usage.map(row => row.price), [1.5, 9, 17.5]);
  for (const row of usage) row.last_verified = '2026-10-15';
  const unrelated = f.data.usage_prices.filter(row => row.model_id !== model.id);
  const before = JSON.stringify(unrelated);
  const otherPlans = JSON.stringify(f.data.plans.filter(row => row.id !== plan.id));
  const preview = await f.run('seed-vertical-pricing-references', ['--slug', slug]);
  assert.equal(preview.code, 0, preview.output);
  assert.doesNotMatch(preview.output, /wan-video|seedance|mistral/i);
  assert.match(preview.output, /2026-10-30/);
  const applied = await f.run('seed-vertical-pricing-references', ['--apply', '--slug', slug]);
  assert.equal(applied.code, 0, applied.output);
  for (const row of usage) assert.equal(new Date(String(row.last_verified)).toISOString(), '2026-10-30T00:00:00.000Z');
  assert.equal(JSON.stringify(unrelated), before);
  assert.equal(JSON.stringify(f.data.plans.filter(row => row.id !== plan.id)), otherPlans);
});
