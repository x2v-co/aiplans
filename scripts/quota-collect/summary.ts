import { measuredQuota, type Range } from '../../src/lib/quota/engine';
import { PRICE_CONFIG, TARGET_MIX, WINDOWS_PER_WEEK } from './config';
import { TOKEN_KEYS, uniqueSamples, type Sample, type Tokens } from './types';

export type WindowSummary = {
  day: string; planSlug: string; collector: string; accountLabel: string;
  window: Sample['window']; resetsAt: string | null; limitId: string | null; model: string | null;
  observations: number; tokens: Tokens; intervalTokens: Tokens;
  usedPctMin: number | null; usedPctMax: number | null; deltaPct: number | null;
  tokensPerPct: number | null; impliedWindowValueUsd: Range | null;
  placeholderPrices: boolean; notes: string[];
};
export type DailySummary = {
  day: string; planSlug: string; collector: string; accountLabel: string;
  events: number; tokens: Tokens; incompleteEvents: number;
};

function sumTokens(rows: Tokens[]): Tokens {
  return Object.fromEntries(TOKEN_KEYS.map((key) => {
    const values = rows.flatMap((row) => row[key] === null ? [] : [row[key]]);
    const total = values.reduce((a, b) => a + b, 0);
    if (!Number.isSafeInteger(total)) throw new Error('Aggregated tokens exceed safe integer precision');
    return [key, values.length ? total : null];
  })) as Tokens;
}
function complete(rows: Tokens[]): boolean {
  return rows.every((row) => row.tokensInput !== null && row.tokensCached !== null && row.tokensOutput !== null);
}
function groupBy<T>(values: T[], key: (value: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const id = key(value);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(value);
  }
  return [...groups.values()];
}
const day = (sample: Sample) => sample.observedAt.slice(0, 10);

/** Daily usage counts each token event once, even when both short and weekly meters exist. */
export function dailySummary(samples: Sample[]): DailySummary[] {
  return groupBy(uniqueSamples(samples), (s) => JSON.stringify([day(s), s.planSlug, s.collector, s.accountLabel])).map((rows) => {
    const first = rows[0];
    const events = [...new Map(rows.flatMap((row) => row.raw.usageEvents ?? [{ ...row, eventId: row.raw.eventId }])
      .map((event) => [event.eventId, event])).values()];
    return {
      day: day(first), planSlug: first.planSlug, collector: first.collector, accountLabel: first.accountLabel,
      events: events.length, tokens: sumTokens(events), incompleteEvents: events.filter((row) => !complete([row])).length,
    };
  });
}

/** A measurement starts AFTER the first meter reading: its last usage preceded that reading.
 * Do not stitch across midnight, resets, different limit pools, or changing/missing models.
 */
export function windowSummary(samples: Sample[]): WindowSummary[] {
  return groupBy(uniqueSamples(samples), (s) => JSON.stringify([
    day(s), s.planSlug, s.collector, s.accountLabel, s.window, s.windowMinutes, s.resetsAt, s.raw.limitId,
  ])).map((rows) => {
    const first = rows[0];
    const last = rows[rows.length - 1];
    const interval = rows.slice(1);
    const intervalTokens = sumTokens(interval);
    const readings = rows.flatMap((s) => s.usedPct === null ? [] : [s.usedPct]);
    const models = new Set(rows.map((s) => s.model));
    const result: WindowSummary = {
      day: day(first), planSlug: first.planSlug, collector: first.collector, accountLabel: first.accountLabel,
      window: first.window, resetsAt: first.resetsAt, limitId: first.raw.limitId ?? null,
      model: models.size === 1 ? first.model : null, observations: rows.length,
      tokens: sumTokens(rows), intervalTokens,
      usedPctMin: readings.length ? Math.min(...readings) : null,
      usedPctMax: readings.length ? Math.max(...readings) : null,
      deltaPct: null, tokensPerPct: null, impliedWindowValueUsd: null,
      placeholderPrices: false, notes: [],
    };
    if (!first.resetsAt || rows.length < 2 || readings.length !== rows.length) {
      result.notes.push('Needs two readings with a known common reset window; no quota inference');
      return result;
    }
    if (rows.some((s, index) => index > 0 && s.usedPct! < rows[index - 1].usedPct!)) {
      result.notes.push('Meter decreased within the same reset window; measurement rejected');
      return result;
    }
    const delta = last.usedPct! - first.usedPct!;
    result.deltaPct = delta;
    if (delta <= 1) {
      result.notes.push('Percentage delta too small for ±0.5pp rounding per reading');
      return result;
    }
    if (!complete(interval)) {
      result.notes.push('Missing token categories in the measurement interval');
      return result;
    }
    if (models.size !== 1 || !result.model) {
      result.notes.push('Missing/changing model; comparison rejected');
      return result;
    }
    const tokenTotal = intervalTokens.tokensInput! + intervalTokens.tokensCached! + intervalTokens.tokensOutput! + (intervalTokens.tokensCacheWrite ?? 0);
    if (tokenTotal <= 0) {
      result.notes.push('No observed tokens in the measurement interval');
      return result;
    }
    result.tokensPerPct = tokenTotal / delta;
    const config = PRICE_CONFIG[result.model];
    if (!config) {
      result.notes.push('No configured list prices for this model; token comparison only');
      return result;
    }
    if (intervalTokens.tokensInput! + intervalTokens.tokensCached! + intervalTokens.tokensOutput! === 0) {
      result.notes.push('No tokens covered by the three-category price engine');
      return result;
    }
    const measurement = measuredQuota({
      tokensConsumed: { input: intervalTokens.tokensInput!, cachedInput: intervalTokens.tokensCached!, output: intervalTokens.tokensOutput! },
      listPrices: config.prices, mix: TARGET_MIX, quotaPctBefore: first.usedPct!, quotaPctAfter: last.usedPct!,
      windowKind: first.window, windowsPerWeek: WINDOWS_PER_WEEK,
    });
    result.impliedWindowValueUsd = measurement.windowValueUsd;
    result.placeholderPrices = config.placeholder;
    if (config.placeholder) result.notes.push('CONFIG TO FILL: illustrative list prices, not verified vendor prices');
    result.notes.push('Cache-write fees omitted by the three-category engine; reasoning is already included in output');
    return result;
  });
}

export function formatDailySummary(summaries: DailySummary[]): string {
  return ['Daily summary (UTC; fresh input excludes cached; output includes reasoning)',
    'day | plan | collector | account | events | input | cached | cache_write | output | reasoning | incomplete',
    ...summaries.map((s) => [s.day, s.planSlug, s.collector, s.accountLabel, s.events,
      ...TOKEN_KEYS.map((key) => s.tokens[key] ?? '?'), s.incompleteEvents].join(' | ')),
    ...(summaries.length ? [] : ['(no samples)']),
  ].join('\n');
}
