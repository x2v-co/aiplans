import { isGluedModelSlug } from './glued-model-slug';
import { selectIndexablePlanComparisons, type PlanComparisonCandidate } from './search-indexing';
import { publicModelDescription } from './public-catalog-copy';

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

export function hasModelPriceData(facts: SeoIndexFacts): boolean {
  return facts.api_price_count > 0 || facts.priced_plan_count > 0 || facts.usage_price_count > 0;
}

/** Generated names, specifications and FAQ templates are not independent prose. */
export function isLowValueModel(facts: SeoIndexFacts): boolean {
  return !hasModelPriceData(facts) && !publicModelDescription(facts.description);
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

export function selectSeoModels<T extends SeoIndexFacts>(rows: T[], applyPolicy = true): T[] {
  // Keep the previous 2,000-model cap and candidate set, applying quality after
  // the cap so the report reproduces the old sitemap's limit on the same rows.
  return rows.filter(row => row.active && row.is_llm && row.available_api_count > 0)
    .slice(0, 2000)
    .filter(row => !isGluedModelSlug(row.slug) && (!applyPolicy || !isLowValueModel(row)));
}

export function selectSeoComparisons<T extends SeoIndexFacts>(rows: T[], applyPolicy = true): T[] {
  const candidates = rows.filter(row => row.active && row.is_llm);
  return selectIndexablePlanComparisons(candidates)
    .filter(row => !isGluedModelSlug(row.slug) && (!applyPolicy || !isLowValuePlanComparison(row)));
}

export function modelShouldIndex(row: SeoIndexFacts): boolean {
  return row.active && !isGluedModelSlug(row.slug) && !isLowValueModel(row);
}
