/**
 * Data-driven, localized copy for a model detail page.
 *
 * The 400+ `/models/[slug]` pages are the site's core SEO/GEO landing pages but
 * used to render only a price table and a handful of stat cards — no prose, no
 * FAQ, nothing an answer engine can quote. Every model has the same *shape* of
 * facts (producer, context window, channel count, cheapest/official price,
 * Arena ELO, China availability, plans that include it), so we synthesize a
 * truthful summary and a per-model FAQ from those facts instead of hand-writing
 * 400 blurbs.
 *
 * Everything here is derived from values the page already queried — no
 * invented capabilities, no "best model ever" marketing. If a fact is absent
 * from the data, the sentence that needs it is omitted rather than guessed.
 */
import { convertToUSD } from './currency-conversion';
import { formatPrice, type CurrencyCode } from './currency';
import type { Locale } from './seo';

export interface ModelCopyChannel {
  input_price_per_1m: number | null;
  output_price_per_1m: number | null;
  currency: string | null;
  providers?: {
    name?: string | null;
    type?: string | null;
    region?: string | null;
    access_from_china?: boolean | null;
    website?: string | null;
  } | null;
}

export interface ModelCopyPlan {
  name: string;
  providers?: { name?: string | null } | null;
}

export interface ModelCopyContext {
  name: string;
  producerName?: string | null;
  /** 'chat' | 'thinking llm' | etc. Used only to pick a noun like "reasoning model". */
  modelType?: string | null;
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
  channels: ModelCopyChannel[];
  officialChannel?: ModelCopyChannel | null;
  cheapestChannel?: ModelCopyChannel | null;
  plans: ModelCopyPlan[];
  arenaElo?: number | null;
}

export interface FaqItem {
  question: string;
  answer: string;
}

interface ModelCopy {
  /** One-paragraph factual summary, plain text (no markup). */
  summary: string;
  /** Question/answer pairs, mirrored by a visible FAQ and FAQPage JSON-LD. */
  faqs: FaqItem[];
}

const cur = (c: ModelCopyChannel): CurrencyCode => (c.currency || 'USD') as CurrencyCode;

function formatCtx(tokens: number): string {
  if (tokens >= 1_000_000) {
    const v = tokens / 1_000_000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}M`;
  }
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return String(tokens);
}

function priceRangeUSD(channels: ModelCopyChannel[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  let any = false;
  for (const c of channels) {
    if (typeof c.input_price_per_1m !== 'number' || c.input_price_per_1m <= 0) continue;
    const v = convertToUSD(c.input_price_per_1m, cur(c));
    if (!Number.isFinite(v)) continue;
    any = true;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return any ? { min, max } : null;
}

function channelLabel(c: ModelCopyChannel): string {
  return c.providers?.name?.trim() || 'the provider';
}

function chinaChannels(channels: ModelCopyChannel[]): ModelCopyChannel[] {
  return channels.filter((c) => c.providers?.access_from_china);
}

function planNames(plans: ModelCopyPlan[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of plans) {
    const n = p.name?.trim();
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

function modelNoun(type: string | null | undefined, locale: Locale): string {
  const t = (type || '').toLowerCase();
  if (t.includes('thinking') || t.includes('reason')) {
    return locale === 'zh' ? '推理模型' : 'reasoning model';
  }
  if (t.includes('image') || t.includes('vision') || t.includes('multimodal')) {
    return locale === 'zh' ? '多模态模型' : 'multimodal model';
  }
  if (t.includes('embed')) {
    return locale === 'zh' ? '嵌入模型' : 'embedding model';
  }
  return locale === 'zh' ? '大语言模型' : 'large language model';
}

export function buildModelCopy(ctx: ModelCopyContext, locale: Locale): ModelCopy {
  const isZh = locale === 'zh';
  const { name, channels, officialChannel, cheapestChannel, plans } = ctx;
  const producer = ctx.producerName?.trim();
  const range = priceRangeUSD(channels);
  const cheapestName = cheapestChannel ? channelLabel(cheapestChannel) : null;
  const officialName = officialChannel ? channelLabel(officialChannel) : null;
  const cnChannels = chinaChannels(channels);
  const plansList = planNames(plans);

  // ── Summary ──────────────────────────────────────────────────────────
  const summaryParts: string[] = [];

  if (isZh) {
    let lead = `${name}`;
    if (producer) lead += ` 是 ${producer} 推出的${modelNoun(ctx.modelType, locale)}`;
    else lead += ` 是一款${modelNoun(ctx.modelType, locale)}`;
    if (ctx.contextWindow) lead += `，上下文窗口为 ${formatCtx(ctx.contextWindow)} tokens`;
    if (ctx.maxOutputTokens) lead += `，单次最大输出 ${formatCtx(ctx.maxOutputTokens)} tokens`;
    lead += '。';
    summaryParts.push(lead);

    if (range) {
      const priceStr =
        range.min === range.max
          ? `约 ${formatPrice(range.min, 'USD', locale)} /1M 输入 tokens`
          : `${formatPrice(range.min, 'USD', locale)}–${formatPrice(range.max, 'USD', locale)} /1M 输入 tokens（按美元折算）`;
      let s = `本站追踪的 ${channels.length} 个 API 渠道中，输入价格区间为 ${priceStr}`;
      if (cheapestName && cheapestChannel && cheapestChannel.input_price_per_1m) {
        const native = formatPrice(cheapestChannel.input_price_per_1m, cur(cheapestChannel), locale);
        s += `，最便宜的是 ${cheapestName}（${native}/1M 输入）`;
      }
      s += '。';
      summaryParts.push(s);
    }

    if (officialChannel && officialChannel.input_price_per_1m && officialName) {
      summaryParts.push(
        `官方渠道 ${officialName} 的定价为 ${formatPrice(
          officialChannel.input_price_per_1m,
          cur(officialChannel),
          locale,
        )}/1M 输入、${formatPrice(officialChannel.output_price_per_1m ?? 0, cur(officialChannel), locale)}/1M 输出。`,
      );
    }

    if (cnChannels.length > 0) {
      const names = cnChannels.slice(0, 3).map(channelLabel).join('、');
      summaryParts.push(
        `在中国大陆可直连的渠道包括 ${names}${cnChannels.length > 3 ? ' 等' : ''}。`,
      );
    } else if (channels.length > 0) {
      summaryParts.push('该模型的追踪渠道在中国大陆通常需要代理或 VPN 才能访问。');
    }

    if (plansList.length > 0) {
      summaryParts.push(`可通过订阅套餐使用，例如 ${plansList.slice(0, 4).join('、')}。`);
    }

    if (ctx.arenaElo) {
      summaryParts.push(`Chatbot Arena ELO 评分约为 ${Math.round(ctx.arenaElo)}。`);
    }

    summaryParts.push('价格由每小时自动抓取官方与各渠道页面生成，并经过每日数据准确性审计。');
  } else {
    let lead = `${name} is a ${modelNoun(ctx.modelType, locale)}`;
    if (producer) lead += ` by ${producer}`;
    if (ctx.contextWindow) lead += ` with a ${formatCtx(ctx.contextWindow)}-token context window`;
    if (ctx.maxOutputTokens) lead += ` and a ${formatCtx(ctx.maxOutputTokens)}-token maximum output`;
    lead += '.';
    summaryParts.push(lead);

    if (range) {
      const priceStr =
        range.min === range.max
          ? `${formatPrice(range.min, 'USD', locale)} per 1M input tokens`
          : `${formatPrice(range.min, 'USD', locale)}–${formatPrice(range.max, 'USD', locale)} per 1M input tokens (USD-normalized)`;
      let s = `Across the ${channels.length} API channels tracked here, input pricing ranges from ${priceStr}`;
      if (cheapestName && cheapestChannel && cheapestChannel.input_price_per_1m) {
        const native = formatPrice(cheapestChannel.input_price_per_1m, cur(cheapestChannel), locale);
        s += `; the cheapest is ${cheapestName} at ${native} per 1M input tokens`;
      }
      s += '.';
      summaryParts.push(s);
    }

    if (officialChannel && officialChannel.input_price_per_1m && officialName) {
      summaryParts.push(
        `The official channel (${officialName}) charges ${formatPrice(
          officialChannel.input_price_per_1m,
          cur(officialChannel),
          locale,
        )} per 1M input tokens and ${formatPrice(
          officialChannel.output_price_per_1m ?? 0,
          cur(officialChannel),
          locale,
        )} per 1M output tokens.`,
      );
    }

    if (cnChannels.length > 0) {
      const names = cnChannels.slice(0, 3).map(channelLabel).join(', ');
      summaryParts.push(
        `Channels reachable from mainland China without a VPN include ${names}${
          cnChannels.length > 3 ? ', among others' : ''
        }.`,
      );
    } else if (channels.length > 0) {
      summaryParts.push('None of the tracked channels are directly reachable from mainland China without a proxy or VPN.');
    }

    if (plansList.length > 0) {
      summaryParts.push(`It is also available through subscription plans such as ${plansList.slice(0, 4).join(', ')}.`);
    }

    if (ctx.arenaElo) {
      summaryParts.push(`Its Chatbot Arena ELO is approximately ${Math.round(ctx.arenaElo)}.`);
    }

    summaryParts.push(
      'Prices are collected hourly from official provider pages and every tracked channel, then cross-checked by a daily data-accuracy audit.',
    );
  }

  // ── FAQs ─────────────────────────────────────────────────────────────
  const faqs: FaqItem[] = [];

  // 1. Cheapest channel
  if (cheapestChannel && cheapestChannel.input_price_per_1m && cheapestName) {
    const native = formatPrice(cheapestChannel.input_price_per_1m, cur(cheapestChannel), locale);
    const outNative = formatPrice(cheapestChannel.output_price_per_1m ?? 0, cur(cheapestChannel), locale);
    const usd = convertToUSD(Number(cheapestChannel.input_price_per_1m), cur(cheapestChannel));
    if (isZh) {
      faqs.push({
        question: `${name} 最便宜的 API 渠道是哪个？`,
        answer:
          `在本站追踪的渠道中，${cheapestName} 最便宜，输入价格为 ${native}/1M tokens，输出 ${outNative}/1M tokens` +
          (Number.isFinite(usd) ? `（约合 ${formatPrice(usd, 'USD', locale)}/1M 输入）。` : '。') +
          ' 实际价格以供应商页面为准，本站每小时更新。',
      });
    } else {
      faqs.push({
        question: `What is the cheapest API provider for ${name}?`,
        answer:
          `Of the channels tracked here, ${cheapestName} is the cheapest at ${native} per 1M input tokens and ${outNative} per 1M output tokens` +
          (Number.isFinite(usd) ? ` (about ${formatPrice(usd, 'USD', locale)} per 1M input).` : '.') +
          ' Confirm on the provider\'s page; figures are updated hourly.',
      });
    }
  }

  // 2. Official price
  if (officialChannel && officialChannel.input_price_per_1m && officialName) {
    const inP = formatPrice(officialChannel.input_price_per_1m, cur(officialChannel), locale);
    const outP = formatPrice(officialChannel.output_price_per_1m ?? 0, cur(officialChannel), locale);
    if (isZh) {
      faqs.push({
        question: `${name} 官方 API 价格是多少？`,
        answer: `${officialName} 官方定价为输入 ${inP}/1M tokens、输出 ${outP}/1M tokens。`,
      });
    } else {
      faqs.push({
        question: `What is the official API price of ${name}?`,
        answer: `${officialName} lists ${name} at ${inP} per 1M input tokens and ${outP} per 1M output tokens.`,
      });
    }
  }

  // 3. China access
  if (channels.length > 0) {
    if (cnChannels.length > 0) {
      const names = cnChannels.slice(0, 4).map(channelLabel).join(isZh ? '、' : ', ');
      if (isZh) {
        faqs.push({
          question: `${name} 在中国大陆能用吗？`,
          answer: `可以。以下渠道支持中国大陆直连：${names}。国内厂商渠道通常支持支付宝/微信付款。`,
        });
      } else {
        faqs.push({
          question: `Can I use ${name} from mainland China?`,
          answer: `Yes — these channels are directly reachable from mainland China without a VPN: ${names}. Domestic channels generally support Alipay/WeChat Pay.`,
        });
      }
    } else {
      if (isZh) {
        faqs.push({
          question: `${name} 在中国大陆能用吗？`,
          answer: '本站追踪的渠道均无法从中国大陆直连，访问官方或国际渠道通常需要代理或 VPN。',
        });
      } else {
        faqs.push({
          question: `Can I use ${name} from mainland China?`,
          answer: 'None of the tracked channels are directly reachable from mainland China; reaching the official or international channels normally requires a proxy or VPN.',
        });
      }
    }
  }

  // 4. Context window
  if (ctx.contextWindow) {
    const ctxStr = ctx.contextWindow.toLocaleString();
    if (isZh) {
      faqs.push({
        question: `${name} 的上下文窗口有多大？`,
        answer: `${name} 的上下文窗口为 ${ctxStr} tokens` +
          (ctx.maxOutputTokens ? `，单次最大输出约 ${ctx.maxOutputTokens.toLocaleString()} tokens。` : '。'),
      });
    } else {
      faqs.push({
        question: `What is the context window of ${name}?`,
        answer: `${name} offers a ${ctxStr}-token context window` +
          (ctx.maxOutputTokens ? ` and a maximum output of about ${ctx.maxOutputTokens.toLocaleString()} tokens.` : '.'),
      });
    }
  }

  // 5. Subscription plans
  if (plansList.length > 0) {
    if (isZh) {
      faqs.push({
        question: `有哪些订阅套餐包含 ${name}？`,
        answer: `以下套餐包含 ${name}：${plansList.slice(0, 6).join('、')}。可点击对应套餐查看完整档位与年付价格。`,
      });
    } else {
      faqs.push({
        question: `Which subscription plans include ${name}?`,
        answer: `${name} is included in these plans: ${plansList.slice(0, 6).join(', ')}. Open a plan for full tier and annual-pricing details.`,
      });
    }
  }

  // 6. Data freshness (E-E-A-T; same on every model page but the question is model-scoped)
  if (isZh) {
    faqs.push({
      question: `${name} 的价格多久更新一次？数据可靠吗？`,
      answer:
        '价格每小时从官方定价页和各渠道自动抓取，并写入价格历史。另有每日只读数据审计，交叉核对每个渠道与模型生产方的官方价，发现过期或异常行会标记并修正。',
    });
  } else {
    faqs.push({
      question: `How often are ${name} prices updated, and how reliable is the data?`,
      answer:
        'Prices are scraped hourly from official pricing pages and every tracked channel, with every significant change recorded in a price-history log. A daily read-only data audit cross-checks each channel against the model producer\'s published price and flags stale or inconsistent rows for correction.',
    });
  }

  return { summary: summaryParts.join(' '), faqs };
}
