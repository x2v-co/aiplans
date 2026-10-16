import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Sql } from 'postgres';
import { gatewaySubscriptionEconomics } from '../../src/lib/gateway-subscription';
import { normalizePlanKind } from '../../src/lib/plan-kinds';
import { seedVercelTokenPass, tokenPassSeedOptions, TOKEN_PASS_SLUG } from './vercel-token-pass-2026-10-16';

type Row = Record<string, unknown> & { id: number };
const unwrap = (v: unknown) => (v && typeof v === 'object' && 'json' in v ? (v as { json: unknown }).json : v);

/** In-memory SQL double; unexpected SQL fails closed. */
function fixture(initial: Partial<Record<string, Row[]>> = {}) {
  const data: Record<string, Row[]> = { providers: [], models: [], plans: [], model_plan_mapping: [], ...structuredClone(initial) as Record<string, Row[]> };
  let id = 500;
  const writes: string[] = [];
  const frag = (v: unknown) => (v as { fragment: unknown }).fragment;
  const tx = (parts: TemplateStringsArray | unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const q = parts.join('?').trim();
    if (q === 'SELECT * FROM providers WHERE slug IN ?') return Promise.resolve(data.providers.filter(r => (frag(values[0]) as unknown[]).includes(r.slug)));
    if (q === 'SELECT * FROM models WHERE slug IN ?') return Promise.resolve(data.models.filter(r => (frag(values[0]) as unknown[]).includes(r.slug)));
    if (q === 'SELECT * FROM plans WHERE provider_id = ? AND slug = ?') return Promise.resolve(data.plans.filter(r => r.provider_id === values[0] && r.slug === values[1]));
    if (q === 'SELECT * FROM model_plan_mapping WHERE plan_id = ?') return Promise.resolve(data.model_plan_mapping.filter(r => r.plan_id === values[0]));
    const table = String(frag(values[0]));
    const raw = frag(values[1]) as Record<string, unknown>;
    for (const key of ['features', 'quotas', 'model_selector']) if (raw[key] != null) assert.ok(typeof raw[key] === 'object' && 'json' in (raw[key] as object), `${key} must use tx.json`);
    const payload = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, unwrap(v)]));
    writes.push(`${q} ${table}`);
    if (q === 'INSERT INTO ? ? RETURNING id') { const row = { ...payload, id: id++ }; data[table].push(row); return Promise.resolve([{ id: row.id }]); }
    if (q === 'UPDATE ? SET ? WHERE id = ?') { Object.assign(data[table].find(r => r.id === values[2])!, payload); return Promise.resolve([]); }
    throw new Error(`Unexpected SQL: ${q}`);
  };
  return { tx: Object.assign(tx, { json: (value: unknown) => ({ json: value }) }) as unknown as Sql, data, writes };
}

const catalog = { providers: [{ id: 1, slug: 'vercel-ai-gateway' }], models: [{ id: 11, slug: 'glm-5.3' }, { id: 12, slug: 'kimi-k3' }] };

test('dry-run issues SELECTs only and previews plan + mappings', async () => {
  const f = fixture(catalog);
  const { steps, missingModels } = await seedVercelTokenPass(f.tx);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(missingModels, []);
  assert.deepEqual(steps.map(s => `${s.table}:${s.action}`), ['plans:insert', 'model_plan_mapping:insert', 'model_plan_mapping:insert']);
});

test('apply writes verified Token Pass facts and is idempotent', async () => {
  const f = fixture(catalog);
  await seedVercelTokenPass(f.tx, true);
  const plan = f.data.plans.find(p => p.slug === TOKEN_PASS_SLUG)!;
  assert.equal(normalizePlanKind(plan.plan_kind as string), 'gateway_subscription');
  assert.equal(plan.price, 30);
  assert.equal(plan.monthly_api_credit_usd, 80);
  assert.equal(plan.quota_unit, 'usd');
  assert.equal(plan.has_overage_pricing, false);
  assert.equal(plan.provider_id, 1);
  assert.deepEqual((plan.model_selector as { extra: string[] }).extra, ['glm-5.3', 'kimi-k3']);
  assert.match(String(plan.notes), /do(es)?n't roll over|expires each billing period/);
  assert.match(String(plan.notes), /Pro teams/);
  assert.equal(gatewaySubscriptionEconomics(plan as never)!.costFactor, 0.375);
  assert.equal(f.data.model_plan_mapping.length, 2);
  assert.equal(f.data.providers.length, 1, 'reuses existing Vercel provider');
  const again = await seedVercelTokenPass(f.tx, true);
  assert.deepEqual(again.steps, []);
});

test('missing catalog model: dry-run reports, apply aborts without creating models', async () => {
  const f = fixture({ ...catalog, models: [{ id: 11, slug: 'glm-5.3' }] });
  assert.deepEqual((await seedVercelTokenPass(f.tx)).missingModels, ['Kimi K3']);
  await assert.rejects(seedVercelTokenPass(f.tx, true), /Missing catalog models: Kimi K3/);
  assert.deepEqual(f.writes, []);
});

test('options and package scripts default to dry-run', () => {
  assert.deepEqual(tokenPassSeedOptions([]), { apply: false });
  assert.deepEqual(tokenPassSeedOptions(['--apply']), { apply: true });
  assert.throws(() => tokenPassSeedOptions(['--apply', '--dry-run']));
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:vercel-token-pass'], 'tsx scripts/seed-vercel-token-pass-2026-10-16.ts');
});

test('replayed migrate keeps gateway_subscription in plans_plan_kind_chk', () => {
  const src = readFileSync(new URL('../migrate-data-accuracy.ts', import.meta.url), 'utf8');
  const checks = src.match(/CHECK \(plan_kind IN \([^)]*\)\)/g)!;
  assert.ok(checks.length >= 2);
  for (const c of checks) assert.match(c, /'gateway_subscription'/);
});
