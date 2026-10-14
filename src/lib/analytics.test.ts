import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyTrackedLink, guideSlugFromPath } from './analytics';

test('classifies external HTTP links as outbound', () => {
  assert.deepEqual(
    classifyTrackedLink('https://openrouter.ai/models?ref=aiplans', 'https://aiplans.dev'),
    {
      kind: 'outbound',
      domain: 'openrouter.ai',
      url: 'https://openrouter.ai/models?ref=aiplans',
    },
  );
});

test('classifies localized comparison links', () => {
  assert.deepEqual(
    classifyTrackedLink('/zh/compare/plans/kimi-k2.5?period=yearly', 'https://aiplans.dev'),
    {
      kind: 'comparison',
      compareType: 'plans',
      targetPath: '/zh/compare/plans/kimi-k2.5?period=yearly',
    },
  );
  assert.deepEqual(
    classifyTrackedLink('/en/compare/models', 'https://aiplans.dev'),
    {
      kind: 'comparison',
      compareType: 'models',
      targetPath: '/en/compare/models',
    },
  );
});

test('ignores non-comparison internal and unsafe links', () => {
  assert.equal(classifyTrackedLink('/en/guides', 'https://aiplans.dev'), null);
  assert.equal(classifyTrackedLink('mailto:hello@aiplans.dev', 'https://aiplans.dev'), null);
  assert.equal(classifyTrackedLink('javascript:alert(1)', 'https://aiplans.dev'), null);
});

test('classifies guide → model and guide → plan clicks', () => {
  assert.deepEqual(
    classifyTrackedLink('/en/models/gpt-5', 'https://aiplans.dev', '/en/guides/openai-api-pricing'),
    { kind: 'guide_target', targetType: 'model', targetSlug: 'gpt-5', targetPath: '/en/models/gpt-5' },
  );
  assert.deepEqual(
    classifyTrackedLink('/zh/providers/openai', 'https://aiplans.dev', '/zh/guides/openai-api-pricing'),
    { kind: 'guide_target', targetType: 'plan', targetSlug: 'openai', targetPath: '/zh/providers/openai' },
  );
});

test('model links outside guide pages stay untracked', () => {
  assert.equal(classifyTrackedLink('/en/models/gpt-5', 'https://aiplans.dev', '/en/api-pricing'), null);
  assert.equal(classifyTrackedLink('/en/models/gpt-5', 'https://aiplans.dev', '/en/guides'), null);
  assert.equal(classifyTrackedLink('/en/models/gpt-5', 'https://aiplans.dev'), null);
});

test('guide pages still report comparison and outbound clicks', () => {
  assert.equal(
    classifyTrackedLink('/en/compare/models', 'https://aiplans.dev', '/en/guides/grok-pricing')?.kind,
    'comparison',
  );
  assert.equal(
    classifyTrackedLink('https://x.ai/api', 'https://aiplans.dev', '/en/guides/grok-pricing')?.kind,
    'outbound',
  );
});

test('guideSlugFromPath', () => {
  assert.equal(guideSlugFromPath('/zh/guides/kimi-api-pricing'), 'kimi-api-pricing');
  assert.equal(guideSlugFromPath('/zh/guides'), null);
  assert.equal(guideSlugFromPath('/en/models/x'), null);
});
