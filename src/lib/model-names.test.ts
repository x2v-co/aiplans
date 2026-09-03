import assert from 'node:assert/strict';
import test from 'node:test';
import { formatModelName } from './model-names';

test('formats common model slugs as readable product names', () => {
  assert.equal(formatModelName('kimi-k2.5'), 'Kimi K2.5');
  assert.equal(formatModelName('claude-opus-4.8'), 'Claude Opus 4.8');
  assert.equal(formatModelName('glm-5.2-(free)'), 'GLM 5.2 (Free)');
  assert.equal(formatModelName('qwen3.5-397b-a17b'), 'Qwen3.5 397B A17B');
});

test('preserves already-readable numeric and mixed-case labels', () => {
  assert.equal(formatModelName('GPT-4.1'), 'GPT 4.1');
  assert.equal(formatModelName('DeepSeek_V3'), 'DeepSeek V3');
});
