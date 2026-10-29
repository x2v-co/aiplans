import { splitGluedModelSlug } from './glued-model-slug';

/**
 * Old public slugs that now 404, keyed to the live catalog slug.
 *
 * Targets were checked against the live site on 2026-10-19: each named slug
 * returns 200 on both `/models` and `/compare/plans`. An empty target means
 * there is no single successor, so the section falls back to its list page.
 * Glued ids (`kimi-k2-thinkingkimi-k2-instruct…`) use the first id's row.
 *
 * `/compare/plans` targets must be indexable. selectIndexablePlanComparisons
 * marks older members of a series noindex, so a 301 onto e.g.
 * moonshotai-kimi-k2 handed Google a noindex page and the old URL dropped out
 * of the index. Compare targets therefore point at the newest page in the same
 * family that is in the sitemap (checked 2026-10-29); a family with no
 * indexable comparison falls back to the list page. /models targets are
 * always indexable and keep the exact successor.
 *
 * The table is the only redirect layer for these slugs: `model_slug_redirects`
 * in the database covers renames the crawler inserted, and the seeds do not
 * backfill historical aliases.
 */
export type LegacySlugTarget = {
  models?: string;
  compare?: string;
};

export const LEGACY_MODEL_SLUGS: Record<string, LegacySlugTarget> = {
  'gpt-6.1-sol': { models: 'openai-gpt-6-1-sol', compare: 'openai-gpt-6-1-sol' },
  'gpt-6-astra': { models: 'openai-gpt-6-astra' },
  'gpt-6-luna': { models: 'openai-gpt-6-luna' },
  'claude-opus-5.5': { models: 'anthropic-claude-opus-5-5', compare: 'claude-opus-4.5' },
  'claude-opus-5-batch': { models: 'anthropic-claude-opus-5-batch', compare: 'claude-opus-4.5' },
  'claude-opus-4.8': { models: 'anthropic-claude-opus-4-8', compare: 'claude-opus-4.5' },
  'claude-opus-4.7': { models: 'anthropic-claude-opus-4-7', compare: 'claude-opus-4.5' },
  'claude-opus-4.6': { models: 'anthropic-claude-opus-4-6', compare: 'claude-opus-4.5' },
  'claude-sonnet-5': { models: 'anthropic-claude-sonnet-5', compare: 'claude-sonnet-4.5' },
  'claude-sonnet-4.6-batch': { models: 'anthropic-claude-sonnet-4-6-batch', compare: 'claude-sonnet-4.5' },
  'claude-haiku-4-5': { models: 'anthropic-claude-haiku-4-5', compare: 'claude-haiku-5.5' },
  'claude-fable-5.1-batch': { models: 'anthropic-claude-fable-5-1-batch' },
  'kimi-k2': { models: 'moonshotai-kimi-k2', compare: 'kimi-k3' },
  'kimi-k2-thinking': { models: 'moonshotai-kimi-k2-thinking', compare: 'kimi-k3' },
  'kimi-k2.5': { models: 'moonshotai-kimi-k2-5', compare: 'kimi-k3' },
  'glm-5': { models: 'z-ai-glm-5', compare: 'glm-5.3' },
  'glm-4.5': { models: 'z-ai-glm-4-5', compare: 'glm-5.3' },
  'glm-4.6v': { models: 'z-ai-glm-4-6v', compare: 'glm-5.3' },
  'glm-4.7-flash': { models: 'z-ai-glm-4-7-flash', compare: 'glm-5.3-flash' },
  'qwen3.8-27b': { models: 'qwen-qwen3-8-27b' },
  'qwen3.5-35b-a3b': { models: 'qwen-qwen3-5-35b-a3b' },
  'qwen3-14b': { models: 'qwen-qwen3-14b' },
  'qwen-2.5-72b': { models: 'qwen-qwen-2-5-72b-instruct' },
  'step-3.7-flash': { models: 'stepfun-step-3-7-flash' },
  'seed-2.1-turbo': { models: 'doubao-seed-2.1-turbo', compare: 'doubao-seed-2.1-turbo' },
  'minimax-01': { models: 'minimax-minimax-01', compare: 'minimax-minimax-01' },
  'minimax-m2-her': { models: 'minimax-minimax-m2-her', compare: 'minimax-minimax-m2-her' },
  // Brand-level slugs point at the catalog's floating "latest" page; the guard
  // is only that the page exists (checked 2026-10-29). `qwen3.5-max` still has
  // no single successor, so it falls back to the section list.
  'kimi': { models: '~moonshotai-kimi-latest' },
  'claude-sonnet': { models: '~anthropic-claude-sonnet-latest' },
  'grok': { models: '~x-ai-grok-latest' },
  'gemini-pro': { models: '~google-gemini-pro-latest' },
  'qwen2.5-7b': { models: 'qwen-qwen-2-5-7b-instruct' },
  'claude-sonnet-4': { models: 'anthropic-claude-sonnet-4' },
  'qwen3.5-max': {},

  // Backfilled 2026-10-29 from the Search Console page export (878 URLs):
  // every slug below still carried impressions while returning 404, because
  // the catalog moved the same model under a vendor-prefixed slug. Each
  // `models` target was fetched on 2026-10-29 and returns 200 with
  // `index, follow`; a `compare` target is only set when the same model family
  // has an indexable /compare/plans page (an older member of the series is
  // noindex, so redirecting onto it drops the old URL).
  'gpt-3.5-turbo': { models: 'openai-gpt-3-5-turbo' },
  'gpt-4': { models: 'openai-gpt-4' },
  'gpt-4-turbo': { models: 'openai-gpt-4-turbo' },
  'gpt-5.2-pro': { models: 'openai-gpt-5-2-pro', compare: 'gpt-5.4-pro' },
  'gpt-5.5-pro': { models: 'openai-gpt-5-5-pro', compare: 'gpt-5.5' },
  'gpt-5.6-luna-pro': { models: 'openai-gpt-5-6-luna-pro', compare: 'gpt-5.6-luna' },
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
  'claude-opus-4.8-batch': { models: 'anthropic-claude-opus-4-8-batch', compare: 'claude-opus-4.5' },
  'claude-opus-5': { models: 'anthropic-claude-opus-5', compare: 'claude-opus-4.5' },
  'claude-sonnet-4.6': { models: 'anthropic-claude-sonnet-4-6', compare: 'claude-sonnet-4.5' },
  'glm-4.5-air': { models: 'z-ai-glm-4-5-air', compare: 'glm-5.3' },
  'glm-4.5v': { models: 'z-ai-glm-4-5v' },
  'glm-4.6': { models: 'z-ai-glm-4-6', compare: 'glm-5.3' },
  'glm-5-turbo': { models: 'z-ai-glm-5-turbo' },
  'glm-5.1': { models: 'z-ai-glm-5-1' },
  'glm-5.2-(free)': { models: 'z-ai-glm-5-2-free' },
  'glm-5v-turbo': { models: 'z-ai-glm-5v-turbo', compare: 'glm-5.3' },
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
  'claude-fable': { models: '~anthropic-claude-fable-latest' },
  'gpt-mini': { models: '~openai-gpt-mini-latest' },
};

/**
 * `/compare/plans` pages that are gone while the same slug's `/models` page is
 * still live and indexable. They cannot live in LEGACY_MODEL_SLUGS: an entry
 * with a `compare` target but no `models` target also redirects `/models` to
 * the section list, which would drop a page that currently serves traffic.
 */
export const LEGACY_COMPARE_ONLY_SLUGS: Record<string, string> = {
  // Same 2026-10-29 export; the /models page returns 200 + index, follow.
  'gpt-4.1-nano': 'gpt-5.4-nano',
  'gpt-5.1-codex-max': 'gpt-5.3-codex',
  'gpt-5.2-codex': 'gpt-5.3-codex',
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
  const parts = splitGluedModelSlug(slug);
  const lookup = parts?.[0] ?? slug;
  if (!Object.hasOwn(LEGACY_MODEL_SLUGS, lookup)) {
    // An unresolvable glued id (one price cell stored as a slug) still lands on
    // the section list, as it always has.
    if (parts) return `/${locale}/${section}`;
    const compareOnly = sectionKey === 'compare' ? LEGACY_COMPARE_ONLY_SLUGS[lookup] : undefined;
    return compareOnly ? `/${locale}/${section}/${compareOnly}` : null;
  }
  const entry = LEGACY_MODEL_SLUGS[lookup];
  const targetSlug = entry[sectionKey];
  if (targetSlug) {
    const destination = `/${locale}/${section}/${targetSlug}`;
    return destination === `/${locale}/${section}/${slug}` ? null : destination;
  }
  // The family has no indexable comparison: hand the compare URL to the model
  // page, which renders the same plan table, instead of the section list.
  // selectIndexablePlanComparisons marks every older member of a series
  // noindex (their plan set is a subset of the newest one), so those pages are
  // near-duplicates and must stay noindex rather than becoming compare targets.
  if (sectionKey === 'compare' && entry.models) {
    return `/${locale}/models/${entry.models}`;
  }
  return `/${locale}/${section}`;
}
