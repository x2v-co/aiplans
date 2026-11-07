/**
 * Workers AI planned deprecations, announced 2026-11-05.
 * The changelog first said November 15, 2026, then moved removal to November 20, 2026.
 * From that day, requests fail HTTP 410 Gone / error 5028.
 * Source (re-read live 2026-11-07): https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/
 *
 * Catalog Workers AI rows use a cloudflare- slug (cloudflare-clef) and keep the
 * @cf/ id in the name and description. Bare ids such as kimi-k2.6 already belong
 * to Moonshot, Zhipu or DeepSeek, so they are never updated. A missing exclusive
 * Cloudflare row is inserted as cloudflare-<model id> and marked deprecated.
 * shutdown_date retires every channel of that row, so a shared row is left alone.
 *
 * Rows already stamped CF_SHUTDOWN_DATE_PREVIOUS are corrected forward to
 * CF_SHUTDOWN_DATE. Description text that still names the old day is rewritten by
 * seed:catalog-2026-11-07-workers-ai-deprecation-date, not by this insert seed.
 */
export const CF_DEPRECATION_SOURCE = 'https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/';
export const CF_ANNOUNCED_ON = '2026-11-05';
/** First published removal day. Superseded; not a conflicting foreign date. */
export const CF_SHUTDOWN_DATE_PREVIOUS = '2026-11-15';
export const CF_SHUTDOWN_DATE = '2026-11-20';

/** Frontier and smaller replacements named in the changelog for the LLM list. */
export const CF_LLM_REPLACEMENT = '@cf/deepseek-ai/deepseek-v4.1-flash-1017 or @cf/zai-org/glm-5.3; smaller: @cf/google/gemma-4-26b-a4b-it or @cf/qwen/qwen3.8-27b';
const FLUX = '@cf/black-forest-labs/flux-2-klein-9b';

export interface CfDeprecation {
  endpoint: string;
  replacement: string;
}

export const CF_DEPRECATIONS: readonly CfDeprecation[] = [
  { endpoint: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/nvidia/nemotron-3-120b-a12b', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/deepseek-ai/deepseek-v4-pro-0813', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/deepseek-ai/deepseek-v4-flash-0731', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/qwen/qwq-32b', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/qwen/qwen3-30b-a3b-fp8', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/moonshotai/kimi-k2.6', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/moonshotai/kimi-k2.7-code', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/zai-org/glm-5.2', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/zai-org/glm-5.3-flash', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/meta-llama/llama-2-7b-chat-hf-lora', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/google/gemma-2b-it-lora', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/google/gemma-7b-it-lora', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/meta/llama-3.1-8b-instruct-fp8', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/meta/llama-3.2-1b-instruct', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/meta/llama-3.2-3b-instruct', replacement: CF_LLM_REPLACEMENT },
  { endpoint: '@cf/myshell-ai/melotts', replacement: '@cf/deepgram/aura-2-en' },
  { endpoint: '@cf/stabilityai/stable-diffusion-xl-base-1.0', replacement: FLUX },
  { endpoint: '@cf/runwayml/stable-diffusion-v1-5-inpainting', replacement: FLUX },
  { endpoint: '@cf/bytedance/stable-diffusion-xl-lightning', replacement: FLUX },
  { endpoint: '@cf/lykon/dreamshaper-8-lcm', replacement: FLUX },
  { endpoint: '@cf/openai/whisper-tiny-en', replacement: '@cf/deepgram/nova-3' },
  { endpoint: '@cf/llava-hf/llava-1.5-7b-hf', replacement: '@cf/moondream/moondream3.1-9B-A2B' },
  { endpoint: '@cf/google/embeddinggemma-300m', replacement: '@cf/google/embeddinggemma-2 (available soon)' },
];

const WORKERS_AI_ID = /^@cf\/[^/]+\/[^/]+$/;

export function workersAiModelId(endpoint: string): string {
  if (!WORKERS_AI_ID.test(endpoint)) throw new Error(`Bad Workers AI id: ${endpoint}`);
  return endpoint.slice(endpoint.lastIndexOf('/') + 1);
}

/** Catalog slug for a Workers AI row. Distinct from an upstream model of the same id. */
export function workersAiCatalogSlug(endpoint: string): string {
  return `cloudflare-${workersAiModelId(endpoint)}`;
}

/** Exact slugs that can already represent this Workers AI id. Not an upstream alias. */
export function workersAiSlugCandidates(endpoint: string): string[] {
  const modelId = workersAiModelId(endpoint);
  const path = endpoint.slice('@cf/'.length);
  return [...new Set([workersAiCatalogSlug(endpoint), modelId, path.replaceAll('/', '-'), endpoint])];
}

const IMAGE_ENDPOINTS = new Set([
  '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  '@cf/runwayml/stable-diffusion-v1-5-inpainting',
  '@cf/bytedance/stable-diffusion-xl-lightning',
  '@cf/lykon/dreamshaper-8-lcm',
]);
const SPEECH_ENDPOINTS = new Set(['@cf/myshell-ai/melotts', '@cf/openai/whisper-tiny-en']);

/** Category for a row this seed creates. Prices are not in the deprecation notice. */
export function workersAiKind(endpoint: string): { type: string; model_category: string; pricing_unit: string } {
  if (IMAGE_ENDPOINTS.has(endpoint)) return { type: 'multimodal', model_category: 'image', pricing_unit: 'unknown' };
  if (SPEECH_ENDPOINTS.has(endpoint)) return { type: 'multimodal', model_category: 'speech', pricing_unit: 'unknown' };
  if (endpoint === '@cf/llava-hf/llava-1.5-7b-hf') return { type: 'multimodal', model_category: 'text', pricing_unit: 'per_1m_tokens' };
  if (endpoint === '@cf/google/embeddinggemma-300m') return { type: 'llm', model_category: 'embedding', pricing_unit: 'per_1m_tokens' };
  return { type: 'llm', model_category: 'text', pricing_unit: 'per_1m_tokens' };
}

export interface WorkersAiInsert {
  endpoint: string;
  slug: string;
  values: {
    slug: string;
    name: string;
    type: string;
    model_category: string;
    pricing_unit: string;
    offical_link: string;
    description: string;
    shutdown_date: string;
    deprecated_at: string;
    replacement_model: string;
    deprecation_source_url: string;
  };
}

export function workersAiModelInsert(item: CfDeprecation): WorkersAiInsert {
  const modelId = workersAiModelId(item.endpoint);
  const slug = workersAiCatalogSlug(item.endpoint);
  const kind = workersAiKind(item.endpoint);
  return {
    endpoint: item.endpoint,
    slug,
    values: {
      slug,
      name: item.endpoint,
      ...kind,
      offical_link: `https://developers.cloudflare.com/workers-ai/models/${modelId}/`,
      description: `Workers AI id ${item.endpoint}. Removed from the Workers AI catalog on ${CF_SHUTDOWN_DATE} (announced ${CF_ANNOUNCED_ON}). Recommended replacement: ${item.replacement}. The deprecation notice does not publish a price, so this row has no channel price. Source: ${CF_DEPRECATION_SOURCE}`,
      shutdown_date: CF_SHUTDOWN_DATE,
      deprecated_at: CF_ANNOUNCED_ON,
      replacement_model: item.replacement,
      deprecation_source_url: CF_DEPRECATION_SOURCE,
    },
  };
}

const slugOwner = new Map<string, string>();
for (const item of CF_DEPRECATIONS) {
  for (const slug of workersAiSlugCandidates(item.endpoint)) {
    const previous = slugOwner.get(slug);
    if (previous && previous !== item.endpoint) throw new Error(`Slug ${slug} is claimed by ${previous} and ${item.endpoint}`);
    slugOwner.set(slug, item.endpoint);
  }
}

export const WORKERS_AI_CANDIDATE_SLUGS = [...slugOwner.keys()];

export interface WorkersAiModelRow {
  id: number;
  slug: string;
  shutdown_date: string | null;
  deprecated_at?: string | null;
  replacement_model: string | null;
  deprecation_source_url: string | null;
  /** Provider slugs from provider_ids and api_channel_prices. Empty means unknown. */
  providerSlugs: readonly string[];
}

export interface WorkersAiUpdate {
  id: number;
  slug: string;
  endpoint: string;
  from: { shutdown_date: string | null; deprecated_at: string | null; replacement_model: string | null; deprecation_source_url: string | null };
  to: { shutdown_date: string; deprecated_at: string; replacement_model: string; deprecation_source_url: string };
}

export type SkipStatus = 'not-in-catalog' | 'not-workers-ai' | 'shared-channel';

export interface SkippedEndpoint {
  endpoint: string;
  status: SkipStatus;
  slugs: string[];
}

export interface UntouchedRow {
  slug: string;
  endpoint: string;
  status: Exclude<SkipStatus, 'not-in-catalog'>;
}

function ownership(slugs: readonly string[]): 'exclusive' | 'shared' | 'other' {
  const set = [...new Set(slugs)];
  if (set.length === 1 && set[0] === 'cloudflare') return 'exclusive';
  if (set.includes('cloudflare')) return 'shared';
  return 'other';
}

const same = (from: WorkersAiUpdate['from'], to: WorkersAiUpdate['to']) =>
  (Object.keys(to) as (keyof WorkersAiUpdate['to'])[]).every(key => from[key] === to[key]);

/**
 * Pure plan. Throws before any caller writes when a slug is ambiguous or already
 * carries a shutdown day other than CF_SHUTDOWN_DATE or CF_SHUTDOWN_DATE_PREVIOUS.
 * The superseded November 15 stamp is updated to November 20. Non-Cloudflare rows
 * are reported and left unchanged. An endpoint with no exclusive Cloudflare row
 * is inserted as cloudflare-<model id>, unless that slug is already taken.
 */
export function planWorkersAiDeprecations(rows: readonly WorkersAiModelRow[]) {
  const bySlug = new Map<string, WorkersAiModelRow>();
  for (const row of rows) {
    if (bySlug.has(row.slug)) throw new Error(`Ambiguous model slug: ${row.slug}; nothing written.`);
    bySlug.set(row.slug, row);
  }
  const byEndpoint = new Map(CF_DEPRECATIONS.map(item => [item.endpoint, item]));
  const updates: WorkersAiUpdate[] = [];
  const untouched: UntouchedRow[] = [];
  const matched = new Map<string, { exclusive: string[]; other: string[]; shared: string[] }>();

  for (const row of rows) {
    const endpoint = slugOwner.get(row.slug);
    if (!endpoint) continue;
    const item = byEndpoint.get(endpoint)!;
    const bucket = matched.get(endpoint) ?? { exclusive: [], other: [], shared: [] };
    matched.set(endpoint, bucket);
    const kind = ownership(row.providerSlugs);
    if (kind !== 'exclusive') {
      const status = kind === 'shared' ? 'shared-channel' : 'not-workers-ai';
      bucket[kind === 'shared' ? 'shared' : 'other'].push(row.slug);
      untouched.push({ slug: row.slug, endpoint, status });
      continue;
    }
    bucket.exclusive.push(row.slug);
    if (row.shutdown_date && row.shutdown_date !== CF_SHUTDOWN_DATE && row.shutdown_date !== CF_SHUTDOWN_DATE_PREVIOUS) {
      throw new Error(`Conflicting shutdown date for ${row.slug} (${row.shutdown_date}); nothing written.`);
    }
    const from = {
      shutdown_date: row.shutdown_date,
      deprecated_at: row.deprecated_at ?? null,
      replacement_model: row.replacement_model,
      deprecation_source_url: row.deprecation_source_url,
    };
    const to = {
      shutdown_date: CF_SHUTDOWN_DATE,
      deprecated_at: CF_ANNOUNCED_ON,
      replacement_model: item.replacement,
      deprecation_source_url: CF_DEPRECATION_SOURCE,
    };
    if (!same(from, to)) updates.push({ id: row.id, slug: row.slug, endpoint, from, to });
  }

  const inserts: WorkersAiInsert[] = [];
  const skipped: SkippedEndpoint[] = [];
  for (const item of CF_DEPRECATIONS) {
    const bucket = matched.get(item.endpoint);
    if (bucket?.exclusive.length) continue;
    const slug = workersAiCatalogSlug(item.endpoint);
    if (bySlug.has(slug)) {
      const status: SkipStatus = bucket?.shared.length ? 'shared-channel' : 'not-workers-ai';
      skipped.push({ endpoint: item.endpoint, status, slugs: [...(bucket?.shared ?? []), ...(bucket?.other ?? []), slug] });
      continue;
    }
    inserts.push(workersAiModelInsert(item));
  }

  return { updates, inserts, skipped, untouched };
}

export function workersAiSeedOptions(args: readonly string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-06-workers-ai-deprecations.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}
