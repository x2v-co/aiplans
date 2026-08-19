/**
 * Model series / version helpers.
 *
 * A "series" is a model line whose members differ only by version number —
 * claude-opus-4.5 and claude-opus-4.6 are the same series, gpt-5.2 and
 * gpt-5.2-high are not (the suffix is part of the identity, except for a few
 * reasoning-effort markers that we deliberately fold together).
 *
 * Two callers depend on identical behaviour, which is why this lives in its
 * own module:
 *   - /api/products, when collapsing the featured list to current versions
 *   - scripts/materialize-model-plan-mappings.ts, for `current_only` selectors
 * A second implementation would silently drift and start mapping stale model
 * versions into subscription plans.
 */

export type ModelSeries = {
  key: string;
  version: number[];
};

export function getModelSeries(slug: string): ModelSeries {
  const normalized = slug.toLowerCase().replace(/_/g, '-');
  const match = normalized.match(/^(.*?)(?:^|-)(?:v)?(\d+(?:\.\d+)*)(?:-(.*))?$/);
  if (!match) return { key: normalized, version: [] };

  const prefix = match[1].replace(/-$/, '');
  const suffix = (match[3] || '').replace(/-(?:high|thinking|latest|preview|instant|reasoning|xhigh)$/g, '');
  return {
    key: `${prefix}|${suffix}`,
    version: match[2].split('.').map(Number),
  };
}

export function compareVersions(left: number[], right: number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * Keep only the newest member of each series.
 *
 * `rank` breaks ties between two entries carrying the same version number
 * (e.g. a duplicated slug variant): the higher rank wins. Callers that have
 * no meaningful tiebreaker can omit it.
 */
export function pickNewestPerSeries<T>(
  items: T[],
  slugOf: (item: T) => string,
  rank: (item: T) => number = () => 0,
): T[] {
  const newest = new Map<string, { item: T; version: number[] }>();

  for (const item of items) {
    const series = getModelSeries(slugOf(item));
    const current = newest.get(series.key);
    const versionDiff = current ? compareVersions(series.version, current.version) : 1;

    if (!current || versionDiff > 0 || (versionDiff === 0 && rank(item) > rank(current.item))) {
      newest.set(series.key, { item, version: series.version });
    }
  }

  return [...newest.values()].map(({ item }) => item);
}
