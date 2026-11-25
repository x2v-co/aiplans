import { isGluedModelSlug } from './glued-model-slug';
import { canonicalModelSlug, isDuplicateModelSlug, JUNK_MODEL_SLUGS } from './duplicate-model-slugs';
import { selectIndexablePlanComparisons, type PlanComparisonCandidate } from './search-indexing';
import { publicModelDescription } from './public-catalog-copy';
import { modelLifecycleStatus } from './model-shutdown';
import { retainedModelContext } from './retained-model-context';
import type { AiCatalogKind } from './ai-vertical-catalog';

/** Stable 2026-11-25 curation, reviewed against the saved e7ad95c public
 * sitemap/Flight catalog and existing curated vertical source. Search demand
 * includes exact historical aliases; no prices or release dates rank at runtime.
 * Private page/query evidence and per-URL decisions stay outside the repository.
 * Membership is permission to index, never proof of existence or availability.
 */
export const SEO_INDEX_SELECTION_VERSION = '2026-11-25';
export const SEO_MODEL_ALLOWLIST: ReadonlySet<string> = new Set([
  'anthropic-claude-fable-5',
  'anthropic-claude-opus-4-6',
  'anthropic-claude-opus-4-8',
  'anthropic-claude-opus-5',
  'anthropic-claude-opus-5-5',
  'anthropic-claude-sonnet-5',
  'claude-3-sonnet',
  'claude-3.7-sonnet',
  'claude-opus-4',
  'claude-opus-4.1',
  'claude-opus-4.5',
  'claude-sonnet-4.5',
  'cognitivecomputations-dolphin-mistral-24b-venice-edition',
  'deepseek-deepseek-v4-flash-vision-exp',
  'deepseek-r1',
  'deepseek-v4-pro',
  'deepseek-v4.1-flash',
  'doubao-seed-2.0-pro',
  'doubao-seed-2.1-pro',
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3-flash',
  'gemini-3.1-pro',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-nano-banana-2.1',
  'glm-4.6v-flashx',
  'glm-4.7-flashx',
  'glm-5.2',
  'glm-5.2-fast',
  'glm-5.3',
  'glm-5.3-fast',
  'gpt-5',
  'gpt-5-pro',
  'gpt-5.1',
  'gpt-5.2',
  'gpt-5.3-codex',
  'gpt-5.4-pro',
  'gpt-5.5',
  'gpt-realtime-2.1',
  'grok-4.5',
  'grok-4.6',
  'inclusionai-ling-3-2-flash-free',
  'kimi-k2.6',
  'kimi-k2.6-fast',
  'kimi-k2.7-code',
  'kimi-k2.7-code-fast',
  'kimi-k2.7-code-highspeed',
  'kimi-k3',
  'minimax-m3',
  'mistral-medium-3.5',
  'moonshotai-kimi-k2',
  'moonshotai-kimi-k2-5',
  'moonshotai-kimi-k2-thinking',
  'openai-gpt-5-2-pro',
  'openai-gpt-5-5-pro',
  'openai-gpt-6-1-sol',
  'openai-gpt-6-luna',
  'openai-gpt-chat-latest',
  'qwen-plus',
  'qwen-qwen3-14b',
  'qwen-qwen3-5-27b',
  'qwen-qwen3-5-35b-a3b',
  'qwen-qwen3-6-27b',
  'qwen-qwen3-8-27b',
  'qwen-qwen3-coder',
  'qwen-qwen3-vl-8b-instruct',
  'qwen2.5-7b-instruct-turbo',
  'qwen3.5-397b-a17b',
  'qwen3.5-9b',
  'qwen3.8-max',
  'z-ai-glm-4-5',
  'z-ai-glm-4-5-air',
  'z-ai-glm-4-6',
  'z-ai-glm-4-6v',
  'z-ai-glm-4-7-flash',
  'z-ai-glm-5',
  'z-ai-glm-5-turbo',
  'z-ai-glm-5v-turbo',
]);

export const SEO_PROVIDER_ALLOWLIST: ReadonlySet<string> = new Set([
  'anthropic',
  'aws-bedrock',
  'azure-openai',
  'baidu',
  'deepseek',
  'fireworks',
  'google',
  'grok',
  'hunyuan',
  'meta',
  'minimax-china',
  'minimax-global',
  'mistral',
  'moonshot-china',
  'moonshot-global',
  'openai',
  'openrouter',
  'pika',
  'qwen',
  'replicate',
  'runway',
  'seed',
  'stepfun',
  'suno',
  'together-ai',
  'vertex-ai',
  'volcengine',
  'xai',
  'zhipu-china',
  'zhipu-global',
]);

export const SEO_VERTICAL_ALLOWLIST: Readonly<Partial<Record<AiCatalogKind, readonly string[]>>> = {
  'video-model': ['veo-3-1', 'kling', 'sora', 'wan-video'],
  'music-model': ['suno', 'udio'],
  'world-model': ['genie-3', 'world-labs-marble'],
  'decision-model': ['perplexity-pplx-decider-v1-3', 'cloudflare-clef'],
  'voice-model': ['gpt-realtime-whisper', 'eleven-v4'],
  'image-model': ['gpt-image-2', 'gemini-3-pro-image'],
  'embedding-model': ['text-embedding-3-small', 'gemini-embedding-2'],
};

export function providerShouldIndex(slug: string): boolean {
  return SEO_PROVIDER_ALLOWLIST.has(slug);
}

/** Called only after route/catalog existence checks. Retired items stay noindex. */
export function verticalShouldIndex(kind: AiCatalogKind, slug: string, shutdownDate?: string | null): boolean {
  return (SEO_VERTICAL_ALLOWLIST[kind]?.includes(slug) ?? false)
    && modelLifecycleStatus(shutdownDate) !== 'retired';
}

/** Counts include only finite, nonnegative prices. Zero is a real free price.
 * API/usage rows must be available; contact-sales plans do not have a price.
 */
export interface SeoIndexFacts extends PlanComparisonCandidate {
  description: string | null;
  api_price_count: number;
  priced_plan_count: number;
  usage_price_count: number;
  priced_subscription_count: number;
  priced_subscription_provider_count: number;
  available_api_count: number;
  active: boolean;
  is_llm: boolean;
}

/** OpenRouter `~vendor/model-latest` auto-routing endpoints, stored as
 * `~vendor-model-latest`. They are not models: each one renders the same
 * prices and title as the concrete model it currently routes to (for example
 * `~deepseek-deepseek-v4-flash-latest` vs `deepseek-v4-flash`), so indexing
 * them publishes duplicate pages. Flagship and compare discovery already skip
 * them; the sitemap and robots tag do too. The pages stay reachable.
 */
export function isRouterAliasSlug(slug: string): boolean {
  return slug.startsWith('~');
}

/** Batch-API variants (`openai-gpt-5-2-batch`, `claude-opus-5:batch`,
 * `gpt-5.2-(batch)`). Each page repeats its base model's page with the batch
 * discount applied (~97% identical text in the 2026-11 audit; 76 of the 81 in
 * the sitemap had a base model page), so Google files them as near-duplicates.
 * They are noindex, follow and out of the sitemap; the pages stay reachable.
 */
export function isBatchVariantSlug(slug: string): boolean {
  return /(?:[-:]batch|-\(batch\))$/i.test(slug);
}

/** Canonical path segment for a model page. Batch variants are noindex and
 * keep a self canonical: noindex plus a canonical pointing at another
 * (also noindex) batch row would send Google mixed signals.
 */
export function modelCanonicalSlug(slug: string): string {
  return isBatchVariantSlug(slug) ? slug : canonicalModelSlug(slug);
}

export function hasModelPriceData(facts: SeoIndexFacts): boolean {
  return facts.api_price_count > 0 || facts.priced_plan_count > 0 || facts.usage_price_count > 0;
}

/** Generated names, specifications and FAQ templates are not independent prose. */
export function isLowValueModel(facts: SeoIndexFacts): boolean {
  return !hasModelPriceData(facts) && !publicModelDescription(facts.description)
    && !retainedModelContext(facts.slug);
}

/** /compare/plans/[model] compares subscriptions for ONE model, not a model pair.
 * There is no independently authored comparison text in this route. Require two
 * priced subscriptions from two vendors; same-vendor tier permutations add no
 * independent comparison. Unknown/contact-sales prices cannot establish value.
 * Curated /compare/models, /compare/video-models and the plan directory are
 * separate, substantive overview pages and are not subject to this detail rule.
 */
export function isLowValuePlanComparison(facts: SeoIndexFacts): boolean {
  return facts.priced_subscription_count < 2 || facts.priced_subscription_provider_count < 2;
}

/** Historical comparison value diagnostic, retained for reports. */
export function isLowValueAllowlistedComparison(facts: SeoIndexFacts): boolean {
  return facts.priced_subscription_count < 2;
}

export function selectSeoModels<T extends SeoIndexFacts>(rows: T[], applyPolicy = true): T[] {
  if (applyPolicy) return rows.filter(modelShouldIndex);
  // Historical report candidate set only. The curated set has no order-dependent cap.
  return rows.filter(row => row.active && row.is_llm && row.available_api_count > 0)
    .slice(0, 2000).filter(row => !isGluedModelSlug(row.slug));
}

/** Historical comparison additions for the policy-off report. These do not
 * grant indexability: all comparison details leave the curated sitemap.
 */
export const SEO_COMPARISON_ALLOWLIST: ReadonlySet<string> = new Set([
  'gemini-3-pro',
  'gemini-2.5-pro',
  'gemini-3.1-pro',
  'gemini-nano-banana-2.1',
]);

export function selectSeoComparisons<T extends SeoIndexFacts>(rows: T[], applyPolicy = true): T[] {
  // Comparison details are consolidated or remain accessible noindex, follow.
  if (applyPolicy) return [];
  const candidates = rows.filter(row => row.active && row.is_llm);
  const selected = selectIndexablePlanComparisons(candidates);
  const seen = new Set(selected.map(row => row.slug));
  const allowlisted = candidates.filter(row => SEO_COMPARISON_ALLOWLIST.has(row.slug)
    && !seen.has(row.slug) && row.plan_count >= 2);
  return [...selected, ...allowlisted]
    .filter(row => !isGluedModelSlug(row.slug));
}

export function modelShouldIndex(row: SeoIndexFacts): boolean {
  return SEO_MODEL_ALLOWLIST.has(row.slug) && row.active && row.is_llm
    && !isGluedModelSlug(row.slug) && !isRouterAliasSlug(row.slug)
    && !isBatchVariantSlug(row.slug) && !isDuplicateModelSlug(row.slug)
    && !JUNK_MODEL_SLUGS.has(row.slug) && !isLowValueModel(row);
}

/** A redirect requires exact identity AND the same subscription payload rendered
 * on the canonical model page. No successor, synonym, or section-index fallback.
 * The caller proves parity by passing the slug returned by the shared loader.
 */
export function compareSeoFallback(
  locale: string, slug: string, catalog: SeoIndexFacts[], integratedModelSlug?: string,
): string | null {
  const facts = catalog.find(row => row.slug === slug);
  if (integratedModelSlug !== slug || !facts || !modelShouldIndex(facts)
    || modelCanonicalSlug(slug) !== slug) return null;
  return `/${locale === 'zh' ? 'zh' : 'en'}/models/${encodeURIComponent(slug)}`;
}
