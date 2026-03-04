/**
 * 货币相关工具函数
 * 用于格式化和处理不同货币的价格显示
 */

export type CurrencyCode = 'USD' | 'CNY' | 'EUR' | 'GBP' | 'JPY' | 'KRW';

export type PriceUnit = 'per_month' | 'per_year' | 'per_1m_tokens' | 'per_1k_tokens' | 'per_pack' | 'per_request';

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
}

/**
 * 货币元数据映射
 */
export const CURRENCY_INFO: Record<CurrencyCode, CurrencyInfo> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', locale: 'ko-KR' },
};

/**
 * 价格单位元数据映射
 */
export const PRICE_UNIT_INFO: Record<PriceUnit, { label: { en: string; zh: string } }> = {
  per_month: { label: { en: '/month', zh: '/月' } },
  per_year: { label: { en: '/year', zh: '/年' } },
  per_1m_tokens: { label: { en: '/1M tokens', zh: '/百万tokens' } },
  per_1k_tokens: { label: { en: '/1K tokens', zh: '/千tokens' } },
  per_pack: { label: { en: '/pack', zh: '/包' } },
  per_request: { label: { en: '/request', zh: '/请求' } },
};

/**
 * 根据区域获取默认货币
 */
export function getDefaultCurrencyForRegion(region: string): CurrencyCode {
  return region === 'china' ? 'CNY' : 'USD';
}

/**
 * 格式化价格
 * @param price 价格数值
 * @param currency 货币代码
 * @param locale 显示语言环境
 * @returns 格式化后的价格字符串
 */
export function formatPrice(
  price: number | null | undefined,
  currency: CurrencyCode = 'USD',
  locale: string = 'en'
): string {
  if (price === null || price === undefined) return '-';

  const info = CURRENCY_INFO[currency];
  const displayLocale = locale === 'zh' ? 'zh-CN' : info.locale;

  return new Intl.NumberFormat(displayLocale, {
    style: 'currency',
    currency: info.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * 格式化价格（简化版，只返回数值）
 * @param price 价格数值
 * @param currency 货币代码
 * @param decimals 小数位数
 * @returns 格式化后的价格字符串（不带货币符号）
 */
export function formatPriceSimple(
  price: number | null | undefined,
  decimals: number = 2
): string {
  if (price === null || price === undefined) return '-';

  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 获取货币符号
 */
export function getCurrencySymbol(currency: CurrencyCode): string {
  return CURRENCY_INFO[currency]?.symbol || '$';
}

/**
 * 格式化带单位的价格
 * @param price 价格数值
 * @param currency 货币代码
 * @param unit 价格单位
 * @param locale 显示语言环境
 * @returns 完整的价格字符串（如 "$20.00/month"）
 */
export function formatPriceWithUnit(
  price: number | null | undefined,
  currency: CurrencyCode = 'USD',
  unit: PriceUnit = 'per_month',
  locale: string = 'en'
): string {
  const priceStr = formatPrice(price, currency, locale);
  const unitInfo = PRICE_UNIT_INFO[unit];
  const unitLabel = locale === 'zh' ? unitInfo.label.zh : unitInfo.label.en;

  return `${priceStr}${unitLabel}`;
}

/**
 * 货币转换（简化汇率，实际应用中应使用实时汇率API）
 * @param price 原价格
 * @param fromCurrency 原货币
 * @param toCurrency 目标货币
 * @returns 转换后的价格
 */
export function convertCurrency(
  price: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): number {
  // 简化汇率（实际应用中应该使用实时汇率API）
  const EXCHANGE_RATES: Record<CurrencyCode, number> = {
    USD: 1,
    CNY: 7.2,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 149.5,
    KRW: 1320,
  };

  const fromRate = EXCHANGE_RATES[fromCurrency];
  const toRate = EXCHANGE_RATES[toCurrency];

  // 先转换为USD，再转换为目标货币
  const priceInUSD = price / fromRate;
  return priceInUSD * toRate;
}

/**
 * 比较两个不同货币的价格
 * @returns 正数表示price1更贵，负数表示price2更贵，0表示相等
 */
export function comparePrices(
  price1: number,
  currency1: CurrencyCode,
  price2: number,
  currency2: CurrencyCode
): number {
  // 统一转换为USD再比较
  const price1USD = convertCurrency(price1, currency1, 'USD');
  const price2USD = convertCurrency(price2, currency2, 'USD');

  return price1USD - price2USD;
}

/**
 * 计算比官方便宜的百分比
 * @param price 当前价格
 * @param currency 当前货币
 * @param officialPrice 官方价格
 * @param officialCurrency 官方货币
 * @returns 节省的百分比（如 15 表示 15%）
 */
export function calculateSavingsPercent(
  price: number,
  currency: CurrencyCode,
  officialPrice: number,
  officialCurrency: CurrencyCode
): number {
  // 统一转换为USD再计算
  const priceUSD = convertCurrency(price, currency, 'USD');
  const officialUSD = convertCurrency(officialPrice, officialCurrency, 'USD');

  if (officialUSD <= 0) return 0;

  const savings = ((officialUSD - priceUSD) / officialUSD) * 100;
  return Math.round(savings);
}

/**
 * 格式化节省百分比
 */
export function formatSavingsPercent(savings: number, locale: string = 'en'): string {
  if (savings > 0) {
    return locale === 'zh' ? `便宜 ${savings}%` : `Save ${savings}%`;
  } else if (savings < 0) {
    const premium = Math.abs(savings);
    return locale === 'zh' ? `贵 ${premium}%` : `${premium}% premium`;
  }
  return locale === 'zh' ? '同价' : 'Same price';
}
