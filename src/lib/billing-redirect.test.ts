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

test('MiMo v2.5 slugs explain auto-routing, billing model and removal time', () => {
  for (const [slug, from, to, price] of [
    ['xiaomi-mimo-v2-5-pro', 'mimo-v2.5-pro', 'mimo-v2.6-pro', /¥3 \/ ¥6/],
    ['xiaomi-mimo-v2-5', 'mimo-v2.5', 'mimo-v2.6-flash', /¥1 \/ ¥2/],
  ] as const) {
    for (const locale of ['en', 'zh']) {
      const note = billingRedirectNote(slug, locale)!;
      assert.ok(note.includes(from) && note.includes(to));
      assert.match(note, /2026-10-21 10:00/);
      assert.match(note, /2026-10-14/);
      assert.match(note, price);
      assert.match(note, /mimo\.mi\.com\/docs\/en-US\/updates\/deprecate/);
    }
  }
  assert.equal(billingRedirectNote('xiaomi-mimo-v2-6-pro', 'en'), null);
});

test('Kimi K2 models carry the undated Moonshot deprecation notice; K3 does not', () => {
  for (const slug of ['kimi-k2.6', 'kimi-k2.7-code-highspeed', 'moonshotai-kimi-k2-thinking']) {
    for (const locale of ['en', 'zh']) {
      const note = billingRedirectNote(slug, locale)!;
      assert.match(note, /2026-10-31/);
      assert.match(note, locale === 'zh' ? /12 月底/ : /end of December 2026/);
      assert.match(note, /platform\.moonshot\.cn\/docs\/pricing\/chat/);
      assert.doesNotMatch(note, /2026-12-\d\d/);
    }
  }
  assert.equal(billingRedirectNote('kimi-k3', 'en'), null);
  assert.equal(billingRedirectNote('moonshotai-kimi-k3-1-pro', 'zh'), null);
});
