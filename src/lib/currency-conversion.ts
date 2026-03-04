/**
 * 货币转换和对比工具
 * 用于在比较不同货币的价格时进行统一计算
 */

import type { CurrencyCode } from './currency';
import { getExchangeRateSync } from './exchange-rates';

/**
 * 将价格从一种货币转换为另一种货币（使用同步汇率）
 */
export function convertPrice(
  price: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): number {
  const rate = getExchangeRateSync(fromCurrency, toCurrency);
  return price * rate;
}

/**
 * 将价格转换为 USD（用于比较）
 */
export function convertToUSD(
  price: number,
  currency: CurrencyCode
): number {
  const rate = getExchangeRateSync(currency, 'USD');
  return price * rate;
}

/**
 * 格式化汇率信息
 */
export function formatExchangeRate(
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): string {
  // 简化显示，实际使用数据库汇率
  return `1 ${fromCurrency} ≈ ${toCurrency}`;
}

/**
 * 计算两种不同货币价格的差异百分比（使用同步汇率）
 */
export function calculatePriceDifference(
  price1: number,
  currency1: CurrencyCode,
  price2: number,
  currency2: CurrencyCode
): number {
  // 统一转换为 USD 后再比较
  const price1USD = convertToUSD(price1, currency1);
  const price2USD = convertToUSD(price2, currency2);

  if (price2USD === 0) return 0;

  return ((price1USD - price2USD) / price2USD) * 100;
}

/**
 * 对比计划价格（支持不同货币）
 * @returns {
 *   originalPrice: 原始价格
 *   originalCurrency: 原始货币
 *   convertedPrice: 转换后价格（USD）
 *   isCheapest: 是否最便宜
 *   vsOfficial: 与官方对比
 * }
 */
export interface PlanPriceComparison {
  originalPrice: number;
  originalCurrency: CurrencyCode;
  displayCurrency: CurrencyCode;  // 用户选择显示的货币
  convertedPrice: number;
  isCheapest: boolean;
  vsOfficial?: {
    difference: number;
    percentage: number;
  };
}

export function comparePlanPrices(
  plans: Array<{
    price: number;
    currency: CurrencyCode;
    isOfficial: boolean;
  }>,
  displayCurrency: CurrencyCode = 'USD'
): PlanPriceComparison[] {
  if (plans.length === 0) return [];

  // 转换所有价格为显示货币
  const convertedPlans = plans.map((plan) => ({
    ...plan,
    convertedPrice: convertPrice(plan.price, plan.currency, displayCurrency),
  }));

  // 找到最便宜的价格（转换后）
  const cheapestConvertedPrice = Math.min(...convertedPlans.map((p) => p.convertedPrice));

  // 获取官方计划（如果有）
  const officialPlan = convertedPlans.find((p) => p.isOfficial);

  return convertedPlans.map((plan) => ({
    originalPrice: plan.price,
    originalCurrency: plan.currency,
    displayCurrency,
    convertedPrice: plan.convertedPrice,
    isCheapest: plan.convertedPrice === cheapestConvertedPrice,
    vsOfficial: officialPlan && !plan.isOfficial ? {
      difference: plan.convertedPrice - officialPlan.convertedPrice,
      percentage: calculatePriceDifference(
        plan.price,
        plan.currency,
        officialPlan.price,
        officialPlan.currency
      ),
    } : undefined,
  }));
}

/**
 * 格式化对比结果文本
 */
export function formatPriceComparison(
  comparison: PlanPriceComparison,
  locale: string = 'en'
): string {
  if (comparison.vsOfficial) {
    const diff = comparison.vsOfficial.percentage;
    if (diff > 0) {
      return locale === 'zh'
        ? `贵 ${Math.abs(diff)}%`
        : `${Math.abs(diff)}% premium`;
    } else if (diff < 0) {
      return locale === 'zh'
        ? `便宜 ${Math.abs(diff)}%`
        : `Save ${Math.abs(diff)}%`;
    }
    return locale === 'zh' ? '同价' : 'Same price';
  }
  return '';
}

/**
 * 获取汇率字符串（显示给用户）
 */
export function getExchangeRateDisplay(currency: CurrencyCode): string {
  if (currency === 'USD') return '';
  if (currency === 'CNY') return '(1 USD = ¥7.20)';
  if (currency === 'EUR') return '(1 USD = €0.92)';
  if (currency === 'GBP') return '(1 USD = £0.79)';
  if (currency === 'JPY') return '(1 USD = ¥149.50)';
  if (currency === 'KRW') return '(1 USD = ₩1320)';
  return '';
}
