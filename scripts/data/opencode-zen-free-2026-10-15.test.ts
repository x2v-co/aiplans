import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { providers, models, apiChannelPrices } from '../../src/db/schema';
import { isVerifiedFreePrice } from '../utils/audit-price-policy';
import { DSV41_SLUGS, ZEN_PROVIDER_SLUG, seedOpenCodeZenFree, zenSeedOptions } from './opencode-zen-free-2026-10-15';

type Row = Record<string, unknown> & { id: number };
const columns = Object.fromEntries([providers, models, apiChannelPrices].map(table => {
  const config = getTableConfig(table);
  return [config.name, new Set(config.columns.map(column => column.name))];
}));

function fixture(initial: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = { providers: [], models: [], api_channel_prices: [], ...structuredClone(initial) };
  let nextId = 1000;
  let writes = 0;
  const fragment = (value: unknown) => (value as { fragment: unknown }).fragment;
  const tx = (parts: TemplateStringsArray | unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    for (const table of ['providers', 'models']) {
      if (query === `SELECT * FROM ${table} WHERE slug IN ?`) {
        return Promise.resolve(structuredClone(data[table].filter(row => (fragment(values[0]) as unknown[]).includes(row.slug))));
      }
    }
    if (query === 'SELECT * FROM api_channel_prices WHERE model_id = ? AND provider_id = ?') {
      return Promise.resolve(structuredClone(data.api_channel_prices.filter(row => row.model_id === values[0] && row.provider_id === values[1])));
    }
    const table = String(fragment(values[0]));
    const payload = fragment(values[1]) as Record<string, unknown>;
    for (const key of Object.keys(payload)) assert.ok(columns[table].has(key), `${table}.${key} missing from schema`);
    writes++;
    if (query === 'INSERT INTO ? ? RETURNING id') { const row = { ...payload, id: nextId++ }; data[table].push(row); return Promise.resolve([{ id: row.id }]); }
    if (query === 'UPDATE ? SET ? WHERE id = ?') { Object.assign(data[table].find(row => row.id === values[2])!, payload); return Promise.resolve([]); }
    throw new Error(`Unexpected SQL: ${query}`);
  };
  return { sql: tx as unknown as Sql, data, writes: () => writes };
}

test('flags', () => {
  assert.deepEqual(zenSeedOptions([]), { apply: false });
  assert.deepEqual(zenSeedOptions(['--apply']), { apply: true });
  assert.throws(() => zenSeedOptions(['--apply', '--dry-run']));
  assert.throws(() => zenSeedOptions(['--force']));
});

test('dry-run writes nothing; apply reuses catalog model, is free with regular list price, idempotent', async () => {
  const existing = { id: 7, slug: DSV41_SLUGS[0], name: 'DeepSeek V4.1 Flash', context_window: 1_000_000, provider_ids: [3] };
  const f = fixture({ models: [existing] });
  const dry = await seedOpenCodeZenFree(f.sql);
  assert.equal(f.writes(), 0);
  assert.deepEqual(dry.map(step => step.table), ['providers', 'api_channel_prices']);
  await seedOpenCodeZenFree(f.sql, true);
  assert.equal(f.data.models.length, 1);
  assert.equal(f.data.models[0].context_window, 1_000_000);
  const [channel] = f.data.api_channel_prices;
  assert.equal(channel.model_id, 7);
  assert.deepEqual([channel.input_price_per_1m, channel.output_price_per_1m, channel.cached_input_price_per_1m], [0, 0, 0]);
  assert.deepEqual([channel.regular_input_price_per_1m, channel.regular_output_price_per_1m, channel.regular_cached_input_price_per_1m], [0.3, 1.2, 0.006]);
  assert.equal(channel.promo_ends_at, null);
  assert.match(String(channel.notes), /End date: not published.*Context limit.*not published/s);
  assert.doesNotMatch(JSON.stringify(f.data), /needs-verification|待复核/);
  assert.equal(f.data.providers[0].slug, ZEN_PROVIDER_SLUG);
  assert.deepEqual(await seedOpenCodeZenFree(f.sql, true), []);
});

test('audit exemption is scoped to this model on OpenCode Zen only', () => {
  assert.equal(isVerifiedFreePrice('deepseek-v4.1-flash', 'opencode-zen'), true);
  assert.equal(isVerifiedFreePrice('deepseek-v4.1-flash', 'opencode-go'), false);
  assert.equal(isVerifiedFreePrice('deepseek-v4-pro', 'opencode-zen'), false);
});
