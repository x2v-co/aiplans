import assert from 'node:assert/strict';
import test from 'node:test';
import { qwenPositionalPair } from './qwen-dynamic';

test('Qwen positional windows keep the ≤128K band as the displayed price', () => {
  assert.deepEqual(
    qwenPositionalPair('qwen3.5-plus', [0.8, 4.8, 4.8, 2, 12, 12, 4, 24, 24, 0.8, 2, 8]),
    { input: 0.8, output: 4.8 },
  );
  assert.equal(qwenPositionalPair('qwen3.5-plus', [2, 12, 4, 24]), null);
  assert.deepEqual(
    qwenPositionalPair('qwen3.5-flash', [0.2, 2, 0.8, 8, 1.2, 12, 0.15, 1.5]),
    { input: 0.2, output: 2 },
  );
  assert.equal(qwenPositionalPair('qwen3.5-flash', [1.2, 7.2]), null);
  assert.equal(qwenPositionalPair('qwen3.5-flash', [1.2, 12]), null);
  assert.deepEqual(
    qwenPositionalPair('qwen-flash', [0.15, 1.5, 0.6, 6, 1.2, 12, 0.8, 2.7]),
    { input: 0.15, output: 1.5 },
  );
  assert.equal(qwenPositionalPair('qwen-flash', [0.2, 2]), null);
  assert.equal(qwenPositionalPair('qwen-flash', [0.25, 1.5]), null);
});
