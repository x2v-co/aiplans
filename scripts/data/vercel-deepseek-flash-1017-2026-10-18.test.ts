import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  CHANNEL_NOTES, GATEWAY_MODEL_ID, GATEWAY_US_PEAK, SESSION_AFFINITY_NOTE,
  seedVercelDeepSeekFlash1017, vercelFlash1017Options,
} from './vercel-deepseek-flash-1017-2026-10-18';

type Row = Record<string, unknown> & { id: number };
function fixture(opts: { providers?: Row[]; models?: Row[]; channels?: Row[]; variants?: Row[] } = {}) {
  const data = {
    providers: structuredClone(opts.providers ?? [{ id: 1, slug: 'vercel-ai-gateway', type: 'aggregator', notes: 'Token Pass notes' }]),
    models: structuredClone(opts.models ?? [{ id: 10, slug: 'deepseek-v4.1-flash' }]),
    api_channel_prices: structuredClone(opts.channels ?? []),
    api_channel_price_variants: structuredClone(opts.variants ?? []),
  };
  let id = 500;
  const writes: string[] = [];
  const frag = (v: unknown) => (v as { fragment: unknown }).fragment;
  const tx = Object.assign(((parts: TemplateStringsArray | unknown, ...values: unknown[]) => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const q = parts.join('?').replace(/\s+/g, ' ').trim();
    if (q.startsWith('SELECT * FROM models WHERE slug IN')) {
      const wanted = new Set(frag(values[0]) as string[]);
      return Promise.resolve(data.models.filter(r => wanted.has(String(r.slug))));
    }
    if (q.startsWith('SELECT * FROM providers WHERE slug IN')) {
      const wanted = new Set(frag(values[0]) as string[]);
      return Promise.resolve(data.providers.filter(r => wanted.has(String(r.slug))));
    }
    if (q.startsWith('SELECT * FROM api_channel_prices WHERE model_id')) {
      return Promise.resolve(data.api_channel_prices.filter(r => r.model_id === values[0] && r.provider_id === values[1]));
    }
    if (q.startsWith('SELECT * FROM api_channel_price_variants WHERE model_id')) {
      return Promise.resolve(data.api_channel_price_variants.filter(r => r.model_id === values[0] && r.provider_id === values[1]));
    }
    const table = String(frag(values[0]));
    const raw = frag(values[1]) as Record<string, unknown>;
    const payload = Object.fromEntries(Object.entries(raw).map(([key, value]) =>
      [key, key === 'constraints_json' && value != null && typeof value === 'object' && 'json' in (value as object)
        ? (value as { json: unknown }).json : value]));
    writes.push(q.split(' ')[0]!);
    if (q.startsWith('INSERT INTO')) {
      const row = { ...payload, id: id++ };
      (data as Record<string, Row[]>)[table].push(row);
      return Promise.resolve([{ id: row.id }]);
    }
    if (q.startsWith('UPDATE')) {
      Object.assign((data as Record<string, Row[]>)[table].find(r => r.id === values[2])!, payload);
      return Promise.resolve([]);
    }
    throw new Error(`Unexpected SQL: ${q}`);
  }) as unknown as Sql, { json: (value: unknown) => ({ json: value }) });
  return { tx, data, writes };
}

test('adds Vercel channel + session note; dry-run writes nothing; idempotent', async () => {
  const f = fixture();
  const dry = await seedVercelDeepSeekFlash1017(f.tx, false);
  assert.ok(dry.length >= 3);
  assert.deepEqual(f.writes, []);
  await seedVercelDeepSeekFlash1017(f.tx, true);
  assert.match(String(f.data.providers[0].notes), /Session affinity/);
  const channel = f.data.api_channel_prices[0];
  assert.deepEqual(
    [channel.input_price_per_1m, channel.output_price_per_1m, channel.cached_input_price_per_1m],
    [GATEWAY_US_PEAK.input, GATEWAY_US_PEAK.output, GATEWAY_US_PEAK.cache],
  );
  assert.match(String(channel.notes), /needs-verification/);
  assert.match(String(channel.notes), new RegExp(GATEWAY_MODEL_ID.replace(/\./g, '\\.')));
  assert.ok(f.data.api_channel_price_variants.some(v => v.variant_key === 'us-peak' && v.is_headline));
  assert.ok(f.data.api_channel_price_variants.some(v => v.variant_key === 'fast'));
  assert.deepEqual(await seedVercelDeepSeekFlash1017(f.tx, true), []);
});

test('session note is appended once; refuses missing model / wrong provider type', async () => {
  const f = fixture({ providers: [{ id: 1, slug: 'vercel-ai-gateway', type: 'aggregator', notes: SESSION_AFFINITY_NOTE }] });
  await seedVercelDeepSeekFlash1017(f.tx, true);
  assert.equal(String(f.data.providers[0].notes).split('Session affinity').length - 1, 1);
  await assert.rejects(seedVercelDeepSeekFlash1017(fixture({ models: [] }).tx), /Missing catalog model/);
  await assert.rejects(
    seedVercelDeepSeekFlash1017(fixture({ providers: [{ id: 1, slug: 'vercel', type: 'official' }] }).tx),
    /Expected Vercel aggregator/,
  );
  assert.match(CHANNEL_NOTES, /needs-verification/);
  assert.equal(vercelFlash1017Options([]).apply, false);
  assert.throws(() => vercelFlash1017Options(['--apply', '--dry-run']));
});
