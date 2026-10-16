import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractListPriceRows, isTencentModelName, parseListPriceRows } from './hunyuan-dynamic';

const cell = (t: string) => `<td><div><span data-slate-string="true">${t}</span></div></td>`;
const html = `<table><tr>${cell('产品名')}${cell('免费额度')}</tr><tr>${cell('Hunyuan-a13b')}${cell('共100万 tokens')}</tr></table>
<table><tr>${cell('产品名')}${cell('刊例价（每&nbsp;百万 tokens）')}</tr>
<tr>${cell('Hunyuan-a13b')}<td><div>输入：0.5元</div><div>输出：2元 </div></td></tr>
<tr>${cell('Tencent HY Vision 1.5 Instruct')}<td><div>输入：3元</div><div>输出：9元</div></td></tr>
<tr>${cell('Hunyuan-embedding')}<td><div>输入：0.7元</div><div>输出：0.7元</div></td></tr>
<tr>${cell('腾讯元器')}<td><div>输入：100元</div><div>输出：100元</div></td></tr></table>`;

test('parses the SSR 刊例价 table and skips non-chat rows', () => {
  const prices = parseListPriceRows(extractListPriceRows(html));
  assert.deepEqual(prices.map(p => [p.modelName, p.inputPricePer1M, p.outputPricePer1M]), [
    ['hunyuan-a13b', 0.5, 2],
    ['hy-vision-1.5-instruct', 3, 9],
  ]);
});

test('returns no rows when the list-price table is absent', () => {
  assert.deepEqual(extractListPriceRows('<html><body>shell</body></html>'), []);
});

test('hy-* canonical names are attributed to Tencent (hy-vision-1.5 was skipped as unknown provider)', () => {
  assert.equal(isTencentModelName('hy-vision-1.5-instruct'), true);
  assert.equal(isTencentModelName('hunyuan-a13b'), true);
  assert.equal(isTencentModelName('Tencent HY 2.0 Think'), true);
  assert.equal(isTencentModelName('why-not-model'), false);
  assert.equal(isTencentModelName('gpt-6'), false);
});
