import { isPrimaryModelVariant, modelFreshnessTime } from './model-freshness';
import { pickNewestPerSeries } from './model-series';

export type PlanComparisonCandidate = {
  slug: string;
  plan_count: number;
  released_at?: string | Date | null;
  updated_at?: string | Date | null;
};

/**
 * Keep pages that provide a real comparison, then collapse old releases whose
 * subscription entitlement is represented by the newest model in that series.
 */
export function selectIndexablePlanComparisons<T extends PlanComparisonCandidate>(items: T[]): T[] {
  const meaningful = items.filter(
    (item) => item.plan_count >= 2 && isPrimaryModelVariant(item.slug),
  );

  return pickNewestPerSeries(
    meaningful,
    (item) => item.slug,
    (item) => modelFreshnessTime({
      slug: item.slug,
      released_at: item.released_at,
      created_at: item.updated_at,
    }),
  );
}
