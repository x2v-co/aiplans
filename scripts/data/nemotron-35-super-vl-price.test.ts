import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { NEMOTRON_FREE_SLUG, NEMOTRON_SLUG, seedNemotronPrice } from './nemotron-35-super-vl-price';

type Row = Record<string, unknown> & { id: number };
function fixture(opts: { model?: boolean; provider?: boolean; free?: boolean } = {}) {
  const seen: unknown[] = [];
  const data = {
    channels: [{ id: 1, input_price_per_1m: 0.15, output_price_per_1m: 0.5, cached_input_price_per_1m: 0.02, currency: 'USD', price_unit: 'per_1m_tokens' }] as Row[],
    variants: [
      { id: 10, variant_key: 'openrouter-auto', variant_kind: 'default_route', input_price_per_1m: 0.15, output_price_per_1m: 0.5 },
      { id: 11, variant_key: 'upstream-together', variant_kind: 'upstream_provider', source_group_name: 'Together', input_price_per_1m: 0.15, output_price_per_1m: 0.5, cached_input_price_per_1m: 0.02, is_available: true },
      { id: 12, variant_key: 'upstream-crusoe', variant_kind: 'upstream_provider', source_group_name: 'Crusoe', input_price_per_1m: 0.15, output_price_per_1m: 0.5, is_available: true },
      { id: 13, variant_key: 'upstream-gone', variant_kind: 'upstream_provider', source_group_name: 'Nebius', input_price_per_1m: 0.15, output_price_per_1m: 0.5, is_available: true },
    ] as Row[],
  };
  const tx = (parts: unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const q = (parts as string[]).join('?');
    if (q.includes('FROM models WHERE slug =')) { seen.push(values[0]); return Promise.resolve(opts.model === false || values[0] !== NEMOTRON_SLUG ? [] : [{ id: 1 }]); }
    if (q.includes('FROM models')) return Promise.resolve(opts.free ? [{ id: 3690, slug: NEMOTRON_FREE_SLUG }] : []);
    if (q.includes('FROM providers')) return Promise.resolve(opts.provider === false ? [] : [{ id: 2 }]);
    if (q.includes('provider_id <>')) return Promise.resolve([]);
    if (q.startsWith('SELECT * FROM api_channel_price_variants')) return Promise.resolve(structuredClone(data.variants));
    if (q.startsWith('SELECT * FROM api_channel_prices')) return Promise.resolve(structuredClone(data.channels));
    const table = q.startsWith('UPDATE api_channel_prices ') ? data.channels : data.variants;
    Object.assign(table.find(r => r.id === values[1])!, (values[0] as { fragment: Row }).fragment);
    return Promise.resolve([]);
  };
  return { tx: tx as unknown as Sql, data, seen };
}

test('aligns OpenRouter headline rows to 0.10/0.40/0.08, keeps posted upstream prices, then no-op', async () => {
  const f = fixture();
  const dry = await seedNemotronPrice(f.tx, false);
  assert.equal(dry.length, 5);
  assert.equal(f.data.channels[0].input_price_per_1m, 0.15);
  await seedNemotronPrice(f.tx, true);
  assert.deepEqual([f.data.channels[0].input_price_per_1m, f.data.channels[0].output_price_per_1m, f.data.channels[0].cached_input_price_per_1m], [0.1, 0.4, 0.08]);
  const byId = Object.fromEntries(f.data.variants.map(v => [v.id, v]));
  assert.equal(byId[10].output_price_per_1m, 0.4);
  assert.equal(byId[11].input_price_per_1m, 0.15);
  assert.equal(byId[12].input_price_per_1m, 0.1);
  assert.equal(byId[13].is_available, false);
  assert.deepEqual(await seedNemotronPrice(f.tx, true), []);
});

test('uses the hyphenated DB slug (models#3689), not the dotted OpenRouter slug', async () => {
  assert.equal(NEMOTRON_SLUG, 'nvidia-nemotron-3-5-super-vl');
  assert.equal(NEMOTRON_FREE_SLUG, 'nvidia-nemotron-3-5-super-vl-free');
  const f = fixture();
  await seedNemotronPrice(f.tx, false);
  assert.deepEqual(f.seen, ['nvidia-nemotron-3-5-super-vl']);
});

test('reports which lookup is missing', async () => {
  await assert.rejects(seedNemotronPrice(fixture({ model: false }).tx, false), /model nvidia-nemotron-3-5-super-vl missing/);
  await assert.rejects(seedNemotronPrice(fixture({ provider: false }).tx, false), /provider openrouter missing/);
});

test(':free row is review-only and never written', async () => {
  const f = fixture({ free: true });
  const steps = await seedNemotronPrice(f.tx, true);
  const free = steps.filter(s => s.target.includes('3690'));
  assert.deepEqual(free, [{ target: 'models#3690:nvidia-nemotron-3-5-super-vl-free', action: 'review', changes: { reason: ':free route stays $0; not modified' } }]);
  assert.ok(steps.every(s => s.action === 'review' || !s.target.startsWith('models#')));
});
