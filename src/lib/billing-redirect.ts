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

/**
 * Gemini 2.5 Pro / Flash (Intel 2026-11-03). The 2026-11-02 changelog and the pricing-page
 * callouts say both are deprecated, no longer selectable in AI Studio, and from 2026-12-01 every
 * API request is auto-routed to the target model and billed at its rates. The endpoint is not
 * shut down, so no shutdown_date is stored (that would make the sweep disable live channels).
 * The deprecations table still read "No shutdown date announced" on 2026-11-03.
 * Standard paid-tier USD rates per 1M tokens checked on the pricing page 2026-11-03.
 */
const GEMINI_25_SOURCE = 'https://ai.google.dev/gemini-api/docs/changelog';
const GEMINI_25_PRICING = 'https://ai.google.dev/gemini-api/docs/pricing';
const GEMINI_38_FLASH = {
  to: 'gemini-3.8-flash',
  zh: '输入 $0.75 / 输出 $3.75 / 缓存 $0.075（至 2026-12-31；2027-01-01 起 $1.50 / $7.50 / $0.15）',
  en: 'input $0.75 / output $3.75 / cached $0.075 through 2026-12-31, then $1.50 / $7.50 / $0.15 from 2027-01-01',
};
const GEMINI_35_FLASH_LITE = { to: 'gemini-3.5-flash-lite', zh: '输入 $0.30 / 输出 $2.50 / 缓存 $0.03', en: 'input $0.30 / output $2.50 / cached $0.03' };
export /**
 * Gemini 3.5 Flash / 3.7 Flash (deprecations table, checked 2026-11-11). Shutdown column is
 * "N/A": the endpoint is not shutting down, AI Studio can no longer select the model, and API
 * requests auto-route to the next Flash. No announcement date is published (the other column is
 * the release date), so deprecated_at is not invented. Same no-shutdown_date rule as Gemini 2.5.
 */
const GEMINI_FLASH_ROUTE_SOURCE = 'https://ai.google.dev/gemini-api/docs/deprecations';
const GEMINI_35_TO_36 = {
  from: 'gemini-3.5-flash', to: 'gemini-3.6-flash',
  zh: '输入 $0.75 / 输出 $3.75 / 缓存 $0.075（至 2026-12-31；2027-01-01 起 $1.50 / $7.50 / $0.15）',
  en: 'input $0.75 / output $3.75 / cached $0.075 through 2026-12-31, then $1.50 / $7.50 / $0.15 from 2027-01-01',
};
const GEMINI_37_TO_38 = {
  from: 'gemini-3.7-flash', to: 'gemini-3.8-flash',
  zh: GEMINI_35_TO_36.zh, en: GEMINI_35_TO_36.en,
};
export const GEMINI_FLASH_ROUTES: Record<string, { from: string; to: string; zh: string; en: string }> = {
  'gemini-3.5-flash': GEMINI_35_TO_36,
  'gemini-3.7-flash': GEMINI_37_TO_38,
};

const GEMINI_25_ROUTES: Record<string, { from: string; batch: boolean } & typeof GEMINI_35_FLASH_LITE> = {
  'gemini-2.5-pro': { from: 'gemini-2.5-pro', batch: false, ...GEMINI_38_FLASH },
  'google-gemini-gemini-2-5-pro-batch': { from: 'gemini-2.5-pro', batch: true, ...GEMINI_38_FLASH },
  'gemini-2.5-flash': { from: 'gemini-2.5-flash', batch: false, ...GEMINI_35_FLASH_LITE },
  'google-gemini-gemini-2-5-flash-batch': { from: 'gemini-2.5-flash', batch: true, ...GEMINI_35_FLASH_LITE },
};

function gemini25Note(slug: string, locale: string): string | null {
  const g = GEMINI_25_ROUTES[slug];
  if (!g) return null;
  if (locale === 'zh') {
    const price = g.batch ? `Batch 请求按 ${g.to} 的 Batch 价计费（见定价页）` : `${g.to} 标准付费价（每百万 token）：${g.zh}`;
    return `Google 于 2026-11-02 宣布弃用 ${g.from}，AI Studio 已不可选。自 2026-12-01 起，所有对 ${g.from} 的 API 请求会自动转发到 ${g.to}，并按 ${g.to} 的价格计费；${price}。官方建议在 12-01 前把模型名改为 ${g.to}，并注意破坏性变更：function calling 与 thought_signature 校验、thinking_level 取代 thinking_budget、移除部分采样参数和预填模型回合。本页价格仍为 ${g.from} 当前价。2026-11-03 核对。来源：${GEMINI_25_SOURCE} 与 ${GEMINI_25_PRICING}。`;
  }
  const price = g.batch ? `Batch requests bill at ${g.to} Batch rates (see the pricing page)` : `${g.to} standard paid-tier rates per 1M tokens: ${g.en}`;
  return `Google deprecated ${g.from} on 2026-11-02; it can no longer be selected in Google AI Studio. From 2026-12-01, all API requests to ${g.from} are automatically routed to ${g.to} and billed at ${g.to} rates. ${price}. Google recommends switching the model string to ${g.to} before 2026-12-01; breaking changes include function calling and thought_signature validation, thinking_level replacing thinking_budget, and removed sampling parameters and prefilled model turns. Prices on this page are still the current ${g.from} rates. Checked 2026-11-03. Sources: ${GEMINI_25_SOURCE} and ${GEMINI_25_PRICING}.`;
}

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
  const routed = GEMINI_FLASH_ROUTES[slug];
  if (routed) {
    if (locale === 'zh') {
      return `Google 弃用表：${routed.from} 在 AI Studio 已不可选，端点不关停（Shutdown 列为 N/A），API 请求自动路由到 ${routed.to}，并按 ${routed.to} 的标准付费价计费（每百万 token）：${routed.zh}。表中的发布日不是弃用公告日，官方没有另给 deprecated 日期。2026-11-11 核对。来源：${GEMINI_FLASH_ROUTE_SOURCE} 与 ${GEMINI_25_PRICING}。`;
    }
    return `Google's deprecations table: ${routed.from} can no longer be selected in Google AI Studio. The shutdown column is N/A — the endpoint is not shutting down — and API requests automatically route to ${routed.to}, billed at ${routed.to} standard paid-tier rates per 1M tokens: ${routed.en}. The other date in that row is the release date, not a deprecation announcement. Checked 2026-11-11. Sources: ${GEMINI_FLASH_ROUTE_SOURCE} and ${GEMINI_25_PRICING}.`;
  }
  const gemini = gemini25Note(slug, locale);
  if (gemini) return gemini;
  if (slug === 'deepseek-v4-flash' || slug === 'deepseek-v4-flash-vision-exp' || slug === 'deepseek-deepseek-v4-flash-vision-exp') {
    const from = slug === 'deepseek-v4-flash' ? 'deepseek-v4-flash' : 'deepseek-v4-flash-vision-exp';
    if (locale === 'zh') {
      return `DeepSeek 2026-09-10 更新：V4 Flash 与 V4 Flash Vision Exp 已退役。旧名称 ${from} 仍暂时接受，请求路由到 V4.1 Flash（API id deepseek-flash），并按当前 Flash 价计费。定价页脚注写明这两个旧名称对应的模型已退役、请求由 DeepSeek-V4.1-Flash-1017 提供。2026-11-11 核对。来源：https://api-docs.deepseek.com/updates 与 https://api-docs.deepseek.com/quick_start/pricing。`;
    }
    return `DeepSeek's 2026-09-10 changelog: V4 Flash and V4 Flash Vision Exp are retired. The old name ${from} is still accepted temporarily; requests route to V4.1 Flash (API id deepseek-flash) and are billed at the current Flash price. The pricing-page footnote says those legacy names are still accepted and the retired models' requests are served by DeepSeek-V4.1-Flash-1017. Checked 2026-11-11. Sources: https://api-docs.deepseek.com/updates and https://api-docs.deepseek.com/quick_start/pricing.`;
  }
  if (slug !== 'grok-code-fast-1') return null;
  if (locale === 'zh') {
    return '计费跳转目标待核验。迁移页总则写：2026-05-15 退役的 slug 转到 grok-4.3，并按 grok-4.3 计费。同一页的 Code workloads 与推荐表写 grok-code-fast-1 路由到 grok-build-0.1。定价页 2026-10-19 核对到的价格（每百万 token）：grok-build-0.1 在 200k 上下文以内为输入 $1.00、缓存 $0.20、输出 $2.00，200k 及以上为 $2.00 / $0.40 / $4.00；grok-4.3 在 200k 以内为 $1.25 / $0.20 / $2.50，200k 及以上为 $2.50 / $0.40 / $5.00。本站不把退役前的 $1 / $2 改写成其中任一档。来源：https://docs.x.ai/developers/migration/may-15-retirement 与 https://docs.x.ai/developers/pricing。';
  }
  return 'Billing redirect is unverified. The migration page\'s general rule says slugs retired on 2026-05-15 route to grok-4.3 and are billed as grok-4.3. The same page\'s code-workload section and recommendation table route grok-code-fast-1 to grok-build-0.1. Prices checked on the pricing page on 2026-10-19 (per 1M tokens): grok-build-0.1 under 200k context is input $1.00, cached $0.20, output $2.00, and $2.00 / $0.40 / $4.00 at 200k or above; grok-4.3 under 200k is $1.25 / $0.20 / $2.50, and $2.50 / $0.40 / $5.00 at 200k or above. The pre-retirement $1 / $2 row is left unchanged. Sources: https://docs.x.ai/developers/migration/may-15-retirement and https://docs.x.ai/developers/pricing.';
}
