import { effectivePrice, type PriceSchedule } from '@/lib/effective-price';
import { sql, TEXT_ARRAY } from '@/lib/db';
import { convertToUSD } from '@/lib/currency-conversion';
import type { CurrencyCode } from '@/lib/currency';
import { formatModelName } from '@/lib/model-names';
import type { Locale } from '@/lib/seo';

export type PricingGuideSlug =
  | 'glm-chatglm-api-pricing'
  | 'claude-anthropic-pricing'
  | 'grok-pricing'
  | 'kimi-api-pricing'
  | 'openai-api-pricing'
  | 'cursor-x-subscription-pricing';

type LocalizedText = Record<Locale, string>;

export type PricingGuide = {
  slug: PricingGuideSlug;
  title: LocalizedText;
  description: LocalizedText;
  intro: LocalizedText;
  queryPatterns: string[];
  priceTable?: false;
  planTable?: Array<{
    plan: LocalizedText;
    monthlyPrice: LocalizedText;
    includedUsage: LocalizedText;
    thirdPartyModels: LocalizedText;
  }>;
  providerSlugs: string[];
  sections: Array<{ heading: LocalizedText; body: LocalizedText }>;
  faqs?: Array<{ question: LocalizedText; answer: LocalizedText }>;
  sources?: Array<{ label: LocalizedText; url: string }>;
  reviewedAt?: string;
};

/**
 * Single definition of the OpenAI model family (incl. third-party gpt-oss hosting).
 * Used by both the guide SQL (queryPatterns) and guideForModelSlug() internal links.
 */
export const OPENAI_MODEL_SLUG_PREFIXES = ['gpt-', 'openai-gpt-', '~openai-gpt-'] as const;

/** Strip known vendor/aggregator prefixes so 'openai-gpt-5' / '~openai-gpt-oss-20b' → 'gpt-…'. */
export function normalizeOpenAIModelSlug(modelSlug: string): string {
  return modelSlug.toLowerCase().replace(/^~/, '').replace(/^openai-/, '');
}

export function isOpenAIModelSlug(modelSlug: string): boolean {
  const slug = modelSlug.toLowerCase();
  return OPENAI_MODEL_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix))
    && normalizeOpenAIModelSlug(slug).startsWith('gpt-');
}

export const PRICING_GUIDES: Record<PricingGuideSlug, PricingGuide> = {
  'openai-api-pricing': {
    slug: 'openai-api-pricing',
    title: { en: 'OpenAI API Pricing: GPT Costs vs ChatGPT Plans', zh: 'OpenAI API 价格指南：GPT 成本与 ChatGPT 订阅区别' },
    description: {
      en: 'Compare tracked GPT API prices across channels. Calculate input and output token costs, check caching and batch rules, and separate API billing from ChatGPT plans.',
      zh: '对比已追踪的 GPT API 渠道价格，计算输入与输出 token 成本，核对缓存、批处理和长上下文计费，并区分 API 账单与 ChatGPT 订阅。',
    },
    intro: {
      en: 'Start with how you will use OpenAI: an application calling an API key is billed differently from ChatGPT or Codex using a subscription. Below, compare tracked GPT model variants, then use the cost formula and official sources to check the bill for your own workload. The table is a database snapshot, not a guarantee of endpoint availability or a complete OpenAI rate card.',
      zh: '先确定你如何使用 OpenAI：应用通过 API Key 调用，与通过订阅使用 ChatGPT 或 Codex，采用不同的计费方式。下表对比已追踪的 GPT 模型版本；随后可用成本公式和官方来源核对自己的用量。表格是数据库快照，不保证接口可用，也不是 OpenAI 全量价目表。',
    },
    queryPatterns: OPENAI_MODEL_SLUG_PREFIXES.map((prefix) => `${prefix}%`),
    providerSlugs: ['openai'],
    reviewedAt: '2026-10-13',
    sections: [
      {
        heading: { en: 'Does ChatGPT Plus include API usage?', zh: 'ChatGPT Plus 包含 API 用量吗？' },
        body: {
          en: 'Do not treat a ChatGPT subscription as a balance for API-key calls. OpenAI separates API token billing from subscription usage. Codex can use an eligible ChatGPT plan, while Codex authenticated with an API key follows API pricing. Compare subscription entitlements on the OpenAI plans page; do not divide a monthly plan price by an API token rate to infer an included token allowance.',
          zh: '不要把 ChatGPT 订阅当作 API Key 调用的余额。OpenAI 将 API token 计费与订阅用量分开。Codex 可以使用符合条件的 ChatGPT 套餐，而通过 API Key 登录的 Codex 按 API 价格计费。订阅权益应在 OpenAI 套餐页单独比较，不能用月费除以 API 单价来推算订阅包含多少 token。',
        },
      },
      {
        heading: { en: 'Calculate a monthly API budget', zh: '如何估算每月 API 预算' },
        body: {
          en: 'For ordinary uncached text usage, cost = input tokens ÷ 1,000,000 × input rate + billable output tokens ÷ 1,000,000 × output rate. As an illustrative example, 10,000 requests averaging 1,000 input and 250 output tokens consume 10M input and 2.5M output tokens: ten times the workload shown in each table row. Measure full request usage, including repeated conversation history, rather than counting only the latest message. These volumes are examples, not a usage forecast.',
          zh: '普通未缓存文本的成本 = 输入 token ÷ 1,000,000 × 输入单价 + 计费输出 token ÷ 1,000,000 × 输出单价。例如，10,000 次请求若平均每次输入 1,000、输出 250 token，总量就是 1,000 万输入和 250 万输出 token，相当于下表每行示例用量的 10 倍。应统计完整请求中的历史对话等用量，而不是只数最后一条消息。这些用量仅用于演算，不是对实际消耗的预测。',
        },
      },
      {
        heading: { en: 'Usage example: repeated GPT prompts', zh: '用量示例：重复的 GPT 提示词' },
        body: {
          en: 'Assume 10,000 standard, short-context text requests, each with 1,000 input and 250 billable output tokens. Assume usage reports confirm 8M cache-hit input tokens and 2M ordinary input tokens, on a model without separately billed cache writes. Let I, C and O be its current ordinary-input, cached-input and output rates per million tokens: the illustration costs 2 × I + 8 × C + 2.5 × O. It excludes tools, retries and regional uplifts, and uses no batch discount. If caching misses, move those tokens back to I; if the model bills cache writes, account for them at their own rate. Use the Compare channels entry and each model link to check the same processing mode before choosing a channel.',
          zh: '假设有 10,000 次标准处理、短上下文文本请求，每次输入 1,000、计费输出 250 token；用量报告确认其中 800 万输入命中缓存、200 万为普通输入，且所选模型没有单独计费的缓存写入。以当前每百万普通输入、缓存输入、输出单价分别记作 I、C、O，则示例成本为 2 × I + 8 × C + 2.5 × O。此演算不含工具、重试和地区加价，不采用批处理折扣。缓存未命中的 token 应改按 I 计算；模型若收取缓存写入费，应按对应费率另计。通过“对比渠道”入口和每行模型链接，先核对相同处理模式再选择渠道。',
        },
      },
      {
        heading: { en: 'Caching, batch and long-context pricing', zh: '缓存、批处理与长上下文计费' },
        body: {
          en: 'The official rate card distinguishes ordinary input, cached input, cache writes for applicable models, and output. It also lists processing modes and short- versus long-context rates. Choose the row that matches your model and request, not simply the smallest number on the page. A batch variant is not a like-for-like replacement for an interactive endpoint. Our snapshot does not apply extra discounts or context-tier adjustments to the stored price.',
          zh: '官方价目表区分普通输入、缓存输入、适用模型的缓存写入和输出，还列出不同处理模式与长短上下文档位。应选择与实际模型、请求匹配的价格行，而不是页面上最小的数字。批处理版本不能直接等同于交互式接口。本页快照不会在已存储价格之上再叠加折扣，也不会自动调整上下文计价档位。',
        },
      },
      {
        heading: { en: 'Compare the same model across channels', zh: '如何比较同一模型的不同渠道' },
        body: {
          en: 'Match the exact model identifier, version, processing mode and region before comparing OpenAI with a cloud or aggregator. The table selects the lowest tracked input rate for each model after currency conversion; it does not rank channels by your total bill. A channel with cheaper input but more expensive output can cost more for generation-heavy work. Open the model detail page to compare the other channels and verify their terms, limits and sources.',
          zh: '比较 OpenAI 与云平台、聚合渠道之前，先匹配准确的模型标识、版本、处理模式和地区。表格在汇率换算后，为每个模型选择已追踪渠道中的最低输入单价，不按你的总账单排序。输入便宜、输出较贵的渠道，在生成任务中可能反而更贵。点击模型详情查看其他渠道，并核对条款、限额与价格来源。',
        },
      },
      {
        heading: { en: 'Easy-to-miss costs beyond text tokens', zh: '容易忽略的成本：文本 token 之外' },
        body: {
          en: 'Tools such as web search, file search and hosted containers can add charges beyond the basic text-token estimate. Image, audio and realtime workloads have their own pricing dimensions. Regional processing can also change the applicable rate. Check the official pricing documentation and the provider invoice before setting a production budget. Start with a measured sample of real requests, then include retries and multi-step runs in your forecast.',
          zh: '网页搜索、文件搜索和托管容器等工具，可能在基础文本 token 费用之外产生收费。图像、音频和实时语音也有各自的计价维度，区域处理还可能改变适用费率。制定生产预算前，应核对官方价格文档及渠道账单。先测量一批真实请求，再把重试、多步骤运行计入预测。',
        },
      },
    ],
    faqs: [
      {
        question: { en: 'How much does 1 million GPT tokens cost?', zh: '100 万 GPT token 多少钱？' },
        answer: {
          en: 'There is no single GPT token price. Select the exact model and channel, then distinguish input from output and any cache or context tier. The table shows tracked input and output rates per million tokens in each channel’s billing currency.',
          zh: 'GPT 没有统一的 token 单价。先选择具体模型和渠道，再区分输入、输出、缓存以及上下文档位。表格按渠道计费币种，列出已追踪的每百万输入与输出 token 单价。',
        },
      },
      {
        question: { en: 'Can I use a ChatGPT subscription for API-key calls?', zh: 'ChatGPT 订阅可以抵扣 API Key 调用吗？' },
        answer: {
          en: 'API-key usage follows API billing, not the included ChatGPT subscription allowance. Subscription access to Codex is a separate usage path; check which authentication method your tool uses before estimating cost.',
          zh: 'API Key 调用按 API 账单计费，不使用 ChatGPT 订阅内额度。通过订阅访问 Codex 是另一条使用路径；估算成本前，请检查工具采用的登录方式。',
        },
      },
      {
        question: { en: 'Is the lowest input rate enough to compare total cost?', zh: '输入单价最低就一定最便宜吗？' },
        answer: {
          en: 'No. Multiply both input and output rates by your measured token volumes, then add applicable tool and service fees. A low input rate alone cannot establish the lowest total cost, and a missing output rate is unknown, not zero.',
          zh: '不一定。需要把输入和输出单价分别乘以实测用量，再加上适用的工具与服务费用。仅凭低输入价不能确定最低总成本；输出价格缺失表示未知，不代表免费。',
        },
      },
      {
        question: { en: 'Does this comparison include every OpenAI model and fee?', zh: '这个对比包含所有 OpenAI 模型和费用吗？' },
        answer: {
          en: 'No. It displays up to 12 recently listed, tracked GPT-family language models with available per-million-token channel prices. It is not a complete catalog and does not estimate image, audio, storage or tool charges. Use the official rate card for those products.',
          zh: '不包含。本页最多展示 12 个最近列入、具有可用每百万 token 渠道报价的 GPT 系列语言模型。它不是完整目录，也不估算图像、音频、存储或工具费用；这些产品请查看官方价目表。',
        },
      },
    ],
    sources: [
      {
        label: { en: 'OpenAI API pricing: token rates, processing modes and tools', zh: 'OpenAI API 官方价格：token、处理模式与工具费用' },
        url: 'https://developers.openai.com/api/docs/pricing',
      },
      {
        label: { en: 'OpenAI Codex pricing: subscription usage versus API-key billing', zh: 'OpenAI Codex 官方计费：订阅用量与 API Key 的区别' },
        url: 'https://developers.openai.com/codex/pricing/',
      },
      {
        label: { en: 'OpenAI prompt caching: cache hits and writes', zh: 'OpenAI 提示词缓存：缓存命中与写入' },
        url: 'https://developers.openai.com/api/docs/guides/prompt-caching',
      },
    ],
  },
  'glm-chatglm-api-pricing': {
    slug: 'glm-chatglm-api-pricing',
    title: { en: 'GLM Pricing: ChatGLM API Costs, Free Routes & Coding Plans', zh: 'GLM / ChatGLM 价格：API 费用、免费渠道与编程套餐' },
    description: {
      en: 'Compare current GLM and ChatGLM API prices, free variants, China access, official channels, and example token costs.',
      zh: '对比 GLM 与 ChatGLM 当前 API 价格、免费版本、中国大陆访问、官方渠道和 token 成本示例。',
    },
    intro: {
      en: 'GLM models appear through Zhipu AI, Z.AI and international aggregators. A low listed rate does not establish the total bill, and “free” variants can have different limits or availability. This guide keeps those channels separate and calculates a consistent workload example.',
      zh: 'GLM 模型同时出现在智谱官方渠道和国际聚合平台。最低标价不一定来自官方接口，“免费”版本的限额与可用性也可能不同。本指南区分这些渠道，并用统一用量示例计算成本。',
    },
    queryPatterns: ['%glm%', '%chatglm%'],
    providerSlugs: ['zhipu-china', 'zhipu-global'],
    reviewedAt: '2026-10-13',
    sections: [
      {
        heading: { en: 'Official versus free endpoints', zh: '官方接口与免费渠道' },
        body: {
          en: 'Use the official baseline when support, account ownership, and predictable quotas matter. Aggregator free routes are useful for evaluation, but they may apply separate rate limits, routing rules, or availability windows.',
          zh: '重视支持、账号归属和稳定额度时，应以官方基准为准。聚合平台的免费路由适合评估，但可能采用不同的速率限制、路由规则或开放时间。',
        },
      },
      {
        heading: { en: 'Mainland China access', zh: '中国大陆访问' },
        body: {
          en: 'Zhipu’s China service is generally the direct-access option for mainland users. International channels can differ in payment methods, data location, model naming, and release timing, so compare the exact channel row before integrating.',
          zh: '智谱国内服务通常是大陆用户的直连选择。国际渠道在支付方式、数据位置、模型命名和发布时间上可能不同，接入前应核对具体渠道行。',
        },
      },
      {
        heading: { en: 'Cost formula: keep CNY and USD ledgers separate', zh: '成本公式：人民币与美元账单分开算' },
        body: {
          en: 'For metered GLM calls, cost = ordinary input ÷ 1M × input rate + cache-hit input ÷ 1M × cached rate + output ÷ 1M × output rate + applicable cache storage and tool charges. Use CNY rates on the China BigModel site and USD rates on Z.AI; convert only after calculating each bill. Resource packs are prepaid purchases with model coverage and validity conditions: allocate their purchase cost to covered usage, then add uncovered metered usage, without charging the covered tokens twice. A GLM Coding Plan has its own endpoint and quota rules; its subscription price is not a general API token allowance.',
          zh: 'GLM 按量调用成本 = 普通输入 ÷ 100 万 × 输入单价 + 缓存命中输入 ÷ 100 万 × 缓存单价 + 输出 ÷ 100 万 × 输出单价 + 适用的缓存存储与工具费。国内 BigModel 按人民币价目表、Z.AI 按美元价目表分别计算，最后再换汇。资源包属于预付购买，须核对覆盖模型与有效期；将购买成本分摊至覆盖用量，再加上未覆盖的按量费用，避免对已覆盖 token 重复计费。GLM Coding Plan 有独立接口与配额规则，订阅月费不能换算成通用 API token 额度。',
        },
      },
      {
        heading: { en: 'Usage example: a paid route and a Flash evaluation', zh: '用量示例：付费接口与 Flash 评估' },
        body: {
          en: 'Assume 2,000 paid GLM requests averaging 2,000 input and 500 output tokens, with no cache hits, tools or resource pack. The illustration uses 4M input and 1M output: cost = 4 × I + O, where I and O are the exact model’s live rates in the chosen site’s currency. A separate evaluation using a variant explicitly listed as free can have zero model-token charges within its limits; do not carry that assumption over to every model containing “Flash”. If a resource pack covers some requests, calculate its allocated cost and the uncovered requests separately.',
          zh: '假设有 2,000 次付费 GLM 请求，平均每次输入 2,000、输出 500 token，没有缓存命中、工具或资源包。此演算共 400 万输入、100 万输出，成本 = 4 × I + O；I、O 取所选站点、具体模型的实时单价及币种。若另外使用官方明确标为免费的版本进行评估，在限额内模型 token 费用可为零，但不能把这个假设套用于所有名称含“Flash”的模型。资源包若覆盖部分请求，应将其分摊成本与未覆盖请求分开计算。',
        },
      },
      {
        heading: { en: 'Easy-to-miss costs: packs, tools and free-route limits', zh: '容易忽略的成本：资源包、工具与免费接口限制' },
        body: {
          en: 'Check resource-pack expiry and supported models before prepaying; unused quota changes your effective cost. A free Flash variant still has rate and concurrency limits, and a paid fallback creates a separate bill. Tool calls and cache storage have their own pricing entries. Coding Plan quotas do not remove ordinary API charges, and a currency conversion on this page does not change the currency charged by either official site.',
          zh: '预付前核对资源包有效期与适用模型，未用完的额度会改变实际单位成本。免费 Flash 版本仍有速率与并发限制，切换付费后备接口会另产生账单。工具调用和缓存存储有各自的价格项。Coding Plan 配额不会免除普通 API 费用，本页换汇展示也不会改变官方站点的实际扣款币种。',
        },
      },
    ],
    faqs: [
      {
        question: { en: 'Are BigModel and Z.AI prices in the same currency?', zh: 'BigModel 与 Z.AI 使用同一种计费币种吗？' },
        answer: { en: 'The China site lists CNY prices; Z.AI lists USD prices. Match the exact model, token unit and endpoint before converting the resulting totals.', zh: '国内站列人民币价格，Z.AI 列美元价格。换算总额之前，先匹配具体模型、token 单位与接口。' },
      },
      {
        question: { en: 'Is every GLM Flash model free?', zh: '所有 GLM Flash 模型都免费吗？' },
        answer: { en: 'No. Use only variants explicitly marked free in the official table, and check their limits. Flash and FlashX names alone do not establish a zero rate.', zh: '不是。以官方表格中明确标为免费的具体版本为准，并核对限额。仅凭 Flash 或 FlashX 名称不能判断零单价。' },
      },
      {
        question: { en: 'Does a Coding Plan cover ordinary API calls?', zh: 'Coding Plan 覆盖普通 API 调用吗？' },
        answer: { en: 'Treat the coding subscription and metered API as separate products. Check the coding endpoint and allowed usage rather than deducting its monthly price from an API bill.', zh: '编程订阅与按量 API 应作为独立产品。核对编程专用接口和允许的用法，不要从 API 账单中扣除订阅月费。' },
      },
      {
        question: { en: 'How should I budget for a resource pack?', zh: '如何为资源包做预算？' },
        answer: { en: 'Check coverage and expiry, allocate the prepaid cost across usage you expect to consume, then add charges outside the pack. Unused capacity is still part of your purchase cost.', zh: '核对覆盖范围与有效期，将预付费用分摊到预计实际消耗，再加上包外费用。未使用的容量仍属于购买成本。' },
      },
    ],
    sources: [
      { label: { en: 'Zhipu BigModel official pricing (China)', zh: '智谱 BigModel 国内官方价格' }, url: 'https://open.bigmodel.cn/pricing' },
      { label: { en: 'Z.AI official API pricing (global)', zh: 'Z.AI 国际站官方 API 价格' }, url: 'https://docs.z.ai/guides/overview/pricing' },
    ],
  },
  'claude-anthropic-pricing': {
    slug: 'claude-anthropic-pricing',
    title: { en: 'Claude Pricing: API Cost & Anthropic Subscription Plans', zh: 'Claude 价格：API 成本与 Anthropic 订阅套餐' },
    description: {
      en: 'Compare Claude API token costs with Anthropic subscription plans, official pricing, cloud channels, and example workloads.',
      zh: '对比 Claude API token 成本、Anthropic 订阅套餐、官方价格、云渠道和示例用量。',
    },
    intro: {
      en: 'Claude API billing and Claude subscriptions solve different needs. API usage is metered by input and output tokens, while Pro, Max, Team, and Enterprise plans cover the Claude application. The live table below focuses on API channels; linked plan pages cover subscription entitlements.',
      zh: 'Claude API 计费与 Claude 订阅解决的是不同需求。API 按输入和输出 token 计费，Pro、Max、Team 与 Enterprise 则面向 Claude 应用。本页实时表格聚焦 API 渠道，相关套餐页说明订阅权益。',
    },
    queryPatterns: ['%claude%'],
    providerSlugs: ['anthropic'],
    reviewedAt: '2026-10-18',
    sections: [
      {
        heading: { en: 'API cost versus subscription price, and included API credits', zh: 'API 成本、订阅价格与附赠 API 额度' },
        body: {
          en: 'Max and Team plans include monthly Claude API credits: Max 5x $100, Max 20x $200; Team $20 per Standard seat and $100 per Premium seat, pooled across the team and capped at $500. Free, Pro and Enterprise get none. Credits are claimed by linking a Claude Console organization, after 7 days on an eligible plan. They cover only the Claude API, Claude Managed Agents, the Claude Agent SDK and the playground in the Claude Console, not Claude Code, extra usage in the Claude apps, or Claude on AWS, Bedrock, Google Cloud (Vertex AI) or Microsoft Foundry. They refresh each billing cycle (monthly on annual plans) and expire unused, with no rollover. Estimate API spend from token volume; anything above the credit is billed at normal API rates.',
          zh: 'Max 与 Team 套餐每月附赠 Claude API 额度：Max 5x 为 100 美元，Max 20x 为 200 美元；Team 的 Standard 席位每席 20 美元、Premium 席位每席 100 美元，全团队合并为一个余额，上限 500 美元。Free、Pro 与 Enterprise 不附赠。需在订阅满 7 天后关联一个 Claude Console 组织领取，仅可用于 Claude Console 中的 Claude API、Claude Managed Agents、Claude Agent SDK 和 Playground，不能用于 Claude Code、Claude 应用的超额用量，也不能用于 AWS、Bedrock、Google Cloud（Vertex AI）或 Microsoft Foundry 上的 Claude。额度每个账单周期发放（年付按月发放），当期未用完即作废、不滚存。API 支出仍应按 token 用量估算，超出额度的部分按常规 API 价格计费。',
        },
      },
      {
        heading: { en: 'Cloud and aggregator channels', zh: '云平台与聚合渠道' },
        body: {
          en: 'AWS Bedrock, Google Vertex AI, and aggregators may expose the same Claude family with different regional availability, contracts, rate limits, and billing. Price is one input, not proof that two channels are operationally identical.',
          zh: 'AWS Bedrock、Google Vertex AI 与聚合平台可能提供同系列 Claude，但地区、合同、限速和账单规则不同。价格只是选择因素之一，并不代表渠道完全等价。',
        },
      },
      {
        heading: { en: 'Cost formula: cache writes and reads are different', zh: '成本公式：缓存写入与读取分开计费' },
        body: {
          en: 'Claude cost = (ordinary input × I + cache writes × W + cache reads × R + output × O) ÷ 1M + tool charges. I, W, R and O are the current rates for the exact model, cache lifetime and context tier. Writes use a premium over base input; reads use a lower multiplier, which can vary by model. Count each input category once. Eligible asynchronous Batch API input and output receive a 50% discount; choose the batch rate entries rather than applying another discount to rates already stored as batch prices.',
          zh: 'Claude 成本 =（普通输入 × I + 缓存写入 × W + 缓存读取 × R + 输出 × O）÷ 100 万 + 工具费。I、W、R、O 取具体模型、缓存存续时间和上下文档位的当前费率。写入相对基础输入加价，读取采用较低的倍率，具体倍率可能因模型而异；各类输入只计一次。符合条件的异步 Batch API 输入与输出享有 50% 折扣，应直接选择批处理价格项，不要对已按批处理存储的价格再次打折。',
        },
      },
      {
        heading: { en: 'Usage example: reuse a cached document', zh: '用量示例：重复读取缓存文档' },
        body: {
          en: 'Assume 100 requests within one cache lifetime, each with the same 20,000-token document, 1,000 new input tokens and 500 output tokens, below the selected model’s context-tier threshold. Assume one successful cache write followed by 99 hits, with no tools or batch processing. The illustration costs 0.1 × I + 0.02 × W + 1.98 × R + 0.05 × O. Without caching it is 2.1 × I + 0.05 × O. Compare using the live rates; misses or expiry create more writes or ordinary input and change the result.',
          zh: '假设同一缓存存续期内有 100 次请求，每次包含同一份 20,000 token 文档、1,000 个新增输入 token 和 500 个输出 token，未超过所选模型的上下文计价阈值。假设首次写入成功、随后 99 次命中，不使用工具或批处理。此演算成本为 0.1 × I + 0.02 × W + 1.98 × R + 0.05 × O；不用缓存则为 2.1 × I + 0.05 × O。请代入实时费率比较；未命中或到期会增加写入或普通输入，结果随之变化。',
        },
      },
      {
        heading: { en: 'Easy-to-miss costs: context tiers and cloud regions', zh: '容易忽略的成本：上下文档位与云平台地区' },
        body: {
          en: 'Check whether the selected model has a long-context tier; do not assume every Claude version does. Cache reads and writes can count toward the prompt-length threshold. Cache lifetime changes write pricing. Bedrock and Vertex AI regional or multi-region endpoints can have different rates from global routing; use the cloud provider’s rate card and invoice. Server-side tools add charges beyond the token estimate.',
          zh: '核对所选模型是否有长上下文计价档位，不要假定所有 Claude 版本都适用。缓存读取与写入也可能计入提示词长度阈值；缓存存续时间会改变写入价格。Bedrock 与 Vertex AI 的地区或多地区接口可能与全球路由费率不同，应核对云平台价目表及账单。服务端工具还会在 token 估算之外收费。',
        },
      },
    ],
    faqs: [
      {
        question: { en: 'Can Max or Team API credits pay for Claude Code?', zh: 'Max 或 Team 附赠的 API 额度能用于 Claude Code 吗？' },
        answer: { en: 'No. The monthly credits cover only the Claude API, Managed Agents, the Agent SDK and the playground in the Claude Console. Claude Code, extra usage in the Claude apps, and Claude on Bedrock, Vertex AI or Foundry are excluded, and unused credits expire each billing cycle.', zh: '不能。每月附赠额度仅可用于 Claude Console 中的 Claude API、Managed Agents、Agent SDK 和 Playground；Claude Code、Claude 应用的超额用量以及 Bedrock、Vertex AI、Foundry 上的 Claude 都不适用，未用完的额度在每个账单周期结束时作废。' },
      },
      {
        question: { en: 'Does every cached token use the read rate?', zh: '所有缓存 token 都按读取价收费吗？' },
        answer: { en: 'No. A cache creation uses the write rate for its lifetime; later hits use the read rate. Use the separate usage counters and model-specific multipliers.', zh: '不是。创建缓存按对应存续时间的写入价计费，后续命中才按读取价计费。应使用独立用量计数及具体模型的倍率。' },
      },
      {
        question: { en: 'Can I use the batch discount for interactive calls?', zh: '交互式调用能用批处理折扣吗？' },
        answer: { en: 'The 50% input/output discount applies to eligible asynchronous Batch API usage. A standard interactive request uses its standard rates.', zh: '输入与输出 50% 折扣适用于符合条件的异步 Batch API。普通交互请求按对应标准费率计费。' },
      },
      {
        question: { en: 'Does long context always increase Claude rates?', zh: 'Claude 长上下文一定加价吗？' },
        answer: { en: 'It depends on the model. Check its current threshold and rate entries, including whether cached input contributes to prompt length.', zh: '取决于具体模型。核对当前阈值和价格项，以及缓存输入是否计入提示词长度。' },
      },
      {
        question: { en: 'Are Bedrock and Vertex AI rates identical to direct API rates?', zh: 'Bedrock、Vertex AI 与直连 API 价格完全相同吗？' },
        answer: { en: 'Check the exact region, endpoint type and cloud contract. Regional pricing and billing terms can differ from the direct Claude API.', zh: '须核对具体地区、接口类型和云合同。地区价格与账单条款可能不同于直连 Claude API。' },
      },
    ],
    sources: [
      { label: { en: 'Anthropic official Claude pricing and billing mechanisms', zh: 'Anthropic 官方 Claude 价格与计费机制' }, url: 'https://docs.anthropic.com/en/docs/about-claude/pricing' },
      { label: { en: 'Claude docs: API credits for Max and Team subscribers (verified 2026-10-18)', zh: 'Claude 官方文档：Max 与 Team 订阅附赠 API 额度（2026-10-18 核验）' }, url: 'https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers' },
    ],
  },
  'grok-pricing': {
    slug: 'grok-pricing',
    title: { en: 'Grok Pricing: API Costs, Subscription Plans & Imagine', zh: 'Grok 价格：API 费用、订阅与 Imagine 计费' },
    description: {
      en: 'Compare current Grok API prices, xAI official channels, subscription options, and example token costs.',
      zh: '对比 Grok 当前 API 价格、xAI 官方渠道、订阅选择和 token 成本示例。',
    },
    intro: {
      en: '“Grok pricing” can mean metered xAI API usage or access through a consumer subscription. This page separates those products and lists the currently tracked API variants with a reproducible workload estimate.',
      zh: '“Grok 价格”既可能指 xAI API 的按量计费，也可能指消费级订阅访问。本页区分两类产品，并列出当前追踪的 API 版本及可复算的用量估算。',
    },
    queryPatterns: ['%grok%'],
    providerSlugs: ['grok'],
    reviewedAt: '2026-10-13',
    sections: [
      {
        heading: { en: 'Choose the right billing product', zh: '先区分计费产品' },
        body: {
          en: 'Use API pricing for applications, agents, and batch workloads. Use subscription pricing for the end-user Grok experience. A subscription should not be treated as interchangeable API credit.',
          zh: '应用、Agent 和批处理工作负载应看 API 价格；终端用户使用 Grok 应看订阅价格。不要把订阅费用直接视为可替代的 API 额度。',
        },
      },
      {
        heading: { en: 'Variant names matter', zh: '注意模型版本' },
        body: {
          en: 'Fast, mini, reasoning, and dated Grok variants can have different token rates and limits. Match the exact model identifier used by your integration before comparing totals.',
          zh: 'Fast、mini、推理版和日期版本的 Grok 可能采用不同 token 单价与限额。比较总成本前，应先确认接入使用的准确模型标识。',
        },
      },
      {
        heading: { en: 'Cost formula: include reasoning and search', zh: '成本公式：计入推理与搜索' },
        body: {
          en: 'Grok API cost = ordinary input ÷ 1M × I + cached input ÷ 1M × C + billable output ÷ 1M × O + separately billed search and tool usage. Reasoning tokens are billed as output: if the output total already includes reasoning, do not add it twice. Live search and server-side tools have their own billing units, which may be calls or retrieved items; use the current tool entry. Consumer subscription access is a separate entitlement, not an interchangeable API credit balance; check any subscription-linked API allowance explicitly.',
          zh: 'Grok API 成本 = 普通输入 ÷ 100 万 × I + 缓存输入 ÷ 100 万 × C + 计费输出 ÷ 100 万 × O + 独立计费的搜索与工具用量。推理 token 按输出计费；输出总量若已包含推理，就不要再加一次。实时搜索与服务端工具有独立计费单位，可能按调用或检索条目收费，应以当前工具价格项为准。消费级订阅访问是独立权益，不能视为可互换的 API 余额；如有订阅关联的 API 用量，须明确核对其范围。',
        },
      },
      {
        heading: { en: 'Usage example: a reasoning agent with search', zh: '用量示例：带搜索的推理 Agent' },
        body: {
          en: 'Assume 1,000 agent requests with measured totals of 2M input tokens, including 0.5M cache hits, plus 0.25M visible completion and 0.75M reasoning tokens. Assume all search-result tokens are already in those input totals, no batch discount, and 200 billable web-search calls on a tool priced per call. The illustration costs 1.5 × I + 0.5 × C + 1 × O + 200 × S, where S is that tool’s current per-call rate. If the selected search tool bills retrieved items instead, replace the last term with the measured item count and its rate.',
          zh: '假设有 1,000 次 Agent 请求，实测总输入 200 万 token，其中 50 万命中缓存；另有 25 万可见回答、75 万推理 token。假设搜索结果 token 已计入上述输入，不采用批处理折扣，并使用一个按次收费的网页搜索工具，共产生 200 次计费调用。此演算成本 = 1.5 × I + 0.5 × C + 1 × O + 200 × S，S 为该工具当前每次调用费。若所选搜索工具按检索条目收费，则将末项改为实测条目数乘以对应费率。',
        },
      },
      {
        heading: { en: 'Easy-to-miss costs: hidden output and repeated tools', zh: '容易忽略的成本：推理输出与反复调用工具' },
        body: {
          en: 'A short final answer can still carry substantial billed reasoning output. One user request can trigger multiple search or tool operations, and tool results enlarge later prompts. Cache-hit rates apply only to confirmed hits, not every repeated conversation. Keep a subscription’s usage pool separate from metered API spending and verify how any linked API access is charged. Budget from usage records rather than visible answer length.',
          zh: '最终回答很短，也可能产生较多的计费推理输出。一条用户请求可触发多次搜索或工具操作，工具结果还会扩大后续提示词。缓存命中价仅适用于已确认命中的部分，并非所有重复对话。订阅用量池与按量 API 支出应分开记录，并核对关联 API 访问的收费方式。预算应依据用量记录，而不是可见回答长度。',
        },
      },
    ],
    faqs: [
      {
        question: { en: 'Is a Grok subscription the same as API credit?', zh: 'Grok 订阅等于 API 额度吗？' },
        answer: { en: 'No. Subscription entitlements and metered API billing are different. Verify any explicitly included API access and its limits instead of treating the monthly fee as cash credit.', zh: '不等于。订阅权益与按量 API 计费不同。须核对明确包含的 API 访问及限额，不要把月费当成现金余额。' },
      },
      {
        question: { en: 'Are reasoning tokens charged when they are not visible?', zh: '不可见的推理 token 也收费吗？' },
        answer: { en: 'Reasoning tokens are billable output. Use the reported output total and avoid adding reasoning a second time when it is already included.', zh: '推理 token 属于计费输出。应使用报告的输出总量，已包含推理时避免再次累加。' },
      },
      {
        question: { en: 'Is live search included in the token rate?', zh: '实时搜索包含在 token 单价中吗？' },
        answer: { en: 'Search and server-side tools have separate charges as well as associated token usage. Check whether the selected tool bills calls or retrieved items.', zh: '搜索与服务端工具除相关 token 用量外，还可能独立收费。须核对所选工具按调用还是检索条目计费。' },
      },
      {
        question: { en: 'Can I apply cached-input pricing to all history?', zh: '所有历史对话都能按缓存输入价算吗？' },
        answer: { en: 'Apply it only to input confirmed as cached in usage metrics. The remaining history uses the ordinary input rate for the selected model.', zh: '仅对用量指标确认已缓存的输入采用缓存价，其余历史按所选模型的普通输入价计费。' },
      },
    ],
    sources: [
      { label: { en: 'xAI official Grok models and prices', zh: 'xAI 官方 Grok 模型与价格' }, url: 'https://docs.x.ai/docs/models' },
      { label: { en: 'xAI API pricing: tokens and tool charges', zh: 'xAI API 官方计费：token 与工具费用' }, url: 'https://docs.x.ai/developers/pricing' },
      { label: { en: 'xAI prompt caching and reasoning usage example', zh: 'xAI 官方提示词缓存与推理用量示例' }, url: 'https://docs.x.ai/cookbook/examples/prompt-caching' },
    ],
  },
  'kimi-api-pricing': {
    slug: 'kimi-api-pricing',
    title: { en: 'Kimi Pricing: API Costs, Subscription & Coding Plans', zh: 'Kimi 价格：月之暗面 API、会员订阅与编程套餐' },
    description: {
      en: 'Compare current Kimi and Moonshot API prices, subscription plans, China and global channels, and example costs.',
      zh: '对比 Kimi 与 Moonshot 当前 API 价格、订阅套餐、国内外渠道和示例成本。',
    },
    intro: {
      en: 'Kimi is offered through Moonshot’s China and global services as well as third-party channels. API token pricing and Kimi application subscriptions are separate products, so this guide presents API costs first and links to the relevant plan comparisons.',
      zh: 'Kimi 通过月之暗面的国内、国际服务以及第三方渠道提供。API token 价格和 Kimi 应用订阅属于不同产品，因此本指南先展示 API 成本，再链接对应套餐比较。',
    },
    queryPatterns: ['%kimi%', '%moonshot%'],
    providerSlugs: ['moonshot', 'moonshot-china', 'moonshot-global'],
    reviewedAt: '2026-10-13',
    sections: [
      {
        heading: { en: 'China and global services', zh: '国内与国际服务' },
        body: {
          en: 'The China and global services may differ in account registration, payment currency, network access, model rollout, and documentation. Treat them as separate channels even when the model family name matches.',
          zh: '国内与国际服务在账号注册、支付币种、网络访问、模型上线节奏和文档方面可能不同。即使模型系列名称相同，也应作为独立渠道比较。',
        },
      },
      {
        heading: { en: 'API versus Kimi subscriptions', zh: 'API 与 Kimi 订阅' },
        body: {
          en: 'API billing is appropriate for software integration and scales with token use. Kimi subscriptions cover product features and usage allowances in the application; compare those on the linked plan page.',
          zh: 'API 计费适合软件集成，并随 token 用量变化。Kimi 订阅覆盖应用内功能和使用额度，应在关联套餐页中单独比较。',
        },
      },
      {
        heading: { en: 'Cost formula: currency, cache and context length', zh: '成本公式：币种、缓存与上下文长度' },
        body: {
          en: 'Kimi cost = ordinary input ÷ 1M × I + cache-hit input ÷ 1M × C + output ÷ 1M × O + applicable cache-write or storage charges + billable web-search usage × its tool rate. Use the China site’s CNY rate card or the global site’s USD rate card. For models with context-length pricing, determine the tier from the full request, including history and documents; automatic context selection and named context-length variants can lead to different applicable rates. Use the exact model’s current rules rather than a single rate for every Moonshot or Kimi request.',
          zh: 'Kimi 成本 = 普通输入 ÷ 100 万 × I + 缓存命中输入 ÷ 100 万 × C + 输出 ÷ 100 万 × O + 适用的缓存写入或存储费 + 计费网页搜索用量 × 工具单价。国内站使用人民币价目表，国际站使用美元价目表。对按上下文长度定价的模型，须按包含历史和文档的完整请求确定档位；自动选择上下文与指定上下文长度的不同版本，可能采用不同费率。应使用具体模型的当前规则，不能把所有 Moonshot 或 Kimi 请求套用一个单价。',
        },
      },
      {
        heading: { en: 'Usage example: document questions with cached context', zh: '用量示例：带上下文缓存的文档问答' },
        body: {
          en: 'Assume 1,000 document-Q&A requests with measured totals of 3M input tokens, including 1M cache hits, and 0.5M output tokens. Assume every request stays within the selected model’s same context-price tier, uses a cache mechanism without separate write or storage charges, and makes 40 billable web-search calls. The illustration costs 2 × I + C + 0.5 × O + 40 × S in the chosen site’s currency. Search-result tokens are already included in the input total. If your model bills cache writes or storage, add those charges; if some requests enter another context tier, calculate that subset separately.',
          zh: '假设有 1,000 次文档问答请求，实测总输入 300 万 token，其中 100 万命中缓存，另有 50 万输出。假设所有请求都落在所选模型同一上下文计价档位，使用不另收写入或存储费的缓存机制，并产生 40 次计费网页搜索调用。此演算成本为 2 × I + C + 0.5 × O + 40 × S，使用所选站点币种；搜索结果 token 已包含在输入总量中。模型若收取缓存写入或存储费，应另加；部分请求若进入其他上下文档位，应将该部分单独计算。',
        },
      },
      {
        heading: { en: 'Easy-to-miss costs: search, context growth and recharge limits', zh: '容易忽略的成本：搜索、上下文增长与充值限速' },
        body: {
          en: 'Web search can add a tool fee and more input tokens when results are sent back to the model. Repeated document content is still billable input unless it qualifies for a cache hit, and longer history can change a context-priced model’s rate. Check cache lifetime and any write or storage line items. Recharge or account tiers determine rate limits under the selected site’s rules; prepaid balance does not guarantee unlimited concurrency. Compare China and global invoices in their original currencies before conversion.',
          zh: '网页搜索可能产生工具费，将结果发回模型还会增加输入 token。重复文档内容只有符合缓存命中条件时才能按缓存价计费；更长的历史可能改变按上下文定价模型的费率。还须核对缓存存续时间及写入、存储价格项。充值或账号档位按所选站点规则决定速率限制，预付余额不代表无限并发。比较国内与国际账单时，应先分别按原币种核算，再换汇。',
        },
      },
    ],
    faqs: [
      {
        question: { en: 'Can I reuse China-site prices for the global API?', zh: '国际 API 可以直接套国内站价格吗？' },
        answer: { en: 'Use each site’s own model rates and billing currency: CNY for China and USD for global. Compare totals only after matching models and converting currencies.', zh: '应使用各站自己的模型费率和币种：国内站为人民币，国际站为美元。匹配模型并换汇后再比较总额。' },
      },
      {
        question: { en: 'Does automatic context selection mean one fixed price?', zh: '自动选择上下文就代表固定单价吗？' },
        answer: { en: 'No. For context-priced models, inspect the applicable length tier or named variant. Other models may use a flat rate across their supported context; follow the exact model’s documentation.', zh: '不代表。按上下文定价的模型须核对适用长度档位或指定版本；其他模型可能在支持的上下文内使用固定费率，应以具体模型文档为准。' },
      },
      {
        question: { en: 'Does context caching remove web-search charges?', zh: '上下文缓存会免掉网页搜索费吗？' },
        answer: { en: 'No. Cache pricing concerns model input, while web search has its own tool fee. Search results passed into a later request also contribute to input usage.', zh: '不会。缓存价格针对模型输入，网页搜索有独立工具费。搜索结果传入后续请求时，也会计入输入用量。' },
      },
      {
        question: { en: 'Does recharging unlock unlimited requests?', zh: '充值后可以无限调用吗？' },
        answer: { en: 'No. Check the site’s recharge or account-tier rate limits and your current quota. API balance and Kimi application subscriptions are separate products.', zh: '不能。应核对站点的充值或账号档位限速及当前配额。API 余额与 Kimi 应用订阅属于独立产品。' },
      },
    ],
    sources: [
      { label: { en: 'Moonshot official API pricing (China)', zh: '月之暗面国内站官方 API 价格' }, url: 'https://platform.moonshot.cn/docs/pricing/chat' },
      { label: { en: 'Moonshot official API pricing (global)', zh: '月之暗面国际站官方 API 价格' }, url: 'https://platform.moonshot.ai/docs/pricing/chat' },
      { label: { en: 'Kimi official web-search billing', zh: 'Kimi 官方网页搜索计费' }, url: 'https://platform.kimi.ai/docs/pricing/websearch' },
      { label: { en: 'Kimi official recharge and rate limits', zh: 'Kimi 官方充值与速率限制' }, url: 'https://platform.kimi.ai/docs/pricing/limits' },
    ],
  },
  'cursor-x-subscription-pricing': {
    slug: 'cursor-x-subscription-pricing',
    title: { en: "Cursor's X Subscription vs Legacy Plans: Cost Comparison", zh: 'Cursor 新套餐（The X Subscription）与旧套餐对比' },
    description: {
      en: 'Compare Cursor’s X Subscription and legacy monthly plans, included third-party usage, API-list-price charges and the permanent switch, with illustrative monthly budgets.',
      zh: '对比 Cursor 新 X Subscription 与旧套餐的月费、第三方模型额度、API 标价收费和永久切换规则，并用明确假设演算月度预算。',
    },
    intro: {
      en: 'This is a subscription comparison, not a token price table. The X Subscription shares an included usage pool across Cursor and Grok, refreshed weekly. Premium and above make third-party models such as Claude and GPT available, but none of their usage is included: API list prices apply from the first use, paid from prepaid credit. Existing Cursor plans retain their included third-party usage until you switch. The monthly prices below exclude tax and were reviewed on 2026-10-13.',
      zh: '本页比较订阅套餐，不是 token 价目表。The X Subscription 的内含用量池由 Cursor 与 Grok 共享，每周刷新。Premium 及以上可使用 Claude、GPT 等第三方模型，但这些用量不包含在套餐额度中：从首次使用起按 API 标价计费，从预付余额扣款。现有 Cursor 旧套餐的第三方内含用量会持续保留，直到你切换。下表月费不含税，核对日期为 2026-10-13。',
    },
    priceTable: false,
    // Used for related model links and dateModified only (priceTable: false).
    queryPatterns: ['%grok%', 'claude-%', 'gpt-%'],
    providerSlugs: ['xai'],
    reviewedAt: '2026-10-13',
    planTable: [
      {
        plan: { en: 'X Subscription Free', zh: '新套餐 Free' },
        monthlyPrice: { en: '$0', zh: '$0' },
        includedUsage: { en: 'Limited usage', zh: '有限用量' },
        thirdPartyModels: { en: 'Check official model availability', zh: '以官方模型可用范围为准' },
      },
      {
        plan: { en: 'X Subscription Plus', zh: '新套餐 Plus' },
        monthlyPrice: { en: '$8', zh: '$8' },
        includedUsage: { en: 'Basic usage; Grok models only', zh: '基础用量；仅 Grok 模型' },
        thirdPartyModels: { en: 'Unavailable', zh: '不可用' },
      },
      {
        plan: { en: 'X Subscription Premium', zh: '新套餐 Premium' },
        monthlyPrice: { en: '$30', zh: '$30' },
        includedUsage: { en: '4× Plus; shared Cursor/Grok pool', zh: 'Plus 的 4 倍；Cursor/Grok 共享池' },
        thirdPartyModels: { en: 'No allowance; API list price from first use', zh: '无内含额度；首次使用起按 API 标价另付' },
      },
      {
        plan: { en: 'X Subscription Super', zh: '新套餐 Super' },
        monthlyPrice: { en: '$100', zh: '$100' },
        includedUsage: { en: '15× Plus; shared Cursor/Grok pool', zh: 'Plus 的 15 倍；Cursor/Grok 共享池' },
        thirdPartyModels: { en: 'No allowance; API list price from first use', zh: '无内含额度；首次使用起按 API 标价另付' },
      },
      {
        plan: { en: 'X Subscription Ultra', zh: '新套餐 Ultra' },
        monthlyPrice: { en: '$200', zh: '$200' },
        includedUsage: { en: '50× Plus; shared Cursor/Grok pool', zh: 'Plus 的 50 倍；Cursor/Grok 共享池' },
        thirdPartyModels: { en: 'No allowance; API list price from first use', zh: '无内含额度；首次使用起按 API 标价另付' },
      },
      {
        plan: { en: 'X Subscription Teams', zh: '新套餐 Teams' },
        monthlyPrice: { en: '$30+ / user', zh: '$30 起 / 用户' },
        includedUsage: { en: 'Check the selected seat tier', zh: '核对所选席位档位' },
        thirdPartyModels: { en: 'Billed separately at API list price', zh: '按 API 标价另付' },
      },
      {
        plan: { en: 'Legacy Cursor Pro', zh: '旧套餐 Cursor Pro' },
        monthlyPrice: { en: '$20', zh: '$20' },
        includedUsage: { en: '$20 of Other Models usage', zh: '$20 第三方（Other Models）用量' },
        thirdPartyModels: { en: 'Included allowance, then metered overage', zh: '先使用内含额度，超出另计' },
      },
      {
        plan: { en: 'Legacy Cursor Pro+', zh: '旧套餐 Cursor Pro+' },
        monthlyPrice: { en: '$60', zh: '$60' },
        includedUsage: { en: '$70 of Other Models usage', zh: '$70 第三方（Other Models）用量' },
        thirdPartyModels: { en: 'Included allowance, then metered overage', zh: '先使用内含额度，超出另计' },
      },
      {
        plan: { en: 'Legacy Cursor Ultra', zh: '旧套餐 Cursor Ultra' },
        monthlyPrice: { en: '$200', zh: '$200' },
        includedUsage: { en: '$400 of Other Models usage', zh: '$400 第三方（Other Models）用量' },
        thirdPartyModels: { en: 'Included allowance, then metered overage', zh: '先使用内含额度，超出另计' },
      },
      {
        plan: { en: 'Legacy Cursor Teams Standard', zh: '旧套餐 Cursor Teams Standard' },
        monthlyPrice: { en: '$40 / user', zh: '$40 / 用户' },
        includedUsage: { en: 'Check the current plan allowance', zh: '核对当前套餐额度' },
        thirdPartyModels: { en: 'Check the team’s billing terms', zh: '核对团队计费条款' },
      },
      {
        plan: { en: 'Legacy Cursor Teams Premium', zh: '旧套餐 Cursor Teams Premium' },
        monthlyPrice: { en: '$120 / user', zh: '$120 / 用户' },
        includedUsage: { en: 'Check the current plan allowance', zh: '核对当前套餐额度' },
        thirdPartyModels: { en: 'Check the team’s billing terms', zh: '核对团队计费条款' },
      },
    ],
    sections: [
      {
        heading: { en: 'Who should consider staying on legacy plans?', zh: '哪些用户应考虑保留旧套餐？' },
        body: {
          en: 'If your Cursor work regularly uses Claude, GPT or other third-party models, compare the value of your current Other Models allowance before switching. Legacy Pro, Pro+ and Ultra include $20, $70 and $400 respectively; that included third-party usage continues until you switch. Existing customers can still upgrade or downgrade among their current Cursor plans without adopting The X Subscription, except Apple App Store billed plans, which must switch first. Staying preserves the option to review your actual usage before making a permanent change.',
          zh: '如果你在 Cursor 中经常使用 Claude、GPT 等第三方模型，切换前先计算当前 Other Models 额度的价值。旧 Pro、Pro+、Ultra 分别内含 $20、$70、$400 第三方用量，这些额度会持续保留至切换时。现有用户仍可在当前 Cursor 套餐之间升级或降级，无须采用 The X Subscription；Apple App Store 计费的套餐除外，须先切换。保留旧套餐可让你先核对真实用量，再决定是否永久改变计费方式。',
        },
      },
      {
        heading: { en: 'Who should consider switching?', zh: '哪些用户可考虑切换？' },
        body: {
          en: 'If your work mainly uses Grok and you want to share included usage across Cursor and Grok, compare the new pool sizes against your weekly workload. Plus is Grok-only; Premium and above allow third-party models with separate payment at API list price. A lower subscription fee alone does not establish a lower monthly bill. Compare the subscription and third-party spending together, and set the available spending caps for prepaid third-party usage. Switching is optional and permanent: it cannot be undone, including by Support.',
          zh: '如果主要使用 Grok，并希望在 Cursor 与 Grok 之间共享内含用量，可按每周工作量比较新套餐的用量池。Plus 仅支持 Grok；Premium 及以上允许另付 API 标价使用第三方模型。仅月费较低，不能说明月度总账单较低。应合并比较订阅费与第三方支出，并使用可用的支出上限管理预付第三方用量。切换是自愿且永久的，无法撤销，Support 也无法恢复旧套餐。',
        },
      },
      {
        heading: { en: 'Monthly cost formula: allowance versus first-use billing', zh: '月度成本公式：内含额度与首次使用即收费' },
        body: {
          en: 'For the legacy individual plans, monthly cost = plan price + max(0, third-party API-list-price usage − included third-party allowance). For the new plans with third-party access, monthly cost = plan price + all third-party usage at API list price. The new shared Grok pool does not offset Claude or GPT spending. These formulas isolate the subscription and third-party model components; add any applicable tax and paid top-offs for included-pool usage separately.',
          zh: '旧个人套餐：月度成本 = 套餐月费 + max(0, 按 API 标价计算的第三方用量 − 内含第三方额度)。支持第三方模型的新套餐：月度成本 = 套餐月费 + 全部第三方用量的 API 标价费用。新的 Grok 共享池不能抵扣 Claude 或 GPT 支出。这些公式只比较订阅与第三方模型部分，适用税费和共享池额外 top-off 用量须另加。',
        },
      },
      {
        heading: { en: 'Worked examples: $70 and $150 of third-party usage', zh: '演算示例：$70 与 $150 第三方用量' },
        body: {
          en: 'Assume monthly billing in USD, third-party usage valued at API list price, no tax or shared-pool top-offs, and otherwise identical workloads. At $70 of third-party usage, legacy Pro+ costs $60 + max(0, $70 − $70) = $60, while new Premium costs $30 + $70 = $100. At $150, legacy Pro+ costs $60 + $80 = $140, while new Premium costs $30 + $150 = $180. These are illustrations of the billing formulas, not forecasts or a claim that the plans have identical features or Grok usage allowances.',
          zh: '假设按月以美元计费，第三方用量按 API 标价折算，无税费、无共享池 top-off，其他工作量相同。第三方用量为 $70 时，旧 Pro+ 成本为 $60 + max(0, $70 − $70) = $60；新 Premium 为 $30 + $70 = $100。用量为 $150 时，旧 Pro+ 为 $60 + $80 = $140；新 Premium 为 $30 + $150 = $180。以上仅用于演示计费公式，不是用量预测，也不表示套餐功能或 Grok 内含额度相同。',
        },
      },
      {
        heading: { en: 'Easy-to-miss costs and switching rules', zh: '容易忽略的成本与切换规则' },
        body: {
          en: 'Prices exclude tax. The shared Cursor/Grok allowance refreshes weekly; reaching its limit means waiting for the refresh or buying top-offs. Third-party models are paid from prepaid credit from first use on Premium and above. Switching permanently removes the old plan choice, and Support cannot reverse it. Selected old subscriptions are cancelled with an automatic prorated refund, except App Store subscriptions; a new billing cycle starts on the switch day. Cursor cannot cancel or refund Apple App Store billing: manage cancellation and any refund with Apple to avoid continued old charges, and remember those plans must switch before changing tiers.',
          zh: '标价不含税。Cursor/Grok 共享额度每周刷新，达到限额后须等待刷新或购买 top-off。Premium 及以上的第三方模型从首次使用起从预付余额扣款。切换会永久失去旧套餐选择，Support 也不能撤销。选中的旧订阅会取消并自动按比例退款，App Store 订阅除外；新计费周期从切换当天开始。Cursor 不能取消或退款 Apple App Store 账单，应向 Apple 管理取消及退款，以免旧订阅继续扣款；这些套餐更换档位前也须先切换。',
        },
      },
    ],
    faqs: [
      {
        question: { en: 'Must I switch, and can Support undo the switch?', zh: '必须切换吗？Support 能撤销切换吗？' },
        answer: { en: 'Switching is optional, but permanent once completed. It cannot be undone, and Support cannot restore the legacy plan. Included third-party usage on your existing Cursor plan continues until you switch.', zh: '切换是自愿的，但完成后永久生效，无法撤销，Support 也不能恢复旧套餐。现有 Cursor 套餐的第三方内含用量会持续保留至切换时。' },
      },
      {
        question: { en: 'Does Premium include Claude or GPT usage?', zh: 'Premium 包含 Claude 或 GPT 用量吗？' },
        answer: { en: 'No third-party allowance is included. Premium and above make those models available at API list price from first use, paid from prepaid credit; spending caps are available. Plus supports Grok models only.', zh: '不含第三方额度。Premium 及以上可使用这些模型，但首次使用起就按 API 标价从预付余额扣款，并可设置支出上限。Plus 仅支持 Grok 模型。' },
      },
      {
        question: { en: 'Can I change a legacy Cursor tier without switching?', zh: '不切换也能更换旧 Cursor 套餐档位吗？' },
        answer: { en: 'Existing Cursor customers can upgrade or downgrade among their current Cursor plans without switching. Apple App Store billed plans are the exception and must switch first.', zh: '现有 Cursor 用户可以在当前 Cursor 套餐之间升级或降级，无须切换。Apple App Store 计费套餐除外，须先切换。' },
      },
      {
        question: { en: 'What happens to refunds, billing dates and weekly limits?', zh: '退款、计费日期与每周限额如何处理？' },
        answer: { en: 'Switching cancels selected old subscriptions with automatic prorated refunds, except App Store billing, and starts a new billing cycle that day. The new shared Cursor/Grok pool refreshes weekly; after the limit, wait or pay for top-offs. Taxes are additional.', zh: '切换会取消选中的旧订阅并自动按比例退款，App Store 计费除外；当天开始新的计费周期。新 Cursor/Grok 共享池每周刷新，超限后可等待或付费 top-off，税费另计。' },
      },
    ],
    sources: [
      { label: { en: 'Cursor official X Subscription pricing', zh: 'Cursor 官方 X Subscription 价格' }, url: 'https://cursor.com/pricing' },
      { label: { en: 'Cursor official legacy pricing and plans', zh: 'Cursor 官方旧套餐与价格' }, url: 'https://cursor.com/help/account-and-billing/pricing.md' },
      { label: { en: 'Cursor official X Subscription switching rules', zh: 'Cursor 官方 X Subscription 切换规则' }, url: 'https://cursor.com/help/the-x-subscription/overview' },
      { label: { en: 'xAI official X Subscription announcement', zh: 'xAI 官方 X Subscription 公告' }, url: 'https://x.ai/news/x-subscription' },
    ],
  },
};

export const PRICING_GUIDE_SLUGS = Object.keys(PRICING_GUIDES) as PricingGuideSlug[];

export function isPricingGuideSlug(value: string): value is PricingGuideSlug {
  return Object.hasOwn(PRICING_GUIDES, value);
}

export function guideForModelSlug(modelSlug: string): PricingGuideSlug | null {
  const slug = modelSlug.toLowerCase();
  if (slug.includes('glm')) return 'glm-chatglm-api-pricing';
  if (slug.includes('claude')) return 'claude-anthropic-pricing';
  if (slug.includes('grok')) return 'grok-pricing';
  if (slug.includes('kimi') || slug.includes('moonshot')) return 'kimi-api-pricing';
  if (isOpenAIModelSlug(slug)) return 'openai-api-pricing';
  return null;
}

export function guideForProviderSlug(providerSlug: string): PricingGuideSlug | null {
  return PRICING_GUIDE_SLUGS.find((slug) =>
    PRICING_GUIDES[slug].providerSlugs.includes(providerSlug),
  ) ?? null;
}

type PriceRow = PriceSchedule & {
  model_id: number;
  model_name: string;
  model_slug: string;
  released_at: Date | string | null;
  provider_name: string;
  provider_slug: string;
  provider_type: string | null;
  input_price: number | null;
  output_price: number | null;
  currency: string | null;
  last_verified: Date | string | null;
};

export type GuideModelPrice = {
  name: string;
  slug: string;
  channelCount: number;
  cheapest: {
    providerName: string;
    providerSlug: string;
    inputPrice: number;
    outputPrice: number | null;
    currency: CurrencyCode;
    inputUsd: number;
    outputUsd: number | null;
  };
  official: {
    providerName: string;
    inputPrice: number;
    currency: CurrencyCode;
  } | null;
  exampleCostUsd: number | null;
  lastVerified: Date | string | null;
};

export async function getPricingGuideModels(guide: PricingGuide): Promise<GuideModelPrice[]> {
  if (guide.queryPatterns.length === 0) return [];

  const rows = await sql<PriceRow[]>`
    SELECT m.id AS model_id, m.name AS model_name, m.slug AS model_slug,
           m.released_at, p.name AS provider_name, p.slug AS provider_slug,
           p.type AS provider_type, cp.input_price_per_1m AS input_price,
           cp.output_price_per_1m AS output_price,
             cp.promo_ends_at, cp.regular_input_price_per_1m,
             cp.regular_output_price_per_1m, cp.regular_cached_input_price_per_1m, cp.currency, cp.last_verified
    FROM models m
    JOIN api_channel_prices cp ON cp.model_id = m.id AND cp.is_available = true
    JOIN providers p ON p.id = cp.provider_id
    WHERE (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date) AND lower(m.slug) LIKE ANY(${sql.array(guide.queryPatterns, TEXT_ARRAY)})
      -- Language models only: model_category is the current taxonomy (migration 023);
      -- legacy models.type may be 'llm' or 'coding_tool' etc., so only drop subscription rows.
      AND COALESCE(m.model_category, 'text') = 'text'
      AND m.type IS DISTINCT FROM 'subscription'
      -- Keep excluding non-token pricing; NULL keeps the project default per_1m_tokens.
      -- price_unit may be NULL on legacy rows; treat NULL as the default per-1M-token unit.
      AND COALESCE(cp.price_unit, 'per_1m_tokens') = 'per_1m_tokens'
    ORDER BY m.released_at DESC NULLS LAST, m.updated_at DESC NULLS LAST, m.id, p.slug
  `;

  return summarizeGuidePrices(rows);
}

export function summarizeGuidePrices(rows: PriceRow[], now = new Date()): GuideModelPrice[] {
  const grouped = new Map<number, PriceRow[]>();
  for (const rawRow of rows) {
    const price = effectivePrice({ ...rawRow, input_price_per_1m: rawRow.input_price,
      output_price_per_1m: rawRow.output_price }, now);
    const row = { ...rawRow, input_price: price.input_price_per_1m, output_price: price.output_price_per_1m };
    const current = grouped.get(row.model_id) ?? [];
    current.push(row);
    grouped.set(row.model_id, current);
  }

  return [...grouped.values()]
    .map((channels): GuideModelPrice | null => {
      const priced = channels
        .filter((row) => row.input_price != null && Number.isFinite(Number(row.input_price)) && row.input_price >= 0)
        .map((row) => ({
          row,
          inputUsd: convertToUSD(Number(row.input_price), (row.currency || 'USD') as CurrencyCode),
          outputUsd: row.output_price == null || !Number.isFinite(Number(row.output_price)) || row.output_price < 0
            ? null
            : convertToUSD(Number(row.output_price), (row.currency || 'USD') as CurrencyCode),
        }))
        .sort((left, right) => left.inputUsd - right.inputUsd);
      const best = priced[0];
      if (!best) return null;
      const official = priced.find(({ row }) =>
        row.provider_type === 'producer' || row.provider_type === 'official',
      );

      return {
        name: formatModelName(channels[0].model_name || channels[0].model_slug),
        slug: channels[0].model_slug,
        channelCount: channels.length,
        cheapest: {
          providerName: best.row.provider_name,
          providerSlug: best.row.provider_slug,
          inputPrice: Number(best.row.input_price),
          outputPrice: best.outputUsd == null ? null : Number(best.row.output_price),
          currency: (best.row.currency || 'USD') as CurrencyCode,
          inputUsd: best.inputUsd,
          outputUsd: best.outputUsd,
        },
        official: official
          ? {
              providerName: official.row.provider_name,
              inputPrice: Number(official.row.input_price),
              currency: (official.row.currency || 'USD') as CurrencyCode,
            }
          : null,
        exampleCostUsd: best.outputUsd == null ? null : best.inputUsd + best.outputUsd * 0.25,
        lastVerified: best.row.last_verified,
      };
    })
    .filter((item): item is GuideModelPrice => item !== null)
    .slice(0, 12);
}

/** Newest of the editorial review date and the latest data verification, as ISO string. */
export function latestGuideDate(
  ...dates: Array<Date | string | null | undefined>
): string | undefined {
  const times = dates
    .filter((d): d is Date | string => d != null && d !== '')
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t));
  return times.length ? new Date(Math.max(...times)).toISOString() : undefined;
}
