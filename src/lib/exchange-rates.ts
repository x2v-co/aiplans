/**
 * 汇率服务 - 每天更新一次
 */

/**
 * 汇率数据结构
 */
export interface ExchangeRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
  is_active: boolean;
  valid_at: string;
  updated_at: string;
}

/**
 * 固定汇率（每天更新一次）
 */
const FIXED_RATES: Record<string, Record<string, number>> = {
  // USD 基准
  'USD': {
    'CNY': 6.90,
    'EUR': 0.92,
    'GBP': 0.79,
    'JPY': 149.5,
    'KRW': 1320,
    'SGD': 1.35,
  },
  // 反向汇率
  'CNY': { 'USD': 1 / 6.90 },
  'EUR': { 'USD': 1 / 0.92 },
  'GBP': { 'USD': 1 / 0.79 },
  'JPY': { 'USD': 1 / 149.5 },
  'KRW': { 'USD': 1 / 1320 },
  'SGD': { 'USD': 1 / 1.35 },
};

/**
 * 获取汇率（同步版本）
 */
export function getExchangeRateSync(
  from: string,
  to: string
): number {
  if (from === to) return 1;
  const direct = FIXED_RATES[from]?.[to];
  if (direct !== undefined) return direct;
  // Cross rate via USD (e.g. EUR -> CNY); previously fell back to 1.
  const toUsd = FIXED_RATES[from]?.USD;
  const fromUsd = FIXED_RATES.USD?.[to];
  if (toUsd !== undefined && fromUsd !== undefined) return toUsd * fromUsd;
  return 1;
}

/**
 * 获取汇率显示字符串
 */
export function getExchangeRateDisplay(from: string, to: string): string {
  const rate = getExchangeRateSync(from, to);
  return `1 ${from} ≈ ${rate} ${to}`;
}

/**
 * 设置全局汇率缓存（由外部系统调用）
 */
export function setGlobalExchangeRates(rates: Record<string, Record<string, number>>): void {
  Object.keys(FIXED_RATES).forEach(from => {
    FIXED_RATES[from] = rates[from];
  });
  console.log('🌍 Global exchange rates updated');
}
