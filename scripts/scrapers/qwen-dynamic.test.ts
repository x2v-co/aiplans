import assert from 'node:assert/strict';
import test from 'node:test';
import { qwenMentionedNames, qwenPositionalPair } from './qwen-dynamic';

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

test('Qwen headers still on the price page are not treated as absent', () => {
  const lines = [
    'qwen-max', '仅非思考模式', '无阶梯计价', '2.4元', '9.6元',
    'qwen-plus', '0<Token≤128K', '0.8元', '2元', '8元',
    'qwen-long', '0.5元', '2元',
    'qwen-vl-ocr', '0.3元', '0.5元',
    'qwen3-max', '12元', '36元',
  ];
  const mentioned = qwenMentionedNames(lines);
  for (const name of ['qwen-max', 'qwen-plus', 'qwen-long', 'qwen-vl-ocr']) assert.ok(mentioned.includes(name), name);
  assert.ok(mentioned.includes('qwen3-max'));
  assert.equal(mentioned.filter(name => name === 'qwen-max').length, 1);
  assert.deepEqual(qwenPositionalPair('qwen-max', [2.4, 9.6]), { input: 2.4, output: 9.6 });
  assert.deepEqual(qwenPositionalPair('qwen-long', [0.5, 2]), { input: 0.5, output: 2 });
  assert.deepEqual(qwenPositionalPair('qwen-vl-ocr', [0.3, 0.5]), { input: 0.3, output: 0.5 });
  assert.deepEqual(qwenPositionalPair('qwen-plus', [0.8, 2, 8, 2.4, 20]), { input: 0.8, output: 2 });
});
