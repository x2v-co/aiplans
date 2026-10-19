import assert from 'node:assert/strict';
import test from 'node:test';
import { isGluedModelSlug, splitGluedModelSlug } from './glued-model-slug';
import { LEGACY_MODEL_SLUGS, legacySlugRedirect } from './legacy-slug-redirects';

const IMPRESSED_REDIRECTS: Array<[string, string]> = [
  ['/en/compare/plans/kimi-k2', '/en/compare/plans/moonshotai-kimi-k2'],
  ['/en/compare/plans/kimi-k2-thinking', '/en/compare/plans/moonshotai-kimi-k2-thinking'],
  ['/en/compare/plans/kimi-k2.5', '/en/compare/plans/moonshotai-kimi-k2-5'],
  ['/zh/compare/plans/kimi-k2', '/zh/compare/plans/moonshotai-kimi-k2'],
  ['/en/models/gpt-6.1-sol', '/en/models/openai-gpt-6-1-sol'],
  ['/en/models/claude-opus-5.5', '/en/models/anthropic-claude-opus-5-5'],
  ['/zh/models/claude-opus-5.5', '/zh/models/anthropic-claude-opus-5-5'],
  ['/zh/models/gpt-6.1-sol', '/zh/models/openai-gpt-6-1-sol'],
  ['/zh/models/gpt-6-astra', '/zh/models/openai-gpt-6-astra'],
  ['/zh/models/gpt-6-luna', '/zh/models/openai-gpt-6-luna'],
  ['/en/models/gpt-6-luna', '/en/models/openai-gpt-6-luna'],
  ['/en/models/gpt-6-astra', '/en/models/openai-gpt-6-astra'],
  ['/zh/models/step-3.7-flash', '/zh/models/stepfun-step-3-7-flash'],
  ['/en/compare/plans/claude-sonnet-5', '/en/compare/plans/anthropic-claude-sonnet-5'],
  ['/en/compare/plans/claude-opus-4.6', '/en/compare/plans/anthropic-claude-opus-4-6'],
  ['/zh/models/glm-4.5', '/zh/models/z-ai-glm-4-5'],
  ['/en/models/qwen3.8-27b', '/en/models/qwen-qwen3-8-27b'],
  ['/en/compare/plans/claude-haiku-4-5', '/en/compare/plans/anthropic-claude-haiku-4-5'],
  ['/en/compare/plans/qwen-2.5-72b', '/en/compare/plans/qwen-qwen-2-5-72b-instruct'],
  ['/en/models/claude-sonnet-4.6-batch', '/en/models/anthropic-claude-sonnet-4-6-batch'],
  ['/en/models/minimax-01', '/en/models/minimax-minimax-01'],
  ['/en/models/kimi-k2.5', '/en/models/moonshotai-kimi-k2-5'],
  ['/zh/models/claude-opus-4.6', '/zh/models/anthropic-claude-opus-4-6'],
  ['/en/compare/plans/claude-opus-4.8', '/en/compare/plans/anthropic-claude-opus-4-8'],
  ['/en/compare/plans/claude-opus-5-batch', '/en/compare/plans/anthropic-claude-opus-5-batch'],
  ['/en/compare/plans/glm-4.6v', '/en/compare/plans/z-ai-glm-4-6v'],
  ['/en/compare/plans/glm-4.7-flash', '/en/compare/plans/z-ai-glm-4-7-flash'],
  ['/en/compare/plans/minimax-m2-her', '/en/compare/plans/minimax-minimax-m2-her'],
  ['/en/compare/plans/qwen3.5-35b-a3b', '/en/compare/plans/qwen-qwen3-5-35b-a3b'],
  ['/en/models/claude-sonnet-5', '/en/models/anthropic-claude-sonnet-5'],
  ['/zh/compare/plans/qwen3-14b', '/zh/compare/plans/qwen-qwen3-14b'],
  ['/zh/models/claude-opus-4.7', '/zh/models/anthropic-claude-opus-4-7'],
  ['/en/compare/plans/claude-fable-5.1-batch', '/en/compare/plans/anthropic-claude-fable-5-1-batch'],
  ['/en/compare/plans/seed-2.1-turbo', '/en/compare/plans/doubao-seed-2.1-turbo'],
  ['/en/compare/plans/glm-5', '/en/compare/plans/z-ai-glm-5'],
];

const LIST_FALLBACKS: Array<[string, string]> = [
  ['/en/models/kimi', '/en/models'],
  ['/zh/models/qwen2.5-7b', '/zh/models'],
  ['/zh/models/gemini-pro', '/zh/models'],
  ['/en/compare/plans/qwen3.5-max', '/en/compare/plans'],
  ['/en/compare/plans/claude-sonnet-4', '/en/compare/plans'],
];

test('impressed 404 slugs redirect to the live catalog slug', () => {
  for (const [from, to] of IMPRESSED_REDIRECTS) {
    assert.equal(legacySlugRedirect(from), to, from);
  }
});

test('slugs with no single successor redirect to the section list', () => {
  for (const [from, to] of LIST_FALLBACKS) {
    assert.equal(legacySlugRedirect(from), to, from);
  }
});

test('glued pricing-cell slugs redirect to the first model, not the concatenated page', () => {
  const glued = 'kimi-k2-thinkingkimi-k2-instruct-0905kimi-k2-instructkimi-k2-base';
  assert.deepEqual(splitGluedModelSlug(glued), [
    'kimi-k2-thinking', 'kimi-k2-instruct-0905', 'kimi-k2-instruct', 'kimi-k2-base',
  ]);
  assert.equal(
    legacySlugRedirect(`/en/compare/plans/${glued}`),
    '/en/compare/plans/moonshotai-kimi-k2-thinking',
  );
  assert.equal(
    legacySlugRedirect(`/en/models/${glued}kimi-k2.5kimi-k2.6kimi-k2.7-code`),
    '/en/models/moonshotai-kimi-k2-thinking',
  );
  assert.equal(legacySlugRedirect('/en/compare/plans/glm-5glm-5.1'), '/en/compare/plans/z-ai-glm-5');
});

test('live slugs, vendor-prefixed ids and unrelated paths are left alone', () => {
  assert.equal(legacySlugRedirect('/en/models/openai-gpt-6-1-sol'), null);
  assert.equal(legacySlugRedirect('/en/models/qwen-qwen3-8-27b'), null);
  assert.equal(legacySlugRedirect('/en/models/deepseek-deepseek-v4'), null);
  assert.equal(legacySlugRedirect('/en/guides/glm-chatglm-api-pricing'), null);
  assert.equal(legacySlugRedirect('/en'), null);
  assert.equal(isGluedModelSlug('qwen-qwen3-8-27b'), false);
  assert.equal(isGluedModelSlug('deepseek-deepseek-v4-flash'), false);
});

test('the redirect table does not chain and every target is a different slug', () => {
  for (const [from, target] of Object.entries(LEGACY_MODEL_SLUGS)) {
    assert.equal(Object.hasOwn(LEGACY_MODEL_SLUGS, target.models ?? ''), false, from);
    assert.equal(Object.hasOwn(LEGACY_MODEL_SLUGS, target.compare ?? ''), false, from);
    if (target.models) assert.notEqual(target.models, from);
    if (target.compare) assert.notEqual(target.compare, from);
  }
});
