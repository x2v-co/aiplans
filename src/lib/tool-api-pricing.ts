/**
 * Per-request pricing for server-side web search / fetch tools, curated from official pages.
 * Static (no DB table yet; see docs/proposals/tool-api-pricing.md). Each row cites its source.
 * Only official, published prices are listed; anything unverified is left out.
 */
export type ToolKind = 'web_search' | 'web_fetch';
export interface ToolApiPrice {
  provider: string;
  providerSlug: string;
  tool: string;
  kind: ToolKind;
  /** Price per 1,000 billable units, in `currency`. 0 = no per-call fee (tokens only). */
  pricePer1k: number;
  currency: 'USD' | 'CNY';
  unit: { en: string; zh: string };
  tokens: { en: string; zh: string };
  note?: { en: string; zh: string };
  sourceUrl: string;
  verifiedAt: string;
}

const V = '2026-10-18';
const ANTHROPIC = 'https://platform.claude.com/docs/en/about-claude/pricing';
const OPENAI = 'https://developers.openai.com/api/docs/pricing';
const GOOGLE = 'https://ai.google.dev/gemini-api/docs/pricing';
const XAI = 'https://docs.x.ai/docs/pricing';
const DEEPSEEK_CN = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing';
const DEEPSEEK_EN = 'https://api-docs.deepseek.com/quick_start/pricing';
const PLUS_TOKENS = { en: 'Plus search content tokens at model rates', zh: '另按模型价格计搜索内容 token' };
const TOKENS_ONLY = { en: 'Fetched content billed as input tokens', zh: '抓取内容按输入 token 计费' };
const PER_CALL = { en: '1,000 calls', zh: '每千次调用' };

export const TOOL_API_PRICES: ToolApiPrice[] = [
  { provider: 'Anthropic', providerSlug: 'anthropic', tool: 'Web search', kind: 'web_search', pricePer1k: 10, currency: 'USD',
    unit: { en: '1,000 searches', zh: '每千次搜索' }, tokens: PLUS_TOKENS,
    note: { en: 'Each search counts once regardless of results; errors are not billed.', zh: '每次搜索计一次，与结果条数无关；出错不计费。' },
    sourceUrl: ANTHROPIC, verifiedAt: V },
  { provider: 'Anthropic', providerSlug: 'anthropic', tool: 'Web fetch', kind: 'web_fetch', pricePer1k: 0, currency: 'USD',
    unit: PER_CALL, tokens: TOKENS_ONLY,
    note: { en: 'No additional charge beyond standard token costs.', zh: '除标准 token 费用外不另收费。' }, sourceUrl: ANTHROPIC, verifiedAt: V },
  { provider: 'OpenAI', providerSlug: 'openai', tool: 'Web search', kind: 'web_search', pricePer1k: 10, currency: 'USD',
    unit: PER_CALL, tokens: PLUS_TOKENS,
    note: { en: 'All models; gpt-4o-mini / gpt-4.1-mini bill a fixed 8,000 input-token block per call.', zh: '适用所有模型；gpt-4o-mini、gpt-4.1-mini 每次固定按 8,000 输入 token 计。' },
    sourceUrl: OPENAI, verifiedAt: V },
  { provider: 'OpenAI', providerSlug: 'openai', tool: 'Web search preview (non-reasoning models)', kind: 'web_search', pricePer1k: 25, currency: 'USD',
    unit: PER_CALL, tokens: { en: 'Search content tokens are free', zh: '搜索内容 token 免费' }, sourceUrl: OPENAI, verifiedAt: V },
  { provider: 'Google', providerSlug: 'google', tool: 'Grounding with Google Search (Gemini 3+)', kind: 'web_search', pricePer1k: 14, currency: 'USD',
    unit: { en: '1,000 search queries', zh: '每千次搜索查询' }, tokens: { en: 'Retrieved context not billed as input', zh: '检索内容不计输入 token' },
    note: { en: '5,000 free requests/month shared across Gemini 3+ models; one prompt may trigger several queries.', zh: 'Gemini 3 及以上每月共享 5,000 次免费；一次请求可能触发多次查询，按次计费。' },
    sourceUrl: GOOGLE, verifiedAt: V },
  { provider: 'Google', providerSlug: 'google', tool: 'Grounding with Google Search (Gemini 2.5)', kind: 'web_search', pricePer1k: 35, currency: 'USD',
    unit: { en: '1,000 grounded prompts', zh: '每千次 grounded 请求' }, tokens: { en: 'Retrieved context not billed as input', zh: '检索内容不计输入 token' },
    note: { en: '1,500 requests/day free on the paid tier.', zh: '付费层每天 1,500 次免费。' }, sourceUrl: GOOGLE, verifiedAt: V },
  { provider: 'Google', providerSlug: 'google', tool: 'URL context', kind: 'web_fetch', pricePer1k: 0, currency: 'USD',
    unit: PER_CALL, tokens: TOKENS_ONLY, sourceUrl: GOOGLE, verifiedAt: V },
  { provider: 'xAI', providerSlug: 'xai', tool: 'Web search', kind: 'web_search', pricePer1k: 5, currency: 'USD',
    unit: PER_CALL, tokens: { en: 'Plus tokens at model rates', zh: '另按模型价格计 token' },
    note: { en: 'Includes browsing pages and image search.', zh: '含网页浏览与图片搜索。' }, sourceUrl: XAI, verifiedAt: V },
  { provider: 'DeepSeek', providerSlug: 'deepseek', tool: 'Search API', kind: 'web_search', pricePer1k: 5, currency: 'CNY',
    unit: { en: '1,000 successful requests', zh: '每千次成功请求' }, tokens: { en: 'Standalone API, no tokens', zh: '独立 API，不计 token' },
    note: { en: 'US$0.75 on the English page. Server-side calls from Claude Code / Codex are free until 2026-11-01 00:00 Beijing time.', zh: '英文页为 0.75 美元。经 Claude Code / Codex 服务端调用的部分在北京时间 2026-11-01 00:00 前不计费。' },
    sourceUrl: DEEPSEEK_CN, verifiedAt: V },
  { provider: 'DeepSeek', providerSlug: 'deepseek', tool: 'Fetch API', kind: 'web_fetch', pricePer1k: 5, currency: 'CNY',
    unit: { en: '1,000 successful requests', zh: '每千次成功请求' }, tokens: { en: 'Standalone API, no tokens', zh: '独立 API，不计 token' },
    note: { en: `US$0.75 on the English page (${DEEPSEEK_EN}). Same free period as Search.`, zh: '英文页为 0.75 美元。免费期同 Search。' },
    sourceUrl: DEEPSEEK_CN, verifiedAt: V },
];

export function formatToolPrice(row: ToolApiPrice, locale: 'en' | 'zh'): string {
  if (row.pricePer1k === 0) return locale === 'zh' ? '不另收费' : 'No per-call fee';
  const symbol = row.currency === 'CNY' ? '¥' : '$';
  return `${symbol}${row.pricePer1k} / ${row.unit[locale]}`;
}
