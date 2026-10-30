import type { ModelSelector } from '../../src/lib/plan-selector';

export const VERIFIED_275 = '2026-10-30T00:00:00.000Z';
export const MINIMAX_FLASH = 'minimax-m3.1-flash';
export const MINIMAX_FLASH_ALIASES = ['minimax-m3.1', 'minimax-minimax-m3-1-flash'];
export const MINIMAX_SOURCE_275 = 'https://platform.minimax.io/docs/pricing/overview';
export const MINIMAX_CN_SOURCE_275 = 'https://platform.minimax.cn/docs/pricing/overview';
export const KIMI_SOURCE_275 = 'https://www.kimi.com/membership/pricing';
export const KIMI_HIGHSPEED = 'kimi-k3.1-pro-highspeed';
export const KIMI_PRO = 'moonshotai-kimi-k3-1-pro';
export const KIMI_TIERS_275 = [
  { tier: 'free', name: 'Free', price: 0, price_yearly_monthly: 0, annual_price: null,
    notes: 'K3.1 Pro: limited use on Kimi web/Kimi Work; numerical allowance unverified.' },
  { tier: 'go', name: 'Go', price: 49, price_yearly_monthly: 39, annual_price: 468,
    notes: 'More agent credits (base).' },
  { tier: 'plus', name: 'Plus', price: 99, price_yearly_monthly: 79, annual_price: 948,
    notes: '2x agent credits; includes Kimi Code.' },
  { tier: 'pro', name: 'Pro', price: 199, price_yearly_monthly: 159, annual_price: 1908,
    notes: '4x agent credits; includes Kimi Code, Agent multitasking, K3.1 Pro Highspeed.' },
  { tier: 'max', name: 'Max', price: 699, price_yearly_monthly: 559, annual_price: 6708,
    notes: '14x agent credits; includes Kimi Code, Agent multitasking, K3.1 Pro Highspeed.' },
  { tier: 'ultra', name: 'Ultra', price: 1399, price_yearly_monthly: 1119, annual_price: 13428,
    notes: '28x agent credits; includes Kimi Code, Agent multitasking, K3.1 Pro Highspeed.' },
] as const;
export const KIMI_LEGACY_MARKER = '[aiplans:superseded-by kimi-2026-10]';

export function kimiSelector275(tier: string): ModelSelector {
  // Closed entitlement list: do not infer access from other Kimi API SKUs.
  return { only_extra: true, extra: [KIMI_PRO,
    ...(['pro', 'max', 'ultra'].includes(tier) ? [KIMI_HIGHSPEED] : [])] };
}
export const KIMI_LEGACY_SELECTOR: ModelSelector = { only_extra: true, extra: [] };
