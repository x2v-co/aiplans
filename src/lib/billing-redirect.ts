/**
 * Billing-routing notes for retired slugs whose official pages disagree, and for
 * deprecated slugs that are already auto-routed (and billed) as another model.
 * Shown on the model page. This is not a price: channel rows stay as scraped
 * until an SRE seed records the shutdown and the scraper stops writing them.
 */
const MIMO_ROUTES: Record<string, { from: string; to: string; zh: string; en: string }> = {
  'xiaomi-mimo-v2-5-pro': { from: 'mimo-v2.5-pro', to: 'mimo-v2.6-pro', zh: '¥3 / ¥6 / 缓存命中 ¥0.025（海外 $0.435 / $0.87 / $0.0036）', en: '¥3 / ¥6 / cache hit ¥0.025 (overseas $0.435 / $0.87 / $0.0036)' },
  'xiaomi-mimo-v2-5': { from: 'mimo-v2.5', to: 'mimo-v2.6-flash', zh: '¥1 / ¥2 / 缓存命中 ¥0.02（海外 $0.14 / $0.28 / $0.0028）', en: '¥1 / ¥2 / cache hit ¥0.02 (overseas $0.14 / $0.28 / $0.0028)' },
};
/** Moonshot K2 series: closed to new sign-ups from 2026-10-31, offline "end of December" with no exact day (checked 2026-10-29). */
export const KIMI_K2_SLUGS = new Set(['kimi-k2.6', 'kimi-k2.6-fast', 'kimi-k2.7-code', 'kimi-k2.7-code-fast', 'kimi-k2.7-code-highspeed',
  'moonshotai-kimi-k2', 'moonshotai-kimi-k2-thinking', 'moonshotai-kimi-k2-5']);
const KIMI_SOURCE = 'https://platform.moonshot.cn/docs/pricing/chat';

const MIMO_SOURCES = 'https://mimo.mi.com/docs/en-US/updates/deprecate 与 https://mimo.mi.com/static/docs/price/pay-as-you-go.md';

export function billingRedirectNote(slug: string, locale: string): string | null {
  const mimo = MIMO_ROUTES[slug];
  if (mimo) {
    if (locale === 'zh') {
      return `${mimo.from} 自 2026-10-21 10:00（UTC+8）起停用，此后用旧名请求会报错。自 2026-10-14 起（官方停用表写 10:00，表下说明写 18:00，均为 UTC+8），对 ${mimo.from} 的请求已自动路由到 ${mimo.to}，并按 ${mimo.to} 的价格计费：每百万 token 输入 / 输出 / 缓存命中 ${mimo.zh}。${mimo.from} 不支持 Batch API。2026-10-20 核对。来源：${MIMO_SOURCES}。`;
    }
    return `${mimo.from} is retired as of 2026-10-21 10:00 UTC+8; from then on, requests using the old name return an error. Since 2026-10-14 (the deprecation table says 10:00, the note below it says 18:00, both UTC+8), ${mimo.from} requests are auto-routed to ${mimo.to} and billed at ${mimo.to} prices: input / output / cache hit per 1M tokens ${mimo.en}. ${mimo.from} has no Batch API. Checked 2026-10-20. Sources: ${MIMO_SOURCES.replace(' 与 ', ' and ')}.`;
  }
  if (KIMI_K2_SLUGS.has(slug)) {
    // No shutdown_date is stored because Moonshot gives no exact day, so the regular lifecycle notice does not render.
    return locale === 'zh'
      ? `Moonshot 官方通知：K2 系列模型自 2026-10-31 起停止向新注册用户开放（已注册用户不受影响），计划于 2026 年 12 月底下线全部 K2 系列模型，官方未给出具体日期；官方迁移指引指向 Kimi K3.1 Pro。2026-10-29 核对。来源：${KIMI_SOURCE}。`
      : `Moonshot notice: the K2 series is closed to new sign-ups from 2026-10-31 (existing accounts are not affected), and all K2 series models are planned to go offline at the end of December 2026; no exact date has been given. The official migration guide points to Kimi K3.1 Pro. Checked 2026-10-29. Source: ${KIMI_SOURCE}.`;
  }
  if (slug !== 'grok-code-fast-1') return null;
  if (locale === 'zh') {
    return '计费跳转目标待核验。迁移页总则写：2026-05-15 退役的 slug 转到 grok-4.3，并按 grok-4.3 计费。同一页的 Code workloads 与推荐表写 grok-code-fast-1 路由到 grok-build-0.1。定价页 2026-10-19 核对到的价格（每百万 token）：grok-build-0.1 在 200k 上下文以内为输入 $1.00、缓存 $0.20、输出 $2.00，200k 及以上为 $2.00 / $0.40 / $4.00；grok-4.3 在 200k 以内为 $1.25 / $0.20 / $2.50，200k 及以上为 $2.50 / $0.40 / $5.00。本站不把退役前的 $1 / $2 改写成其中任一档。来源：https://docs.x.ai/developers/migration/may-15-retirement 与 https://docs.x.ai/developers/pricing。';
  }
  return 'Billing redirect is unverified. The migration page\'s general rule says slugs retired on 2026-05-15 route to grok-4.3 and are billed as grok-4.3. The same page\'s code-workload section and recommendation table route grok-code-fast-1 to grok-build-0.1. Prices checked on the pricing page on 2026-10-19 (per 1M tokens): grok-build-0.1 under 200k context is input $1.00, cached $0.20, output $2.00, and $2.00 / $0.40 / $4.00 at 200k or above; grok-4.3 under 200k is $1.25 / $0.20 / $2.50, and $2.50 / $0.40 / $5.00 at 200k or above. The pre-retirement $1 / $2 row is left unchanged. Sources: https://docs.x.ai/developers/migration/may-15-retirement and https://docs.x.ai/developers/pricing.';
}
