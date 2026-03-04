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
    'CNY': 7.2,
    'EUR': 0.92,
    'GBP': 0.79,
    'JPY': 149.5,
    'KRW': 1320,
  },
  // 反向汇率
  'CNY': { 'USD': 1 / 7.2 },
  'EUR': { 'USD': 1 / 0.92 },
  'GBP': { 'USD': 1 / 0.79 },
  'JPY': { 'USD': 1 / 149.5 },
  'KRW': { 'USD': 1 / 1320 },
};

/**
 * 获取汇率（同步版本）
 */
export function getExchangeRateSync(
  from: string,
  to: string
): number {
  const rate = FIXED_RATES[from]?.[to] ?? 1;
  return rate;
}

/**
 * 获取汇率显示字符串
 */
export function getExchangeRateDisplay(from: string, to: string): string {
  const rate = FIXED_RATES[from]?.[to] ?? 1;
  return `1 ${from} ≈ ${to}`;
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
