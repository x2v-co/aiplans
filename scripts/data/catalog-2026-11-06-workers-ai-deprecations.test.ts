import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DECISION_1103_SPECS } from '../../src/lib/decision-models-2026-11-03';
import {
  CF_ANNOUNCED_ON, CF_DEPRECATION_SOURCE, CF_DEPRECATIONS, CF_LLM_REPLACEMENT, CF_SHUTDOWN_DATE,
  planWorkersAiDeprecations, workersAiSeedOptions, workersAiSlugCandidates, type WorkersAiModelRow,
} from './catalog-2026-11-06-workers-ai-deprecations';

const ENDPOINTS = [
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  '@cf/nvidia/nemotron-3-120b-a12b',
  '@cf/deepseek-ai/deepseek-v4-pro-0813',
  '@cf/deepseek-ai/deepseek-v4-flash-0731',
  '@cf/qwen/qwq-32b',
  '@cf/qwen/qwen3-30b-a3b-fp8',
  '@cf/moonshotai/kimi-k2.6',
  '@cf/moonshotai/kimi-k2.7-code',
  '@cf/zai-org/glm-5.2',
  '@cf/zai-org/glm-5.3-flash',
  '@cf/meta-llama/llama-2-7b-chat-hf-lora',
  '@cf/google/gemma-2b-it-lora',
  '@cf/google/gemma-7b-it-lora',
  '@cf/meta/llama-3.1-8b-instruct-fp8',
  '@cf/meta/llama-3.2-1b-instruct',
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/myshell-ai/melotts',
  '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  '@cf/runwayml/stable-diffusion-v1-5-inpainting',
  '@cf/bytedance/stable-diffusion-xl-lightning',
  '@cf/lykon/dreamshaper-8-lcm',
  '@cf/openai/whisper-tiny-en',
  '@cf/llava-hf/llava-1.5-7b-hf',
  '@cf/google/embeddinggemma-300m',
];

const blank = (id: number, slug: string, providerSlugs: string[]): WorkersAiModelRow => ({
  id, slug, shutdown_date: null, deprecated_at: null, replacement_model: null, deprecation_source_url: null, providerSlugs,
});

test('changelog list is the live 2026-11-05 post, with the published replacements', () => {
  assert.deepEqual(CF_DEPRECATIONS.map(item => item.endpoint), ENDPOINTS);
  assert.equal(new Set(ENDPOINTS).size, ENDPOINTS.length);
  assert.equal(CF_ANNOUNCED_ON, '2026-11-05');
  assert.equal(CF_SHUTDOWN_DATE, '2026-11-15');
  assert.equal(CF_DEPRECATION_SOURCE, 'https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/');
  assert.match(CF_LLM_REPLACEMENT, /@cf\/deepseek-ai\/deepseek-v4\.1-flash-1017/);
  assert.match(CF_LLM_REPLACEMENT, /@cf\/zai-org\/glm-5\.3(?!-flash)/);
  assert.match(CF_LLM_REPLACEMENT, /@cf\/google\/gemma-4-26b-a4b-it/);
  assert.match(CF_LLM_REPLACEMENT, /@cf\/qwen\/qwen3\.8-27b/);
  for (const endpoint of ENDPOINTS.slice(0, 16)) assert.equal(CF_DEPRECATIONS.find(item => item.endpoint === endpoint)!.replacement, CF_LLM_REPLACEMENT);
  for (const endpoint of ['@cf/stabilityai/stable-diffusion-xl-base-1.0', '@cf/runwayml/stable-diffusion-v1-5-inpainting', '@cf/bytedance/stable-diffusion-xl-lightning', '@cf/lykon/dreamshaper-8-lcm']) {
    assert.equal(CF_DEPRECATIONS.find(item => item.endpoint === endpoint)!.replacement, '@cf/black-forest-labs/flux-2-klein-9b');
  }
  assert.equal(CF_DEPRECATIONS.find(item => item.endpoint === '@cf/myshell-ai/melotts')!.replacement, '@cf/deepgram/aura-2-en');
  assert.equal(CF_DEPRECATIONS.find(item => item.endpoint === '@cf/openai/whisper-tiny-en')!.replacement, '@cf/deepgram/nova-3');
  assert.equal(CF_DEPRECATIONS.find(item => item.endpoint === '@cf/llava-hf/llava-1.5-7b-hf')!.replacement, '@cf/moondream/moondream3.1-9B-A2B');
  assert.match(CF_DEPRECATIONS.find(item => item.endpoint === '@cf/google/embeddinggemma-300m')!.replacement, /embeddinggemma-2 \(available soon\)/);
});

test('slug candidates stay on the Workers AI id and do not adopt upstream aliases', () => {
  assert.deepEqual(workersAiSlugCandidates('@cf/openai/whisper-tiny-en'), [
    'whisper-tiny-en', 'cloudflare-whisper-tiny-en', 'openai-whisper-tiny-en', '@cf/openai/whisper-tiny-en',
  ]);
  const pro = workersAiSlugCandidates('@cf/deepseek-ai/deepseek-v4-pro-0813');
  assert.ok(pro.includes('deepseek-v4-pro-0813'));
  assert.ok(!pro.includes('deepseek-v4-pro'));
  assert.ok(!workersAiSlugCandidates('@cf/deepseek-ai/deepseek-v4-flash-0731').includes('deepseek-v4-flash'));
  assert.throws(() => workersAiSlugCandidates('whisper'), /Bad Workers AI id/);
});

test('repo Workers AI seed set (Clef / Clairic) is not on the changelog, so nothing is marked', () => {
  const rows = DECISION_1103_SPECS.filter(spec => spec.channel === 'workers-ai').map((spec, index) =>
    blank(index + 1, spec.slug, [spec.providerSlug]));
  assert.deepEqual(rows.map(row => row.slug).sort(), ['cloudflare-clairic', 'cloudflare-clef', 'cloudflare-clef-flash', 'cloudflare-clef-omni']);
  const plan = planWorkersAiDeprecations(rows);
  assert.deepEqual(plan.updates, []);
  assert.equal(plan.skipped.length, ENDPOINTS.length);
  assert.ok(plan.skipped.every(item => item.status === 'not-in-catalog'));
});

test('upstream lookalikes and shared channels are skipped; an exclusive Workers AI row is marked', () => {
  const rows = [
    blank(1, 'kimi-k2.6', ['moonshot-china']),
    blank(2, 'kimi-k2.7-code', ['moonshot-global']),
    blank(3, 'glm-5.2', ['zhipu-china', 'cloudflare']),
    blank(4, 'glm-5.3-flash', ['zhipu-global']),
    blank(5, 'deepseek-v4-pro', ['deepseek']),
    blank(6, 'deepseek-v4-flash', ['deepseek']),
    blank(7, 'cloudflare-clef', ['cloudflare']),
    blank(8, 'cloudflare-whisper-tiny-en', ['cloudflare']),
  ];
  const plan = planWorkersAiDeprecations(rows);
  assert.deepEqual(plan.updates.map(update => update.slug), ['cloudflare-whisper-tiny-en']);
  const marked = plan.updates[0];
  assert.equal(marked.endpoint, '@cf/openai/whisper-tiny-en');
  assert.equal(marked.to.shutdown_date, '2026-11-15');
  assert.equal(marked.to.deprecated_at, '2026-11-05');
  assert.equal(marked.to.replacement_model, '@cf/deepgram/nova-3');
  assert.equal(marked.to.deprecation_source_url, CF_DEPRECATION_SOURCE);
  assert.equal(plan.skipped.find(item => item.endpoint === '@cf/moonshotai/kimi-k2.6')?.status, 'not-workers-ai');
  assert.equal(plan.skipped.find(item => item.endpoint === '@cf/zai-org/glm-5.2')?.status, 'shared-channel');
  assert.equal(plan.skipped.find(item => item.endpoint === '@cf/deepseek-ai/deepseek-v4-pro-0813')?.status, 'not-in-catalog');
  assert.ok(plan.untouched.every(item => item.slug !== 'deepseek-v4-pro' && item.slug !== 'cloudflare-clef'));
  const again = planWorkersAiDeprecations(rows.map(row => row.slug === marked.slug ? { ...row, ...marked.to } : row));
  assert.deepEqual(again.updates, []);
});

test('duplicate slugs and a different shutdown day abort before a write', () => {
  const row = blank(1, 'whisper-tiny-en', ['cloudflare']);
  assert.throws(() => planWorkersAiDeprecations([row, { ...row, id: 2 }]), /Ambiguous model slug: whisper-tiny-en/);
  assert.throws(() => planWorkersAiDeprecations([{ ...row, shutdown_date: '2026-12-01' }]), /Conflicting shutdown date/);
});

test('seed is dry-run by default and is not on the deploy path', () => {
  assert.deepEqual(workersAiSeedOptions([]), { apply: false });
  assert.equal(workersAiSeedOptions(['--apply']).apply, true);
  assert.throws(() => workersAiSeedOptions(['--apply', '--dry-run']), /Usage/);
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['seed:catalog-2026-11-06-workers-ai-deprecations'], 'tsx scripts/seed-catalog-2026-11-06-workers-ai-deprecations.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-06-workers-ai-deprecations:apply'], 'tsx scripts/seed-catalog-2026-11-06-workers-ai-deprecations.ts --apply');
  for (const file of ['../../deploy/production/rollout.sh', '../../deploy/production/seed-catalog.sh', '../../.github/workflows/deploy-production.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /workers-ai-deprecations/);
  }
});
