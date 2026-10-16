import { aaSlugCandidates } from './artificial-analysis';
/**
 * Host-model slug resolution for Artificial Analysis coding-agent records.
 *
 * Until mid-Oct 2026 every record carried `hostModelSlug` (e.g.
 * "anthropic_claude-opus-5"). The 2026-10-16 snapshot dropped that field from
 * all records; the host model is now only exposed as `display.model`
 * ("Sonnet 5.5 (max)") plus `modelCreators[].slug`. Derive an equivalent
 * `provider_model` slug from those so mapping keeps working, and report
 * records with neither so the caller can skip them instead of crashing.
 */
export interface HostFields {
  hostModelSlug?: unknown;
  display?: { model?: unknown } | null;
  modelCreators?: Array<{ slug?: unknown }> | null;
  provider?: unknown;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // reasoning-effort / fallback qualifiers
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Returns the host slug, or null when the record carries no usable host info. */
export function deriveHostModelSlug(record: HostFields): string | null {
  if (typeof record.hostModelSlug === 'string' && record.hostModelSlug.trim()) return record.hostModelSlug;
  const model = record.display?.model;
  if (typeof model !== 'string') return null;
  const modelPart = slugify(model);
  if (!modelPart) return null;
  const creator = record.modelCreators?.find((entry) => typeof entry?.slug === 'string')?.slug;
  const provider = typeof creator === 'string' ? creator : typeof record.provider === 'string' ? record.provider : null;
  return provider ? `${provider}_${modelPart}` : modelPart;
}

/**
 * Explicit host-slug aliases for codenames no generic rule can recover.
 * Keep this curated; generic candidates cover hosts following the
 * `provider_model` convention.
 */
export const HOST_SLUG_ALIASES: Record<string, string> = {
  'anthropic_claude-fable-5-1': 'claude-fable-5.1',
  'anthropic_claude-opus-5': 'claude-opus-5',
  'openai_vega-alpha': 'gpt-6-astra',
  'openai_gpt-5-6-sol': 'gpt-5.6-sol',
  'deepseek_deepseek-v4-pro-0813': 'deepseek-v4-pro',
  'deepseek_deepseek-v4-flash-0731': 'deepseek-v4-flash',
  'xai_grok-4-6-xhigh': 'grok-4.6',
  'alibaba_cloud_qwen3-8-max-public': 'qwen3.8-max',
  'google_skimaki_ai-studio': 'gemini-3.8-flash',
  'cognition_fusion-claude-fable-5-1-xhigh-sidekick-penguin-medium': 'claude-fable-5.1',
  'cognition_fusion-gpt-6-astra-xhigh-sidekick-penguin-medium': 'gpt-6-astra',
};

/**
 * Local catalog slug prefixes per AA creator slug. Many local rows use the
 * OpenRouter form `<vendor>-<model-with-dashes>` (anthropic-claude-opus-5-5,
 * openai-gpt-6-1-sol, x-ai-grok-4-20, z-ai-glm-5-1, moonshotai-kimi-k2-5).
 */
const VENDOR_PREFIXES: Record<string, string[]> = {
  anthropic: ['anthropic-claude-', 'claude-', 'anthropic-'],
  openai: ['openai-', ''],
  google: ['google-', 'google-gemini-', ''],
  xai: ['x-ai-', ''],
  meta: ['meta-', ''],
  kimi: ['moonshotai-', ''],
  moonshotai: ['moonshotai-', ''],
  zai: ['z-ai-', ''],
  stepfun: ['stepfun-', ''],
  deepseek: ['deepseek-', ''],
  alibaba: ['qwen-', ''],
  alibaba_cloud: ['qwen-', ''],
  reflection: ['reflection-', ''],
};

const EFFORT = '(?:xhigh|high|medium|low|minimal|max)';

/** Split `provider_model` and reduce the model part to the base host model. */
export function splitHostSlug(hostModelSlug: string): { vendor: string; model: string } {
  const known = Object.keys(VENDOR_PREFIXES).sort((a, b) => b.length - a.length)
    .find(v => hostModelSlug.startsWith(`${v}_`));
  const vendor = known ?? hostModelSlug.match(/^([a-z0-9]+)_/)?.[1] ?? '';
  let model = vendor ? hostModelSlug.slice(vendor.length + 1) : hostModelSlug;
  model = model
    .replace(/^(?:aa_|cloud_)/, '')
    // Fusion/combined hosts ("claude-opus-5-5-max-gpt-6-luna-high"): keep the lead model.
    .replace(new RegExp(`-${EFFORT}-.*$`), '')
    .replace(/-public$/, '')
    .replace(/-\d{4}$/, '') // dated snapshots, e.g. deepseek-v4-pro-0813
    // Trailing effort tag from old-style slugs (grok-4-6-xhigh). "max" is not
    // stripped here: it is part of real model names (qwen3.8-max).
    .replace(/-(?:xhigh|high|medium|low|minimal)$/, '');
  return { vendor, model };
}

/** Candidate local slugs for an AA host slug, most specific first. */
export function hostSlugCandidates(hostModelSlug: string): string[] {
  const { vendor, model } = splitHostSlug(hostModelSlug);
  const out = new Set<string>();
  const bare = model.replace(/^claude-/, '');
  const stems = vendor === 'anthropic' ? [`claude-${bare}`, bare] : [model];
  for (const stem of stems) for (const c of aaSlugCandidates(stem)) out.add(c);
  const dashed = model.replace(/\./g, '-');
  for (const prefix of VENDOR_PREFIXES[vendor] ?? []) {
    const body = vendor === 'anthropic' ? bare.replace(/\./g, '-') : dashed;
    if (prefix && !body.startsWith(prefix)) out.add(`${prefix}${body}`);
  }
  return [...out];
}

/** Local rows that only add a parameter-size suffix, e.g. reflection-beam-1-0-501b-a23b. */
const SIZE_SUFFIX = /^-\d+(?:\.\d+)?b(?:-a\d+(?:\.\d+)?b)?$/;

export function resolveHostModel<T extends { id: number }>(
  hostModelSlug: string,
  bySlug: ReadonlyMap<string, T>,
): { id: number; slug: string } | undefined {
  const alias = HOST_SLUG_ALIASES[hostModelSlug];
  const candidates = alias ? [alias, ...hostSlugCandidates(hostModelSlug)] : hostSlugCandidates(hostModelSlug);
  for (const candidate of candidates) {
    const model = bySlug.get(candidate);
    if (model) return { id: model.id, slug: candidate };
  }
  for (const candidate of candidates) {
    const matches = [...bySlug.keys()].filter(slug => slug.startsWith(candidate) && SIZE_SUFFIX.test(slug.slice(candidate.length)));
    if (matches.length === 1) return { id: bySlug.get(matches[0])!.id, slug: matches[0] };
  }
  return undefined;
}
