import type { ModelSelector } from './plan-selector';

// Verified HydraFusion pool only, not a claim about Copilot's full model menu.
// Families handle catalog slug aliases; excludes keep each exact version and
// prevent future Pro/Ultrafast/dated/API variants from becoming entitlements.
const MODELS = [
  ['anthropic', 'claude-opus-5.5'], ['openai', 'gpt-6-astra'],
  ['openai', 'gpt-6.1-sol'], ['openai', 'gpt-6-luna'],
];
// OpenRouter catalog slugs have a producer prefix and hyphenated versions.
const POOL = MODELS.flatMap(([provider, slug]) => [slug, `${provider}-${slug.replaceAll('.', '-')}`]);
export const COPILOT_PREVIEW_SELECTOR: ModelSelector = {
  providers: ['anthropic', 'openai'],
  families: POOL,
  exclude: POOL.flatMap(slug => [`${slug}-*`, `${slug}.*`]),
};

// Standalone inherits Enterprise eligibility, including this verified pool.
export const COPILOT_PREVIEW_PLANS = ['copilot-pro', 'copilot-pro-plus', 'copilot-business', 'copilot-enterprise', 'copilot-standalone'];

export const COPILOT_DEPRECATION_SOURCE = 'https://github.blog/changelog/2026-10-15-upcoming-deprecation-of-selected-github-copilot-models-in-mid-november';
/** Removed from all Copilot experiences on the date below (changelog 2026-10-15). */
export const COPILOT_MODEL_DEPRECATIONS = [
  { model: 'Claude Opus 4.8', date: '2026-11-16', replacement: 'Claude Opus 5.5', exceptAnnualIndividual: true },
  { model: 'Claude Opus 5', date: '2026-11-16', replacement: 'Claude Opus 5.5', exceptAnnualIndividual: false },
  { model: 'GPT-5.6 Terra', date: '2026-11-16', replacement: 'GPT-6.1 Sol / GPT-6 Luna', exceptAnnualIndividual: false },
] as const;
