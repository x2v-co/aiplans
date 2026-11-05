import type { ModelSelector } from '../../src/lib/plan-selector';

/**
 * `{ only_extra: true, extra: [] }` is the deliberate "no current entitlements" selector used for
 * superseded plans kept addressable as history (claude-max-5x/20x → claude-max/ultra 2026-10-31,
 * Kimi April tiers 2026-10-30). Resolving to 0 models is the intended result, not a broken rule.
 */
export function isIntentionallyEmptySelector(selector: ModelSelector | null | undefined): boolean {
  if (!selector || selector.only_extra !== true) return false;
  const keys = Object.keys(selector).filter(k => !['only_extra', 'extra'].includes(k));
  return keys.length === 0 && Array.isArray(selector.extra) && selector.extra.length === 0;
}
