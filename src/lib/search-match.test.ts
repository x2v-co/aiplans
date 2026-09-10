import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesSearch, rankSearch, scoreSearch } from './search-match';

const gpt4o = { name: 'GPT-4o', slug: 'gpt-4o', provider: 'OpenAI' };
const glm4 = { name: 'GLM-4.6', slug: 'glm-4.6', provider: 'Zhipu' };
const fields = (m: { name: string; slug: string; provider: string }) => [m.name, m.slug, m.provider];

test('brand aliases: "chatgpt" matches OpenAI GPT models', () => {
  assert.equal(matchesSearch('chatgpt', fields(gpt4o)), true);
});

test('punctuation and spacing are ignored', () => {
  assert.equal(matchesSearch('gpt 4o', fields(gpt4o)), true);
  assert.equal(matchesSearch('gpt4o', fields(gpt4o)), true);
  assert.equal(matchesSearch('GLM4.6', fields(gpt4o)), false);
  assert.equal(matchesSearch('glm46', fields(glm4)), true);
});

test('Chinese brand aliases resolve to English names', () => {
  assert.equal(matchesSearch('智谱', fields(glm4)), true);
  assert.equal(matchesSearch('深度求索', ['DeepSeek V3', 'deepseek-chat', 'DeepSeek']), true);
  assert.equal(matchesSearch('豆包', ['Doubao-Seed-1.6', 'doubao-seed', 'Volcengine']), true);
});

test('all query tokens must match (AND across fields)', () => {
  assert.equal(matchesSearch('openai claude', fields(gpt4o)), false);
  assert.equal(matchesSearch('gpt 4o', fields(gpt4o)), true);
});

test('direct hits outrank alias hits', () => {
  const chatgptPlan = { name: 'ChatGPT Plus', provider: 'OpenAI' };
  const gptModel = { name: 'GPT-4o', provider: 'OpenAI' };
  const ranked = rankSearch('chatgpt', [gptModel, chatgptPlan], (i) => [i.name, i.provider]);
  assert.equal(ranked[0].item.name, 'ChatGPT Plus');
});

test('empty query and empty fields do not match', () => {
  assert.equal(scoreSearch('  ', fields(gpt4o)), -1);
  assert.equal(scoreSearch('gpt', []), -1);
});
