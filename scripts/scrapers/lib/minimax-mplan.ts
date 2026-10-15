/** Parse MiniMax M Plan regular monthly prices (Go / Explore / Build). */
export const MPLAN_TIERS = ['Go', 'Explore', 'Build'] as const;
export type MPlanTier = typeof MPLAN_TIERS[number];

/**
 * Source: the M Plan monthly-offer doc (markdown). Its table lists each tier's
 * regular price ("原价" / "Regular price"), e.g. "| Go | 5 折 | ¥49/月 |" or
 * "| Go | 50% off | \\$22/month |". The old Token Plan (Plus/Max/Ultra) page
 * redirects to M Plan since 2026-10 and has no prices.
 */
export function parseMPlanPrices(markdown: string, currency: 'CNY' | 'USD'): Record<MPlanTier, number> | null {
  const symbol = currency === 'CNY' ? '[¥￥]' : '\\\\?\\$';
  const unit = currency === 'CNY' ? '/\\s*月' : '/\\s*month';
  const out: Partial<Record<MPlanTier, number>> = {};
  for (const tier of MPLAN_TIERS) {
    const re = new RegExp(`^\\|\\s*${tier}\\s*\\|[^\\n]*?${symbol}\\s*([\\d.]+)\\s*${unit}\\s*\\|\\s*$`, 'im');
    const m = markdown.match(re);
    const price = m ? Number(m[1]) : NaN;
    if (!Number.isFinite(price) || price <= 0) return null;
    out[tier] = price;
  }
  return out as Record<MPlanTier, number>;
}
