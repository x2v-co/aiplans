import assert from 'node:assert/strict';
import test from 'node:test';
import { isGluedModelSlug, splitGluedModelSlug } from './glued-model-slug';
import { LEGACY_COMPARE_ONLY_SLUGS, LEGACY_MODEL_SLUGS, legacySlugRedirect } from './legacy-slug-redirects';

// Explicit same-entity comparison destinations; no version-family inference.
const SAME_IDENTITY_COMPARISONS: Readonly<Record<string, string>> = {
  'gpt-6.1-sol': 'openai-gpt-6-1-sol',
  'minimax-01': 'minimax-minimax-01',
  'minimax-m2-her': 'minimax-minimax-m2-her',
};

test('every explicit comparison target preserves its mapped product identity', () => {
  const comparisons: Record<string, string> = {};
  for (const [alias, target] of Object.entries(LEGACY_MODEL_SLUGS)) {
    if (!target.compare) continue;
    assert.equal(target.compare, target.models, `${alias}: comparison must use the same mapped model`);
    assert.equal(target.compare, SAME_IDENTITY_COMPARISONS[alias], `${alias}: same-identity comparison needs explicit evidence`);
    comparisons[alias] = target.compare;
  }
  assert.deepEqual(comparisons, SAME_IDENTITY_COMPARISONS, 'preserve all verified same-entity comparisons');
  for (const [alias, target] of Object.entries(LEGACY_COMPARE_ONLY_SLUGS)) {
    assert.equal(target.models, alias, `${alias}: comparison-only fallback retains the exact model ID`);
    assert.equal(target.compare, undefined);
  }
});

const IMPRESSED_REDIRECTS: Array<[string, string]> = [
  ['/en/compare/plans/kimi-k2', '/en/models/moonshotai-kimi-k2'],
  ['/en/compare/plans/kimi-k2-thinking', '/en/models/moonshotai-kimi-k2-thinking'],
  ['/en/compare/plans/kimi-k2.5', '/en/models/moonshotai-kimi-k2-5'],
  ['/zh/compare/plans/kimi-k2', '/zh/models/moonshotai-kimi-k2'],
  ['/en/models/gpt-6.1-sol', '/en/models/openai-gpt-6-1-sol'],
  ['/en/models/claude-opus-5.5', '/en/models/anthropic-claude-opus-5-5'],
  ['/zh/models/claude-opus-5.5', '/zh/models/anthropic-claude-opus-5-5'],
  ['/zh/models/gpt-6.1-sol', '/zh/models/openai-gpt-6-1-sol'],
  ['/zh/models/gpt-6-astra', '/zh/models/openai-gpt-6-astra'],
  ['/zh/models/gpt-6-luna', '/zh/models/openai-gpt-6-luna'],
  ['/en/models/gpt-6-luna', '/en/models/openai-gpt-6-luna'],
  ['/en/models/gpt-6-astra', '/en/models/openai-gpt-6-astra'],
  ['/zh/models/step-3.7-flash', '/zh/models/stepfun-step-3-7-flash'],
  ['/en/compare/plans/claude-sonnet-5', '/en/models/anthropic-claude-sonnet-5'],
  ['/en/compare/plans/claude-opus-4.6', '/en/models/anthropic-claude-opus-4-6'],
  ['/zh/models/glm-4.5', '/zh/models/z-ai-glm-4-5'],
  ['/en/models/qwen3.8-27b', '/en/models/qwen-qwen3-8-27b'],
  ['/en/compare/plans/claude-haiku-4-5', '/en/models/anthropic-claude-haiku-4-5'],
  ['/en/compare/plans/qwen-2.5-72b', '/en/models/qwen-qwen-2-5-72b-instruct'],
  ['/en/models/claude-sonnet-4.6-batch', '/en/models/anthropic-claude-sonnet-4-6-batch'],
  ['/en/models/minimax-01', '/en/models/minimax-minimax-01'],
  ['/en/models/kimi-k2.5', '/en/models/moonshotai-kimi-k2-5'],
  ['/zh/models/claude-opus-4.6', '/zh/models/anthropic-claude-opus-4-6'],
  ['/en/compare/plans/claude-opus-4.8', '/en/models/anthropic-claude-opus-4-8'],
  ['/en/compare/plans/claude-opus-5-batch', '/en/models/anthropic-claude-opus-5-batch'],
  ['/en/compare/plans/glm-4.6v', '/en/models/z-ai-glm-4-6v'],
  ['/en/compare/plans/glm-4.7-flash', '/en/models/z-ai-glm-4-7-flash'],
  ['/en/compare/plans/minimax-m2-her', '/en/compare/plans/minimax-minimax-m2-her'],
  ['/en/compare/plans/qwen3.5-35b-a3b', '/en/models/qwen-qwen3-5-35b-a3b'],
  ['/en/models/claude-sonnet-5', '/en/models/anthropic-claude-sonnet-5'],
  ['/zh/compare/plans/qwen3-14b', '/zh/models/qwen-qwen3-14b'],
  ['/zh/models/claude-opus-4.7', '/zh/models/anthropic-claude-opus-4-7'],
  ['/en/compare/plans/claude-fable-5.1-batch', '/en/models/anthropic-claude-fable-5-1-batch'],
  ['/en/compare/plans/seed-2.1-turbo', '/en/models/doubao-seed-2.1-turbo'],
  ['/en/compare/plans/glm-5', '/en/models/z-ai-glm-5'],
  // Backfilled 2026-10-29 from the Search Console page export. These are the
  // highest-impression rows that were still returning 404.
  ['/en/models/gpt-4', '/en/models/openai-gpt-4'],
  ['/zh/models/gpt-4', '/zh/models/openai-gpt-4'],
  ['/en/models/gpt-3.5-turbo', '/en/models/openai-gpt-3-5-turbo'],
  ['/en/models/gpt-4-turbo', '/en/models/openai-gpt-4-turbo'],
  ['/en/models/claude-opus-4.6-batch', '/en/models/anthropic-claude-opus-4-6-batch'],
  ['/en/models/claude-sonnet-4.6', '/en/models/anthropic-claude-sonnet-4-6'],
  ['/en/compare/plans/claude-sonnet-4.6', '/en/models/anthropic-claude-sonnet-4-6'],
  ['/en/models/glm-4.5-air', '/en/models/z-ai-glm-4-5-air'],
  ['/en/compare/plans/glm-4.5-air', '/en/models/z-ai-glm-4-5-air'],
  ['/zh/models/glm-5.2-(free)', '/zh/models/z-ai-glm-5-2-free'],
  ['/en/models/o3', '/en/models/openai-o3'],
  ['/en/models/qwen3.6-27b', '/en/models/qwen-qwen3-6-27b'],
  ['/en/models/grok-4.20', '/en/models/x-ai-grok-4-20'],
  ['/en/compare/plans/gpt-5.2-pro', '/en/models/openai-gpt-5-2-pro'],
  // Bundle 2: matched against the full /api/products catalog, not the prefix.
  ['/en/models/gemma-3-27b', '/en/models/google-gemini-gemma-3-27b-it'],
  ['/en/models/gemma-4-26b-a4b-(free)', '/en/models/google-gemini-gemma-4-26b-a4b-it-free'],
  ['/en/models/qwen3-vl-8b', '/en/models/qwen-qwen3-vl-8b-instruct'],
  ['/en/models/qwen3-coder-480b-a35b', '/en/models/qwen-qwen3-coder'],
  ['/en/models/seed-1.6', '/en/models/bytedance-seed-seed-1-6'],
  ['/en/models/kimi', '/en/providers/moonshot-global'],
  ['/zh/models/gemini-pro', '/zh/providers/google'],
  ['/en/compare/plans/grok', '/en/providers/xai'],
  ['/en/models/gpt-mini', '/en/providers/openai'],
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

test('multi-entity pricing-cell slugs have no inferred redirect destination', () => {
  const glued = 'kimi-k2-thinkingkimi-k2-instruct-0905kimi-k2-instructkimi-k2-base';
  assert.deepEqual(splitGluedModelSlug(glued), [
    'kimi-k2-thinking', 'kimi-k2-instruct-0905', 'kimi-k2-instruct', 'kimi-k2-base',
  ]);
  for (const locale of ['en', 'zh']) {
    for (const section of ['models', 'compare/plans']) {
      for (const slug of [glued, `${glued}kimi-k2.5kimi-k2.6kimi-k2.7-code`, 'glm-5glm-5.1', 'glm-99glm-100']) {
        assert.equal(legacySlugRedirect(`/${locale}/${section}/${slug}`), null, slug);
      }
    }
  }
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

test('supported provider prefixes do not hide concatenated identities or invalidate single models', () => {
  for (const [slug, parts] of [
    ['z-ai-glm-5glm-5.1', ['z-ai-glm-5', 'glm-5.1']],
    ['moonshotai-kimi-k2-thinkingkimi-k2-instruct-0905kimi-k2-base',
      ['moonshotai-kimi-k2-thinking', 'kimi-k2-instruct-0905', 'kimi-k2-base']],
    ['qwen-qwen3-8-27bqwen3-14b', ['qwen-qwen3-8-27b', 'qwen3-14b']],
    ['z-ai-glm-5z-ai-glm-5.1', ['z-ai-glm-5', 'z-ai-glm-5.1']],
  ] as const) {
    assert.deepEqual(splitGluedModelSlug(slug), parts, slug);
    assert.equal(isGluedModelSlug(slug), true, slug);
    assert.equal(legacySlugRedirect(`/en/models/${slug}`), null);
  }
  for (const slug of ['qwen-qwen3-8-27b', 'deepseek-deepseek-v4', 'z-ai-glm-4-6v',
    'moonshotai-kimi-k2-thinking', 'google-gemini-gemini-3-flash-preview-free',
    'anthropic-claude-3.7-sonnet-thinking', 'openai-gpt-4-1-nano']) {
    assert.equal(isGluedModelSlug(slug), false, slug);
  }
});

test('the redirect table does not chain and every target is a different slug', () => {
  for (const [from, target] of Object.entries(LEGACY_MODEL_SLUGS)) {
    assert.equal(Object.hasOwn(LEGACY_MODEL_SLUGS, target.models ?? ''), false, from);
    assert.equal(Object.hasOwn(LEGACY_MODEL_SLUGS, target.compare ?? ''), false, from);
    if (target.models) assert.notEqual(target.models, from);
    if (target.compare) assert.notEqual(target.compare, from);
  }
});

// Identity evidence wins over the old sitemap snapshot. A retired model detail
// can be noindex and still be the truthful destination for that exact model.
const SAME_MODEL_REPAIRS: Readonly<Record<string, string>> = {
  'kimi-k2': 'moonshotai-kimi-k2',
  'kimi-k2.5': 'moonshotai-kimi-k2-5',
  'glm-5': 'z-ai-glm-5',
  'glm-4.5': 'z-ai-glm-4-5',
  'glm-4.7-flash': 'z-ai-glm-4-7-flash',
  'glm-4.5-air': 'z-ai-glm-4-5-air',
  'glm-4.6': 'z-ai-glm-4-6',
  'glm-5v-turbo': 'z-ai-glm-5v-turbo',
  'gpt-5.1-codex-max': 'gpt-5.1-codex-max',
  'gpt-5.2-codex': 'gpt-5.2-codex',
  'kimi-k2-thinking': 'moonshotai-kimi-k2-thinking',
  'glm-4.6v': 'z-ai-glm-4-6v',
  'gpt-4.1-nano': 'gpt-4.1-nano',
};

test('comparison fallbacks keep the configured model destination without a second redirect', () => {
  const fallbacks = [
    ...Object.entries(LEGACY_MODEL_SLUGS).filter(([, t]) => !t.compare && t.models),
    ...Object.entries(LEGACY_COMPARE_ONLY_SLUGS).filter(([, t]) => !t.compare),
  ];
  assert.ok(fallbacks.length > 0);
  for (const [from, target] of fallbacks) {
    assert.equal(legacySlugRedirect(`/en/compare/plans/${from}`), `/en/models/${target.models}`, from);
    assert.equal(legacySlugRedirect(`/en/models/${target.models}`), null, `${target.models} must not redirect again`);
  }
});

test('compare-only backfills leave the existing /models page untouched', () => {
  for (const [from, target] of Object.entries(LEGACY_COMPARE_ONLY_SLUGS)) {
    assert.equal(Object.hasOwn(LEGACY_MODEL_SLUGS, from), false, from);
    const to = target.compare ? `compare/plans/${target.compare}` : `models/${target.models}`;
    assert.notEqual(`/en/${to}`, `/en/compare/plans/${from}`);
    assert.equal(legacySlugRedirect(`/en/compare/plans/${from}`), `/en/${to}`, from);
    assert.equal(legacySlugRedirect(`/zh/compare/plans/${from}`), `/zh/${to}`, from);
    assert.equal(legacySlugRedirect(`/en/models/${from}`), null, `${from} /models must stay live`);
  }
});

test('legacy compare destinations and the specific identity repairs stay one hop', () => {
  const cases: Array<[string, string]> = [
    ['/en/compare/plans/kimi-k2', '/en/models/moonshotai-kimi-k2'],
    ['/en/compare/plans/kimi-k2-thinking', '/en/models/moonshotai-kimi-k2-thinking'],
    ['/en/compare/plans/kimi-k2.5', '/en/models/moonshotai-kimi-k2-5'],
    ['/en/compare/plans/glm-5', '/en/models/z-ai-glm-5'],
    ['/zh/compare/plans/kimi-k2', '/zh/models/moonshotai-kimi-k2'],
    ['/en/compare/plans/claude-opus-4.6', '/en/models/anthropic-claude-opus-4-6'],
    ['/en/compare/plans/claude-sonnet-5', '/en/models/anthropic-claude-sonnet-5'],
    ['/en/compare/plans/claude-opus-4.8', '/en/models/anthropic-claude-opus-4-8'],
    ['/en/compare/plans/glm-4.7-flash', '/en/models/z-ai-glm-4-7-flash'],
    ['/en/compare/plans/glm-4.6v', '/en/models/z-ai-glm-4-6v'],
    ['/en/compare/plans/claude-opus-5-batch', '/en/models/anthropic-claude-opus-5-batch'],
    ['/en/compare/plans/claude-opus-4.7', '/en/models/anthropic-claude-opus-4-7'],
    ['/en/compare/plans/claude-haiku-4-5', '/en/models/anthropic-claude-haiku-4-5'],
    ['/zh/compare/plans/qwen3-14b', '/zh/models/qwen-qwen3-14b'],
    ['/zh/compare/plans/kimi-k2.5', '/zh/models/moonshotai-kimi-k2-5'],
    ['/en/compare/plans/qwen3.5-35b-a3b', '/en/models/qwen-qwen3-5-35b-a3b'],
    ['/en/compare/plans/qwen-2.5-72b', '/en/models/qwen-qwen-2-5-72b-instruct'],
  ];
  for (const [from, to] of cases) {
    assert.equal(legacySlugRedirect(from), to, from);
    assert.equal(legacySlugRedirect(to), null, `${to} must not redirect again`);
  }
});

test('the reviewed comparison repairs retain exact model identity in both locales', () => {
  for (const locale of ['en', 'zh']) {
    for (const [from, target] of Object.entries(SAME_MODEL_REPAIRS)) {
      const destination = `/${locale}/models/${target}`;
      assert.equal(legacySlugRedirect(`/${locale}/compare/plans/${from}`), destination);
      assert.equal(legacySlugRedirect(destination), null, 'no redirect chain');
      assert.equal(legacySlugRedirect(`/${locale}/models/${from}`),
        from === target ? null : destination, 'model identity stays intact');
    }
  }
});

test('/models redirects keep the exact successor (those pages are indexable)', () => {
  assert.equal(legacySlugRedirect('/en/models/kimi-k2'), '/en/models/moonshotai-kimi-k2');
  assert.equal(legacySlugRedirect('/zh/models/glm-5'), '/zh/models/z-ai-glm-5');
  assert.equal(legacySlugRedirect('/en/models/claude-opus-4.8'), '/en/models/anthropic-claude-opus-4-8');
});

test('both MiniMax Flash legacy slugs land on the canonical model through the proxy 301 table', () => {
  for (const locale of ['en', 'zh']) {
    for (const slug of ['minimax-m3.1', 'minimax-minimax-m3-1-flash']) {
      for (const section of ['models', 'compare/plans']) assert.equal(legacySlugRedirect(`/${locale}/${section}/${slug}`), `/${locale}/models/minimax-m3.1-flash`);
    }
    assert.equal(legacySlugRedirect(`/${locale}/models/minimax-m3.1-flash`), null);
  }
});

test('no legacy redirect lands on a noindex OpenRouter ~alias page', () => {
  for (const [from, target] of Object.entries({ ...LEGACY_MODEL_SLUGS, ...LEGACY_COMPARE_ONLY_SLUGS })) {
    for (const slug of [target.models, target.compare]) {
      assert.ok(!slug?.startsWith('~'), `${from} -> ${slug} is a router alias`);
    }
  }
});
