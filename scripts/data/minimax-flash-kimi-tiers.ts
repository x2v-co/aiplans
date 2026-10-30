import type { ModelSelector } from '../../src/lib/plan-selector';

export const VERIFIED_275 = '2026-10-30T00:00:00.000Z';
export const MINIMAX_FLASH = 'minimax-m3.1-flash';
export const MINIMAX_FLASH_ALIASES = ['minimax-m3.1', 'minimax-minimax-m3-1-flash'];
export const MINIMAX_SOURCE_275 = 'https://platform.minimax.io/docs/pricing/overview';
export const MINIMAX_CN_SOURCE_275 = 'https://platform.minimax.cn/docs/pricing/overview';
export const KIMI_SOURCE_275 = 'https://www.kimi.com/resources/kimi-k3-1-pro-pricing';
export const KIMI_HIGHSPEED = 'kimi-k3.1-pro-highspeed';
export const KIMI_PRO = 'moonshotai-kimi-k3-1-pro';
export const KIMI_TIERS_275 = [
  { tier: 'free', name: 'Free', price: 0 },
  { tier: 'go', name: 'Go', price: 39 },
  { tier: 'plus', name: 'Plus', price: 79 },
  { tier: 'pro', name: 'Pro', price: 159 },
  { tier: 'max', name: 'Max', price: 559 },
  { tier: 'ultra', name: 'Ultra', price: 1119 },
] as const;
export const KIMI_LEGACY_MARKER = '[aiplans:superseded-by kimi-2026-10]';
export const KIMI_PRICE_CAVEAT = 'Official article labels these figures as annual-billing monthly equivalents; standalone monthly billing and annual totals remain unverified (2026-10-30).';

export function kimiSelector275(tier: string): ModelSelector {
  // Closed entitlement list: do not infer access from other Kimi API SKUs.
  return { only_extra: true, extra: [KIMI_PRO,
    ...(['pro', 'max', 'ultra'].includes(tier) ? [KIMI_HIGHSPEED] : [])] };
}
export const KIMI_LEGACY_SELECTOR: ModelSelector = { only_extra: true, extra: [] };
