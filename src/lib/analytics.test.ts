import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyTrackedLink } from './analytics';

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
