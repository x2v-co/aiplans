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
  | 'openai-api-pricing';

type LocalizedText = Record<Locale, string>;

export type PricingGuide = {
  slug: PricingGuideSlug;
  title: LocalizedText;
  description: LocalizedText;
  intro: LocalizedText;
  queryPatterns: string[];
  providerSlugs: string[];
  sections: Array<{ heading: LocalizedText; body: LocalizedText }>;
  faqs?: Array<{ question: LocalizedText; answer: LocalizedText }>;
  sources?: Array<{ label: LocalizedText; url: string }>;
  reviewedAt?: string;
};

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
    queryPatterns: ['%gpt%'],
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
        heading: { en: 'What the token estimate leaves out', zh: 'token 估算没有包含什么' },
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
        question: { en: 'Is the lowest input price always the cheapest option?', zh: '输入单价最低就一定最便宜吗？' },
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
    ],
  },
  'glm-chatglm-api-pricing': {
    slug: 'glm-chatglm-api-pricing',
    title: { en: 'GLM and ChatGLM API Pricing Guide', zh: 'GLM 与 ChatGLM API 价格指南' },
    description: {
      en: 'Compare current GLM and ChatGLM API prices, free variants, China access, official channels, and example token costs.',
      zh: '对比 GLM 与 ChatGLM 当前 API 价格、免费版本、中国大陆访问、官方渠道和 token 成本示例。',
    },
    intro: {
      en: 'GLM models appear through both Zhipu AI and international aggregators. The cheapest listing is not always the official endpoint, and “free” variants can have different limits or availability. This guide keeps those channels separate and calculates a consistent workload example.',
      zh: 'GLM 模型同时出现在智谱官方渠道和国际聚合平台。最低标价不一定来自官方接口，“免费”版本的限额与可用性也可能不同。本指南区分这些渠道，并用统一用量示例计算成本。',
    },
    queryPatterns: ['%glm%', '%chatglm%'],
    providerSlugs: ['zhipu-china', 'zhipu-global'],
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
    ],
  },
  'claude-anthropic-pricing': {
    slug: 'claude-anthropic-pricing',
    title: { en: 'Claude API Cost and Anthropic Plan Pricing', zh: 'Claude API 成本与 Anthropic 套餐价格' },
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
    sections: [
      {
        heading: { en: 'API cost versus subscription price', zh: 'API 成本与订阅价格' },
        body: {
          en: 'A subscription does not normally include general-purpose API credits. Estimate API spend from token volume, then compare subscriptions separately for interactive chat or coding workflows.',
          zh: '订阅通常不包含通用 API 额度。API 支出应根据 token 用量估算；交互式聊天或编程工作流则应单独比较订阅套餐。',
        },
      },
      {
        heading: { en: 'Cloud and aggregator channels', zh: '云平台与聚合渠道' },
        body: {
          en: 'AWS Bedrock, Google Vertex AI, and aggregators may expose the same Claude family with different regional availability, contracts, rate limits, and billing. Price is one input, not proof that two channels are operationally identical.',
          zh: 'AWS Bedrock、Google Vertex AI 与聚合平台可能提供同系列 Claude，但地区、合同、限速和账单规则不同。价格只是选择因素之一，并不代表渠道完全等价。',
        },
      },
    ],
  },
  'grok-pricing': {
    slug: 'grok-pricing',
    title: { en: 'Grok API and Subscription Pricing Guide', zh: 'Grok API 与订阅价格指南' },
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
    ],
  },
  'kimi-api-pricing': {
    slug: 'kimi-api-pricing',
    title: { en: 'Kimi API Pricing and Moonshot Plan Guide', zh: 'Kimi API 价格与月之暗面套餐指南' },
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
  if (slug.includes('gpt')) return 'openai-api-pricing';
  return null;
}

export function guideForProviderSlug(providerSlug: string): PricingGuideSlug | null {
  return PRICING_GUIDE_SLUGS.find((slug) =>
    PRICING_GUIDES[slug].providerSlugs.includes(providerSlug),
  ) ?? null;
}

type PriceRow = {
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
  const rows = await sql<PriceRow[]>`
    SELECT m.id AS model_id, m.name AS model_name, m.slug AS model_slug,
           m.released_at, p.name AS provider_name, p.slug AS provider_slug,
           p.type AS provider_type, cp.input_price_per_1m AS input_price,
           cp.output_price_per_1m AS output_price, cp.currency, cp.last_verified
    FROM models m
    JOIN api_channel_prices cp ON cp.model_id = m.id AND cp.is_available = true
    JOIN providers p ON p.id = cp.provider_id
    WHERE lower(m.slug) LIKE ANY(${sql.array(guide.queryPatterns, TEXT_ARRAY)})
      AND m.type = 'llm'
      AND cp.price_unit = 'per_1m_tokens'
    ORDER BY m.released_at DESC NULLS LAST, m.updated_at DESC NULLS LAST, m.id, p.slug
  `;

  return summarizeGuidePrices(rows);
}

export function summarizeGuidePrices(rows: PriceRow[]): GuideModelPrice[] {
  const grouped = new Map<number, PriceRow[]>();
  for (const row of rows) {
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
