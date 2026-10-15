import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import type { Sql } from 'postgres';
import ts from 'typescript';
import { COPILOT_PREVIEW_SELECTOR } from '../../src/lib/copilot';
import { resolveSelector, type ModelSelector } from '../../src/lib/plan-selector';
import { QUOTA_TEXT_SOURCES } from '../config/quota-text-sources';
import { generateOpenRouterSlug } from '../scrapers/openrouter';
import { COPILOT_PLANS, COPILOT_SOURCE, HYDRAFUSION_SOURCE, copilotSeedOptions, seedCopilot } from './copilot-2026-10-15';

type Row = Record<string, unknown> & { id: number };
const catalog = ['claude-opus-5.5', 'gpt-6-astra', 'openai-gpt-6-1-sol', 'gpt-6-luna'].map((slug, index) => ({
  id: index + 20, slug, providerSlugs: [index ? 'openai' : 'anthropic'], elo: null,
}));

/** Memory-only SQL interpreter. Unexpected queries/imports fail closed. */
function fixture(initial: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = { providers: [], models: catalog, plans: [], model_plan_mapping: [], ...structuredClone(initial) };
  let nextId = 10000;
  let readOnly = false;
  let ended = false;
  let writes = 0;
  const fragment = (value: unknown) => (value as { fragment: unknown }).fragment;
  const tx = (parts: TemplateStringsArray | unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    if (query === 'SET TRANSACTION READ ONLY') { readOnly = true; return Promise.resolve([]); }
    if (query === "SELECT * FROM providers WHERE slug = 'github'") return Promise.resolve(structuredClone(data.providers.filter(row => row.slug === 'github')));
    if (query === 'SELECT * FROM plans WHERE provider_id = ?') return Promise.resolve(structuredClone(data.plans.filter(row => row.provider_id === values[0])));
    if (query.startsWith('SELECT model.id, model.slug,')) {
      assert.match(query, /model.shutdown_date IS NULL/);
      return Promise.resolve(structuredClone(data.models));
    }
    if (query === 'SELECT * FROM model_plan_mapping WHERE plan_id IN ?') return Promise.resolve(structuredClone(data.model_plan_mapping.filter(row => (fragment(values[0]) as number[]).includes(row.plan_id as number))));
    assert.equal(readOnly, false, `Write in read-only transaction: ${query}`);
    if (query === "DELETE FROM model_plan_mapping WHERE id = ? AND source = 'derived'") {
      data.model_plan_mapping = data.model_plan_mapping.filter(row => row.id !== values[0] || row.source !== 'derived');
      writes++; return Promise.resolve([]);
    }
    const table = String(fragment(values[0]));
    assert.ok(['providers', 'plans', 'model_plan_mapping'].includes(table), `Unexpected write to ${table}`);
    const raw = fragment(values[1]) as Record<string, unknown>;
    const payload = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key,
      value && typeof value === 'object' && 'json' in value ? value.json : value]));
    for (const key of ['features', 'quotas', 'model_selector']) {
      if (payload[key] != null) assert.ok(raw[key] && typeof raw[key] === 'object' && 'json' in raw[key], `${key} must use SQL JSON serialization`);
    }
    if (table === 'model_plan_mapping') assert.ok(!('updated_at' in payload));
    if (query === 'INSERT INTO ? ? RETURNING id') {
      const keys = table === 'providers' ? ['slug'] : table === 'plans' ? ['provider_id', 'slug'] : ['plan_id', 'model_id'];
      assert.ok(!data[table].some(row => keys.every(key => row[key] === payload[key])), `Duplicate ${table}`);
      for (const [key, parent] of [['provider_id', 'providers'], ['product_id', 'providers'], ['plan_id', 'plans'], ['model_id', 'models']]) {
        if (payload[key] !== undefined) assert.ok(data[parent].some(row => row.id === payload[key]), `Missing ${parent}`);
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
    const source = readFileSync(new URL('../seed-copilot-2026-10-15.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const messages: string[] = [];
    const process = { argv: ['node', 'seed-copilot', ...args], exitCode: 0 };
    const dependencies: Record<string, unknown> = {
      './data/copilot-2026-10-15': { copilotSeedOptions, seedCopilot }, './db/postgres-admin': { databaseSql: sql },
    };
    await runInNewContext(compiled, {
      exports: {}, process,
      require(name: string) { assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`); return dependencies[name]; },
      console: { log: (...values: unknown[]) => messages.push(values.join(' ')), error: (error: unknown) => messages.push(String(error)) },
    });
    return { code: process.exitCode, output: messages.join('\n') };
  }
  return { data, sql, cli, writes: () => writes, readOnly: () => readOnly, ended: () => ended };
}

test('actual CLI defaults to SELECT-only dry-run; unsafe flags fail; npm scripts and monitor source are safe', async () => {
  const f = fixture();
  const before = structuredClone(f.data);
  const result = await f.cli();
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /Dry-run; no writes/);
  assert.match(result.output, /copilot-enterprise/);
  assert.ok(f.readOnly()); assert.ok(f.ended()); assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  assert.deepEqual(copilotSeedOptions([]), { apply: false });
  assert.deepEqual(copilotSeedOptions(['--dry-run']), { apply: false });
  assert.deepEqual(copilotSeedOptions(['--apply']), { apply: true });
  for (const args of [['--apply', '--dry-run'], ['--unknown'], ['--apply=true']]) assert.throws(() => copilotSeedOptions(args), /Usage:/);
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:copilot'], 'tsx scripts/seed-copilot-2026-10-15.ts');
  assert.equal(pkg.scripts['seed:copilot:apply'], `${pkg.scripts['seed:copilot']} --apply`);
  assert.ok(QUOTA_TEXT_SOURCES.some(source => source.url === COPILOT_SOURCE && source.enabled !== false));
  for (const file of ['../../deploy/production/rollout.sh', '../audit-vertical-catalog.ts']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /seed:copilot|copilot-(?:free|pro|max|business|enterprise)/);
  }
});

test('apply creates all six plans, unknown prices stay NULL, preview models are derived and reruns are no-ops', async () => {
  const f = fixture();
  const result = await f.cli(['--apply']);
  assert.equal(result.code, 0, result.output);
  assert.equal(f.data.providers.length, 1);
  assert.equal(f.data.providers[0].slug, 'github');
  assert.deepEqual(f.data.models, catalog);
  assert.equal(f.data.plans.length, 6);
  assert.equal(f.data.model_plan_mapping.length, 16);
  for (const [index, plan] of f.data.plans.entries()) {
    const fact = COPILOT_PLANS[index];
    assert.equal(plan.price, fact.price);
    assert.equal(plan.product_id, f.data.providers[0].id);
    assert.equal(plan.provider_id, f.data.providers[0].id);
    assert.equal(plan.source, 'manual'); assert.equal(plan.quota_unit, 'credits');
    assert.equal(plan.data_for_discount, false);
    assert.equal(plan.included_credits, fact.credits);
    assert.equal(plan.annual_price, null);
    assert.match(String(plan.notes), /1 credit = \$0\.01/);
    assert.match(String(plan.notes), /Flex credits may change/);
    if (fact.price === null) {
      assert.equal(plan.last_verified, null);
      assert.match(String(plan.notes), /^\[needs-verification\] Per-seat price/);
    }
    const mappings = f.data.model_plan_mapping.filter(row => row.plan_id === plan.id);
    if (plan.model_selector) {
      const selected = resolveSelector(plan.model_selector as ModelSelector, catalog).models;
      assert.deepEqual(mappings.map(row => row.model_id), selected.map(model => model.id));
      assert.ok(mappings.every((row, priority) => row.source === 'derived' && row.priority === priority));
      assert.ok(String(plan.notes).includes(HYDRAFUSION_SOURCE));
      assert.match(String(plan.notes), /HydraFusion and HydraFusion Max: research preview/);
      assert.match(String(plan.notes), /\[needs-verification\] Billing multiplier undisclosed/);
    } else assert.equal(mappings.length, 0);
    // JSONB key order differs from the insertion order in PostgreSQL.
    if (plan.model_selector) plan.model_selector = Object.fromEntries(Object.entries(plan.model_selector).reverse());
  }
  assert.match(String(f.data.plans[0].notes), /2,000 completions \+ 50 chat requests/);
  for (const plan of f.data.plans.slice(0, 3)) assert.match(String(plan.notes), /training unless opted out/);
  for (const plan of f.data.plans.slice(4)) assert.match(String(plan.notes), /not used for training/);
  assert.match(String(f.data.plans[3].notes), /\[needs-verification\] Max plan training policy/);
  const writes = f.writes();
  assert.deepEqual(await seedCopilot(f.sql, true), []);
  assert.equal(f.writes(), writes);
  assert.deepEqual(await seedCopilot(f.sql), []);
});

test('selector matches only the verified pool, tolerates missing models, and never creates priced HydraFusion models', async () => {
  const noise = ['gpt-6-astra-pro', 'gpt-6-astra-batch', 'openai-gpt-6-1-sol-pro', 'claude-opus-5.5-long-context', 'claude-opus-5.6', 'hydrafusion', 'hydrafusion-max'];
  const candidates = [...catalog, ...noise.map((slug, index) => ({ id: 100 + index, slug, providerSlugs: ['openai', 'anthropic'], elo: null }))];
  assert.deepEqual(resolveSelector(COPILOT_PREVIEW_SELECTOR, candidates).models.map(model => model.id).sort(), catalog.map(model => model.id).sort());
  const aliases = ['anthropic/claude-opus-5.5', 'openai/gpt-6-astra', 'openai/gpt-6.1-sol', 'openai/gpt-6-luna']
    .map((id, index) => ({ id: 500 + index, slug: generateOpenRouterSlug(id), providerSlugs: [id.split('/')[0]], elo: null }));
  assert.equal(resolveSelector(COPILOT_PREVIEW_SELECTOR, aliases).models.length, 4);
  const f = fixture({ models: [] });
  const result = await f.cli(['--apply']);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /Missing catalog models are skipped/);
  assert.equal(f.data.models.length, 0);
  assert.equal(f.data.plans.length, 6);
  assert.equal(f.data.model_plan_mapping.length, 0);
  // A NULL selector emits only the existing missing-selector warning; no empty-selector critical.
  assert.ok(f.data.plans.every(plan => plan.model_selector === null));
});

test('repairs stale owned plans and derived mappings while preserving manual mappings and unrelated records', async () => {
  const f = fixture({
    providers: [{ id: 1, slug: 'github', name: 'GitHub', logo_url: '/existing.svg' }],
    plans: [{ id: 2, provider_id: 1, slug: 'copilot-business', price: 19, annual_price: 999, monthly_message_limit: 999 },
      { id: 3, provider_id: 1, slug: 'unrelated', price: 123 }],
    model_plan_mapping: [{ id: 4, plan_id: 2, model_id: 20, source: 'manual', priority: 8 },
      { id: 5, plan_id: 2, model_id: 999, source: 'derived', priority: 0 }],
  });
  const before = structuredClone(f.data);
  assert.ok((await seedCopilot(f.sql)).length);
  assert.equal(f.writes(), 0); assert.deepEqual(f.data, before);
  await seedCopilot(f.sql, true);
  const business = f.data.plans.find(plan => plan.id === 2)!;
  assert.equal(business.price, null); assert.equal(business.annual_price, null); assert.equal(business.monthly_message_limit, null);
  assert.equal(f.data.providers[0].logo_url, '/existing.svg');
  assert.equal(f.data.providers[0].pricing_url, COPILOT_SOURCE);
  assert.deepEqual(f.data.models, before.models);
  assert.deepEqual(f.data.plans.find(plan => plan.id === 3), before.plans[1]);
  assert.deepEqual(f.data.model_plan_mapping.find(row => row.id === 4), before.model_plan_mapping[0]);
  assert.ok(!f.data.model_plan_mapping.some(row => row.id === 5));
  assert.deepEqual(await seedCopilot(f.sql, true), []);
});

test('ambiguous identities abort atomically and close the client', async () => {
  const f = fixture({ providers: [{ id: 1, slug: 'github' }], plans: [
    { id: 2, provider_id: 1, slug: 'copilot-business' }, { id: 3, provider_id: 1, slug: 'copilot-business' },
  ] });
  const before = structuredClone(f.data);
  const result = await f.cli(['--apply']);
  assert.equal(result.code, 1); assert.match(result.output, /Ambiguous plans\/copilot-business/);
  assert.deepEqual(f.data, before); assert.ok(f.ended());
});
