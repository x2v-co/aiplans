/**
 * Billing-routing notes for retired slugs whose official pages disagree.
 * Shown on the model page. This is not a price: channel rows stay as scraped
 * until an SRE seed records the shutdown and the scraper stops writing them.
 */
export function billingRedirectNote(slug: string, locale: string): string | null {
  if (slug !== 'grok-code-fast-1') return null;
  if (locale === 'zh') {
    return '计费跳转目标待核验。迁移页总则写：2026-05-15 退役的 slug 转到 grok-4.3，并按 grok-4.3 计费。同一页的 Code workloads 与推荐表写 grok-code-fast-1 路由到 grok-build-0.1。定价页 2026-10-19 核对到的价格（每百万 token）：grok-build-0.1 在 200k 上下文以内为输入 $1.00、缓存 $0.20、输出 $2.00，200k 及以上为 $2.00 / $0.40 / $4.00；grok-4.3 在 200k 以内为 $1.25 / $0.20 / $2.50，200k 及以上为 $2.50 / $0.40 / $5.00。本站不把退役前的 $1 / $2 改写成其中任一档。来源：https://docs.x.ai/developers/migration/may-15-retirement 与 https://docs.x.ai/developers/pricing。';
  }
  return 'Billing redirect is unverified. The migration page\'s general rule says slugs retired on 2026-05-15 route to grok-4.3 and are billed as grok-4.3. The same page\'s code-workload section and recommendation table route grok-code-fast-1 to grok-build-0.1. Prices checked on the pricing page on 2026-10-19 (per 1M tokens): grok-build-0.1 under 200k context is input $1.00, cached $0.20, output $2.00, and $2.00 / $0.40 / $4.00 at 200k or above; grok-4.3 under 200k is $1.25 / $0.20 / $2.50, and $2.50 / $0.40 / $5.00 at 200k or above. The pre-retirement $1 / $2 row is left unchanged. Sources: https://docs.x.ai/developers/migration/may-15-retirement and https://docs.x.ai/developers/pricing.';
}
