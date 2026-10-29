import assert from 'node:assert/strict';
import test from 'node:test';
import { isGluedModelSlug, splitGluedModelSlug } from './glued-model-slug';
import { LEGACY_COMPARE_ONLY_SLUGS, LEGACY_MODEL_SLUGS, legacySlugRedirect } from './legacy-slug-redirects';

const IMPRESSED_REDIRECTS: Array<[string, string]> = [
  ['/en/compare/plans/kimi-k2', '/en/compare/plans/kimi-k3'],
  ['/en/compare/plans/kimi-k2-thinking', '/en/compare/plans/kimi-k3'],
  ['/en/compare/plans/kimi-k2.5', '/en/compare/plans/kimi-k3'],
  ['/zh/compare/plans/kimi-k2', '/zh/compare/plans/kimi-k3'],
  ['/en/models/gpt-6.1-sol', '/en/models/openai-gpt-6-1-sol'],
  ['/en/models/claude-opus-5.5', '/en/models/anthropic-claude-opus-5-5'],
  ['/zh/models/claude-opus-5.5', '/zh/models/anthropic-claude-opus-5-5'],
  ['/zh/models/gpt-6.1-sol', '/zh/models/openai-gpt-6-1-sol'],
  ['/zh/models/gpt-6-astra', '/zh/models/openai-gpt-6-astra'],
  ['/zh/models/gpt-6-luna', '/zh/models/openai-gpt-6-luna'],
  ['/en/models/gpt-6-luna', '/en/models/openai-gpt-6-luna'],
  ['/en/models/gpt-6-astra', '/en/models/openai-gpt-6-astra'],
  ['/zh/models/step-3.7-flash', '/zh/models/stepfun-step-3-7-flash'],
  ['/en/compare/plans/claude-sonnet-5', '/en/compare/plans/claude-sonnet-4.5'],
  ['/en/compare/plans/claude-opus-4.6', '/en/compare/plans/claude-opus-4.5'],
  ['/zh/models/glm-4.5', '/zh/models/z-ai-glm-4-5'],
  ['/en/models/qwen3.8-27b', '/en/models/qwen-qwen3-8-27b'],
  ['/en/compare/plans/claude-haiku-4-5', '/en/compare/plans/claude-haiku-5.5'],
  ['/en/compare/plans/qwen-2.5-72b', '/en/models/qwen-qwen-2-5-72b-instruct'],
  ['/en/models/claude-sonnet-4.6-batch', '/en/models/anthropic-claude-sonnet-4-6-batch'],
  ['/en/models/minimax-01', '/en/models/minimax-minimax-01'],
  ['/en/models/kimi-k2.5', '/en/models/moonshotai-kimi-k2-5'],
  ['/zh/models/claude-opus-4.6', '/zh/models/anthropic-claude-opus-4-6'],
  ['/en/compare/plans/claude-opus-4.8', '/en/compare/plans/claude-opus-4.5'],
  ['/en/compare/plans/claude-opus-5-batch', '/en/compare/plans/claude-opus-4.5'],
  ['/en/compare/plans/glm-4.6v', '/en/compare/plans/glm-5.3'],
  ['/en/compare/plans/glm-4.7-flash', '/en/compare/plans/glm-5.3-flash'],
  ['/en/compare/plans/minimax-m2-her', '/en/compare/plans/minimax-minimax-m2-her'],
  ['/en/compare/plans/qwen3.5-35b-a3b', '/en/models/qwen-qwen3-5-35b-a3b'],
  ['/en/models/claude-sonnet-5', '/en/models/anthropic-claude-sonnet-5'],
  ['/zh/compare/plans/qwen3-14b', '/zh/models/qwen-qwen3-14b'],
  ['/zh/models/claude-opus-4.7', '/zh/models/anthropic-claude-opus-4-7'],
  ['/en/compare/plans/claude-fable-5.1-batch', '/en/models/anthropic-claude-fable-5-1-batch'],
  ['/en/compare/plans/seed-2.1-turbo', '/en/compare/plans/doubao-seed-2.1-turbo'],
  ['/en/compare/plans/glm-5', '/en/compare/plans/glm-5.3'],
  // Backfilled 2026-10-29 from the Search Console page export. These are the
  // highest-impression rows that were still returning 404.
  ['/en/models/gpt-4', '/en/models/openai-gpt-4'],
  ['/zh/models/gpt-4', '/zh/models/openai-gpt-4'],
  ['/en/models/gpt-3.5-turbo', '/en/models/openai-gpt-3-5-turbo'],
  ['/en/models/gpt-4-turbo', '/en/models/openai-gpt-4-turbo'],
  ['/en/models/claude-opus-4.6-batch', '/en/models/anthropic-claude-opus-4-6-batch'],
  ['/en/models/claude-sonnet-4.6', '/en/models/anthropic-claude-sonnet-4-6'],
  ['/en/compare/plans/claude-sonnet-4.6', '/en/compare/plans/claude-sonnet-4.5'],
  ['/en/models/glm-4.5-air', '/en/models/z-ai-glm-4-5-air'],
  ['/en/compare/plans/glm-4.5-air', '/en/compare/plans/glm-5.3'],
  ['/zh/models/glm-5.2-(free)', '/zh/models/z-ai-glm-5-2-free'],
  ['/en/models/o3', '/en/models/openai-o3'],
  ['/en/models/qwen3.6-27b', '/en/models/qwen-qwen3-6-27b'],
  ['/en/models/grok-4.20', '/en/models/x-ai-grok-4-20'],
  ['/en/compare/plans/gpt-5.2-pro', '/en/compare/plans/gpt-5.4-pro'],
  // Bundle 2: matched against the full /api/products catalog, not the prefix.
  ['/en/models/gemma-3-27b', '/en/models/google-gemini-gemma-3-27b-it'],
  ['/en/models/gemma-4-26b-a4b-(free)', '/en/models/google-gemini-gemma-4-26b-a4b-it-free'],
  ['/en/models/qwen3-vl-8b', '/en/models/qwen-qwen3-vl-8b-instruct'],
  ['/en/models/qwen3-coder-480b-a35b', '/en/models/qwen-qwen3-coder'],
  ['/en/models/seed-1.6', '/en/models/bytedance-seed-seed-1-6'],
  ['/en/models/kimi', '/en/models/~moonshotai-kimi-latest'],
  ['/zh/models/gemini-pro', '/zh/models/~google-gemini-pro-latest'],
];

const LIST_FALLBACKS: Array<[string, string]> = [
  // No single successor survives in the catalog.
  ['/en/models/qwen3.5-max', '/en/models'],
  ['/en/compare/plans/qwen3.5-max', '/en/compare/plans'],
];

// A dead compare URL whose model page exists: the model page carries the same
// plan table, so it beats dumping the visitor on the section list.
const COMPARE_TO_MODEL: Array<[string, string]> = [
  ['/en/compare/plans/claude-sonnet-4', '/en/models/anthropic-claude-sonnet-4'],
  ['/zh/compare/plans/claude-fable-5.1-batch', '/zh/models/anthropic-claude-fable-5-1-batch'],
  ['/en/compare/plans/qwen-2.5-72b', '/en/models/qwen-qwen-2-5-72b-instruct'],
  ['/en/compare/plans/seed-1.6', '/en/models/bytedance-seed-seed-1-6'],
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

test('a dead compare URL falls through to the model page, not the list', () => {
  for (const [from, to] of COMPARE_TO_MODEL) {
    assert.equal(legacySlugRedirect(from), to, from);
    assert.equal(legacySlugRedirect(to), null, `${to} must not redirect again`);
  }
});

test('glued pricing-cell slugs redirect to the first model, not the concatenated page', () => {
  const glued = 'kimi-k2-thinkingkimi-k2-instruct-0905kimi-k2-instructkimi-k2-base';
  assert.deepEqual(splitGluedModelSlug(glued), [
    'kimi-k2-thinking', 'kimi-k2-instruct-0905', 'kimi-k2-instruct', 'kimi-k2-base',
  ]);
  assert.equal(
    legacySlugRedirect(`/en/compare/plans/${glued}`),
    '/en/compare/plans/kimi-k3',
  );
  assert.equal(
    legacySlugRedirect(`/en/models/${glued}kimi-k2.5kimi-k2.6kimi-k2.7-code`),
    '/en/models/moonshotai-kimi-k2-thinking',
  );
  assert.equal(legacySlugRedirect('/en/compare/plans/glm-5glm-5.1'), '/en/compare/plans/glm-5.3');
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

// /compare/plans pages in the live sitemap on 2026-10-29 (index, follow). The
// old exact successors (moonshotai-kimi-k2, z-ai-glm-5, anthropic-claude-*)
// are noindex because selectIndexablePlanComparisons keeps only the newest
// member of a series; a 301 onto them dropped the old URL from Google.
const INDEXABLE_COMPARE_TARGETS = new Set([
  'claude-haiku-5.5', 'claude-opus-4.5', 'claude-sonnet-4.5', 'doubao-seed-2.1-turbo',
  'glm-5.3', 'glm-5.3-flash', 'kimi-k3', 'minimax-minimax-01', 'minimax-minimax-m2-her',
  'openai-gpt-6-1-sol', 'gpt-5.3-codex', 'gpt-5.4-nano', 'gpt-5.4-pro', 'gpt-5.5', 'gpt-5.6-luna',
]);

test('every compare redirect lands on an indexable sitemap page or the list', () => {
  for (const [from, target] of Object.entries(LEGACY_MODEL_SLUGS)) {
    if (!target.compare) continue;
    assert.ok(INDEXABLE_COMPARE_TARGETS.has(target.compare), `${from} -> ${target.compare} is not indexable`);
  }
  for (const [from, target] of Object.entries(LEGACY_COMPARE_ONLY_SLUGS)) {
    assert.ok(INDEXABLE_COMPARE_TARGETS.has(target), `${from} -> ${target} is not indexable`);
  }
});

test('compare-only backfills leave the live /models page untouched', () => {
  for (const [from, target] of Object.entries(LEGACY_COMPARE_ONLY_SLUGS)) {
    assert.equal(Object.hasOwn(LEGACY_MODEL_SLUGS, from), false, from);
    assert.notEqual(target, from);
    assert.equal(legacySlugRedirect(`/en/compare/plans/${from}`), `/en/compare/plans/${target}`, from);
    assert.equal(legacySlugRedirect(`/zh/compare/plans/${from}`), `/zh/compare/plans/${target}`, from);
    assert.equal(legacySlugRedirect(`/en/models/${from}`), null, `${from} /models must stay live`);
  }
});

test('the 18 impressed compare URLs that hit noindex now 301 to indexable pages in one hop', () => {
  const cases: Array<[string, string]> = [
    ['/en/compare/plans/kimi-k2', '/en/compare/plans/kimi-k3'],
    ['/en/compare/plans/kimi-k2-thinking', '/en/compare/plans/kimi-k3'],
    ['/en/compare/plans/kimi-k2.5', '/en/compare/plans/kimi-k3'],
    ['/en/compare/plans/glm-5glm-5.1', '/en/compare/plans/glm-5.3'],
    ['/en/compare/plans/glm-5', '/en/compare/plans/glm-5.3'],
    ['/zh/compare/plans/kimi-k2', '/zh/compare/plans/kimi-k3'],
    ['/en/compare/plans/claude-opus-4.6', '/en/compare/plans/claude-opus-4.5'],
    ['/en/compare/plans/claude-sonnet-5', '/en/compare/plans/claude-sonnet-4.5'],
    ['/en/compare/plans/claude-opus-4.8', '/en/compare/plans/claude-opus-4.5'],
    ['/en/compare/plans/glm-4.7-flash', '/en/compare/plans/glm-5.3-flash'],
    ['/en/compare/plans/glm-4.6v', '/en/compare/plans/glm-5.3'],
    ['/en/compare/plans/claude-opus-5-batch', '/en/compare/plans/claude-opus-4.5'],
    ['/en/compare/plans/claude-opus-4.7', '/en/compare/plans/claude-opus-4.5'],
    ['/en/compare/plans/claude-haiku-4-5', '/en/compare/plans/claude-haiku-5.5'],
    ['/zh/compare/plans/qwen3-14b', '/zh/models/qwen-qwen3-14b'],
    ['/zh/compare/plans/kimi-k2.5', '/zh/compare/plans/kimi-k3'],
    ['/en/compare/plans/qwen3.5-35b-a3b', '/en/models/qwen-qwen3-5-35b-a3b'],
    ['/en/compare/plans/qwen-2.5-72b', '/en/models/qwen-qwen-2-5-72b-instruct'],
  ];
  for (const [from, to] of cases) {
    assert.equal(legacySlugRedirect(from), to, from);
    assert.equal(legacySlugRedirect(to), null, `${to} must not redirect again`);
  }
});

test('/models redirects keep the exact successor (those pages are indexable)', () => {
  assert.equal(legacySlugRedirect('/en/models/kimi-k2'), '/en/models/moonshotai-kimi-k2');
  assert.equal(legacySlugRedirect('/zh/models/glm-5'), '/zh/models/z-ai-glm-5');
  assert.equal(legacySlugRedirect('/en/models/claude-opus-4.8'), '/en/models/anthropic-claude-opus-4-8');
});
