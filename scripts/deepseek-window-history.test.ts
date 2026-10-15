import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as pricing from '../src/lib/deepseek-pricing';
import * as history from './utils/price-history';
import * as normalizer from './utils/model-normalizer';
import { buildOpenRouterVariants } from './scrapers/openrouter';
import { parseDeepSeekTable } from './scrapers/deepseek-dynamic';
import type { ScraperResult } from './utils/validator';

type Row = Record<string, unknown> & { id: number };
/** Execute the actual write/history boundary with memory-only dependencies. */
function pipeline() {
  const tables: Record<string, Row[]> = {
    models: [{ id: 10, slug: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }],
    api_channel_prices: [], api_channel_price_variants: [],
  };
  const changes: unknown[] = [];
  const db = { from(table: string) {
    assert.ok(tables[table]);
    const filters: Array<(row: Row) => boolean> = [];
    const query = {
      select() { return query; }, eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
      async single() { return { data: structuredClone(tables[table].find(row => filters.every(filter => filter(row))) ?? null), error: null }; },
    };
    return query;
  } };
  const source = readFileSync(new URL('./index-dynamic.ts', import.meta.url), 'utf8');
  const functionText = source.slice(source.indexOf('async function processAPIScraper('), source.indexOf('// Map scraper source names'));
  const compiled = ts.transpileModule(`${functionText}\nexports.run = processAPIScraper;`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exported: { run?: (result: ScraperResult, name: string, full: boolean, create: boolean) => Promise<{ errors: number }> } = {};
  const save = (table: string, row: Record<string, unknown>) => {
    const previous = tables[table].find(v => v.model_id === row.model_id && v.provider_id === row.provider_id && v.variant_key === row.variant_key);
    if (previous) Object.assign(previous, structuredClone(row));
    else tables[table].push({ ...structuredClone(row), id: tables[table].length + 1 });
    return previous ?? tables[table].at(-1)!;
  };
  runInNewContext(compiled, {
    exports: exported, ...pricing, ...history, ...normalizer, Date, db,
    inferProviderId: () => -1, getChannelProviderId: async () => 3, inferRegion: () => 'global',
    getOrCreateProduct: async () => tables.models[0],
    upsertChannelPrice: async (row: Record<string, unknown>) => save('api_channel_prices', row),
    batchUpsertChannelPriceVariants: async (rows: Record<string, unknown>[]) => { rows.forEach(row => save('api_channel_price_variants', row)); return rows.length; },
    logPriceChange: async (change: unknown) => { changes.push(change); },
    console: { log() {}, warn() {}, error(...args: unknown[]) { throw new Error(args.join(' ')); } },
  });
  return { tables, changes, run: async (result: ScraperResult) => {
    const response = await exported.run!(result, result.source, false, false);
    assert.equal(response.errors, 0);
  } };
}

test('daily StreamLake window oscillations persist observations without any price_history writes; actual changes log', async () => {
  const f = pipeline();
  // Synthetic endpoint rates, deliberately unrelated to official DeepSeek prices.
  const result = (input: number, date: string): ScraperResult => {
    const model = { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek', context_length: 1_000_000,
      pricing: { prompt: String(input / 1e6), completion: String(input * 2 / 1e6) } };
    const headline = { modelName: 'deepseek-v4-pro', modelSlug: 'deepseek-v4-pro', inputPricePer1M: input, outputPricePer1M: input * 2, isAvailable: true };
    return { success: true, source: 'OpenRouter', prices: [headline],
      variants: buildOpenRouterVariants(model, headline, [{ provider_name: 'StreamLake', pricing: model.pricing }], new Date(date)) };
  };
  // Existing dynamic price from before deploy, without any variant observations.
  f.tables.api_channel_prices.push({ id: 1, model_id: 10, provider_id: 3,
    input_price_per_1m: 3, output_price_per_1m: 6, last_verified: new Date('2026-10-11T12:00Z') });
  await f.run(result(3, '2026-10-12T12:00Z')); // off-peak first: no inferred peak
  assert.equal(f.tables.api_channel_prices[0].input_price_per_1m, 3);
  await f.run(result(6, '2026-10-13T02:00Z'));
  await f.run(result(3, '2026-10-13T12:00Z'));
  await f.run(result(3, '2026-10-14T02:00Z')); // source lags the peak transition
  assert.equal(f.changes.length, 0);
  assert.equal(f.tables.api_channel_prices[0].input_price_per_1m, 6);
  const auto = f.tables.api_channel_price_variants.find(v => v.variant_key === 'openrouter-auto')!;
  const observations = pricing.deepseekObservations(auto.raw_json as Record<string, unknown>);
  assert.equal(observations.peak?.input, 6);
  assert.equal(observations['off-peak']?.input, 3);
  assert.ok(f.tables.api_channel_price_variants.filter(v => v.variant_kind === 'upstream_provider').every(v =>
    Object.keys(pricing.deepseekObservations(v.raw_json as Record<string, unknown>)).length === 2));
  await f.run(result(8, '2026-10-15T02:00Z'));
  assert.equal(f.changes.length, 1);
});

test('official peak/list and both window observations survive weekend scrapes without false history', async () => {
  const f = pipeline();
  f.tables.api_channel_prices.push({ id: 1, model_id: 10, provider_id: 3, input_price_per_1m: 0.66, output_price_per_1m: 1.98 });
  const rows = [['MODEL', 'deepseek-v4-pro'], ['PEAK', '$0.044'], ['OFF-PEAK', '$0.022'],
    ['PEAK', '$1.32'], ['OFF-PEAK', '$0.66'], ['PEAK', '$3.96'], ['OFF-PEAK', '$1.98']];
  for (const day of ['2026-10-16T02:00Z', '2026-10-17T02:00Z']) await f.run(parseDeepSeekTable(rows, new Date(day)));
  assert.equal(f.changes.length, 0);
  assert.equal(f.tables.api_channel_prices[0].input_price_per_1m, 1.32);
  for (const variant of f.tables.api_channel_price_variants) {
    assert.equal(Object.keys(pricing.deepseekObservations(variant.raw_json as Record<string, unknown>))[0], variant.variant_key);
  }
});
