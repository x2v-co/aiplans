import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractKimiTablesFromHtml, parseKimiPricingTables, type KimiPricingTable } from './moonshot-dynamic';
import {
  KIMI_GLOBAL_PRICING_PAGE, KIMI_GLOBAL_SOURCE, parseKimiGlobalPricingTables, scrapeMoonshotGlobalDynamic,
} from './moonshot-global-dynamic';

// platform.kimi.ai/docs/pricing/chat DocTables as served on 2026-11-04.
const tables: KimiPricingTable[] = [{
  contextText: '3 k3-series-models K3 Series Models All K3 series models support a 1,048,576-token context window. DocTable',
  headers: ['Model', 'Input', 'Output', 'Cached Input', '5m writes', '1h writes'],
  rows: [
    ['kimi-k3.1-pro', '$2.00 / MTok', '$10.00 / MTok', '$0.20 / MTok', '$2.00 / MTok', '$4.00 / MTok'],
    ['kimi-k3.1-pro-highspeed', '$4.00 / MTok', '$20.00 / MTok', '$0.20 / MTok', '$4.00 / MTok', '$8.00 / MTok'],
    ['kimi-k3', '$3.00 / MTok', '$15.00 / MTok', '$0.30 / MTok', '$3.00 / MTok', '$6.00 / MTok'],
  ],
}, {
  contextText: '3 k2-series-models K2 Series Models All K2 series models support a 262,144-token context window. Dear Kimi Users, starting October 31, 2026 … DocTable',
  headers: ['Model', 'Input', 'Output', 'Cached Input'],
  rows: [
    ['kimi-k2.7-code', '$0.95 / MTok', '$4.00 / MTok', '$0.19 / MTok'],
    ['kimi-k2.7-code-highspeed', '$1.90 / MTok', '$8.00 / MTok', '$0.38 / MTok'],
    ['kimi-k2.6', '$0.95 / MTok', '$4.00 / MTok', '$0.16 / MTok'],
  ],
}];

test('international Kimi tables yield the six USD moonshot-global prices seeded 2026-11-02', () => {
  const { prices } = parseKimiGlobalPricingTables(tables);
  assert.deepEqual(prices.map(p => [p.modelSlug, p.inputPricePer1M, p.outputPricePer1M, p.cachedInputPricePer1M, p.contextWindow, p.currency]), [
    ['kimi-k3.1-pro', 2, 10, 0.2, 1048576, 'USD'],
    ['kimi-k3.1-pro-highspeed', 4, 20, 0.2, 1048576, 'USD'],
    ['kimi-k3', 3, 15, 0.3, 1048576, 'USD'],
    ['kimi-k2.7-code', 0.95, 4, 0.19, 262144, 'USD'],
    ['kimi-k2.7-code-highspeed', 1.9, 8, 0.38, 262144, 'USD'],
    ['kimi-k2.6', 0.95, 4, 0.16, 262144, 'USD'],
  ]);
  assert.match(prices[0].notes!, /5m TTL \$2\/1M tokens; 1h TTL \$4\/1M tokens/);
});

test('cache-write columns become the seeded standard + cache-write-5m/1h variant keys, never cache hits', () => {
  const { variants } = parseKimiGlobalPricingTables(tables);
  const pro = variants.filter(v => v.modelSlug === 'kimi-k3.1-pro');
  assert.deepEqual(pro.map(v => [v.variantKey, v.isHeadline, v.cacheCreatePricePer1M, v.cachedInputPricePer1M]), [
    ['standard', true, undefined, 0.2],
    ['cache-write-5m', false, 2, 0.2],
    ['cache-write-1h', false, 4, 0.2],
  ]);
  assert.deepEqual(pro[2].constraints, { cache_ttl_seconds: 3600 });
  // K2 rows publish no write columns, so no variant group is invented for them.
  assert.equal(variants.filter(v => v.modelSlug.startsWith('kimi-k2')).length, 0);
  assert.equal(variants.length, 9);
});

test('international page fails closed on CNY, changed headings, partial write columns or bad context', () => {
  for (const corrupt of [
    (t: KimiPricingTable[]) => { t[1].rows[0][1] = '¥6.50 / MTok'; },
    (t: KimiPricingTable[]) => { t[1].headers[3] = 'Cache'; },
    (t: KimiPricingTable[]) => { t[0].headers[5] = 'TTL'; },
    (t: KimiPricingTable[]) => { t[0].rows[0][4] = '—'; },
    (t: KimiPricingTable[]) => { t[1].contextText = 'K2 Series Models'; },
  ]) {
    const changed = structuredClone(tables);
    corrupt(changed);
    assert.throws(() => parseKimiGlobalPricingTables(changed));
  }
  // The China parser keeps rejecting the international (USD/English) tables.
  assert.throws(() => parseKimiPricingTables(tables), /Unrecognized Kimi pricing table headers/);
});

test('scraper reads the server-rendered international DocTables (fixture of the 2026-11-04 page)', async () => {
  const html = readFileSync(join(__dirname, 'fixtures', 'kimi-pricing-chat-global-2026-11-04.html'), 'utf8');
  assert.deepEqual(extractKimiTablesFromHtml(html).map(t => t.headers), tables.map(t => t.headers));
  const urls: string[] = [];
  const fetchImpl = (async (url: string | URL | Request) => { urls.push(String(url)); return new Response(html, { status: 200 }); }) as typeof fetch;
  const result = await scrapeMoonshotGlobalDynamic({ fetchImpl, attempts: 1 });
  assert.deepEqual(urls, [KIMI_GLOBAL_PRICING_PAGE]);
  assert.equal(result.source, KIMI_GLOBAL_SOURCE);
  assert.deepEqual(result.prices, parseKimiGlobalPricingTables(tables).prices);
  assert.equal(result.variants?.length, 9);
});
