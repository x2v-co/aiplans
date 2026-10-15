import type { ListPrices, UsageMix } from '../../src/lib/quota/engine';

/** CONFIG TO FILL: illustrative gpt-5-codex-ish prices, NOT verified vendor prices.
 * Replace with reviewed prices before interpreting USD values. Never auto-publish estimates.
 * No network lookup or model fallback: unknown/mixed models get no valuation.
 */
export const PRICE_CONFIG: Record<string, { prices: ListPrices; placeholder: boolean }> = {
  'gpt-5-codex': { prices: { input: 1.25, cachedInput: 0.125, output: 10 }, placeholder: true },
};
export const TARGET_MIX: UsageMix = { cacheReadPct: 97, inputPct: 2.5, outputPct: 0.5 };
/** Only satisfies measuredQuota's weekly conversion; summaries expose windowValueUsd only.
 * This is an illustrative one-window/week assumption, NOT a measured weekly allowance.
 */
export const WINDOWS_PER_WEEK = 1;
export const PLAN_TYPES: Record<string, string> = {
  pro: 'chatgpt-pro', plus: 'chatgpt-plus', team: 'chatgpt-team',
  business: 'chatgpt-business', enterprise: 'chatgpt-enterprise', free: 'chatgpt-free',
};
