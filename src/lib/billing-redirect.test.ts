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

test('Gemini 2.5 Pro / Flash explain the 2026-12-01 auto-route, target rates and breaking changes', () => {
  for (const [slug, from, to, price] of [
    ['gemini-2.5-pro', 'gemini-2.5-pro', 'gemini-3.8-flash', /\$0\.75/],
    ['google-gemini-gemini-2-5-pro-batch', 'gemini-2.5-pro', 'gemini-3.8-flash', /Batch/],
    ['gemini-2.5-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite', /\$0\.30/],
    ['google-gemini-gemini-2-5-flash-batch', 'gemini-2.5-flash', 'gemini-3.5-flash-lite', /Batch/],
  ] as const) {
    for (const locale of ['en', 'zh']) {
      const note = billingRedirectNote(slug, locale)!;
      assert.ok(note.includes(from) && note.includes(to), `${slug} ${locale}`);
      assert.match(note, /2026-11-02/);
      assert.match(note, /2026-12-01/);
      assert.match(note, /thinking_level/);
      assert.match(note, price);
      assert.match(note, /ai\.google\.dev\/gemini-api\/docs\/changelog/);
    }
  }
  assert.match(billingRedirectNote('gemini-2.5-pro', 'en')!, /\$1\.50 \/ \$7\.50 \/ \$0\.15 from 2027-01-01/);
  for (const slug of ['gemini-2.5-flash-lite', 'gemini-2.5-flash-image', 'gemini-3.8-flash']) assert.equal(billingRedirectNote(slug, 'en'), null);
  const flash35 = billingRedirectNote('gemini-3.5-flash', 'en')!;
  assert.match(flash35, /gemini-3\.6-flash/);
  assert.match(flash35, /N\/A/);
  assert.match(flash35, /\$0\.75/);
  const flash37 = billingRedirectNote('gemini-3.7-flash', 'zh')!;
  assert.match(flash37, /gemini-3\.8-flash/);
  assert.match(flash37, /不关停/);
  const flash = billingRedirectNote('deepseek-v4-flash', 'en')!;
  assert.match(flash, /deepseek-v4-flash-vision-exp|V4 Flash Vision Exp/);
  assert.match(flash, /deepseek-flash/);
  assert.match(billingRedirectNote('deepseek-v4-flash-vision-exp', 'zh')!, /V4\.1 Flash/);
});
