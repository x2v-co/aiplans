import assert from 'node:assert/strict';
import test from 'node:test';
import { baseGroupName, isCanonicalSlug, variantOf } from './grouped-products';

test('variantOf parses nested mini/nano/batch suffixes', () => {
  assert.deepEqual(variantOf('gpt-5-mini'), { tags: ['mini'], parent: 'gpt-5' });
  assert.deepEqual(variantOf('gpt-4o-batch'), { tags: ['batch'], parent: 'gpt-4o' });
  assert.deepEqual(variantOf('gpt-5-mini-batch'), { tags: ['mini', 'batch'], parent: 'gpt-5' });
  assert.deepEqual(variantOf('seed-2.0-mini'), { tags: ['mini'], parent: 'seed-2.0' });
  assert.equal(variantOf('gpt-5'), null);
  assert.equal(variantOf('aion-3.0-mini')?.parent, 'aion-3.0');
});

test('baseGroupName keeps major versions but collapses dated snapshots', () => {
  // Different generations stay separate.
  assert.equal(baseGroupName('gpt-4'), 'gpt-4');
  assert.equal(baseGroupName('gpt-5'), 'gpt-5');
  assert.equal(baseGroupName('grok-2'), 'grok-2');
  assert.equal(baseGroupName('grok-4'), 'grok-4');
  assert.equal(baseGroupName('glm-5'), 'glm-5');
  // Dotted point versions keep their generation digit.
  assert.equal(baseGroupName('claude-opus-4.8'), 'claude-opus-4.8');
  // Dated snapshots collapse onto the base.
  assert.equal(baseGroupName('qwen3.5-plus-2026-04-20'), 'qwen3.5-plus');
  // A 4-digit non-year model name is not treated as a year.
  assert.equal(baseGroupName('grok-2-vision-1212'), 'grok-2-vision-1212');
});

test('isCanonicalSlug distinguishes owners from snapshots', () => {
  assert.equal(isCanonicalSlug('qwen3.5-plus'), true);
  assert.equal(isCanonicalSlug('gpt-5'), true);
  assert.equal(isCanonicalSlug('qwen3.5-plus-2026-02-15'), false);
  assert.equal(isCanonicalSlug('some-model-2025'), false);
});
