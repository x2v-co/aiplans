import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMiniMaxPriceTables } from './minimax-dynamic';

test('pricing overview preserves Flash suffix, cache rate and CNY, without swallowing preview or unknown SKUs', () => {
  const prices = parseMiniMaxPriceTables([[
    ['模型', '输入价格 元/百万 tokens', '输出价格 元/百万 tokens', '缓存读取 元/百万 tokens'],
    ['MiniMax-M3.1-Flash', '1.00', '4.00', '0.10'],
    ['MiniMax-M3 ≤ 512k 输入 tokens 永久五折', '4.20 2.10', '16.80 8.40', '0.84 0.42'],
    ['MiniMax-M3.1-Flash-Preview', '9', '10', '1'],
    ['MiniMax-M3.1-Unverified', '9', '10', '1'],
  ]]);
  assert.deepEqual(prices.map(p => p.modelName), ['minimax-m3.1-flash', 'minimax-m3']);
  assert.deepEqual([prices[0].inputPricePer1M, prices[0].outputPricePer1M, prices[0].cachedInputPricePer1M, prices[0].currency], [1, 4, 0.1, 'CNY']);
  assert.equal(prices[1].inputPricePer1M, 2.1);
});
