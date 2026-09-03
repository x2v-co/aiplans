import assert from 'node:assert/strict';
import test from 'node:test';
import { isPrimaryModelVariant, modelFreshnessTime, pickLatestModels } from './model-freshness';

test('uses the source release date before the discovery date', () => {
  assert.equal(
    modelFreshnessTime({
      slug: 'model-a',
      released_at: '2026-08-01T00:00:00Z',
      created_at: '2026-09-01T00:00:00Z',
    }),
    Date.parse('2026-08-01T00:00:00Z'),
  );
});

test('filters operational variants from latest-model discovery', () => {
  assert.equal(isPrimaryModelVariant('gemini-3.8-flash-(batch)'), false);
  assert.equal(isPrimaryModelVariant('kimi-k3-fast'), false);
  assert.equal(isPrimaryModelVariant('claude-fable-5.1'), true);
});

test('orders latest models and keeps the newest version in a series', () => {
  const result = pickLatestModels([
    { slug: 'claude-opus-4.8', released_at: '2026-08-20' },
    { slug: 'claude-opus-5', released_at: '2026-08-18' },
    { slug: 'gemini-3.8-flash', released_at: '2026-09-02' },
    { slug: 'gemini-3.8-flash-(batch)', released_at: '2026-09-03' },
  ]);

  assert.deepEqual(result.map((model) => model.slug), [
    'gemini-3.8-flash',
    'claude-opus-5',
  ]);
});
