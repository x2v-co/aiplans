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
  for (const plan of ['chatgpt-plus', 'chatgpt-pro', 'chatgpt-pro-100', 'chatgpt-pro-200', 'chatgpt-pro-500', 'chatgpt-business', 'chatgpt-team', 'chatgpt-enterprise']) {
    assert.deepEqual(slugsFor(plan), ['openai-gpt-6-1-sol'], plan);
  }
  for (const plan of ['chatgpt-free', 'chatgpt-go']) {
    assert.deepEqual(slugsFor(plan), [], plan);
  }
});

test('only the Google AI Pro selector changes for Argon AI Studio access; gemini-advanced (live Google AI Pro) also includes Argon; Free stays excluded', () => {
  const googleModels: SelectableModel[] = [
    { id: 1, slug: 'gemini-4-argon', providerSlugs: ['google'], elo: null },
    { id: 2, slug: 'gemini-3.8-flash', providerSlugs: ['google'], elo: null },
    { id: 3, slug: 'gemini-4-argon-batch', providerSlugs: ['google'], elo: null },
    { id: 4, slug: 'gemini-pro', providerSlugs: ['google'], elo: null },
    { id: 5, slug: 'gemini-4-argon-preview', providerSlugs: ['google'], elo: null },
  ];
  const pro = CLASSIFICATIONS.find(p => p.providerSlug === 'google' && p.planSlug === 'google-ai-pro');
  assert.ok(pro);
  assert.deepEqual(pro.selector, { families: ['gemini'], exclude: ['gemini-pro', 'gemini-flash', '*-preview*'] });
  assert.deepEqual(resolveSelector(pro.selector, googleModels, ['google']).models.map(m => m.slug), ['gemini-3.8-flash', 'gemini-4-argon']);
  const advanced = CLASSIFICATIONS.find(p => p.providerSlug === 'google' && p.planSlug === 'gemini-advanced');
  assert.ok(advanced);
  assert.deepEqual(resolveSelector(advanced.selector, googleModels, ['google']).models.map(m => m.slug), ['gemini-3.8-flash', 'gemini-4-argon']);
  const free = CLASSIFICATIONS.find(p => p.providerSlug === 'google' && p.planSlug === 'gemini-free');
  assert.ok(free);
  assert.deepEqual(resolveSelector(free.selector, googleModels, ['google']).models.map(m => m.slug), ['gemini-3.8-flash']);
});

test('US Ultra rungs remain consumer chat plans in the existing Google line', () => {
  const rungs = ['google-ai-ultra-5x', 'google-ai-ultra-20x'].map(slug => CLASSIFICATIONS.find(row => row.providerSlug === 'google' && row.planSlug === slug));
  assert.deepEqual(rungs.map(row => [row?.kind, row?.line, row?.rank]), [['chat','google-one',3],['chat','google-one',4]]);
});

test('Google app and Code Assist plans exclude API-only Gemini Robotics-ER', () => {
  const googleCatalog: SelectableModel[] = [
    { id: 1, slug: 'gemini-er-2.0', providerSlugs: ['google'], elo: null },
    { id: 2, slug: 'gemini-3.8-flash', providerSlugs: ['google'], elo: null },
  ];

  for (const planSlug of [
    'gemini-free', 'google-ai-plus', 'gemini-advanced',
    'google-ai-ultra-5x', 'google-ai-ultra-20x',
    'gemini-code-assist-individual', 'gemini-code-assist-standard', 'gemini-code-assist-enterprise',
  ]) {
    const classification = CLASSIFICATIONS.find(
      (entry) => entry.providerSlug === 'google' && entry.planSlug === planSlug,
    );
    assert.ok(classification, `missing Google classification for ${planSlug}`);
    const slugs = resolveSelector(classification.selector, googleCatalog, ['google'])
      .models.map((model) => model.slug);
    assert.deepEqual(slugs, ['gemini-3.8-flash'], planSlug);
  }
});

test('current Kimi tiers restrict Highspeed to Pro, Max and Ultra; April tiers grant no current access', () => {
  const kimiCatalog: SelectableModel[] = [
    { id: 1, slug: 'moonshotai-kimi-k3-1-pro', providerSlugs: ['moonshot-china'], elo: null },
    { id: 2, slug: 'kimi-k3.1-pro-highspeed', providerSlugs: ['moonshot-china'], elo: null },
    { id: 3, slug: 'kimi-k3', providerSlugs: ['moonshot-china'], elo: null },
  ];
  for (const tier of ['free', 'go', 'plus', 'pro', 'max', 'ultra']) {
    const c = CLASSIFICATIONS.find(c => c.planSlug === `kimi-${tier}`)!;
    const selected = resolveSelector(c.selector, kimiCatalog, ['moonshot-china']).models.map(m => m.slug);
    assert.deepEqual(selected, ['pro', 'max', 'ultra'].includes(tier)
      ? ['kimi-k3.1-pro-highspeed', 'moonshotai-kimi-k3-1-pro'] : ['moonshotai-kimi-k3-1-pro'], tier);
  }
  for (const slug of ['kimi-free-legacy-2026-04', 'kimi-basic', 'kimi-pro-legacy-2026-04', 'kimi-team', 'kimi-enterprise']) {
    const c = CLASSIFICATIONS.find(c => c.planSlug === slug)!;
    assert.equal(c.line, 'kimi-legacy');
    assert.deepEqual(resolveSelector(c.selector, kimiCatalog, ['moonshot-china']).models, []);
  }
});

test('Le Chat excludes retired/speech models; Code Assist excludes image models (2026-10-15 mappings review)', async () => {
  
  const all = CLASSIFICATIONS;
  const m = (slug: string, provider: string) => ({ id: slug.length, slug, providerSlugs: [provider], elo: null });
  const mistral = ['mistral-mistral-large-2512', 'mistral-devstral-2512', 'mistral-mistral-saba', 'mistral-voxtral-small-24b-2507', 'codestral-2508'].map(s => m(s, 'mistral'));
  const google = ['gemini-3.1-pro', 'gemini-3-pro-image', 'gemini-3.1-flash-image'].map(s => m(s, 'google'));
  const pick = (plan: string, catalog: ReturnType<typeof m>[], provider: string) =>
    resolveSelector(all.find((p: { planSlug: string }) => p.planSlug === plan)!.selector, catalog, [provider]).models.map(x => x.slug).sort();
  for (const plan of ['le-chat-pro', 'le-chat-team', 'le-chat-enterprise'])
    assert.deepEqual(pick(plan, mistral, 'mistral'), ['codestral-2508', 'mistral-mistral-large-2512']);
  for (const plan of ['gemini-code-assist-individual', 'gemini-code-assist-standard', 'gemini-code-assist-enterprise'])
    assert.deepEqual(pick(plan, google, 'google'), ['gemini-3.1-pro']);
  assert.ok(pick('google-ai-plus', google, 'google').includes('gemini-3-pro-image'));
});
