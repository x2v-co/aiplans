import { subscriptionSearchCopy } from './subscription-search';
import type { Locale } from './seo';
import type { GroupedProduct } from './grouped-products';

export interface SeoPlan {
  id: number;
  name: string;
  pricing_model: string;
  price: number | null;
  price_unit: string | null;
  currency: string | null;
  is_contact_sales: boolean | null;
}

export interface PriceFloor {
  price: number;
  currency: string;
  name: string;
}

export interface PricingCopy {
  title: string;
  description: string;
}

// Keep minima separate by currency. A native CNY amount must never be ranked
// against a USD amount without a verified exchange rate, or relabelled as USD.
export function priceFloors(rows: PriceFloor[]): PriceFloor[] {
  const floors = new Map<string, PriceFloor>();
  for (const row of rows) {
    if (!Number.isFinite(row.price) || row.price < 0 || !/^[A-Z]{3}$/.test(row.currency)) continue;
    const previous = floors.get(row.currency);
    if (!previous || row.price < previous.price) floors.set(row.currency, row);
  }
  return [...floors.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export function seoPrice({ price, currency }: PriceFloor): string {
  // Token rates need more than two decimals; never round a positive rate to 0.
  const amount = price.toLocaleString('en-US', { maximumSignificantDigits: 10 });
  return `${currency === 'USD' ? '$' : `${currency} `}${amount}`;
}

export function monthlyPlanFloors(plans: SeoPlan[]): PriceFloor[] {
  return priceFloors(plans.flatMap((p) =>
    p.pricing_model === 'subscription' && p.price_unit === 'per_month' &&
    !p.is_contact_sales && p.price != null && p.currency
      ? [{ price: p.price, currency: p.currency, name: p.name }]
      : [],
  ));
}

function monthlyFrom(plans: SeoPlan[], locale: Locale): string {
  const floors = monthlyPlanFloors(plans);
  if (!floors.length) return '';
  const prices = floors.map(seoPrice).join(' / ');
  return locale === 'zh' ? `，月付 ${prices} 起` : `, from ${prices}/mo`;
}

export function buildComparisonPricingCopy(
  modelName: string, plans: SeoPlan[], locale: Locale, year = new Date().getUTCFullYear(),
  modelSlug = '',
): PricingCopy {
  const subscriptions = plans.filter(plan => plan.pricing_model === 'subscription');
  const from = monthlyFrom(subscriptions, locale);
  const heading = subscriptionSearchCopy(modelSlug, modelName, locale).heading;
  return locale === 'zh' ? {
    title: `${heading} ${year}：${subscriptions.length} 个套餐${from}`,
    description: `对比包含 ${modelName} 的 ${subscriptions.length} 个订阅套餐${from}。查看供应商、月付与年付价格、消息限额和模型权限；不同货币分别列出最低月付价。`,
  } : {
    title: `${heading} & Pricing ${year}: ${subscriptions.length} ${subscriptions.length === 1 ? 'Plan' : 'Plans'}${from}`,
    description: `Compare ${subscriptions.length} plans with ${modelName} access${from}. See monthly vs annual subscription prices and message limits. Lowest monthly prices shown by currency.`,
  };
}

export function featuredPlanNames(plans: SeoPlan[]): string[] {
  const names = [...new Set(plans.filter((p) =>
    p.pricing_model === 'subscription' && !p.is_contact_sales && p.price != null && p.price > 0,
  ).map((p) => p.name))];
  // Pick distinct consumer/team tiers when present, using only names in the
  // returned rows. This avoids three Pro price variants crowding out Team.
  const selected = [/(?:^|\s)Plus(?:\s|$)/i, /(?:^|\s)Pro(?:\s|$)/i, /(?:^|\s)(?:Team|Business)(?:\s|$)/i]
    .flatMap((pattern) => names.find((name) => pattern.test(name)) ?? []);
  return [...new Set([...selected, ...names])].slice(0, 3);
}

function compactNames(names: string[]): string {
  if (names.length < 2) return names.join(', ');
  const prefix = names[0].split(' ').slice(0, -1).join(' ') + ' ';
  return prefix.trim() && names.every((name) => name.startsWith(prefix))
    ? names.map((name, index) => index ? name.slice(prefix.length) : name).join(', ')
    : names.join(', ');
}

export function buildProviderPricingCopy(
  providerName: string, plans: SeoPlan[], locale: Locale, year = new Date().getUTCFullYear(),
  slug?: string,
): PricingCopy {
  const names = compactNames(featuredPlanNames(plans));
  const from = monthlyFrom(plans, locale);
  // Bing queries for this provider are "月之暗面api" and "月之暗面订阅".
  // Counts and tier names still come from the plan rows, not from a fixed list.
  if (locale === 'zh' && slug === 'moonshot-china') {
    return {
      title: `月之暗面 API 价格与订阅 ${year}${names ? `：${names}` : ''}`,
      description: `月之暗面（Kimi / Moonshot）API 价格与订阅：对比 ${plans.length} 个套餐${from}${names ? `，包括 ${names}` : ''}。查看按量 API 价格、月付与年付，以及各档包含的模型。`,
    };
  }
  return locale === 'zh' ? {
    title: `${providerName} 套餐与价格 ${year}${names ? `：${names} 对比` : ''}`,
    description: `对比 ${providerName} 的 ${plans.length} 个套餐${from}${names ? `，包括 ${names}` : ''}。查看月付与年付价格、模型权限和使用限额，选择适合个人或团队的方案。`,
  } : {
    title: `${providerName} Plans & Pricing ${year}${names ? `: ${names} Compared` : ''}`,
    description: `Compare ${plans.length} ${providerName} plans${from}${names ? `: ${names}` : ''}. Check monthly vs annual prices, model access and usage limits.`,
  };
}

export function buildPlansIndexPricingCopy(
  providers: Array<{ name: string; planCount: number }>, locale: Locale, year = new Date().getUTCFullYear(),
): PricingCopy {
  const count = providers.reduce((sum, p) => sum + p.planCount, 0);
  const names = providers.slice(0, 4).map((p) => p.name).join(', ');
  return locale === 'zh' ? {
    title: `AI 订阅套餐价格对比 ${year}：${count} 个套餐、${providers.length} 家供应商`,
    description: `AI 套餐比价：对比 ${providers.length} 家供应商的 ${count} 个套餐${names ? `，包括 ${names}` : ''}。查看月付与年付价格、模型权限和个人/团队档位。`,
  } : {
    title: `AI Plans & Pricing ${year}: Compare ${count} Plans from ${providers.length} Providers`,
    description: `Compare ${count} AI plans from ${providers.length} providers${names ? `, including ${names}` : ''}. Browse monthly and annual subscription pricing, model access, and individual or team tiers.`,
  };
}

export function databaseDate(value: Date | string | null): string | null {
  if (value == null) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

export function buildApiPricingSeo(
  products: GroupedProduct[], updatedAt: Date | string | null, locale: Locale,
  year = new Date().getUTCFullYear(),
) {
  const isZh = locale === 'zh';
  const channels = products.flatMap((product) => product.versions
    .filter((channel) => channel.is_available !== false)
    .map((channel) => ({ product, channel })));
  const providerCount = new Set(channels.map(({ channel }) => channel.provider_id)).size;
  const floors = priceFloors(channels.flatMap(({ product, channel }) =>
    channel.price_unit === 'per_1m_tokens' && channel.input_price_per_1m != null
      ? [{ price: channel.input_price_per_1m, currency: channel.currency,
        name: `${channel.model_slug && channel.model_slug !== product.slug ? channel.model_slug : product.name} (${channel.providers.name})` }]
      : [],
  ));
  const updatedOn = databaseDate(updatedAt);
  const heading = isZh ? 'AI 大模型 API 价格对比（每百万 token）' : 'AI Model API Pricing Comparison (per Million Tokens)';
  const updateText = updatedOn ? (isZh ? `价格数据更新于 ${updatedOn}。` : `Updated ${updatedOn}.`) : '';
  const introduction = isZh
    ? `AI API 比价：对比 ${products.length} 个模型、${providerCount} 家供应商的 ${channels.length} 个渠道，查看每百万 token 的输入、输出和缓存价格，寻找便宜 API。`
    : `Compare ${products.length} AI models across ${channels.length} API channels & ${providerCount} providers. Find cheaper input, output & cached rates per million tokens.`;
  const description = isZh ? `${introduction}${updateText}` : `${introduction} ${updateText}`.trim();
  const faqs = [{
    question: isZh ? 'AI 大模型 API 的 token 价格怎么对比？' : 'How do I compare AI model API token prices?',
    answer: isZh
      ? `本站收录 ${products.length} 个模型、${channels.length} 个可用 API 渠道和 ${providerCount} 家供应商。每百万 token 的输入、输出和缓存输入价格分别列出；实际费用取决于各类 token 的用量。`
      : `This table covers ${products.length} models and ${channels.length} available API channels from ${providerCount} providers. Compare input, output and cached input prices separately per million tokens; your cost depends on the amount of each token type used.`,
  }];
  if (floors.length) faqs.push({
    question: isZh ? '哪些 API 的输入 token 价格最低？' : 'Which APIs have the lowest input token prices?',
    answer: isZh
      ? `按货币分别比较当前可用渠道的主报价，每百万输入 token 的最低价为：${floors.map((f) => `${f.name}，${seoPrice(f)}`).join('；')}。这是输入价格对比；输出、缓存和其他价格变体需另行查看。`
      : `Among available channel headline prices, the lowest rates per million input tokens in each currency are: ${floors.map((f) => `${f.name} at ${seoPrice(f)}`).join('; ')}. Check output, cached rates and other price variants separately.`,
  });
  faqs.push({
    question: isZh ? '不同货币的 API 价格能直接比较吗？' : 'Can I directly compare API prices in different currencies?',
    answer: isZh
      ? '不能把不同货币的数字直接比较。报价保留供应商原始货币；上面的最低输入价按货币分别列出。跨货币比价需要先核对汇率。'
      : 'Compare amounts in the same currency first. Quotes retain the provider’s original currency, and the lowest input rates above are listed separately by currency. Cross-currency comparisons require an exchange rate check.',
  });
  if (updatedOn) faqs.push({
    question: isZh ? 'API 价格数据更新于哪一天？' : 'When was the API pricing data updated?',
    answer: isZh
      ? `当前可用 LLM 渠道及其公开价格变体中，数据库最近一次价格记录更新日期为 ${updatedOn}（UTC）。该日期不表示所有渠道都在同一天核验；实际账单请以供应商报价为准。`
      : `The latest database price-row update among available LLM channels and their public price variants is ${updatedOn} (UTC). This does not mean every channel was verified that day; confirm the provider’s quote before purchasing.`,
  });
  return { title: `${heading} ${year}`, heading, description, introduction, updatedOn, faqs };
}
