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

export const COPILOT_PREVIEW_PLANS = ['copilot-pro', 'copilot-pro-plus', 'copilot-business', 'copilot-enterprise'];
