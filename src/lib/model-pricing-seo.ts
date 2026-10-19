import { CURRENCY_INFO, type CurrencyCode } from './currency';
import { convertToUSD } from './currency-conversion';
import { effectivePrice, type ScheduledChannelPrice } from './effective-price';
import { modelAliases } from './model-aliases';
import { pickOfferCurrency, priceValidUntil, SITE_URL, type Locale } from './seo';

export interface PricingChannel extends ScheduledChannelPrice {
  id?: number;
  currency?: string | null;
  price_unit?: string | null;
  is_available?: boolean | null;
  updated_at?: Date | string | null;
  last_verified?: Date | string | null;
  providers?: { name?: string | null; type?: string | null; website?: string | null } | null;
}

export function isRealPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function pricingDate(row: Pick<PricingChannel, 'updated_at' | 'last_verified'>): string | null {
  const times = [row.updated_at, row.last_verified]
    .filter(value => value != null).map(value => new Date(value!).getTime()).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString().slice(0, 10) : null;
}

/** Keep the published currency and all price precision, including genuine zero rates. */
export function pricingLabel(value: unknown, currency: string | null | undefined): string {
  return isRealPrice(value) ? `${currency || 'USD'} ${value}` : '—';
}

export function buildModelPricingSeo(
  model: { name: string; slug: string; updated_at?: Date | string | null },
  rows: PricingChannel[],
  locale: Locale,
  now = new Date(),
) {
  const isZh = locale === 'zh';
  const channels = rows.map(row => effectivePrice(row, now)).filter(row =>
    row.is_available !== false && (row.price_unit == null || row.price_unit === 'per_1m_tokens') &&
    Object.hasOwn(CURRENCY_INFO, row.currency || 'USD'));
  const pricedChannels = channels.filter(row => isRealPrice(row.input_price_per_1m))
    .sort((a, b) => convertToUSD(a.input_price_per_1m!, (a.currency || 'USD') as CurrencyCode) -
      convertToUSD(b.input_price_per_1m!, (b.currency || 'USD') as CurrencyCode));
  const cheapest = pricedChannels[0];
  const official = channels.filter(row => row.providers?.type === 'producer' || row.providers?.type === 'official');
  const tableChannels = [...new Set([...official, ...pricedChannels.slice(0, 3)])];
  const dates = channels.filter(row => [row.input_price_per_1m, row.output_price_per_1m,
    row.cached_input_price_per_1m].some(isRealPrice)).map(pricingDate).filter((date): date is string => date != null);
  const updatedOn = dates.sort().at(-1) ?? pricingDate(model);
  const updateText = updatedOn
    ? (isZh ? `更新于 ${updatedOn}` : `Updated on ${updatedOn}`)
    : (isZh ? '更新日期暂无记录' : 'Update date not recorded');
  // One template for every Chinese model page. Search queries put 价格
  // directly after the model name ("glm 5.3 flash 价格", "deepseek v4.1 flash价格").
  const title = isZh ? `${model.name} 价格`
    : `${model.name} API Pricing / Price per 1M tokens`;
  const cheapestLabel = cheapest ? pricingLabel(cheapest.input_price_per_1m, cheapest.currency) : null;
  const description = isZh
    ? `${model.name} API 定价：${cheapestLabel ? `最低输入价格 ${cheapestLabel}/百万 tokens。` : '暂无可用输入报价。'}对比官方与渠道的输入、输出和缓存读取价格。${updateText}。`
    : `${model.name} API pricing: ${cheapestLabel ? `lowest input price ${cheapestLabel} per 1M tokens.` : 'No input price available.'} Compare official and channel input, output and cache-read rates. ${updateText}.`;

  // One native currency per AggregateOffer; never publish converted rates as offers.
  const offerCurrency = pickOfferCurrency(pricedChannels.map(row => row.currency || 'USD'));
  const offerChannels = pricedChannels.filter(row => (row.currency || 'USD') === offerCurrency);
  const prices = offerChannels.map(row => row.input_price_per_1m!);
  const offerValidUntil = priceValidUntil();
  const aggregateOffer = offerCurrency == null ? undefined : {
    '@type': 'AggregateOffer', priceCurrency: offerCurrency,
    lowPrice: String(Math.min(...prices)), highPrice: String(Math.max(...prices)), offerCount: prices.length,
    priceSpecification: { '@type': 'UnitPriceSpecification', priceCurrency: offerCurrency, unitText: 'per 1M input tokens' },
    offers: offerChannels.map(row => ({
      '@type': 'Offer', priceCurrency: offerCurrency, price: String(row.input_price_per_1m),
      priceSpecification: { '@type': 'UnitPriceSpecification', priceCurrency: offerCurrency,
        price: String(row.input_price_per_1m), unitText: 'per 1M input tokens' },
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/${locale}/models/${encodeURIComponent(model.slug)}`,
      priceValidUntil: offerValidUntil,
      ...(row.providers?.name ? { seller: { '@type': 'Organization', name: row.providers.name,
        url: row.providers.website ?? undefined } } : {}),
      category: row.providers?.type ?? undefined,
    })),
  };

  const priceAnswer = cheapest
    ? (isZh ? `最低输入报价为每百万 tokens ${cheapestLabel}，同一渠道输出价格为 ${pricingLabel(cheapest.output_price_per_1m, cheapest.currency)}。`
      : `The lowest input rate is ${cheapestLabel} per 1M tokens; output on that channel is ${pricingLabel(cheapest.output_price_per_1m, cheapest.currency)} per 1M tokens.`)
    : (isZh ? '暂无可用的输入报价。' : 'No input rate is available.');
  const cacheChannels = channels.filter(row => isRealPrice(row.cached_input_price_per_1m));
  const cacheAnswer = cacheChannels.length
    ? cacheChannels.map(row => `${row.providers?.name || (isZh ? '渠道' : 'Channel')}: ${pricingLabel(row.cached_input_price_per_1m, row.currency)}`).join('; ') + (isZh ? '，均为每百万缓存读取 tokens 的报价。' : ' per 1M cache-read tokens.')
    : (isZh ? '暂无缓存读取报价；未记录价格不代表免费。' : 'No cache-read rate is recorded; missing prices do not imply free caching.');
  const faqs = [
    { question: isZh ? `${model.name} API 多少钱？` : `How much does the ${model.name} API cost?`, answer: priceAnswer },
    { question: isZh ? `${model.name} 哪个渠道最便宜？` : `Which channel has the cheapest ${model.name} API?`,
      answer: cheapest ? (isZh ? `${cheapest.providers?.name || '渠道'} 的输入报价最低：${cheapestLabel}/百万 tokens。跨币种排名使用汇率换算；输出和缓存价格单独比较。`
        : `${cheapest.providers?.name || 'The channel'} has the lowest input rate: ${cheapestLabel} per 1M tokens. Cross-currency ranking uses exchange rates; compare output and cache prices separately.`)
        : (isZh ? '暂无可用于比较的输入报价。' : 'No input rates are available to compare.') },
    { question: isZh ? `${model.name} 缓存读取价格是多少？` : `What is the ${model.name} cache-read price?`, answer: cacheAnswer },
    { question: isZh ? `${model.name} 价格最后何时更新？` : `When was ${model.name} pricing last updated?`,
      answer: `${updateText}${isZh ? '。日期取已记录的最新价格更新或核验时间；各渠道时间见价格表。' : '. This is the latest recorded price update or verification; see the table for individual channel dates.'}` },
  ];
  return { title, description, aliases: modelAliases(model.name, model.slug), channels, pricedChannels,
    cheapest, official, tableChannels, updatedOn, updateText, aggregateOffer, faqs };
}
