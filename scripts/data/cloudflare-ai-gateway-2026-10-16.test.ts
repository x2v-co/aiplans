import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  CF_GATEWAY_PROVIDER, CF_GATEWAY_SLUG, CF_UNIFIED_BILLING_FEE_PCT,
  cfGatewaySeedOptions, cfUnifiedBillingEffectiveCost, seedCloudflareAiGateway,
} from './cloudflare-ai-gateway-2026-10-16';

type Row = Record<string, unknown> & { id: number };
function fixture(providers: Row[] = []) {
  const data = structuredClone(providers);
  const writes: string[] = [];
  const frag = (v: unknown) => (v as { fragment: unknown }).fragment;
  const tx = (parts: TemplateStringsArray | unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const q = parts.join('?').trim();
    if (q === 'SELECT * FROM providers WHERE slug = ?') return Promise.resolve(data.filter(r => r.slug === values[0]));
    assert.equal(frag(values[0]), 'providers');
    const raw = frag(values[1]) as Record<string, unknown>;
    assert.ok(raw.payment_methods && typeof raw.payment_methods === 'object' && 'json' in (raw.payment_methods as object));
    writes.push(q);
    if (q === 'INSERT INTO ? ? RETURNING id') { data.push({ ...raw, id: 900 }); return Promise.resolve([{ id: 900 }]); }
    if (q === 'UPDATE ? SET ? WHERE id = ?') { Object.assign(data.find(r => r.id === values[2])!, raw); return Promise.resolve([]); }
    throw new Error(`Unexpected SQL: ${q}`);
  };
  return { tx: Object.assign(tx, { json: (value: unknown) => ({ json: value }) }) as unknown as Sql, data, writes };
}

test('facts: aggregator, prepaid, 5% fee, no gateway subscription plan', () => {
  assert.equal(CF_GATEWAY_PROVIDER.type, 'aggregator');
  assert.equal(CF_UNIFIED_BILLING_FEE_PCT, 5);
  assert.match(CF_GATEWAY_PROVIDER.notes, /5% fee/);
  assert.match(CF_GATEWAY_PROVIDER.notes, /no markup/);
  assert.match(CF_GATEWAY_PROVIDER.notes, /negative/);
  assert.match(CF_GATEWAY_PROVIDER.notes, /all Cloudflare plans/);
  assert.deepEqual(CF_GATEWAY_PROVIDER.payment_methods, ['prepaid_credits']);
});

test('effective cost adds the 5% credit fee', () => {
  assert.equal(cfUnifiedBillingEffectiveCost(100), 105);
  assert.equal(cfUnifiedBillingEffectiveCost(0), 0);
  assert.throws(() => cfUnifiedBillingEffectiveCost(-1));
});

test('dry-run is SELECT-only and previews an insert', async () => {
  const f = fixture();
  const steps = await seedCloudflareAiGateway(f.tx);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].action, 'insert');
  assert.deepEqual(f.writes, []);
});

test('apply inserts once, then is idempotent', async () => {
  const f = fixture();
  await seedCloudflareAiGateway(f.tx, true);
  assert.deepEqual(f.writes, ['INSERT INTO ? ? RETURNING id']);
  const row = f.data[0];
  row.payment_methods = (row.payment_methods as { json: unknown }).json;
  delete row.updated_at;
  assert.deepEqual(await seedCloudflareAiGateway(f.tx, true), []);
  assert.equal(f.writes.length, 1);
});

test('apply updates an existing row; duplicates abort', async () => {
  const f = fixture([{ id: 7, slug: CF_GATEWAY_SLUG, type: 'official' }]);
  const steps = await seedCloudflareAiGateway(f.tx, true);
  assert.equal(steps[0].action, 'update');
  assert.equal(f.data[0].type, 'aggregator');
  await assert.rejects(seedCloudflareAiGateway(fixture([{ id: 1, slug: CF_GATEWAY_SLUG }, { id: 2, slug: CF_GATEWAY_SLUG }]).tx), /Ambiguous/);
});

test('cli options', () => {
  assert.equal(cfGatewaySeedOptions([]).apply, false);
  assert.equal(cfGatewaySeedOptions(['--apply']).apply, true);
  assert.throws(() => cfGatewaySeedOptions(['--apply', '--dry-run']));
});
