import test from 'node:test';
import assert from 'node:assert/strict';
import { isExplicitlyUnverifiedPrice, isOpenRouterPublishedFree, isVerifiedFreeOutput, isVerifiedFreePrice } from './audit-price-policy';

test('only deliberately withheld prices become verification warnings', () => {
  const row = {input_price_per_1m:null,output_price_per_1m:null,last_verified:null,notes:'[needs-verification] base unknown'};
  assert.equal(isExplicitlyUnverifiedPrice(row), true);
  assert.equal(isExplicitlyUnverifiedPrice({...row, notes:null}), false);
  assert.equal(isExplicitlyUnverifiedPrice({...row, input_price_per_1m:0}), false);
  assert.equal(isExplicitlyUnverifiedPrice({...row, last_verified:'2026-10-15'}), false);
});

test('SubQ free output exception cannot hide zero input or another channel error', () => {
  assert.equal(isVerifiedFreeOutput('subq-snap','subq',0.05), true);
  assert.equal(isVerifiedFreeOutput('subq-snap','subq',0), false);
  assert.equal(isVerifiedFreeOutput('subq-snap','openrouter',0.05), false);
  assert.equal(isVerifiedFreeOutput('other','subq',0.05), false);
  assert.equal(isVerifiedFreeOutput('scaledown-summarize','openrouter',0.04), true);
  assert.equal(isVerifiedFreeOutput('scaledown-extract','openrouter',0), false);
  assert.equal(isVerifiedFreeOutput('scaledown-extract','scaledown',0.04), false);
});

test('OpenRouter explicit 0/0 is published free; null or one-sided zero is not', () => {
  assert.equal(isOpenRouterPublishedFree('openrouter', 0, 0), true);
  assert.equal(isOpenRouterPublishedFree('openrouter', null, null), false);
  assert.equal(isOpenRouterPublishedFree('openrouter', 0, null), false);
  assert.equal(isOpenRouterPublishedFree('openrouter', null, 0), false);
  assert.equal(isOpenRouterPublishedFree('openrouter', 0, 1.2), false);
  assert.equal(isOpenRouterPublishedFree('openrouter', 0.5, 0), false);
  assert.equal(isOpenRouterPublishedFree('together-ai', 0, 0), false);
  assert.equal(isOpenRouterPublishedFree(undefined, 0, 0), false);
});

test('百炼 input-only and limited-time preview exemptions cover only the official model/channel', () => {
  for (const input of [0.3, 0.306]) assert.equal(isVerifiedFreeOutput('qwen-decision-model', 'qwen', input), true);
  for (const input of [0, -1, null, 1]) assert.equal(isVerifiedFreeOutput('qwen-decision-model', 'qwen', input), false);
  assert.equal(isVerifiedFreePrice('qwen-decision-model-preview', 'qwen'), true);
  assert.equal(isVerifiedFreePrice('qwen-decision-model', 'qwen'), false);
  assert.equal(isVerifiedFreeOutput('qwen-decision-model-preview', 'qwen', 0.3), false);
  for (const provider of ['openrouter', 'vercel', 'alibaba', undefined]) {
    assert.equal(isVerifiedFreeOutput('qwen-decision-model', provider, 0.3), false);
    assert.equal(isVerifiedFreePrice('qwen-decision-model-preview', provider), false);
  }
  for (const model of ['qwen-plus', 'decision-model', 'decision-model-preview', 'decision-model-preview-2026-09-24', undefined]) {
    assert.equal(isVerifiedFreeOutput(model, 'qwen', 0.3), false);
    assert.equal(isVerifiedFreePrice(model, 'qwen'), false);
  }
});
