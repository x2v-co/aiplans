import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSelector, type SelectableModel } from '../../src/lib/plan-selector';
import { CLASSIFICATIONS } from './plan-classifications';

const catalog: SelectableModel[] = [
  { id: 1, slug: 'claude-fable-5', providerSlugs: ['anthropic'], elo: null },
  { id: 2, slug: 'claude-fable-5.1', providerSlugs: ['anthropic'], elo: null },
  { id: 3, slug: 'claude-fable-5-batch', providerSlugs: ['anthropic'], elo: null },
];

function selectedSlugs(planSlug: string): string[] {
  const classification = CLASSIFICATIONS.find(
    (entry) => entry.providerSlug === 'anthropic' && entry.planSlug === planSlug,
  );
  assert.ok(classification, `missing Anthropic classification for ${planSlug}`);

  return resolveSelector(classification.selector, catalog, ['anthropic'])
    .models.map((model) => model.slug);
}

test('Claude Max plans include Fable releases but not API batch variants', () => {
  for (const planSlug of ['claude-max', 'claude-max-5x', 'claude-max-20x']) {
    assert.deepEqual(selectedSlugs(planSlug), ['claude-fable-5', 'claude-fable-5.1']);
  }
});

test('Claude Pro does not claim the Max-only Fable family', () => {
  assert.deepEqual(selectedSlugs('claude-pro'), []);
});

test('GLM Coding Plans use the closed two-model entitlement list', () => {
  const glmCatalog: SelectableModel[] = [
    { id: 10, slug: 'glm-5.3', providerSlugs: ['zhipu-china'], elo: null },
    { id: 11, slug: 'glm-5.3-flash', providerSlugs: ['zhipu-china'], elo: null },
    { id: 12, slug: 'glm-5.3-fast', providerSlugs: ['zhipu-china'], elo: null },
    { id: 13, slug: 'glm-4.6', providerSlugs: ['zhipu-china'], elo: null },
  ];
  const expected = ['glm-5.3', 'glm-5.3-flash'];

  for (const [provider, plan] of [
    ['zhipu-china', 'glm-coding-lite'],
    ['zhipu-global', 'z-ai-lite'],
  ] as const) {
    const classification = CLASSIFICATIONS.find(
      (entry) => entry.providerSlug === provider && entry.planSlug === plan,
    );
    assert.ok(classification, `missing classification for ${provider}/${plan}`);
    const slugs = resolveSelector(classification.selector, glmCatalog, [provider]).models.map(
      (model) => model.slug,
    );
    assert.deepEqual(slugs, expected, `${provider}/${plan} claims unentitled models`);
  }
});

test('GPT-6.1 Sol maps to Plus/Pro/Business/Team/Enterprise only, never batch', () => {
  const openaiCatalog: SelectableModel[] = [
    { id: 3363, slug: 'openai-gpt-6-1-sol', providerSlugs: ['openai'], elo: null },
    { id: 3364, slug: 'openai-gpt-6-1-sol-batch', providerSlugs: ['openai'], elo: null },
    { id: 3365, slug: 'openai-gpt-6-1-sol-pro', providerSlugs: ['openai'], elo: null },
  ];
  const slugsFor = (planSlug: string) => {
    const c = CLASSIFICATIONS.find((e) => e.providerSlug === 'openai' && e.planSlug === planSlug);
    assert.ok(c, planSlug);
    return resolveSelector(c.selector, openaiCatalog, ['openai']).models.map((m) => m.slug);
  };
  for (const plan of ['chatgpt-plus', 'chatgpt-pro', 'chatgpt-business', 'chatgpt-team', 'chatgpt-enterprise']) {
    assert.deepEqual(slugsFor(plan), ['openai-gpt-6-1-sol'], plan);
  }
  for (const plan of ['chatgpt-free', 'chatgpt-go']) {
    assert.deepEqual(slugsFor(plan), [], plan);
  }
});
