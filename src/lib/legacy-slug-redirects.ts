/**
 * Old public slugs that now 404, keyed to the live catalog slug.
 *
 * Targets were checked against the live site on 2026-10-19: each named slug
 * returns 200 on both `/models` and `/compare/plans`. An empty target means
 * there is no single successor, so the section falls back to its list page.
 * Multi-entity glued ids have no inferred successor. Only an exact,
 * source-verified entry here can redirect; otherwise detail routes return 404.
 *
 * Comparison aliases retain the exact model identity. Indexability alone does
 * not establish equivalence: use the exact model detail if no same-entity
 * comparison target is configured, even if lifecycle rules noindex that detail.
 * Do not substitute a newer generation for an exact model query.
 * The dated catalog/sitemap checks in their comments are historical evidence,
 * not a guarantee of today's target availability or indexing status.
 *
 * The table is the only redirect layer for these slugs: `model_slug_redirects`
 * in the database covers renames the crawler inserted, and the seeds do not
 * backfill historical aliases.
 */
export type LegacySlugTarget = {
  models?: string;
  compare?: string;
  /** Brand-level slugs (`kimi`, `grok`) land on the provider page for both
   * sections. It is indexable and matches the brand pricing intent. */
  provider?: string;
};

export const LEGACY_MODEL_SLUGS: Record<string, LegacySlugTarget> = {
  // Intel 2026-11-14: production /models/embeddinggemma-2 was 404; canonical Workers AI slug.
  'embeddinggemma-2': { models: 'cloudflare-embeddinggemma-2' },
  'google-embeddinggemma-2': { models: 'cloudflare-embeddinggemma-2' },
  // #275: both published IDs refer to MiniMax-M3.1-Flash. Proxy returns 301.
  'minimax-m3.1': { models: 'minimax-m3.1-flash' },
  'minimax-minimax-m3-1-flash': { models: 'minimax-m3.1-flash' },
  'gpt-6.1-sol': { models: 'openai-gpt-6-1-sol', compare: 'openai-gpt-6-1-sol' },
  'gpt-6-astra': { models: 'openai-gpt-6-astra' },
  'gpt-6-luna': { models: 'openai-gpt-6-luna' },
  'claude-opus-5.5': { models: 'anthropic-claude-opus-5-5' },
  'claude-opus-5-batch': { models: 'anthropic-claude-opus-5-batch' },
  'claude-opus-4.8': { models: 'anthropic-claude-opus-4-8' },
  'claude-opus-4.7': { models: 'anthropic-claude-opus-4-7' },
  'claude-opus-4.6': { models: 'anthropic-claude-opus-4-6' },
  'claude-sonnet-5': { models: 'anthropic-claude-sonnet-5' },
  'claude-sonnet-4.6-batch': { models: 'anthropic-claude-sonnet-4-6-batch' },
  'claude-haiku-4-5': { models: 'anthropic-claude-haiku-4-5' },
  'claude-fable-5.1-batch': { models: 'anthropic-claude-fable-5-1-batch' },
  'kimi-k2': { models: 'moonshotai-kimi-k2' },
  // Same K2 Thinking identity: scripts/data/catalog-2026-10-29.ts KIMI_K2_SLUGS.
  'kimi-k2-thinking': { models: 'moonshotai-kimi-k2-thinking' },
  'kimi-k2.5': { models: 'moonshotai-kimi-k2-5' },
  'glm-5': { models: 'z-ai-glm-5' },
  'glm-4.5': { models: 'z-ai-glm-4-5' },
  // Keep the existing exact GLM-4.6V model mapping for comparison URLs too.
  'glm-4.6v': { models: 'z-ai-glm-4-6v' },
  'glm-4.7-flash': { models: 'z-ai-glm-4-7-flash' },
  'qwen3.8-27b': { models: 'qwen-qwen3-8-27b' },
  'qwen3.5-35b-a3b': { models: 'qwen-qwen3-5-35b-a3b' },
  'qwen3-14b': { models: 'qwen-qwen3-14b' },
  'qwen-2.5-72b': { models: 'qwen-qwen-2-5-72b-instruct' },
  'step-3.7-flash': { models: 'stepfun-step-3-7-flash' },
  'seed-2.1-turbo': { models: 'doubao-seed-2.1-turbo' },
  'minimax-01': { models: 'minimax-minimax-01', compare: 'minimax-minimax-01' },
  'minimax-m2-her': { models: 'minimax-minimax-m2-her', compare: 'minimax-minimax-m2-her' },
  // Brand-level slugs go to the provider page. They used to point at the
  // OpenRouter `~vendor-model-latest` routing pages, which duplicate a concrete
  // model page and are now noindex (seo-index-policy isRouterAliasSlug).
  // `qwen3.5-max` still has no single successor, so it falls back to the list.
  'kimi': { provider: 'moonshot-global' },
  'claude-sonnet': { provider: 'anthropic' },
  'grok': { provider: 'xai' },
  'gemini-pro': { provider: 'google' },
  'qwen2.5-7b': { models: 'qwen-qwen-2-5-7b-instruct' },
  'claude-sonnet-4': { models: 'anthropic-claude-sonnet-4' },
  'qwen3.5-max': {},

  // Backfilled 2026-10-29 from the Search Console page export (878 URLs):
  // every slug below still carried impressions while returning 404, because
  // the catalog moved the same model under a vendor-prefixed slug. Each
  // `models` target was fetched on 2026-10-29 and returns 200 with
  // `index, follow`. Comparison targets must preserve the same model identity;
  // the historical availability checks do not justify newer-version targets.
  'gpt-3.5-turbo': { models: 'openai-gpt-3-5-turbo' },
  'gpt-4': { models: 'openai-gpt-4' },
  'gpt-4-turbo': { models: 'openai-gpt-4-turbo' },
  'gpt-5.2-pro': { models: 'openai-gpt-5-2-pro' },
  'gpt-5.5-pro': { models: 'openai-gpt-5-5-pro' },
  'gpt-5.6-luna-pro': { models: 'openai-gpt-5-6-luna-pro' },
  'gpt-5.6-sol-pro': { models: 'openai-gpt-5-6-sol-pro' },
  'gpt-5.6-terra-pro': { models: 'openai-gpt-5-6-terra-pro' },
  'gpt-oss-20b': { models: 'openai-gpt-oss-20b' },
  'gpt-oss-safeguard-20b': { models: 'openai-gpt-oss-safeguard-20b' },
  'o1-pro': { models: 'openai-o1-pro' },
  'o3': { models: 'openai-o3' },
  'o3-pro': { models: 'openai-o3-pro' },
  'o4-mini-high': { models: 'openai-o4-mini-high' },
  'claude-3-haiku': { models: 'anthropic-claude-3-haiku' },
  'claude-fable-5': { models: 'anthropic-claude-fable-5' },
  'claude-fable-5-batch': { models: 'anthropic-claude-fable-5-batch' },
  'claude-opus-4.6-batch': { models: 'anthropic-claude-opus-4-6-batch' },
  'claude-opus-4.8-batch': { models: 'anthropic-claude-opus-4-8-batch' },
  'claude-opus-5': { models: 'anthropic-claude-opus-5' },
  'claude-sonnet-4.6': { models: 'anthropic-claude-sonnet-4-6' },
  'glm-4.5-air': { models: 'z-ai-glm-4-5-air' },
  'glm-4.5v': { models: 'z-ai-glm-4-5v' },
  'glm-4.6': { models: 'z-ai-glm-4-6' },
  'glm-5-turbo': { models: 'z-ai-glm-5-turbo' },
  'glm-5.1': { models: 'z-ai-glm-5-1' },
  'glm-5.2-(free)': { models: 'z-ai-glm-5-2-free' },
  'glm-5v-turbo': { models: 'z-ai-glm-5v-turbo' },
  'qwen3-32b': { models: 'qwen-qwen3-32b' },
  'qwen3-coder-next': { models: 'qwen-qwen3-coder-next' },
  'qwen3-max-thinking': { models: 'qwen-qwen3-max-thinking' },
  'qwen3-next-80b-a3b-thinking': { models: 'qwen-qwen3-next-80b-a3b-thinking' },
  'qwen3-vl-8b-thinking': { models: 'qwen-qwen3-vl-8b-thinking' },
  'qwen3.6-27b': { models: 'qwen-qwen3-6-27b' },
  'qwen3.6-35b-a3b': { models: 'qwen-qwen3-6-35b-a3b' },
  'grok-4.20': { models: 'x-ai-grok-4-20' },
  'grok-build-0.1': { models: 'x-ai-grok-build-0-1' },
  'minimax-m1': { models: 'minimax-minimax-m1' },
  'mistral-medium-3': { models: 'mistral-mistral-medium-3' },
  'step-3.5-flash': { models: 'stepfun-step-3-5-flash' },

  // Bundle 2 (2026-10-29): the slugs above were resolved by vendor prefix, which
  // misses models whose catalog slug also renames the variant (`gemma-3-27b` ->
  // `google-gemini-gemma-3-27b-it`, `qwen3-vl-8b` -> `qwen-qwen3-vl-8b-instruct`).
  // These were matched against the full `/api/products` catalog (928 rows) and
  // each target fetched on 2026-10-29: 200 + `index, follow`.
  'qwen3-coder-480b-a35b': { models: 'qwen-qwen3-coder' },
  'deepseek-v4-flash-vision': { models: 'deepseek-deepseek-v4-flash-vision-exp' },
  'qwen3-vl-8b': { models: 'qwen-qwen3-vl-8b-instruct' },
  'qwen3-vl-32b': { models: 'qwen-qwen3-vl-32b-instruct' },
  'qwen3-vl-235b-a22b': { models: 'qwen-qwen3-vl-235b-a22b-instruct' },
  'qwen3-vl-30b-a3b': { models: 'qwen-qwen3-vl-30b-a3b-instruct' },
  'qwen2.5-vl-72b': { models: 'qwen-qwen2-5-vl-72b-instruct' },
  'qwen-2.5-coder-32b': { models: 'qwen-qwen-2-5-coder-32b-instruct' },
  'gemma-4-26b-a4b-(free)': { models: 'google-gemini-gemma-4-26b-a4b-it-free' },
  'gemma-4-31b-(free)': { models: 'google-gemini-gemma-4-31b-it-free' },
  'gemma-4-26b-a4b': { models: 'google-gemini-gemma-4-26b-a4b-it' },
  'gemma-3-27b': { models: 'google-gemini-gemma-3-27b-it' },
  'gemma-3-12b': { models: 'google-gemini-gemma-3-12b-it' },
  'gemma-2-27b': { models: 'google-gemini-gemma-2-27b-it' },
  'mixtral-8x22b': { models: 'mistral-mixtral-8x22b-instruct' },
  'gemini-2.5-pro-preview-06-05': { models: 'google-gemini-gemini-2-5-pro-preview' },
  'gemini-3.1-pro-preview-custom-tools': { models: 'google-gemini-gemini-3-1-pro-preview-customtools' },
  'seed-1.6': { models: 'bytedance-seed-seed-1-6' },
  // Same catalog pass; these only ever appeared as /compare/plans URLs in the
  // export, and their /models page is 404 too, so the compare URL falls
  // through to the model page (see the section fallback below).
  'qwen3.5-27b': { models: 'qwen-qwen3-5-27b' },
  'qwen3.6-max': { models: 'qwen-qwen3-6-max-preview' },
  'qwen3-next-80b-a3b': { models: 'qwen-qwen3-next-80b-a3b-instruct' },
  'claude-fable': { provider: 'anthropic' },
  'gpt-mini': { provider: 'openai' },
};

/**
 * Comparison-only aliases leave the original /models route untouched, including
 * retired-model details. A comparison-only entry in LEGACY_MODEL_SLUGS would
 * also redirect /models to the section list. Lifecycle is not model identity.
 */
export const LEGACY_COMPARE_ONLY_SLUGS: Record<string, LegacySlugTarget> = {
  // Exact catalog ID in fix-data-audit.ts; shutdown/replacement is a separate
  // fact in data/openai-shutdowns.ts, not a URL identity migration.
  'gpt-4.1-nano': { models: 'gpt-4.1-nano' },
  // Exact IDs in data/openai-shutdowns.ts. Existing model pages are verified
  // separately; retirement does not make GPT-5.3 Codex the same product.
  'gpt-5.1-codex-max': { models: 'gpt-5.1-codex-max' },
  'gpt-5.2-codex': { models: 'gpt-5.2-codex' },
};

const ROUTE = /^\/(en|zh)\/(models|compare\/plans)\/([^/]+)\/?$/;

export function legacySlugRedirect(pathname: string): string | null {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    path = pathname;
  }
  const match = path.match(ROUTE);
  if (!match) return null;
  const [, locale, section, slug] = match;
  const sectionKey = section === 'models' ? 'models' : 'compare';
  const lookup = slug;
  if (!Object.hasOwn(LEGACY_MODEL_SLUGS, lookup)) {
    const compareOnly = sectionKey === 'compare' && Object.hasOwn(LEGACY_COMPARE_ONLY_SLUGS, lookup)
      ? LEGACY_COMPARE_ONLY_SLUGS[lookup] : undefined;
    if (compareOnly?.compare) return `/${locale}/${section}/${compareOnly.compare}`;
    if (compareOnly?.models) return `/${locale}/models/${compareOnly.models}`;
    return null;
  }
  const entry = LEGACY_MODEL_SLUGS[lookup];
  if (entry.provider) return `/${locale}/providers/${entry.provider}`;
  const targetSlug = entry[sectionKey];
  if (targetSlug) {
    const destination = `/${locale}/${section}/${targetSlug}`;
    return destination === `/${locale}/${section}/${slug}` ? null : destination;
  }
  // No comparison destination is configured: use the mapped model detail.
  // Its lifecycle/indexing policy is independent of the redirect's identity.
  if (sectionKey === 'compare' && entry.models) {
    return `/${locale}/models/${entry.models}`;
  }
  return `/${locale}/${section}`;
}
