export type DeepSeekPricingWindow = 'peak' | 'off-peak';
export interface DeepSeekRate { input: number; output: number; cache?: number | null }
export interface DeepSeekObservation extends DeepSeekRate { observed_at: string }
export type DeepSeekObservations = Partial<Record<DeepSeekPricingWindow, DeepSeekObservation>>;

// Official rule: weekends and CN statutory holidays are off-peak all day; peak is Mon-Fri only,
// so a Saturday/Sunday make-up workday (调休) stays off-peak.
// 2026 dates: 国办发明电〔2025〕7号 https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm
// Weekday holidays only (weekends are already off-peak). Add 2027 when the State Council publishes it.
export const DEEPSEEK_CN_HOLIDAYS: readonly string[] = [
  '2026-01-01', '2026-01-02',
  '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-23',
  '2026-04-06',
  '2026-05-01', '2026-05-04', '2026-05-05',
  '2026-06-19',
  '2026-09-25',
  '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07',
];
export const DEEPSEEK_HOLIDAY_SOURCE = 'https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm';
export const DEEPSEEK_SOURCE = 'https://api-docs.deepseek.com/quick_start/pricing';
export const DEEPSEEK_PEAK_SCHEDULE = '01:00-04:00 & 06:00-10:00 UTC Mon-Fri, excluding CN public holidays; weekends and CN public holidays are off-peak all day';
// Verified facts, 2026-10-15; Flash version renamed DeepSeek-V4.1-Flash-1017 on the official page (checked 2026-10-18). Flash's legacy catalog slug is reused by the scraper.
export const DEEPSEEK_MODELS = [
  { slug: 'deepseek-v4-flash', apiId: 'deepseek-flash', name: 'DeepSeek-V4.1-Flash-1017', peak: { input: 0.30, output: 1.20, cache: 0.006 } },
  { slug: 'deepseek-v4-pro', apiId: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro-0813', peak: { input: 1.32, output: 3.96, cache: 0.044 } },
] as const;

export function deepseekPricingWindow(date: Date, holidays: readonly string[] = DEEPSEEK_CN_HOLIDAYS): DeepSeekPricingWindow {
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid DeepSeek observation date');
  const weekday = date.getUTCDay();
  const hour = date.getUTCHours();
  const peak = weekday >= 1 && weekday <= 5 && !holidays.includes(date.toISOString().slice(0, 10)) &&
    ((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10));
  return peak ? 'peak' : 'off-peak';
}

export function scaleDeepSeekRate(rate: DeepSeekRate, factor: number): DeepSeekRate {
  return { input: rate.input * factor, output: rate.output * factor, cache: rate.cache == null ? rate.cache : rate.cache * factor };
}

export function sameDeepSeekRate(a: DeepSeekRate, b: DeepSeekRate): boolean {
  const close = (x: number, y: number) => Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x), Math.abs(y));
  return close(a.input, b.input) && close(a.output, b.output) &&
    (a.cache == null || b.cache == null || close(a.cache, b.cache));
}

/** Keep the list at an observed peak; never manufacture a StreamLake list price.
 * Sources may lag a window transition: classify a matching other-window rate
 * by its value, and retain the raw observation under that window.
 */
export function reconcileDeepSeekObservation(
  observed: DeepSeekRate, date: Date, previous: DeepSeekObservations = {},
  list?: DeepSeekRate, knownPeak?: DeepSeekRate,
) {
  const scheduled = deepseekPricingWindow(date);
  const peak = knownPeak ?? previous.peak ?? (previous['off-peak'] ? scaleDeepSeekRate(previous['off-peak'], 2) : list);
  let window = scheduled;
  let windowOnly = false;
  if (peak) {
    if (sameDeepSeekRate(observed, peak)) { window = 'peak'; windowOnly = true; }
    else if (sameDeepSeekRate(observed, scaleDeepSeekRate(peak, 0.5))) { window = 'off-peak'; windowOnly = true; }
  }
  // Bootstrap legacy rows with no observations, including an old off-peak list.
  if (!knownPeak && !previous.peak && !previous['off-peak'] && list &&
      scheduled === 'peak' && sameDeepSeekRate(observed, scaleDeepSeekRate(list, 2))) {
    window = 'peak'; windowOnly = true;
  }
  const observations = { ...previous, [window]: { ...observed, observed_at: date.toISOString() } };
  const listRate = windowOnly
    ? (knownPeak ?? previous.peak ?? (window === 'peak' ? observed : list) ?? observed)
    : observed;
  return { listRate: { input: listRate.input, output: listRate.output, cache: listRate.cache }, observations, window, windowOnly };
}

/** Null-safe decoder for pre-seed / older raw_json payloads. */
export function deepseekObservations(raw?: Record<string, unknown> | null): DeepSeekObservations {
  const value = raw?.pricing_observations;
  if (!value || typeof value !== 'object') return {};
  const result: DeepSeekObservations = {};
  for (const window of ['peak', 'off-peak'] as const) {
    const row = (value as Record<string, unknown>)[window];
    if (!row || typeof row !== 'object') continue;
    const rate = row as DeepSeekObservation;
    if (Number.isFinite(rate.input) && Number.isFinite(rate.output) && typeof rate.observed_at === 'string') result[window] = rate;
  }
  return result;
}

/** Official CNY list (peak) from the Chinese pricing page, checked 2026-10-18. Off-peak = 50%. */
export const DEEPSEEK_CN_SOURCE = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing';
export const DEEPSEEK_FLASH_CNY_PEAK = { input: 2, output: 8, cache: 0.04 } as const;
