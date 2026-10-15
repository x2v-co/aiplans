import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { readFileSync } from 'node:fs';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import { seedCatalogAudit } from './catalog-audit-seed';

type Row = Record<string, unknown> & { id: number };
/** Memory-only SQL adapter: unexpected queries fail; no DB client is imported. */
function fixture(initial: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = { providers: [], models: [], api_channel_prices: [], usage_prices: [], plans: [], api_channel_price_variants: [], model_plan_mapping: [], quota_estimates: [], ...structuredClone(initial) };
  const writes: string[] = [];
  let id = 10000;
  const tx = (parts: TemplateStringsArray | unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const query = parts.join('?').trim();
    const fragment = (v: unknown) => (v as { fragment: unknown }).fragment;
    if (query === 'SELECT * FROM ?') return Promise.resolve(structuredClone(data[String(fragment(values[0]))]));
    if (query === 'INSERT INTO ? ? RETURNING id') {
      const table = String(fragment(values[0]));
      const row = { ...fragment(values[1]) as Record<string, unknown>, id: id++ };
      data[table].push(row); writes.push(query); return Promise.resolve([{ id: row.id }]);
    }
    if (query === 'UPDATE ? SET ? WHERE id = ?') {
      const row = data[String(fragment(values[0]))].find(r => r.id === values[2]);
      assert.ok(row); Object.assign(row, fragment(values[1])); writes.push(query); return Promise.resolve([]);
    }
    if (query.startsWith('UPDATE model_plan_mapping kept')) {
      const [keep, old] = values;
      for (const mapping of data.model_plan_mapping.filter(m => m.plan_id === old && m.source === 'manual')) {
        const kept = data.model_plan_mapping.find(m => m.plan_id === keep && m.model_id === mapping.model_id);
        if (kept) kept.source = 'manual';
      }
      writes.push(query); return Promise.resolve([]);
    }
    if (query.startsWith('INSERT INTO model_plan_mapping')) {
      const [keep, old] = values;
      for (const mapping of data.model_plan_mapping.filter(m => m.plan_id === old)) {
        if (!data.model_plan_mapping.some(m => m.plan_id === keep && m.model_id === mapping.model_id)) {
          data.model_plan_mapping.push({ ...mapping, id: id++, plan_id: keep });
        }
      }
      writes.push(query); return Promise.resolve([]);
    }
    if (query === "SELECT to_regclass('quota_estimates') IS NOT NULL AS present") return Promise.resolve([{ present: true }]);
    const referenceUpdate = query.match(/^UPDATE (usage_prices|quota_estimates) SET plan_id = \? WHERE plan_id = \?$/);
    if (referenceUpdate) {
      for (const row of data[referenceUpdate[1]].filter(r => r.plan_id === values[1])) row.plan_id = values[0];
      writes.push(query); return Promise.resolve([]);
    }
    const deletion = query.match(/^DELETE FROM (plans|model_plan_mapping) WHERE (id|plan_id) = \?$/);
    if (deletion) {
      data[deletion[1]] = data[deletion[1]].filter(r => r[deletion[2]] !== values[0]);
      writes.push(query); return Promise.resolve([]);
    }
    throw new Error(`Unexpected SQL: ${query}`);
  };
  return { tx: tx as unknown as Sql, data, writes };
}

test('default dry-run previews full seed, handles absent providers and performs no writes', async () => {
  const f = fixture();
  const original = structuredClone(f.data);
  const steps = await seedCatalogAudit(f.tx, false);
  assert.ok(steps.some(s => s.table === 'providers' && s.target === 'liquid'));
  assert.ok(steps.some(s => s.table === 'models' && s.target === 'mistral-large-4'));
  assert.ok(steps.some(s => s.target === 'subq-snap/tasks'));
  assert.equal(f.writes.length, 0);
  assert.deepEqual(f.data, original);
});

test('apply is idempotent and preserves producer ownership, new Pro, unknowns and explicit free output', async () => {
  const f = fixture({ providers: [{ id: 1, slug: 'openai' }, { id: 2, slug: 'anthropic' }],
    plans: [
      { id: 10, provider_id: 1, slug: 'chatgpt-pro', features: ['5x usage', '20x usage', 'China ✓', 'Keep feature'], notes: 'Wrong 5x/20x' },
      { id: 11, provider_id: 1, slug: 'chatgpt-pro-200', name: 'ChatGPT Pro 200', price: 200 },
      { id: 12, provider_id: 2, slug: 'claude-max', name: 'Claude Max', price: 100, notes: 'Existing fact' },
      { id: 13, provider_id: 2, slug: 'claude-max-20x', price: 200 },
    ], models: [{ id: 100, slug: 'liquid-lfm-2-5-24b-a2b', name: 'Existing Liquid', provider_ids: [999] }],
  });
  const pro = structuredClone(f.data.plans[1]);
  assert.ok((await seedCatalogAudit(f.tx, true)).length > 0);
  const newLiquid = f.data.models.find(r => r.slug === 'liquid-lfm-2-5-24b-a2b')!;
  assert.ok((newLiquid.provider_ids as number[]).includes(999));
  assert.deepEqual(f.data.plans[1], pro);
  assert.equal(f.data.plans[0].legacy_ends_on, '2026-10-29');
  assert.deepEqual(f.data.plans[0].features, ['Keep feature']);
  for (const p of f.data.plans.filter(r => r.provider_id === 2)) {
    assert.equal(p.access_from_china, false);
    assert.equal(p.monthly_api_credit_usd, null);
    assert.equal(p.monthly_api_credit_status, 'needs-verification');
    assert.match(String(p.notes), /claude.com\/pricing/);
  }
  assert.match(String(f.data.plans[2].notes), /Existing fact/);
  const or = f.data.providers.find(r => r.slug === 'openrouter')!;
  const old = f.data.models.find(r => r.slug === 'mistral-large')!;
  const m4 = f.data.models.find(r => r.slug === 'mistral-large-4')!;
  assert.equal(f.data.api_channel_prices.find(r => r.model_id === old.id && r.provider_id === or.id)?.input_price_per_1m, 2);
  assert.equal(f.data.api_channel_prices.find(r => r.model_id === m4.id && r.provider_id === or.id)?.output_price_per_1m, 2.09);
  const jev = f.data.models.find(r => r.slug === 'typesafe-jev-router')!;
  const jevPrice = f.data.api_channel_prices.find(r => r.model_id === jev.id)!;
  assert.equal(jevPrice.input_price_per_1m, null);
  assert.equal(jevPrice.last_verified, null);
  assert.match(String(jevPrice.notes), /needs-verification/);
  const extract = f.data.models.find(r => r.slug === 'scaledown-extract')!;
  assert.equal(f.data.api_channel_prices.find(r => r.model_id === extract.id)?.output_price_per_1m, 0);
  assert.deepEqual(await seedCatalogAudit(f.tx, true), []);
});

test('dedupe previews a reference-preserving merge and rejects ambiguous Max pricing', async () => {
  const plans = [
    { id: 10, provider_id: 1, slug: 'claude-max', price: 100 },
    { id: 11, provider_id: 1, slug: 'claude-max-5x', price: 100 },
  ];
  const f = fixture({ providers: [{ id: 1, slug: 'anthropic' }], plans });
  const steps = await seedCatalogAudit(f.tx, false);
  const merges = steps.filter(s => s.action === 'merge');
  assert.equal(merges.length, 1);
  assert.equal(merges[0].changes.to, 11);
  assert.equal(f.writes.length, 0);
  const bad = fixture({ providers: [{ id: 1, slug: 'anthropic' }], plans: plans.map(p => ({ ...p, price: 777 })) });
  await assert.rejects(seedCatalogAudit(bad.tx, false), /refusing ambiguous dedupe/);
});

test('applied Max merge keeps linked usage, quota estimates and manual model mappings', async () => {
  const f = fixture({ providers: [{ id: 1, slug: 'anthropic' }],
    plans: [{ id: 10, provider_id: 1, slug: 'claude-max', price: 100 }, { id: 11, provider_id: 1, slug: 'claude-max-5x', price: 100 }],
    model_plan_mapping: [
      { id: 30, model_id: 100, plan_id: 10, source: 'manual', priority: 0 },
      { id: 31, model_id: 100, plan_id: 11, source: 'derived', priority: 0 },
      { id: 32, model_id: 101, plan_id: 10, source: 'manual', priority: 0 },
    ], usage_prices: [{ id: 40, plan_id: 10 }], quota_estimates: [{ id: 50, plan_id: 10, plan_slug: 'claude-max' }],
  });
  await seedCatalogAudit(f.tx, true);
  assert.ok(!f.data.plans.some(p => p.id === 10));
  assert.equal(f.data.model_plan_mapping.length, 2);
  for (const m of f.data.model_plan_mapping) { assert.equal(m.plan_id, 11); assert.equal(m.source, 'manual'); }
  assert.equal(f.data.usage_prices.find(p => p.id === 40)?.plan_id, 11);
  assert.equal(f.data.quota_estimates[0].plan_id, 11);
  assert.deepEqual(await seedCatalogAudit(f.tx, true), []);
});

test('decision catalog seed reuses the P0 SubQ Snap API identity and prices without duplicates', async () => {
  const p0 = readFileSync(new URL('../sql/2026-10-15-p0-pricing.sql', import.meta.url), 'utf8');
  const identity = p0.match(/SELECT 'SubQ Snap', '([^']+)', '([^']+)', '([^']+)', (\d+), ARRAY\[id\]/)!;
  const prices = p0.match(/SELECT m.id, p.id, ([\d.]+), ([\d.]+), '([^']+)', '([^']+)', true/)!;
  assert.ok(identity);
  assert.ok(prices);
  const [, slug, type, category, context] = identity;
  const [, input, output, currency, priceUnit] = prices;
  const snap = catalogForKind('decision-model').filter(item => item.slug === slug);
  assert.equal(snap.length, 1);
  assert.equal(snap[0].providerSlug, 'subq');
  assert.equal(snap[0].contextWindow, Number(context));
  assert.equal(snap[0].inputPricePer1M, Number(input));
  assert.equal(snap[0].outputPricePer1M, Number(output));
  assert.equal(snap[0].currency, currency);
  assert.equal(snap[0].pricingUnit, priceUnit);
  assert.ok(p0.includes(snap[0].url!));
  const f = fixture({
    providers: [{ id: 1, slug: 'subq', type: 'official' }],
    models: [{ id: 2, slug, name: 'SubQ Snap', type, model_category: category, context_window: Number(context), provider_ids: [1] }],
    api_channel_prices: [{ id: 3, model_id: 2, provider_id: 1, input_price_per_1m: Number(input), output_price_per_1m: Number(output) }],
  });
  await seedCatalogAudit(f.tx, true);
  const models = f.data.models.filter(row => row.slug === slug);
  assert.equal(models.length, 1);
  assert.equal(models[0].id, 2);
  assert.equal(models[0].type, type);
  assert.equal(models[0].model_category, category);
  assert.equal(models[0].context_window, Number(context));
  const channels = f.data.api_channel_prices.filter(row => row.model_id === 2);
  assert.equal(channels.length, 1);
  assert.equal(channels[0].input_price_per_1m, Number(input));
  assert.equal(channels[0].output_price_per_1m, Number(output));
  for (const [kind, price] of [['input_tokens', Number(input)], ['output_tokens', Number(output)], ['tasks', null]]) {
    const rows = f.data.usage_prices.filter(row => row.model_id === 2 && row.price_kind === kind);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].price, price);
  }
  assert.deepEqual(await seedCatalogAudit(f.tx, true), []);
});

import { canonicalSeedValue, seedChanges as seedChangesForIdempotence } from './gemini-4-argon';
import { auditVerticalModelFields as auditFields } from './catalog-audit-vertical';
import { AI_VERTICAL_CATALOG as CATALOG } from '../../src/lib/ai-vertical-catalog';

test('seedChanges ignores JSON key order and date formatting', () => {
  assert.deepEqual(seedChangesForIdempotence(
    { id: 1, c: { notes: 'x', price_status: 'priced' }, d: new Date('2026-10-29T00:00:00.000Z'), t: '2026-10-15T00:00:00+00:00' },
    { c: { price_status: 'priced', notes: 'x' }, d: '2026-10-29', t: new Date('2026-10-15T00:00:00Z') }), {});
  assert.equal(canonicalSeedValue('2026-10-15T08:00:00+08:00'), '2026-10-15');
  assert.ok(Object.keys(seedChangesForIdempotence({ id: 1, c: { a: 1 } }, { c: { a: 2 } })).length === 1);
});

test('audit-owned vertical fields keep deploy seed and audit seed in agreement', () => {
  const veo = CATALOG.find(i => i.slug === 'veo-3-1')!;
  assert.equal(auditFields(veo).pricing_unit, 'per_second');
  assert.match(auditFields(veo).description, /Unit: .*\nSources: /s);
  const snap = CATALOG.find(i => i.slug === 'subq-snap')!;
  assert.deepEqual([auditFields(snap).model_category, auditFields(snap).pricing_unit], ['decision', 'per_1m_tokens']);
});

test('canonicalSeedValue terminates on non-midnight timestamps (17:16 RangeError)', async () => {
  const { canonicalSeedValue: c } = await import('./gemini-4-argon');
  assert.equal(c('2026-10-15T17:16:00+00:00'), '2026-10-15T17:16:00.000Z');
  assert.equal(c(new Date('2026-10-15T09:01:02.345Z')), '2026-10-15T09:01:02.345Z');
  assert.equal(c('2026-10-13T00:00:00+00:00'), '2026-10-13');
  assert.equal(c(new Date('2026-10-13T00:00:00Z')), '2026-10-13');
  assert.deepEqual(c({ b: '2026-10-15T08:00:00.000Z', a: [new Date('2026-12-01T08:00:00Z')] }),
    { a: ['2026-12-01T08:00:00.000Z'], b: '2026-10-15T08:00:00.000Z' });
});
