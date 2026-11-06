import bench from '../../public/reports/quota-bench-2026-10.json';
import claude from '../../public/reports/claude-pro-opus55-2026-11-04.json';
import volcengineEvidence from '../../public/reports/volcengine-three-windows-2026-10-28.json';
import volcengineValuation from '../../public/reports/volcengine-api-valuation-2026-11-05.json';

/**
 * Leaderboard of x2v conditional quota measurements, valued at public API list price.
 * One ranked list per window, metric, and direction. Workload mix stays on the row.
 * Unverified tiers, and rows with no fee multiple, stay off the multiple ranking.
 * No new measurements: every number comes from an existing report or guide.
 */
export const QUOTA_LEADERBOARD_PUBLISHED_AT = '2026-11-05';
export const QUOTA_LEADERBOARD_UPDATED_AT = '2026-11-06'; // Legacy Ultra multiple uses the official $200 fee for the Cursor Models pool only.

/** Average weeks per month (52.14 / 12). Same factor as the Claude Pro report's weeklyMultiplier. */
export const WEEKS_PER_MONTH = 4.35;

export type LeaderWindow = '5h' | 'week' | 'month';
export type LeaderMix = 'output' | 'agentic' | 'input' | 'mixed';

export type LeaderRow = {
  id: string;
  plan: string;
  model: string;
  window: LeaderWindow;
  mix: LeaderMix;
  feeUsdMonthly: number | null;
  usd: { low: number; mid: number; high: number };
  /** Rough estimate, including weak signals in a natively measured window. */
  rough: boolean;
  derivedFromWeek?: boolean;
  tierVerified: boolean;
  date: string;
  confidence: 'low';
  anchor: string;
};

const codex = bench.records.find(r => r.id === 'codex-pro')!;
const cursor = bench.records.find(r => r.id === 'cursor-ultra')!;
const volcengine = bench.records.find(r => r.id === 'volcengine-pro')!;
const cw = (name: string) => claude.windows.find(w => w.window === name)!;
const range = (low: number, high: number, mid = (low + high) / 2) => ({ low, mid, high });
const scale = (u: { low: number; mid: number; high: number }, k: number) => ({ low: u.low * k, mid: u.mid * k, high: u.high * k });

// X Ultra: ≈ $1,500/week, ±25% (x2v estimate in cursor-x-subscription-pricing, 2026-11-05).
const xUltraWeek = range(1125, 1875, 1500);

// Value the observed model and actual input/output mix, not the Auto routing alias.
// All three capacities use their own meter delta; month is NOT week × 4.35.
const volcengineSampleUsd = (volcengineEvidence.tokens.input * volcengineValuation.pricing.inputPerMillion
  + volcengineEvidence.tokens.output * volcengineValuation.pricing.outputPerMillion) / 1_000_000;
const volcengineRows: LeaderRow[] = (['5h', 'week', 'month'] as const).map(window => {
  const estimate = volcengineEvidence.estimates[window === 'week' ? 'Week' : window === 'month' ? 'Month' : '5h'];
  return {
    id: `volcengine-pro-${window}`, plan: volcengine.plan, model: volcengine.model, window, mix: 'input',
    feeUsdMonthly: volcengineValuation.planPrice.amount / volcengineValuation.planPrice.cnyPerUsd,
    usd: scale(range(estimate.roundingLow, estimate.roundingHigh, estimate.sameMixTokens), volcengineSampleUsd / volcengineEvidence.totalTokens),
    rough: window === 'month', tierVerified: volcengine.tierVerified, date: volcengine.date,
    confidence: 'low', anchor: '#volcengine-pro',
  };
});

export const QUOTA_LEADER_ROWS: LeaderRow[] = [
  { id: 'x-ultra-week', plan: 'X Subscription Ultra', model: 'grok-4.7-medium (Cursor CLI)', window: 'week', mix: 'mixed', feeUsdMonthly: 200, usd: xUltraWeek, rough: false, tierVerified: true, date: '2026-11-05', confidence: 'low', anchor: '/guides/cursor-x-subscription-pricing' },
  { id: 'x-ultra-month', plan: 'X Subscription Ultra', model: 'grok-4.7-medium (Cursor CLI)', window: 'month', mix: 'mixed', feeUsdMonthly: 200, usd: scale(xUltraWeek, WEEKS_PER_MONTH), rough: true, derivedFromWeek: true, tierVerified: true, date: '2026-11-05', confidence: 'low', anchor: '/guides/cursor-x-subscription-pricing' },
  // Codex is measured weekly only; the monthly row is weekly × 4.35 (rough), per the boss on 2026-11-05.
  { id: 'codex-pro-month', plan: codex.plan, model: codex.model, window: 'month', mix: 'input', feeUsdMonthly: codex.tierVerification!.priceUsdPerMonth!, usd: scale(codex.apiEquivalentUsd!, WEEKS_PER_MONTH), rough: true, derivedFromWeek: true, tierVerified: codex.tierVerified, date: codex.date, confidence: 'low', anchor: '#codex-pro' },
  { id: 'codex-pro-week', plan: codex.plan, model: codex.model, window: 'week', mix: 'input', feeUsdMonthly: codex.tierVerification!.priceUsdPerMonth!, usd: codex.apiEquivalentUsd!, rough: false, tierVerified: codex.tierVerified, date: codex.date, confidence: 'low', anchor: '#codex-pro' },
  ...(['5h', 'week', 'month'] as const).flatMap(window => {
    const src = cw(window);
    const rough = window === 'month';
    return [
      { id: `claude-pro-${window}-output`, plan: 'Claude Pro', model: claude.model, window, mix: 'output' as const, feeUsdMonthly: claude.planPriceUsdMonthly, usd: range(src.outputHeavy.apiUsd[0], src.outputHeavy.apiUsd[1]), rough, derivedFromWeek: rough, tierVerified: true, date: claude.date, confidence: 'low' as const, anchor: '#claude-pro-quota' },
      { id: `claude-pro-${window}-agentic`, plan: 'Claude Pro', model: claude.model, window, mix: 'agentic' as const, feeUsdMonthly: claude.planPriceUsdMonthly, usd: range(src.agentic.apiUsd[0], src.agentic.apiUsd[1]), rough, derivedFromWeek: rough, tierVerified: true, date: claude.date, confidence: 'low' as const, anchor: '#claude-pro-quota' },
    ];
  }),
  ...volcengineRows,
  // Official legacy Ultra price is $200/mo (cursor.com/docs/account/pricing/legacy-cursor-plans, 2026-11-06).
  // Numerator is only the measured Cursor Models pool (composer-2.5). Other Models are not in this figure.
  // rough marks the incomplete sample, not a week×4.35 projection. Stays off catalog plan cards.
  { id: 'cursor-legacy-month', plan: cursor.plan, model: cursor.model, window: 'month', mix: 'mixed', feeUsdMonthly: 200, usd: cursor.apiEquivalentUsd!, rough: true, tierVerified: cursor.tierVerified, date: cursor.date, confidence: 'low', anchor: '#cursor-ultra' },
];

/** Fee for one window: month = fee, week = fee ÷ 4.35. 5h has no fee basis (null). */
export function windowFee(row: LeaderRow): number | null {
  if (row.feeUsdMonthly === null || !row.tierVerified) return null;
  if (row.window === 'month') return row.feeUsdMonthly;
  if (row.window === 'week') return row.feeUsdMonthly / WEEKS_PER_MONTH;
  return null;
}

export function feeMultiple(row: LeaderRow): { low: number; mid: number; high: number } | null {
  const fee = windowFee(row);
  return fee ? scale(row.usd, 1 / fee) : null;
}

export type LeaderSort = 'multiple' | 'usd';
export type LeaderDirection = 'desc' | 'asc';

export type LeaderboardRanking = {
  /** Rows scored on this metric. Index 0 is rank 1 for the selected direction. */
  ranked: LeaderRow[];
  /** Below the divider: unverified tiers, or no fee multiple when ranking by multiple. */
  unverified: LeaderRow[];
};

function rankValue(row: LeaderRow, sort: LeaderSort, window: LeaderWindow): number | null {
  if (sort === 'multiple' && window !== '5h') return feeMultiple(row)?.mid ?? null;
  return row.usd.mid;
}

function scored(row: LeaderRow, window: LeaderWindow, sort: LeaderSort): boolean {
  if (!row.tierVerified) return false;
  if (window !== '5h' && sort === 'multiple') return feeMultiple(row) !== null;
  return Number.isFinite(row.usd.mid);
}

function compareRows(window: LeaderWindow, sort: LeaderSort, direction: LeaderDirection) {
  const effective: LeaderSort = window === '5h' ? 'usd' : sort;
  const tieBreak: LeaderSort = effective === 'usd' ? 'multiple' : 'usd';
  const sign = direction === 'desc' ? 1 : -1;
  const value = (row: LeaderRow, metric: LeaderSort) => rankValue(row, metric, window) ?? Number.NEGATIVE_INFINITY;
  return (a: LeaderRow, b: LeaderRow) => {
    const primary = (value(b, effective) - value(a, effective)) * sign;
    if (primary) return primary;
    const secondary = (value(b, tieBreak) - value(a, tieBreak)) * sign;
    if (secondary) return secondary;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

/** Single global ranking for one window. Mix does not split the list. Default direction is high to low. */
export function rankLeaderboard(window: LeaderWindow, sort: LeaderSort = 'multiple', rows: readonly LeaderRow[] = QUOTA_LEADER_ROWS, direction: LeaderDirection = 'desc'): LeaderboardRanking {
  const inWindow = rows.filter(row => row.window === window);
  return {
    ranked: inWindow.filter(row => scored(row, window, sort)).slice().sort(compareRows(window, sort, direction)),
    unverified: inWindow.filter(row => !scored(row, window, sort)).slice().sort((a, b) => b.usd.mid - a.usd.mid || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
}

/**
 * True when fee-multiple order and absolute-value order are the same list
 * in the given direction. Five-hour windows have no fee multiple, so this is false there.
 */
export function leaderboardOrdersMatch(window: LeaderWindow, rows: readonly LeaderRow[] = QUOTA_LEADER_ROWS, direction: LeaderDirection = 'desc'): boolean {
  if (window === '5h') return false;
  const ids = (sort: LeaderSort) => rankLeaderboard(window, sort, rows, direction).ranked.map(row => row.id);
  const byMultiple = ids('multiple');
  const byUsd = ids('usd');
  return byMultiple.length > 0 && byMultiple.length === byUsd.length && byMultiple.every((id, index) => id === byUsd[index]);
}
