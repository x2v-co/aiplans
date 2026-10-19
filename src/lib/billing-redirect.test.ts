import assert from 'node:assert/strict';
import test from 'node:test';
import { billingRedirectNote } from './billing-redirect';

test('grok-code-fast-1 explains both official billing targets and leaves the old price', () => {
  for (const locale of ['en', 'zh']) {
    const note = billingRedirectNote('grok-code-fast-1', locale)!;
    assert.match(note, /grok-build-0\.1/);
    assert.match(note, /grok-4\.3/);
    assert.match(note, /\$1\.25/);
    assert.match(note, /\$2\.50/);
    assert.match(locale === 'zh' ? note : note, /200k/);
  }
  assert.match(billingRedirectNote('grok-code-fast-1', 'zh')!, /待核验/);
  assert.equal(billingRedirectNote('gpt-5', 'en'), null);
});
