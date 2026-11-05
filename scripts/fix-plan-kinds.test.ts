import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson } from './config/canonical-json';

test('canonicalJson ignores jsonb key order', () => {
  assert.equal(
    canonicalJson({ families: ['gemini'], exclude: ['a'], current_only: true }),
    canonicalJson({ current_only: true, exclude: ['a'], families: ['gemini'] }),
  );
  assert.notEqual(canonicalJson({ families: ['a', 'b'] }), canonicalJson({ families: ['b', 'a'] }));
});

test('superseded plans use the explicit empty selector; anything else empty still fails', async () => {
  const { isIntentionallyEmptySelector } = await import('./config/empty-selector');
  const { CLASSIFICATIONS } = await import('./config/plan-classifications');
  const superseded = ['claude-max-5x', 'claude-max-20x', 'kimi-free-legacy-2026-04', 'kimi-basic',
    'kimi-pro-legacy-2026-04', 'kimi-team', 'kimi-enterprise'];
  for (const slug of superseded) {
    const entry = CLASSIFICATIONS.find(c => c.planSlug === slug);
    assert.ok(entry, slug);
    assert.equal(isIntentionallyEmptySelector(entry.selector), true, slug);
  }
  assert.equal(isIntentionallyEmptySelector({ only_extra: true, extra: ['gpt-5'] }), false);
  assert.equal(isIntentionallyEmptySelector({ only_extra: true }), false);
  assert.equal(isIntentionallyEmptySelector({ families: [] }), false);
  assert.equal(isIntentionallyEmptySelector({ only_extra: true, extra: [], families: ['claude'] }), false);
  assert.equal(isIntentionallyEmptySelector(null), false);
  for (const entry of CLASSIFICATIONS.filter(c => isIntentionallyEmptySelector(c.selector))) {
    assert.ok(/superseded/i.test(entry.reason), `${entry.planSlug} empty selector must be a superseded plan`);
  }
});
