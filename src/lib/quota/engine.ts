/** Prices are USD per million tokens; mixes are percentages, not fractions. */
export type ListPrices = { input: number; cachedInput: number; output: number };
export type TokenCounts = { input: number; cachedInput: number; output: number };
export type UsageMix = { cacheReadPct: number; inputPct: number; outputPct: number };
export type WindowKind = '5h' | 'daily' | 'weekly' | 'monthly';
export type Range = { low: number; high: number };

function nonnegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and nonnegative`);
  return value;
}

function positive(value: number, name: string): number {
  nonnegative(value, name);
  if (value === 0) throw new RangeError(`${name} must be positive`);
  return value;
}

export function blendedPricePerMTok(prices: ListPrices, mix: UsageMix): number {
  for (const key of ['input', 'cachedInput', 'output'] as const) nonnegative(prices[key], key);
  for (const key of ['cacheReadPct', 'inputPct', 'outputPct'] as const) nonnegative(mix[key], key);
  if (Math.abs(mix.cacheReadPct + mix.inputPct + mix.outputPct - 100) > 1e-9) {
    throw new RangeError('Mix percentages must sum to 100');
  }
  return (prices.cachedInput * mix.cacheReadPct + prices.input * mix.inputPct + prices.output * mix.outputPct) / 100;
}

/** Full utilization, with a comparison month defined as exactly four weeks. */
export function realUnitPrice(monthlyFeeUsd: number, usableTokensPerMonth: number): number {
  return nonnegative(monthlyFeeUsd, 'monthlyFeeUsd') / positive(usableTokensPerMonth, 'usableTokensPerMonth') * 1e6;
}

export function weeklyToMonthly(value: number): number {
  return nonnegative(value, 'weekly value') * 4;
}

export function windowToWeekly(value: number, windowKind: WindowKind, windowsPerWeek?: number): number {
  nonnegative(value, 'window value');
  switch (windowKind) {
    case 'weekly': return value;
    case 'monthly': return value / 4;
    case '5h':
    case 'daily':
      if (windowsPerWeek === undefined) throw new RangeError(`${windowKind} requires an explicit windowsPerWeek assumption`);
      return value * positive(windowsPerWeek, 'windowsPerWeek');
    default: throw new RangeError('Unknown window kind');
  }
}

export type Measurement = {
  tokensConsumed: TokenCounts; // Mutually exclusive categories; cachedInput is not also input.
  listPrices: ListPrices;
  mix: UsageMix; // Target comparison workload, separate from the measured workload.
  quotaPctBefore: number; // Percentage CONSUMED, within one reset window.
  quotaPctAfter: number;
  windowKind: WindowKind;
  windowsPerWeek?: number;
  pctRoundingUncertainty?: number; // ± percentage points on EACH reading; default ±0.5.
};

/** The top-level range is monthly tokens; intermediate USD ranges remain inspectable. */
export function measuredQuota(measurement: Measurement): Range & {
  consumedValueUsd: number;
  usdPerPct: Range;
  windowValueUsd: Range;
  weeklyValueUsd: Range;
  monthlyValueUsd: Range;
} {
  const { tokensConsumed, listPrices, mix, quotaPctBefore: before, quotaPctAfter: after } = measurement;
  for (const pct of [before, after]) {
    nonnegative(pct, 'quota percentage');
    if (pct > 100) throw new RangeError('Quota percentage must be <= 100');
  }
  positive(after - before, 'quota percentage delta');
  const uncertainty = nonnegative(measurement.pctRoundingUncertainty ?? 0.5, 'rounding uncertainty');
  const minDelta = Math.max(0, after - uncertainty) - Math.min(100, before + uncertainty);
  const maxDelta = Math.min(100, after + uncertainty) - Math.max(0, before - uncertainty);
  positive(minDelta, 'delta after rounding uncertainty (use a larger measurement)');
  const blendedPrice = positive(blendedPricePerMTok(listPrices, mix), 'blended price');
  for (const key of ['input', 'cachedInput', 'output'] as const) nonnegative(tokensConsumed[key], key);
  const consumedValueUsd = positive(
    (tokensConsumed.input * listPrices.input + tokensConsumed.cachedInput * listPrices.cachedInput + tokensConsumed.output * listPrices.output) / 1e6,
    'consumed list value',
  );
  const usdPerPct = { low: consumedValueUsd / maxDelta, high: consumedValueUsd / minDelta };
  const map = (range: Range, fn: (value: number) => number): Range => ({ low: fn(range.low), high: fn(range.high) });
  const windowValueUsd = map(usdPerPct, (value) => value * 100);
  const weeklyValueUsd = map(windowValueUsd, (value) => windowToWeekly(value, measurement.windowKind, measurement.windowsPerWeek));
  const monthlyValueUsd = map(weeklyValueUsd, weeklyToMonthly);
  return {
    ...map(monthlyValueUsd, (value) => value / blendedPrice * 1e6),
    consumedValueUsd, usdPerPct, windowValueUsd, weeklyValueUsd, monthlyValueUsd,
  };
}

/** Keep the window attached to the result so subsequent multipliers cannot cross windows. */
export function applyMultiplier(
  quota: { value: number; windowKind: WindowKind },
  multiplier: { factor: number; windowKind: WindowKind },
): { value: number; windowKind: WindowKind } {
  if (quota.windowKind !== multiplier.windowKind) throw new RangeError('Cannot chain multipliers across windows');
  return {
    value: nonnegative(quota.value, 'quota') * positive(multiplier.factor, 'multiplier'),
    windowKind: quota.windowKind,
  };
}

/** Display only: retain unrounded values for calculations and persistence. */
export function toRange(low: number, high: number = low): Range {
  nonnegative(low, 'low');
  nonnegative(high, 'high');
  if (low > high) throw new RangeError('low must be <= high');
  return { low: Number(low.toPrecision(2)), high: Number(high.toPrecision(2)) };
}

export function orderOfMagnitude(value: number): string {
  nonnegative(value, 'value');
  if (value === 0) return '~0';
  const exponent = Math.round(Math.log10(value));
  const unit = exponent >= 12 ? 12 : exponent >= 9 ? 9 : exponent >= 6 ? 6 : exponent >= 3 ? 3 : 0;
  const suffix = { 0: '', 3: 'K', 6: 'M', 9: 'B', 12: 'T' }[unit];
  return `~${Number((10 ** (exponent - unit)).toPrecision(2))}${suffix}`;
}
