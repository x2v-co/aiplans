import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseNextFlight } from '../utils/artificial-analysis';
import { extractKimiTablesFromMdx, parseKimiPricingHtml, parseKimiPricingTables, type KimiPricingTable } from './moonshot-dynamic';

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

// Server-rendered page, trimmed, 2026-10-29: the <table> elements are empty
// until hydration; the compiled MDX in the flight payload carries the rows,
// followed by a props-stripped copy (DocTable=()=>null) that must be ignored.
const html = readFileSync(join(__dirname, 'fixtures', 'kimi-pricing-chat-2026-10-29.html'), 'utf8');

test('static HTML yields the same six SKUs as the rendered tables, no browser needed', () => {
  assert.deepEqual(parseKimiPricingHtml(html), parseKimiPricingTables(tables));
});

test('static HTML keeps each family context and the cache-hit column', () => {
  const [k3, k2] = extractKimiTablesFromMdx(parseNextFlight(html));
  assert.match(k3.contextText, /1,048,576 tokens 上下文窗口/);
  assert.doesNotMatch(k3.contextText, /262,144/);
  assert.match(k2.contextText, /262,144 tokens 上下文窗口/);
  assert.deepEqual(k3.headers.slice(0, 4), ['模型', '输入', '输出', '缓存命中']);
  assert.deepEqual(k2.rows[2], ['kimi-k2.6', '¥6.50 / MTok', '¥27.00 / MTok', '¥1.10 / MTok']);
});

test('static HTML fails loud on a props-stripped page, conflicting copies or interpolated cells', () => {
  assert.throws(() => extractKimiTablesFromMdx('const DocTable=()=>null;_jsx(DocTable,{className:`x`})'), /No complete Kimi DocTable set/);
  const table = (price: string) => `const DocTable=1;_jsx(Heading,{level:\`3\`,children:\`K3 系列模型均支持 1,048,576 tokens 上下文窗口。\`}),_jsx(DocTable,{columns:[{title:\`模型\`},{title:\`输入\`},{title:\`输出\`},{title:\`缓存命中\`}],rows:[[\`kimi-k3\`,\`${price}\`,\`¥100.00 / MTok\`,\`¥2.00 / MTok\`]]})`;
  assert.equal(extractKimiTablesFromMdx(table('¥20.00 / MTok')).length, 1);
  assert.throws(() => extractKimiTablesFromMdx(table('¥20.00 / MTok') + table('¥21.00 / MTok')), /conflicting DocTable copies/);
  assert.throws(() => extractKimiTablesFromMdx(table('¥${p} / MTok')), /Unsupported template interpolation/);
  assert.throws(() => parseKimiPricingHtml('<html><body><table></table></body></html>'), /No Next.js flight payload/);
});
