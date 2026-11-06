import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DECISION_1103_SPECS } from '../../src/lib/decision-models-2026-11-03';
import {
  CF_ANNOUNCED_ON, CF_DEPRECATION_SOURCE, CF_DEPRECATIONS, CF_LLM_REPLACEMENT, CF_SHUTDOWN_DATE,
  planWorkersAiDeprecations, workersAiCatalogSlug, workersAiKind, workersAiSeedOptions, workersAiSlugCandidates,
  type WorkersAiModelRow,
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
  assert.equal(workersAiCatalogSlug('@cf/moonshotai/kimi-k2.6'), 'cloudflare-kimi-k2.6');
  assert.deepEqual(workersAiSlugCandidates('@cf/openai/whisper-tiny-en'), [
    'cloudflare-whisper-tiny-en', 'whisper-tiny-en', 'openai-whisper-tiny-en', '@cf/openai/whisper-tiny-en',
  ]);
  const pro = workersAiSlugCandidates('@cf/deepseek-ai/deepseek-v4-pro-0813');
  assert.ok(pro.includes('deepseek-v4-pro-0813'));
  assert.ok(pro.includes('cloudflare-deepseek-v4-pro-0813'));
  assert.ok(!pro.includes('deepseek-v4-pro'));
  assert.ok(!workersAiSlugCandidates('@cf/deepseek-ai/deepseek-v4-flash-0731').includes('deepseek-v4-flash'));
  assert.throws(() => workersAiSlugCandidates('whisper'), /Bad Workers AI id/);
});

test('missing Workers AI rows are inserted as cloudflare-<id>; Clef rows are not reused', () => {
  const rows = DECISION_1103_SPECS.filter(spec => spec.channel === 'workers-ai').map((spec, index) =>
    blank(index + 1, spec.slug, [spec.providerSlug]));
  assert.deepEqual(rows.map(row => row.slug).sort(), ['cloudflare-clairic', 'cloudflare-clef', 'cloudflare-clef-flash', 'cloudflare-clef-omni']);
  const plan = planWorkersAiDeprecations(rows);
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.skipped, []);
  assert.equal(plan.inserts.length, ENDPOINTS.length);
  assert.deepEqual(plan.inserts.map(row => row.slug), ENDPOINTS.map(workersAiCatalogSlug));
  assert.ok(plan.inserts.every(row => row.values.name === row.endpoint && !('provider_ids' in row.values)));
  const kimi = plan.inserts.find(row => row.endpoint === '@cf/moonshotai/kimi-k2.6')!;
  assert.equal(kimi.slug, 'cloudflare-kimi-k2.6');
  assert.equal(kimi.values.replacement_model, CF_LLM_REPLACEMENT);
  assert.equal(kimi.values.model_category, 'text');
  assert.match(kimi.values.description, /@cf\/moonshotai\/kimi-k2\.6/);
  assert.equal(workersAiKind('@cf/openai/whisper-tiny-en').model_category, 'speech');
  assert.equal(workersAiKind('@cf/stabilityai/stable-diffusion-xl-base-1.0').model_category, 'image');
  assert.equal(workersAiKind('@cf/google/embeddinggemma-300m').model_category, 'embedding');
  const seeded = plan.inserts.map((row, index) => blank(100 + index, row.slug, ['cloudflare']));
  for (const row of seeded) Object.assign(row, plan.inserts.find(item => item.slug === row.slug)!.values);
  const again = planWorkersAiDeprecations([...rows, ...seeded]);
  assert.deepEqual(again.inserts, []);
  assert.deepEqual(again.updates, []);
});

test('upstream lookalikes stay untouched; an existing exclusive Cloudflare row is updated instead of inserted', () => {
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
  assert.ok(!plan.inserts.some(row => row.slug === 'cloudflare-whisper-tiny-en' || row.slug === 'kimi-k2.6' || row.slug === 'glm-5.2'));
  assert.ok(plan.inserts.some(row => row.slug === 'cloudflare-kimi-k2.6'));
  assert.ok(plan.inserts.some(row => row.slug === 'cloudflare-glm-5.2'));
  assert.equal(plan.inserts.length, ENDPOINTS.length - 1);
  const marked = plan.updates[0];
  assert.equal(marked.endpoint, '@cf/openai/whisper-tiny-en');
  assert.equal(marked.to.shutdown_date, '2026-11-15');
  assert.equal(marked.to.deprecated_at, '2026-11-05');
  assert.equal(marked.to.replacement_model, '@cf/deepgram/nova-3');
  assert.equal(marked.to.deprecation_source_url, CF_DEPRECATION_SOURCE);
  assert.deepEqual(plan.untouched.map(row => row.slug).sort(), ['glm-5.2', 'glm-5.3-flash', 'kimi-k2.6', 'kimi-k2.7-code']);
  assert.ok(plan.untouched.every(row => row.slug !== 'deepseek-v4-pro' && row.slug !== 'cloudflare-clef'));
  assert.equal(plan.skipped.length, 0);
  const blocked = planWorkersAiDeprecations([...rows, blank(9, 'cloudflare-kimi-k2.6', ['moonshot-china'])]);
  assert.equal(blocked.skipped.find(item => item.endpoint === '@cf/moonshotai/kimi-k2.6')?.status, 'not-workers-ai');
  assert.ok(!blocked.inserts.some(row => row.slug === 'cloudflare-kimi-k2.6'));
  assert.ok(!blocked.updates.some(row => row.slug === 'kimi-k2.6' || row.slug === 'cloudflare-kimi-k2.6'));
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
