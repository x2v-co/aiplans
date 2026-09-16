import assert from 'node:assert/strict';
import test from 'node:test';
import { formatIndexScore, formatTaskCost, formatTaskTime } from './coding-agents-format';

test('index score fraction renders as one-decimal percent', () => {
  assert.equal(formatIndexScore(0.6222, 'en'), '62.2%');
  assert.equal(formatIndexScore(0.03874, 'en'), '3.9%');
});

test('task time uses seconds/minutes/hours like the source page', () => {
  assert.equal(formatTaskTime(null), '—');
  assert.equal(formatTaskTime(45, 'en'), '45s');
  assert.equal(formatTaskTime(2090, 'en'), '34.8m');
  assert.equal(formatTaskTime(4000, 'en'), '1.1h');
});

test('task cost always shows two USD decimals', () => {
  assert.equal(formatTaskCost(0.238, 'en'), '$0.24');
  assert.equal(formatTaskCost(12.388, 'en'), '$12.39');
  assert.equal(formatTaskCost(null), '—');
});
