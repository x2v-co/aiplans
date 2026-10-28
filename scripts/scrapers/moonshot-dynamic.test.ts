import assert from 'node:assert/strict';
import test from 'node:test';
import { parseKimiPricingTables, type KimiPricingTable } from './moonshot-dynamic';

// Rendered official table, 2026-10-28. Cache-write columns must not be
// mistaken for cache hits, and the K2 context must not leak from K3.
const tables: KimiPricingTable[] = [{
  contextText: 'K3 系列模型均支持 1,048,576 tokens 上下文窗口。',
  headers: ['名称', '输入', '输出', '缓存命中', '缓存写入（5min）', '缓存写入（1h）'],
  rows: [
    ['kimi-k3.1-pro', '¥13.00 / MTok', '¥68.00 / MTok', '¥1.30 / MTok', '¥13.00 / MTok', '¥26.00 / MTok'],
    ['kimi-k3.1-pro-highspeed', '¥26.00 / MTok', '¥136.00 / MTok', '¥1.30 / MTok', '¥26.00 / MTok', '¥52.00 / MTok'],
    ['kimi-k3', '¥20.00 / MTok', '¥100.00 / MTok', '¥2.00 / MTok', '¥20.00 / MTok', '¥40.00 / MTok'],
  ],
}, {
  contextText: 'K2 系列模型均支持 262,144 tokens 上下文窗口。',
  headers: ['名称', '输入', '输出', '缓存命中'],
  rows: [
    ['kimi-k2.7-code', '¥6.50 / MTok', '¥27.00 / MTok', '¥1.30 / MTok'],
    ['kimi-k2.7-code-highspeed', '¥13.00 / MTok', '¥54.00 / MTok', '¥2.60 / MTok'],
    ['kimi-k2.6', '¥6.50 / MTok', '¥27.00 / MTok', '¥1.10 / MTok'],
  ],
}];

test('current Kimi tables retain all six SKUs, cache hits and family contexts', () => {
  const prices = parseKimiPricingTables(tables);
  assert.equal(prices.length, 6);
  assert.deepEqual(prices[0], {modelName: 'kimi-k3.1-pro', inputPricePer1M: 13,
    outputPricePer1M: 68, cachedInputPricePer1M: 1.3, contextWindow: 1048576,
    isAvailable: true, currency: 'CNY'});
  assert.equal(prices[1].inputPricePer1M, 26);
  assert.equal(prices[1].outputPricePer1M, 136);
  assert.equal(prices[1].cachedInputPricePer1M, 1.3);
  assert.equal(prices[5].contextWindow, 262144);
});

test('column order is determined by leaf headings, not price position', () => {
  const changed = structuredClone(tables);
  [changed[0].headers[1], changed[0].headers[2]] = [changed[0].headers[2], changed[0].headers[1]];
  for (const row of changed[0].rows) [row[1], row[2]] = [row[2], row[1]];
  assert.deepEqual(parseKimiPricingTables(changed), parseKimiPricingTables(tables));
});

test('empty, partial, changed-unit and changed-currency catalogs fail closed', () => {
  assert.throws(() => parseKimiPricingTables([]), /No Moonshot/);
  for (const corrupt of [
    (t: KimiPricingTable[]) => { t[1].rows = []; },
    (t: KimiPricingTable[]) => { t[1].contextText = ''; },
    (t: KimiPricingTable[]) => { t[1].headers[3] = '缓存写入'; },
    (t: KimiPricingTable[]) => { t[1].rows[0][1] = '$6.50 / MTok'; },
    (t: KimiPricingTable[]) => { t[1].rows[0][1] = '¥6.50 / KTok'; },
    (t: KimiPricingTable[]) => { t[1].rows[0][3] = '—'; },
    (t: KimiPricingTable[]) => { t[1].rows[0][0] = 'Promo'; },
    (t: KimiPricingTable[]) => { t[1].rows.push(t[1].rows[0]); },
  ]) {
    const changed = structuredClone(tables); corrupt(changed);
    assert.throws(() => parseKimiPricingTables(changed));
  }
});
