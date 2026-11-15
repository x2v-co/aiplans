import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CHATGPT_VOICE_PLANS, CHATGPT_VOICE_RETIREMENT_DATE, chatGptVoiceRetirement } from './chatgpt-voice-retirement';

test('ChatGPT voice retirement matches the 2026-11-10 release note and covers current plans only', () => {
  assert.equal(CHATGPT_VOICE_RETIREMENT_DATE, '2026-12-11');
  assert.ok(CHATGPT_VOICE_PLANS.includes('chatgpt-plus'));
  assert.equal(chatGptVoiceRetirement('chatgpt-team', 'en'), null);
  assert.equal(chatGptVoiceRetirement('chatgpt-pro', 'en'), null);
  assert.equal(chatGptVoiceRetirement('copilot-pro', 'en'), null);
  const en = chatGptVoiceRetirement('chatgpt-plus', 'en')!;
  assert.match(en.text, /retires Advanced and Standard voice on 2026-12-11/);
  assert.match(en.text, /Live video and screen sharing stay on Advanced voice/);
  assert.match(chatGptVoiceRetirement('chatgpt-free', 'zh')!.text, /2026-12-11 下线 Advanced 和 Standard voice/);
});

test('note renders on provider and compare plan cards', () => {
  for (const file of ['src/app/[locale]/providers/[slug]/catalog-page.tsx', 'src/app/[locale]/compare/plans/[model]/compare-plans-view.tsx']) {
    assert.match(readFileSync(file, 'utf8'), /<ChatGptVoiceNote slug=\{plan(\.plan\?)?\.slug\} locale=\{locale\} \/>/);
  }
});
