/**
 * Rule-based model selection for subscription plans.
 *
 * `plans.model_selector` (jsonb) describes *which models a plan includes* as a
 * rule instead of a hand-maintained slug list. The old list
 * (`scripts/config/plan-model-slugs.ts`) drifted badly: 18 of its plan slugs no
 * longer existed, 19 live plans were absent from it, and every new model release
 * silently dropped out of every plan until someone edited the file. A rule keeps
 * up on its own.
 *
 * Both `scripts/materialize-model-plan-mappings.ts` (which writes the mappings)
 * and `scripts/audit-data.ts` (which checks them) evaluate selectors through
 * this module, so a selector can never mean two different things.
 */

import { pickNewestPerSeries } from './model-series';

export type ModelSelector = {
  /** Producer provider slugs whose models are candidates. Defaults to the plan's own provider. */
  providers?: string[];
  /** Slug prefixes, matched at a `-` or `.` boundary: 'claude-opus' matches 'claude-opus-4.8'. */
  families?: string[];
  /** Keep only the newest version of each series. Defaults to false — a page for an older version still needs its plans. */
  current_only?: boolean;
  /** Arena ELO floor. Models with no ELO are dropped when this is set. */
  min_elo?: number;
  /** Explicit slugs to include regardless of provider/family/ELO (cross-vendor bundles). */
  extra?: string[];
  /** Globs to remove, e.g. 'claude-opus-*'. Applied last, so it also overrides `extra`. */
  exclude?: string[];
};

export type SelectableModel = {
  id: number;
  slug: string;
  /** Slugs of every provider in the model's `provider_ids` array. */
  providerSlugs: string[];
  elo: number | null;
};

/**
 * Slug shapes that exist only as API price rows, never as subscription
 * entitlements: Batch API variants (50% off async pricing) and free-tier API
 * listings. No selector should have to remember to exclude these, and a plan
 * claiming to "include gpt-5.5 (batch)" would be nonsense.
 *
 * `(free)` must keep its parentheses — that is the aggregator-listing marker.
 * A bare `-free` suffix is left alone in case a model is genuinely named that.
 */
const NON_SUBSCRIPTION_SLUG = [/-\(?batch\)?$/, /-\(free\)$/];

export function isSubscribableSlug(slug: string): boolean {
  const normalized = slug.toLowerCase();
  return !NON_SUBSCRIPTION_SLUG.some((pattern) => pattern.test(normalized));
}

/** Prefix match at a component boundary, so 'gpt-5' matches 'gpt-5.5' and 'gpt-5-mini' but not 'gpt-55'. */
export function matchesFamily(slug: string, family: string): boolean {
  const model = slug.toLowerCase();
  const prefix = family.toLowerCase();
  if (model === prefix) return true;
  return model.startsWith(`${prefix}-`) || model.startsWith(`${prefix}.`);
}

/** Glob match supporting `*` only, anchored at both ends. */
export function matchesGlob(slug: string, pattern: string): boolean {
  const escaped = pattern
    .toLowerCase()
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(slug.toLowerCase());
}

export type SelectorResolution = {
  models: SelectableModel[];
  /** `extra` entries that matched no known model — a config typo, not an empty result. */
  unknownExtra: string[];
  /** `exclude` patterns that matched nothing — dead config worth cleaning up. */
  unusedExclude: string[];
};

/**
 * Resolve a selector against the full model catalog.
 *
 * Returned models are ordered most-prominent-first (highest ELO, then slug), so
 * the caller can write the array index straight into `model_plan_mapping.priority`
 * (consumers sort `priority ASC`).
 */
export function resolveSelector(
  selector: ModelSelector | null | undefined,
  catalog: SelectableModel[],
  defaultProviders: string[] = [],
): SelectorResolution {
  if (!selector) {
    return { models: [], unknownExtra: [], unusedExclude: [] };
  }

  const bySlug = new Map(catalog.map((model) => [model.slug.toLowerCase(), model]));
  const providers = (selector.providers?.length ? selector.providers : defaultProviders)
    .map((slug) => slug.toLowerCase());

  let candidates = catalog.filter(
    (model) =>
      isSubscribableSlug(model.slug) &&
      model.providerSlugs.some((slug) => providers.includes(slug.toLowerCase())),
  );

  if (selector.families?.length) {
    const families = selector.families;
    candidates = candidates.filter((model) =>
      families.some((family) => matchesFamily(model.slug, family)),
    );
  }

  if (typeof selector.min_elo === 'number') {
    const floor = selector.min_elo;
    candidates = candidates.filter((model) => model.elo != null && model.elo >= floor);
  }

  if (selector.current_only) {
    candidates = pickNewestPerSeries(
      candidates,
      (model) => model.slug,
      (model) => model.elo || 0,
    );
  }

  const selected = new Map(candidates.map((model) => [model.slug.toLowerCase(), model]));

  // `extra` bypasses every filter above — it exists for cross-vendor bundles
  // (the Bailian and Volcengine coding plans resell GLM / Kimi / DeepSeek).
  const unknownExtra: string[] = [];
  for (const raw of selector.extra ?? []) {
    const model = bySlug.get(raw.toLowerCase());
    if (!model) {
      unknownExtra.push(raw);
      continue;
    }
    selected.set(model.slug.toLowerCase(), model);
  }

  const unusedExclude: string[] = [];
  for (const pattern of selector.exclude ?? []) {
    const hits = [...selected.keys()].filter((slug) => matchesGlob(slug, pattern));
    if (hits.length === 0) {
      unusedExclude.push(pattern);
      continue;
    }
    for (const slug of hits) selected.delete(slug);
  }

  const models = [...selected.values()].sort(
    (left, right) => (right.elo || 0) - (left.elo || 0) || left.slug.localeCompare(right.slug),
  );

  return { models, unknownExtra, unusedExclude };
}
