import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  OPENAI_DEPRECATIONS_SOURCE, OPENAI_PLATFORM_DEPRECATIONS, openAiPlatformDeprecationsCopy,
} from './openai-platform-deprecations';

test('OpenAI platform deprecations match the official 2026-11-14 deprecations page', () => {
  const by = Object.fromEntries(OPENAI_PLATFORM_DEPRECATIONS.map(item => [item.key, item]));
  assert.deepEqual(Object.keys(by), ['prompts', 'evals', 'agent-builder', 'fine-tuning']);
  for (const key of ['prompts', 'evals', 'agent-builder']) {
    assert.equal(by[key].date, '2026-11-30');
    assert.equal(by[key].noticeDate, '2026-06-03');
  }
  assert.equal(by.evals.status, 'read-only');
  assert.equal(by['fine-tuning'].date, '2027-01-06');
  assert.equal(by['fine-tuning'].noticeDate, '2026-05-07');
  assert.equal(by['fine-tuning'].status, 'restricted');
  assert.match(by['agent-builder'].replacement.en, /ChatKit remains available/);
  assert.ok(OPENAI_PLATFORM_DEPRECATIONS.every(item => item.source.startsWith(OPENAI_DEPRECATIONS_SOURCE)));
});

test('copy is localized and the block renders only on the OpenAI provider page', () => {
  const en = openAiPlatformDeprecationsCopy('en');
  const zh = openAiPlatformDeprecationsCopy('zh');
  assert.equal(en.items.length, 4);
  assert.match(en.items[0].text, /^2026-11-30: \/v1\/prompts/);
  assert.match(zh.items[1].text, /只读/);
  assert.match(zh.items[3].text, /2027-01-06/);
  const page = readFileSync('src/app/[locale]/providers/[slug]/catalog-page.tsx', 'utf8');
  assert.match(page, /providerSlug === 'openai' && <OpenAiPlatformDeprecations locale=\{locale\} \/>/);
});
