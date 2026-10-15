import type { WindowSummary } from './summary';

export type DailyMeasurement = {
  day: string; planSlug: string; collector: string; accountLabel: string;
  window: WindowSummary['window']; limitId: string | null; model: string;
  tokensPerPct: number;
};
export type Anomaly = DailyMeasurement & {
  trailingMedian: number; baselineDays: number; dropPct: number;
};
const DAY_MS = 86_400_000;
const cohort = (s: Omit<DailyMeasurement, 'tokensPerPct' | 'day'>) => JSON.stringify([
  s.planSlug, s.collector, s.accountLabel, s.window, s.limitId, s.model,
]);

/** Weight reset windows by observed percentage delta; each day contributes one baseline. */
export function dailyMeasurements(windows: WindowSummary[]): DailyMeasurement[] {
  const groups = new Map<string, { first: WindowSummary; tokens: number; delta: number }>();
  for (const row of windows) {
    if (row.tokensPerPct === null || row.deltaPct === null || !row.model) continue;
    const key = JSON.stringify([row.day, cohort({ ...row, model: row.model })]);
    const entry = groups.get(key) ?? { first: row, tokens: 0, delta: 0 };
    entry.tokens += row.tokensPerPct * row.deltaPct;
    entry.delta += row.deltaPct;
    groups.set(key, entry);
  }
  return [...groups.values()].map(({ first, tokens, delta }) => ({
    day: first.day, planSlug: first.planSlug, collector: first.collector, accountLabel: first.accountLabel,
    window: first.window, limitId: first.limitId, model: first.model!, tokensPerPct: tokens / delta,
  }));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Previous seven UTC calendar days, excluding the current day. Sparse history is allowed
 * and baselineDays is reported. Compare like meters/models/accounts within the same plan.
 */
export function detectAnomalies(days: DailyMeasurement[]): Anomaly[] {
  const seen = new Set<string>();
  for (const row of days) {
    const key = JSON.stringify([cohort(row), row.day]);
    if (seen.has(key)) throw new Error('Expected one measurement per cohort/day');
    seen.add(key);
    if (!Number.isFinite(row.tokensPerPct) || row.tokensPerPct <= 0) throw new Error('tokensPerPct must be positive and finite');
  }
  return [...days].sort((a, b) => a.day.localeCompare(b.day)).flatMap((row) => {
    const timestamp = Date.parse(row.day);
    const previous = days.filter((other) => cohort(other) === cohort(row)
      && Date.parse(other.day) >= timestamp - 7 * DAY_MS && Date.parse(other.day) < timestamp);
    if (!previous.length) return [];
    const trailingMedian = median(previous.map((s) => s.tokensPerPct));
    const dropPct = (1 - row.tokensPerPct / trailingMedian) * 100;
    return dropPct > 25 ? [{ ...row, trailingMedian, baselineDays: previous.length, dropPct }] : [];
  });
}

export function formatAnomaly(anomaly: Anomaly): string {
  return `[aiplans] Quota self-measure anomaly: ${anomaly.planSlug} ${anomaly.day} ${anomaly.window}\n`
    + `${anomaly.collector}/${anomaly.accountLabel}, ${anomaly.model}, pool=${anomaly.limitId ?? 'unknown'}: `
    + `${anomaly.tokensPerPct.toFixed(1)} tokens/1%, down ${anomaly.dropPct.toFixed(1)}% vs trailing 7-day median `
    + `${anomaly.trailingMedian.toFixed(1)} (${anomaly.baselineDays} observed days). Review logs/shared activity; not proof of a vendor quota change.`;
}
