/**
 * Data-driven stats + FAQ for the `/api-pricing` page — the site's core SEO
 * surface per CLAUDE.md. The page already renders all ~320 models and their
 * channels in the served HTML; this adds a stats intro, a visible FAQ, and
 * FAQPage + ItemList JSON-LD built from the same GroupedProduct[] payload.
 *
 * Every figure is computed from real rows; the cross-currency "cheapest"
 * uses the same USD-normalisation as the table itself (getCheapestChannel).
 */
import type { Locale } from './seo';
import { formatPrice, type CurrencyCode } from './currency';
import { convertToUSD } from './currency-conversion';
import { getCheapestChannel, normalizeChannelType } from './channel-price-utils';
import type { GroupedProduct } from './grouped-products';

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ApiPricingStats {
  modelCount: number;
  channelCount: number;
  providerCount: number;
  chinaModelCount: number;
  /** Cheapest available channel across every model, USD-normalised. */
  cheapest: {
    modelName: string;
    modelSlug: string;
    providerName: string;
    price: number;
    currency: CurrencyCode;
  } | null;
  typeCounts: {
    official: number;
    cloud: number;
    aggregator: number;
    reseller: number;
  };
}

export function computeApiPricingStats(
  products: GroupedProduct[],
): ApiPricingStats {
  const providerIds = new Set<number>();
  let channelCount = 0;
  let chinaModelCount = 0;
  const typeCounts = { official: 0, cloud: 0, aggregator: 0, reseller: 0 };

  let cheapest: ApiPricingStats['cheapest'] = null;
  let cheapestUsd = Infinity;

  for (const p of products) {
    let hasChina = false;
    for (const cp of p.versions) {
      channelCount++;
      providerIds.add(cp.provider_id);
      const norm = normalizeChannelType(cp.providers?.type);
      typeCounts[norm]++;
      if (cp.providers?.access_from_china) hasChina = true;
    }

    // Cheapest channel of this model, then compare its USD value across models.
    const ch = getCheapestChannel(p);
    if (ch) {
      const usdVal = ch.input_price_per_1m
        ? convertToUSD(ch.input_price_per_1m, (ch.currency || 'USD') as CurrencyCode)
        : null;
      if (usdVal != null && usdVal < cheapestUsd) {
        cheapestUsd = usdVal;
        cheapest = {
          modelName: p.name,
          modelSlug: p.slug,
          providerName: ch.providers.name,
          price: ch.input_price_per_1m,
          currency: (ch.currency || 'USD') as CurrencyCode,
        };
      }
    }

    if (hasChina) chinaModelCount++;
  }

  return {
    modelCount: products.length,
    channelCount,
    providerCount: providerIds.size,
    chinaModelCount,
    cheapest,
    typeCounts,
  };
}

export function buildApiPricingFaqs(
  stats: ApiPricingStats,
  locale: Locale,
): FaqItem[] {
  const isZh = locale === 'zh';
  const faqs: FaqItem[] = [];

  const cheapestLine = stats.cheapest
    ? isZh
      ? `在本站追踪的 ${stats.modelCount} 个模型、${stats.channelCount} 个渠道中，按美元折算后最便宜的是 ${stats.cheapest.modelName}，通过 ${stats.cheapest.providerName} 调用，输入价格为 ${formatPrice(stats.cheapest.price, stats.cheapest.currency, locale)}/1M tokens。`
      : `Of the ${stats.modelCount} models and ${stats.channelCount} channels tracked here, the cheapest in USD-normalised terms is ${stats.cheapest.modelName} via ${stats.cheapest.providerName} at ${formatPrice(stats.cheapest.price, stats.cheapest.currency, locale)} per 1M input tokens.`
    : '';

  if (cheapestLine) {
    faqs.push({
      question: isZh ? '哪个模型的 API 最便宜？' : 'Which model has the cheapest API?',
      answer:
        cheapestLine +
        (isZh
          ? ' 价格按各渠道本币报价后统一折算美元比较，实际费用以供应商页面为准。'
          : ' Prices are normalised to USD for comparison after being read in each channel\'s own currency; confirm on the provider\'s page.'),
    });
  }

  if (isZh) {
    faqs.push({
      question: '不同货币的 API 价格如何对比？',
      answer:
        `所有渠道按其本币报价（美元或人民币），对比时统一按汇率折算为美元，避免把 ¥3 当成 \$3。页面上每一行仍显示渠道的原始货币与价格。本站追踪 ${stats.channelCount} 个渠道、${stats.providerCount} 家供应商。`,
    });
    faqs.push({
      question: '官方渠道、云厂商、聚合渠道和分销商有什么区别？',
      answer:
        '官方渠道是模型生产方自己的 API（如 OpenAI、Anthropic、DeepSeek）；云厂商指 Azure、AWS Bedrock、Google Vertex 等托管的同一模型；聚合渠道（如 OpenRouter、硅基流动）把多家模型统一到一个账号和计费下；分销商则转售额度。四类的价格、速率、合规与发票主体不同，可按需求选择。',
    });
    faqs.push({
      question: '在中国大陆能直接调用这些 API 吗？',
      answer:
        `本站标注了每个渠道是否支持中国大陆直连。共有约 ${stats.chinaModelCount} 个模型至少有一个可直连渠道（含国内厂商与部分聚合渠道）；国际官方渠道通常需要代理或 VPN。可使用页面上的“中国直连”筛选。`,
    });
    faqs.push({
      question: '除了按 token 付费的 API，还有订阅套餐吗？',
      answer:
        '有。除按量计费的 API 外，本站还对比 ChatGPT Plus/Pro/Team、Claude Pro/Max/Team、Gemini Advanced、Kimi、GLM 等订阅套餐，含月付/年付价格与档位。请访问“套餐对比”查看包含指定模型的全部套餐。',
    });
    faqs.push({
      question: '这些价格多久更新一次？数据可靠吗？',
      answer:
        'API 价格每小时从官方定价页与各渠道自动抓取，显著变动会写入价格历史；另有每日只读数据审计，交叉核对每个渠道与模型生产方的官方价，发现过期或异常行会标记并修正。',
    });
  } else {
    faqs.push({
      question: 'How are API prices in different currencies compared?',
      answer:
        `Every channel is quoted in its own currency (USD or CNY), then normalised to USD at the current exchange rate for comparison — so ¥3 is never compared as if it were \$3. Each table row still shows the channel's original currency and price. We track ${stats.channelCount} channels across ${stats.providerCount} providers.`,
    });
    faqs.push({
      question: 'What is the difference between official, cloud, aggregator and reseller channels?',
      answer:
        'Official channels are the model producer\'s own API (OpenAI, Anthropic, DeepSeek); cloud channels host the same model on Azure, AWS Bedrock or Google Vertex; aggregators (OpenRouter, SiliconFlow) unify many models under one account and bill; resellers resell capacity. They differ in price, rate limits, compliance and who invoices you.',
    });
    faqs.push({
      question: 'Can I call these APIs directly from mainland China?',
      answer:
        `Each channel is flagged for direct mainland-China access. About ${stats.chinaModelCount} models have at least one directly reachable channel (including domestic producers and some aggregators); international official channels normally require a proxy or VPN. Use the "China access only" filter on the page.`,
    });
    faqs.push({
      question: 'Besides token-priced APIs, are there subscription plans?',
      answer:
        'Yes. Alongside metered API pricing we compare subscriptions such as ChatGPT Plus/Pro/Team, Claude Pro/Max/Team, Gemini Advanced, Kimi and GLM, with monthly and annual pricing. Open "Compare plans" to see every plan that includes a given model.',
    });
    faqs.push({
      question: 'How often are these prices updated, and how reliable is the data?',
      answer:
        'API prices are scraped hourly from official pricing pages and every tracked channel, with significant changes recorded in a price-history log. A daily read-only data audit cross-checks each channel against the model producer\'s published price and flags stale or inconsistent rows for correction.',
    });
  }

  return faqs;
}
