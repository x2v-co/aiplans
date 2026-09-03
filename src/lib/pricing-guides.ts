import { sql, TEXT_ARRAY } from '@/lib/db';
import { convertToUSD } from '@/lib/currency-conversion';
import type { CurrencyCode } from '@/lib/currency';
import { formatModelName } from '@/lib/model-names';
import type { Locale } from '@/lib/seo';

export type PricingGuideSlug =
  | 'glm-chatglm-api-pricing'
  | 'claude-anthropic-pricing'
  | 'grok-pricing'
  | 'kimi-api-pricing';

type LocalizedText = Record<Locale, string>;

export type PricingGuide = {
  slug: PricingGuideSlug;
  title: LocalizedText;
  description: LocalizedText;
  intro: LocalizedText;
  queryPatterns: string[];
  providerSlugs: string[];
  sections: Array<{ heading: LocalizedText; body: LocalizedText }>;
};

export const PRICING_GUIDES: Record<PricingGuideSlug, PricingGuide> = {
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
  return value in PRICING_GUIDES;
}

export function guideForModelSlug(modelSlug: string): PricingGuideSlug | null {
  const slug = modelSlug.toLowerCase();
  if (slug.includes('glm')) return 'glm-chatglm-api-pricing';
  if (slug.includes('claude')) return 'claude-anthropic-pricing';
  if (slug.includes('grok')) return 'grok-pricing';
  if (slug.includes('kimi') || slug.includes('moonshot')) return 'kimi-api-pricing';
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
  exampleCostUsd: number;
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
    ORDER BY m.released_at DESC NULLS LAST, m.updated_at DESC NULLS LAST
  `;

  const grouped = new Map<number, PriceRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.model_id) ?? [];
    current.push(row);
    grouped.set(row.model_id, current);
  }

  return [...grouped.values()]
    .map((channels): GuideModelPrice | null => {
      const priced = channels
        .filter((row) => row.input_price != null && row.input_price >= 0)
        .map((row) => ({
          row,
          inputUsd: convertToUSD(Number(row.input_price), (row.currency || 'USD') as CurrencyCode),
          outputUsd: row.output_price == null
            ? null
            : convertToUSD(Number(row.output_price), (row.currency || 'USD') as CurrencyCode),
        }))
        .sort((left, right) => left.inputUsd - right.inputUsd);
      const best = priced[0];
      if (!best) return null;
      const official = priced.find(({ row }) =>
        row.provider_type === 'producer' || row.provider_type === 'official',
      );
      const latestVerification = channels
        .map((row) => row.last_verified)
        .filter(Boolean)
        .sort((left, right) => new Date(right!).getTime() - new Date(left!).getTime())[0] ?? null;

      return {
        name: formatModelName(channels[0].model_name || channels[0].model_slug),
        slug: channels[0].model_slug,
        channelCount: channels.length,
        cheapest: {
          providerName: best.row.provider_name,
          providerSlug: best.row.provider_slug,
          inputPrice: Number(best.row.input_price),
          outputPrice: best.row.output_price == null ? null : Number(best.row.output_price),
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
        exampleCostUsd: best.inputUsd + (best.outputUsd ?? 0) * 0.25,
        lastVerified: latestVerification,
      };
    })
    .filter((item): item is GuideModelPrice => item !== null)
    .slice(0, 12);
}
