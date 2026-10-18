import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { seedV41FlashCny, v41FlashSeedOptions } from './deepseek-v41-flash-cny-2026-10-18';

type Row = Record<string, unknown> & { id: number };
function fixture(models: Row[] = [{ id: 20, slug: 'deepseek-v4.1-flash' }]) {
  const data: Record<string, Row[]> = { api_channel_prices: [], api_channel_price_variants: [] };
  let id = 100; let writes = 0;
  const frag = (v: unknown) => (v as { fragment: unknown }).fragment;
  const tx = ((parts: TemplateStringsArray | unknown, ...values: unknown[]) => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const q = parts.join('?').replace(/\s+/g, ' ').trim();
    if (q === "SELECT * FROM providers WHERE slug = 'deepseek'") return Promise.resolve([{ id: 3, slug: 'deepseek' }]);
    if (q === 'SELECT * FROM models WHERE slug = ?') return Promise.resolve(structuredClone(models));
    const sel = q.match(/^SELECT \* FROM (api_channel_prices|api_channel_price_variants) WHERE provider_id = \? AND model_id = \?$/);
    if (sel) return Promise.resolve(structuredClone(data[sel[1]].filter(r => r.provider_id === values[0] && r.model_id === values[1])));
    const table = String(frag(values[0])); const payload = frag(values[1]) as Record<string, unknown>;
    writes++;
    if (q === 'INSERT INTO ? ? RETURNING id') { data[table].push({ ...payload, id: id++ }); return Promise.resolve([]); }
    if (q === 'UPDATE ? SET ? WHERE id = ?') { Object.assign(data[table].find(r => r.id === values[2])!, payload); return Promise.resolve([]); }
    throw new Error(`Unexpected SQL: ${q}`);
  }) as unknown as Sql;
  return { tx, data, writes: () => writes };
}

test('dry-run writes nothing; apply adds official CNY peak/off-peak and is idempotent', async () => {
  const f = fixture();
  assert.ok((await seedV41FlashCny(f.tx, false)).length === 3);
  assert.equal(f.writes(), 0);
  await seedV41FlashCny(f.tx, true);
  const [cp] = f.data.api_channel_prices;
  assert.deepEqual([cp.currency, cp.input_price_per_1m, cp.output_price_per_1m, cp.cached_input_price_per_1m], ['CNY', 2, 8, 0.04]);
  assert.match(String(cp.notes), /zh-cn\/quick_start\/pricing/);
  assert.match(String(cp.notes), /DeepSeek-V4\.1-Flash-1017/);
  const off = f.data.api_channel_price_variants.find(v => v.variant_key === 'off-peak')!;
  assert.deepEqual([off.input_price_per_1m, off.output_price_per_1m, off.cached_input_price_per_1m, off.is_headline], [1, 4, 0.02, false]);
  assert.equal(f.data.api_channel_price_variants.find(v => v.variant_key === 'peak')!.is_headline, true);
  assert.deepEqual(await seedV41FlashCny(f.tx, true), []);
});

test('refuses ambiguous or missing model', async () => {
  await assert.rejects(seedV41FlashCny(fixture([]).tx, false), /nothing written/);
  assert.throws(() => v41FlashSeedOptions(['--apply', '--dry-run']));
});
