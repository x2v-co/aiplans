/**
 * Per-request pricing for server-side web search / fetch tools, curated from official pages.
 * Static (no DB table yet; see docs/proposals/tool-api-pricing.md). Each row cites its source.
 * Only official, published prices are listed; anything unverified is left out.
 */
export type ToolKind = 'web_search' | 'web_fetch' | 'ocr' | 'tts' | 'asr';
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
const GATEWAY_VERIFIED_AT = '2026-11-07';
const VERCEL_SEARCH = 'https://vercel.com/docs/ai-gateway/models-and-providers/web-search';
const VERCEL_SEARCH_CHANGELOG = 'https://vercel.com/changelog/ai-gateway-adds-deepseek-search-and-fetch-tools';
const BAIDU_VERIFIED_AT = '2026-10-31';
const BAIDU = 'https://cloud.baidu.com/doc/qianfan/s/1mh4sv6c4';
const BAIDU_CAMPAIGN = 'https://cloud.baidu.com/product/AI-SEARCH/campaign.html';
const BRAVE_X402 = 'https://brave.com/blog/search-api-agentic-payments/';
const BRAVE_API = 'https://brave.com/search/api/';
const OCTEN_PRICING = 'https://docs.octen.ai/overview/pricing';
const SEARCH_API_VERIFIED_AT = '2026-11-13';
const DEEPSEEK_SPEECH_VERIFIED_AT = '2026-11-14';

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
  { provider: 'DeepSeek', providerSlug: 'deepseek', tool: 'File parsing / OCR API', kind: 'ocr', pricePer1k: 1.5, currency: 'CNY',
    unit: { en: '1,000 pages', zh: '每 1,000 页' }, tokens: { en: 'Standalone API, no tokens', zh: '独立 API，不计 token' },
    note: {
      en: `US$0.225 on the English page (${DEEPSEEK_EN}). File parsing and OCR share this list price. Billed by successfully recognized pages (page_count); a recognition that fails or times out is not billed. Disconnecting does not cancel a recognition already received.`,
      zh: '英文页为 0.225 美元。文件解析与 OCR 共用此刊例价。按成功识别页数（page_count）计费；失败或超时不计费。客户端断开后，已接收的识别仍会跑完并在成功时计费。',
    },
    sourceUrl: DEEPSEEK_CN, verifiedAt: DEEPSEEK_SPEECH_VERIFIED_AT },
  { provider: 'DeepSeek', providerSlug: 'deepseek', tool: 'Text to Speech (TTS)', kind: 'tts', pricePer1k: 3, currency: 'CNY',
    unit: { en: '10,000 billed characters', zh: '每 10,000 计费字符' }, tokens: { en: 'Standalone API, no tokens', zh: '独立 API，不计 token' },
    note: {
      en: `List price. Limited-time 50% off is ¥1.5 / US$0.225; no end date is published. English list price is US$0.45 (${DEEPSEEK_EN}). A Chinese character counts as 2 billed characters; any other character (letter, digit or space) counts as 1. At most 10,000 billed characters per full-text request.`,
      zh: '刊例价。限时 5 折为 1.5 元 / 0.225 美元，官方未公布截止日期。英文刊例价为 0.45 美元。汉字计 2 个计费字符，其他字符（字母、数字、空格）计 1 个。全文请求最多 10,000 个计费字符。',
    },
    sourceUrl: DEEPSEEK_CN, verifiedAt: DEEPSEEK_SPEECH_VERIFIED_AT },
  { provider: 'DeepSeek', providerSlug: 'deepseek', tool: 'Speech to Text (ASR)', kind: 'asr', pricePer1k: 0.78, currency: 'CNY',
    unit: { en: 'hour of audio', zh: '每小时音频' }, tokens: { en: 'Standalone API, no tokens', zh: '独立 API，不计 token' },
    note: {
      en: `List price. Limited-time 50% off is ¥0.39 / US$0.058; no end date is published. English list price is US$0.116 (${DEEPSEEK_EN}). Billed by audio duration to the second; a fraction of a second counts as 1 second.`,
      zh: '刊例价。限时 5 折为 0.39 元 / 0.058 美元，官方未公布截止日期。英文刊例价为 0.116 美元。按音频时长精确到秒计费，不足 1 秒按 1 秒计。',
    },
    sourceUrl: DEEPSEEK_CN, verifiedAt: DEEPSEEK_SPEECH_VERIFIED_AT },
  { provider: 'Vercel AI Gateway', providerSlug: 'vercel-ai-gateway', tool: 'DeepSeek Search', kind: 'web_search', pricePer1k: 0.75, currency: 'USD',
    unit: { en: '1,000 billable requests', zh: '每千次可计费请求' },
    tokens: { en: 'Host model tokens billed separately', zh: '宿主模型 token 另计' },
    note: {
      en: `Gateway channel, not a new DeepSeek list price. Docs table: $0.75 per 1,000 billable requests, the same figure as the DeepSeek English page. Billable when a successful request returns a nonempty results array, including results filtered before they reach the model. Failed requests, timeouts, and empty results are not billed. Result count does not change the price. Changelog: ${VERCEL_SEARCH_CHANGELOG}`,
      zh: `Vercel AI Gateway 渠道，不是另一套 DeepSeek 刊例价。文档表为每千次可计费请求 0.75 美元，与 DeepSeek 英文页相同。成功且返回非空结果数组才计费，含在送达模型前被滤掉的结果。失败、超时、空结果不计工具费。结果条数不改变价格。更新日志：${VERCEL_SEARCH_CHANGELOG}`,
    },
    sourceUrl: VERCEL_SEARCH, verifiedAt: GATEWAY_VERIFIED_AT },
  { provider: 'Vercel AI Gateway', providerSlug: 'vercel-ai-gateway', tool: 'DeepSeek Fetch', kind: 'web_fetch', pricePer1k: 0.75, currency: 'USD',
    unit: { en: '1,000 billable requests', zh: '每千次可计费请求' },
    tokens: { en: 'Host model tokens billed separately', zh: '宿主模型 token 另计' },
    note: {
      en: `Gateway channel. Docs table: $0.75 per 1,000 billable requests. Billable when a successful request returns nonempty page content. Failed requests, timeouts, and empty results are not billed. Changelog: ${VERCEL_SEARCH_CHANGELOG}`,
      zh: `Vercel AI Gateway 渠道。文档表为每千次可计费请求 0.75 美元。成功且返回非空页面内容才计费。失败、超时、空结果不计工具费。更新日志：${VERCEL_SEARCH_CHANGELOG}`,
    },
    sourceUrl: VERCEL_SEARCH, verifiedAt: GATEWAY_VERIFIED_AT },
  { provider: 'Baidu AI Cloud', providerSlug: 'baidu', tool: 'Baidu Search API (Enhanced / 增强版)', kind: 'web_search', pricePer1k: 40, currency: 'CNY',
    unit: PER_CALL, tokens: { en: 'Standalone API, no tokens', zh: '独立 API，不计 token' },
    note: { en: `Domestic content list price: ¥0.04/call. Limited-time campaign 2026-10-30 to 2026-12-31: ¥4.9 per 1,000 calls (prepaid pack, up to 1M calls cumulative; overage billed at list price). 1,500 free calls/month; default 3 QPS. Overseas content: ¥0.072/call. Campaign: ${BAIDU_CAMPAIGN}`,
      zh: `国内内容刊例价 0.04 元/次。限时活动 2026-10-30 至 2026-12-31：量包 4.9 元/千次（累计限 100 万次，超额按刊例价）。每月免费 1,500 次；默认 3QPS。国外内容 0.072 元/次。活动页：${BAIDU_CAMPAIGN}` },
    sourceUrl: BAIDU, verifiedAt: BAIDU_VERIFIED_AT },
  { provider: 'Baidu AI Cloud', providerSlug: 'baidu', tool: 'Baidu Search API (Flagship / 旗舰版)', kind: 'web_search', pricePer1k: 72, currency: 'CNY',
    unit: PER_CALL, tokens: { en: 'Standalone API, no tokens', zh: '独立 API，不计 token' },
    note: { en: `Domestic content list price: ¥0.072/call. Limited-time campaign 2026-10-30 to 2026-12-31: ¥9.9 per 1,000 calls (invite code required). 1,500 free calls/month; default 3 QPS. Overseas content: ¥0.072/call. Campaign: ${BAIDU_CAMPAIGN}`,
      zh: `国内内容刊例价 0.072 元/次。限时活动 2026-10-30 至 2026-12-31：量包 9.9 元/千次（需邀请码）。每月免费 1,500 次；默认 3QPS。国外内容 0.072 元/次。活动页：${BAIDU_CAMPAIGN}` },
    sourceUrl: BAIDU, verifiedAt: BAIDU_VERIFIED_AT },
  { provider: 'Brave', providerSlug: 'brave', tool: 'Search API (x402)', kind: 'web_search', pricePer1k: 5, currency: 'USD',
    unit: { en: '1,000 requests', zh: '每千次请求' }, tokens: { en: 'Standalone API, no tokens', zh: '独立 API，不计 token' },
    note: {
      en: `x402 pay-per-request (Base USDC); no account or API key. A request without payment gets HTTP 402, then is retried after payment. LLM Context, web, news, image, video, and local are all $5 per 1,000 ($0.005/request). Gas fees are waived for a limited time. Same $5 per 1,000 list price as the published Search / LLM Context plan on ${BRAVE_API} (account plan includes $5 free credits/month). Answers is a different product ($4 per 1,000 plus $5/M tokens) and is not this row.`,
      zh: `x402 按次付费（Base 链 USDC），无需账号或 API key。未付款请求返回 HTTP 402，付款后重试。LLM Context、web、news、image、video、local 均为每千次 5 美元（每次 0.005 美元）。限时免除 gas。与刊例页 ${BRAVE_API} 的 Search / LLM Context 每千次 5 美元相同（账号方案每月送 5 美元额度）。Answers 是另一产品（每千次 4 美元另加每百万 token 5 美元），不在本行。`,
    },
    sourceUrl: BRAVE_X402, verifiedAt: SEARCH_API_VERIFIED_AT },
  { provider: 'Octen', providerSlug: 'octen', tool: 'Web Search', kind: 'web_search', pricePer1k: 1, currency: 'USD',
    unit: { en: '1,000 calls', zh: '每千次调用' }, tokens: { en: 'Standalone API, no tokens', zh: '独立 API，不计 token' },
    note: {
      en: 'Pay-as-you-go $1 per 1,000 calls (80% off the $5 list price). Full content $0.50 per 1,000 results; the first 10 results per search are free. Personal prepaid Search Plans (one plan at a time, Search or QPS): Standard $20/month ($50/quarter, $180/year) unlimited Web Search plus 1,000 image searches/month, no overage; Plus $100/month ($1,000/year) plus 5,000 image searches/month. Requests may queue when busy; unserved requests are not charged. Extra image search, full content (no free results on the plan), and other APIs stay pay-as-you-go.',
      zh: '按量价每千次 1 美元（刊例 5 美元，八折）。全文每千条结果 0.50 美元，每次搜索前 10 条免费。个人预付费 Search Plan（同时只能有 Search 或 QPS 一种）：Standard 20 美元/月（50 美元/季、180 美元/年）不限量 Web Search + 每月 1,000 次图片搜索、无超额；Plus 100 美元/月（1,000 美元/年）+ 每月 5,000 次图片搜索。忙时可能排队，未能服务的请求不计费。额外图片搜索、套餐内全文（无免费条数）及其他 API 仍按量计费。',
    },
    sourceUrl: OCTEN_PRICING, verifiedAt: SEARCH_API_VERIFIED_AT },
  { provider: 'Octen', providerSlug: 'octen', tool: 'Pulse Search (lite)', kind: 'web_search', pricePer1k: 0.1, currency: 'USD',
    unit: { en: '1,000 calls', zh: '每千次调用' }, tokens: { en: 'Standalone API, no tokens', zh: '独立 API，不计 token' },
    note: {
      en: 'Official table: $0.1 / 1k calls. A standard call is billed as lite when page details are not available for any result. Search Plan details are on the Web Search row.',
      zh: '官方表为每千次 0.1 美元。若所有结果都没有页面详情，standard 调用按 lite 计费。Search Plan 详见 Web Search 行。',
    },
    sourceUrl: OCTEN_PRICING, verifiedAt: SEARCH_API_VERIFIED_AT },
  { provider: 'Octen', providerSlug: 'octen', tool: 'Pulse Search (standard)', kind: 'web_search', pricePer1k: 0.2, currency: 'USD',
    unit: { en: '1,000 calls', zh: '每千次调用' }, tokens: { en: 'Standalone API, no tokens', zh: '独立 API，不计 token' },
    note: {
      en: 'Official table: $0.2 / 1k calls, plus full content $0.5 / 1k results. The full content of the first result per search is free; only additional results are billed. Search Plan details are on the Web Search row.',
      zh: '官方表为每千次 0.2 美元，另加全文每千条结果 0.5 美元。每次搜索第一条全文免费，只对额外结果计费。Search Plan 详见 Web Search 行。',
    },
    sourceUrl: OCTEN_PRICING, verifiedAt: SEARCH_API_VERIFIED_AT },
];

export function formatToolPrice(row: ToolApiPrice, locale: 'en' | 'zh'): string {
  if (row.pricePer1k === 0) return locale === 'zh' ? '不另收费' : 'No per-call fee';
  const symbol = row.currency === 'CNY' ? '¥' : '$';
  return `${symbol}${row.pricePer1k} / ${row.unit[locale]}`;
}
