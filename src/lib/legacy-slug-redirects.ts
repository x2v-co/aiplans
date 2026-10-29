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
  // No single live page: two 7B rows, a floating "latest" alias, or a newer
  // version that is a different model.
  'kimi': {},
  'qwen2.5-7b': {},
  'gemini-pro': {},
  'qwen3.5-max': {},
  'claude-sonnet-4': {},
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
  if (!parts && !Object.hasOwn(LEGACY_MODEL_SLUGS, lookup)) return null;
  const targetSlug = LEGACY_MODEL_SLUGS[lookup]?.[sectionKey];
  const destination = targetSlug
    ? `/${locale}/${section}/${targetSlug}`
    : `/${locale}/${section}`;
  return destination === `/${locale}/${section}/${slug}` ? null : destination;
}
