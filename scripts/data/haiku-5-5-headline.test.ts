import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { seedHaikuHeadline } from './haiku-5-5-headline';

type Row = Record<string, unknown> & { id: number };
function fixture(variants: Row[], channels: Row[] = [{ id: 15592, input_price_per_1m: null, output_price_per_1m: null, is_available: true }]) {
  const data = { variants: structuredClone(variants), channels: structuredClone(channels) };
  let next = 100;
  const tx = (parts: unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const q = (parts as string[]).join('?');
    if (q.includes('FROM models')) return Promise.resolve([{ id: 1 }]);
    if (q.includes('FROM providers')) return Promise.resolve([{ id: 2 }]);
    if (q.startsWith('SELECT * FROM api_channel_price_variants')) return Promise.resolve(structuredClone(data.variants));
    if (q.startsWith('SELECT * FROM api_channel_prices')) return Promise.resolve(structuredClone(data.channels));
    if (q.startsWith('UPDATE api_channel_prices')) { Object.assign(data.channels.find(c => c.id === values[1])!, (values[0] as { fragment: Row }).fragment); return Promise.resolve([]); }
    if (q.startsWith('INSERT INTO api_channel_prices')) { data.channels.push({ ...(values[0] as { fragment: Row }).fragment, id: next++ }); return Promise.resolve([]); }
    if (q.startsWith('INSERT')) { data.variants.push({ ...(values[0] as { fragment: Row }).fragment, id: next++ }); return Promise.resolve([]); }
    if (q.includes('SET is_headline = false')) { data.variants.find(v => v.id === values[0])!.is_headline = false; return Promise.resolve([]); }
    if (q.startsWith('UPDATE')) { Object.assign(data.variants.find(v => v.id === values[1])!, (values[0] as { fragment: Row }).fragment); return Promise.resolve([]); }
    throw new Error(q);
  };
  return { tx: tx as unknown as Sql, data };
}

test('creates the <=100K headline, demotes others, then is a no-op', async () => {
  const f = fixture([
    { id: 5, variant_key: 'prompt-gt-100k', is_headline: true },
    { id: 6, variant_key: 'batch-prompt-le-100k', is_headline: false },
  ]);
  const dry = await seedHaikuHeadline(f.tx, false);
  assert.equal(dry.length, 3);
  assert.equal(f.data.channels[0].input_price_per_1m, null);
  assert.equal(f.data.variants.length, 2);
  await seedHaikuHeadline(f.tx, true);
  const heads = f.data.variants.filter(v => v.is_headline === true);
  assert.deepEqual(heads.map(v => [v.variant_key, v.input_price_per_1m, v.output_price_per_1m]), [['prompt-le-100k', 0.1, 0.5]]);
  assert.deepEqual([f.data.channels[0].input_price_per_1m, f.data.channels[0].output_price_per_1m], [0.1, 0.5]);
  assert.deepEqual(await seedHaikuHeadline(f.tx, true), []);
});
