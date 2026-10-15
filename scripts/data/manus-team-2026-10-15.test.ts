import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import type { Sql } from 'postgres';
import ts from 'typescript';
import { AI_VERTICAL_CATALOG } from '../../src/lib/ai-vertical-catalog';
import { MANUS_TEAM_SOURCE, manusTeamSeedOptions, seedManusTeam } from './manus-team-2026-10-15';

type Row = Record<string, unknown> & { id: number };

/** Memory-only SQL interpreter; the real database module is never imported. */
function fixture(initial: Partial<Record<'providers' | 'plans', Row[]>> = {}) {
  const data = { providers: [] as Row[], plans: [] as Row[], ...structuredClone(initial) };
  let nextId = 10000;
  let readOnly = false;
  let ended = false;
  let writes = 0;
  let connections = 0;
  const fragment = (value: unknown) => (value as { fragment: unknown }).fragment;
  const tx = (parts: TemplateStringsArray | unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    if (query === 'SET TRANSACTION READ ONLY') { readOnly = true; return Promise.resolve([]); }
    if (query === "SELECT * FROM providers WHERE slug = 'manus'") return Promise.resolve(structuredClone(data.providers.filter(row => row.slug === 'manus')));
    if (query === "SELECT * FROM plans WHERE slug = 'manus-team'") return Promise.resolve(structuredClone(data.plans.filter(row => row.slug === 'manus-team')));
    assert.equal(readOnly, false, `Write in read-only transaction: ${query}`);
    assert.ok(['INSERT INTO ? ? RETURNING id', 'UPDATE ? SET ? WHERE id = ?'].includes(query), `Unexpected SQL: ${query}`);
    const table = String(fragment(values[0]));
    assert.ok(table === 'providers' || table === 'plans', `Unexpected table: ${table}`);
    const raw = fragment(values[1]) as Record<string, unknown>;
    const payload = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key,
      value && typeof value === 'object' && 'json' in value ? value.json : value]));
    for (const key of ['features', 'quotas']) {
      if (payload[key] != null) assert.ok(raw[key] && typeof raw[key] === 'object' && 'json' in raw[key], `${key} must use SQL JSON serialization`);
    }
    if (table === 'plans') {
      for (const key of ['provider_id', 'product_id']) assert.ok(data.providers.some(row => row.id === payload[key]), `Missing ${key}`);
    }
    if (query === 'INSERT INTO ? ? RETURNING id') {
      assert.ok(!data[table].some(row => row.slug === payload.slug), `Duplicate ${table}`);
      const row = { ...payload, id: nextId++ };
      data[table].push(row); writes++; return Promise.resolve([{ id: row.id }]);
    }
    const row = data[table].find(row => row.id === values[2]);
    assert.ok(row); Object.assign(row, payload); writes++; return Promise.resolve([]);
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
    const source = readFileSync(new URL('../seed-manus-team-2026-10-15.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const messages: string[] = [];
    const process = { argv: ['node', 'seed-manus-team', ...args], exitCode: 0 };
    const dependencies: Record<string, unknown> = {
      './data/manus-team-2026-10-15': { manusTeamSeedOptions, seedManusTeam }, './db/postgres-admin': { databaseSql: sql },
    };
    try {
      await runInNewContext(compiled, {
        exports: {}, process,
        require(name: string) {
          assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
          if (name === './db/postgres-admin') connections++;
          return dependencies[name];
        },
        console: { log: (...values: unknown[]) => messages.push(values.join(' ')), error: (error: unknown) => messages.push(String(error)) },
      });
    } catch (error) { process.exitCode = 1; messages.push(String(error)); }
    return { code: process.exitCode, output: messages.join('\n') };
  }
  return { data, sql, cli, writes: () => writes, readOnly: () => readOnly, ended: () => ended, connections: () => connections };
}

test('actual CLI defaults to read-only serializable dry-run and validates flags before connecting', async () => {
  for (const args of [[], ['--dry-run']]) {
    const f = fixture();
    const before = structuredClone(f.data);
    const result = await f.cli(args);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /Dry-run; no writes: 2 changes/);
    assert.match(result.output, /manus-team/);
    assert.ok(f.readOnly()); assert.ok(f.ended()); assert.equal(f.writes(), 0);
    assert.deepEqual(f.data, before);
  }
  assert.deepEqual(manusTeamSeedOptions(['--apply']), { apply: true });
  for (const args of [['--apply', '--dry-run'], ['--unknown'], ['--apply=true']]) {
    const f = fixture();
    const result = await f.cli(args);
    assert.equal(result.code, 1); assert.match(result.output, /Usage:/);
    assert.equal(f.connections(), 0); assert.equal(f.writes(), 0);
  }
});

test('apply creates one per-seat plan with annual pricing, pooled monthly credits and verified terms; reruns change nothing', async () => {
  const f = fixture();
  const result = await f.cli(['--apply']);
  assert.equal(result.code, 0, result.output);
  assert.ok(f.ended()); assert.equal(f.readOnly(), false);
  assert.equal(f.data.providers.length, 1); assert.equal(f.data.plans.length, 1);
  const provider = f.data.providers[0];
  assert.equal(provider.slug, 'manus'); assert.equal(provider.pricing_url, MANUS_TEAM_SOURCE);
  const plan = f.data.plans[0];
  assert.equal(plan.provider_id, provider.id); assert.equal(plan.product_id, provider.id);
  assert.equal(plan.price, 20); assert.equal(plan.annual_price, 200); assert.equal(plan.price_unit, 'per_month');
  assert.equal(plan.pricing_model, 'subscription'); assert.equal(plan.currency, 'USD');
  assert.equal(plan.plan_kind, 'agent'); assert.equal(plan.plan_category, 'agent'); assert.equal(plan.tier, 'team');
  assert.equal(plan.quota_unit, 'credits'); assert.equal(plan.included_credits, 4000);
  assert.equal(plan.included_usage_unit, 'credit'); assert.equal(plan.included_usage_amount, 4000);
  assert.equal(plan.monthly_api_credit_usd, null); assert.equal(plan.monthly_message_limit, null);
  assert.deepEqual(plan.quotas, [{ amount: 4000, unit: 'credit', period: 'month', note: 'Base 4,000 credits/seat/month, pooled across the team.' }]);
  assert.match(String(plan.notes), /US\$20\/seat\/month or US\$200\/seat\/year/);
  assert.match(String(plan.notes), /SSO is free at >=30 seats; below 30 seats, SSO is a flat US\$150 add-on/);
  assert.match(String(plan.notes), /Add-on billing interval/);
  assert.ok(String(plan.notes).includes(MANUS_TEAM_SOURCE));
  assert.equal(plan.data_for_discount, false); assert.match(String(plan.data_for_discount_note), /never trains on data/);
  // Simulate PostgreSQL timestamp text and JSONB key order on the next read.
  plan.last_verified = '2026-10-15T00:00:00+00:00';
  plan.quotas = (plan.quotas as Record<string, unknown>[]).map(quota => Object.fromEntries(Object.entries(quota).reverse()));
  const before = structuredClone(f.data);
  const writes = f.writes();
  assert.deepEqual(await seedManusTeam(f.sql, true), []);
  assert.deepEqual(await seedManusTeam(f.sql), []);
  assert.equal(f.writes(), writes); assert.deepEqual(f.data, before);
  const rerun = await f.cli(['--apply']);
  assert.equal(rerun.code, 0, rerun.output); assert.match(rerun.output, /Applied: 0 changes/);
});

test('reuses Manus provider, repairs stale plan values and preserves unrelated metadata and plans', async () => {
  const f = fixture({
    providers: [{ id: 7, slug: 'manus', name: 'Manus', logo_url: '/existing.svg', pricing_url: '/existing-pricing' }],
    plans: [{ id: 8, provider_id: 7, product_id: 7, slug: 'manus-team', price: 99, annual_price: 999, monthly_message_limit: 123, data_for_discount: true },
      { id: 9, provider_id: 7, slug: 'unrelated', price: 123 }],
  });
  const before = structuredClone(f.data);
  const dryRun = await seedManusTeam(f.sql);
  assert.equal(dryRun.length, 1); assert.equal(dryRun[0].action, 'update');
  assert.equal(f.writes(), 0); assert.deepEqual(f.data, before);
  const result = await f.cli(['--apply']);
  assert.equal(result.code, 0, result.output);
  assert.deepEqual(f.data.providers, before.providers);
  assert.deepEqual(f.data.plans[1], before.plans[1]);
  assert.equal(f.data.plans[0].id, 8); assert.equal(f.data.plans[0].price, 20);
  assert.equal(f.data.plans[0].monthly_message_limit, null); assert.equal(f.data.plans[0].data_for_discount, false);
  assert.deepEqual(await seedManusTeam(f.sql, true), []);
});

test('duplicate providers, duplicate plans and conflicting ownership abort without writes and close the client', async () => {
  for (const initial of [
    { providers: [{ id: 1, slug: 'manus' }, { id: 2, slug: 'manus' }] },
    { providers: [{ id: 1, slug: 'manus' }], plans: [{ id: 2, provider_id: 1, slug: 'manus-team' }, { id: 3, provider_id: 1, slug: 'manus-team' }] },
    { providers: [{ id: 1, slug: 'manus' }], plans: [{ id: 2, provider_id: 99, slug: 'manus-team' }] },
    { providers: [{ id: 1, slug: 'manus' }], plans: [{ id: 2, provider_id: 1, product_id: 99, slug: 'manus-team' }] },
    { plans: [{ id: 2, provider_id: 99, slug: 'manus-team' }] },
  ]) {
    for (const args of [[], ['--apply']]) {
      const f = fixture(initial);
      const before = structuredClone(f.data);
      const result = await f.cli(args);
      assert.equal(result.code, 1); assert.match(result.output, /Ambiguous/);
      assert.equal(f.writes(), 0); assert.ok(f.ended()); assert.deepEqual(f.data, before);
    }
  }
});

test('npm scripts remain optional and the static Manus catalog exposes Team pricing and terms', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:manus-team'], 'tsx scripts/seed-manus-team-2026-10-15.ts');
  assert.equal(pkg.scripts['seed:manus-team:apply'], `${pkg.scripts['seed:manus-team']} --apply`);
  for (const command of ['build', 'docker:up', 'migrate']) assert.doesNotMatch(pkg.scripts[command], /manus-team/);
  assert.doesNotMatch(readFileSync(new URL('../../deploy/production/rollout.sh', import.meta.url), 'utf8'), /seed:manus-team|seed-manus-team/);
  const manus = AI_VERTICAL_CATALOG.filter(item => item.providerSlug === 'manus');
  assert.equal(manus.length, 1);
  assert.equal(manus[0].url, MANUS_TEAM_SOURCE);
  assert.match(manus[0].pricing, /US\$20\/seat\/month or US\$200\/seat\/year/);
  assert.match(manus[0].pricing, /4,000 credits\/seat\/month, pooled/);
  assert.match(manus[0].notes!, /never trains on data/);
  assert.match(manus[0].notes!, /SSO free at >=30 seats/);
});
