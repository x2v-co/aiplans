import assert from 'node:assert/strict';
import test from 'node:test';
import { selectIndexablePlanComparisons } from './search-indexing';

test('keeps only meaningful current subscription comparisons', () => {
  const selected = selectIndexablePlanComparisons([
    { slug: 'claude-opus-4.5', plan_count: 7, released_at: '2025-11-01' },
    { slug: 'claude-opus-4.8', plan_count: 7, released_at: '2026-08-01' },
    { slug: 'claude-opus-4.8-(batch)', plan_count: 7, released_at: '2026-08-01' },
    { slug: 'orphan-model', plan_count: 1, released_at: '2026-08-01' },
    { slug: 'kimi-k2.5', plan_count: 6, released_at: '2026-01-01' },
  ]);

  assert.deepEqual(selected.map((item) => item.slug).sort(), [
    'claude-opus-4.8',
    'kimi-k2.5',
  ]);
});
