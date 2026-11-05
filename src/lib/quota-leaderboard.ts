import bench from '../../public/reports/quota-bench-2026-10.json';
import claude from '../../public/reports/claude-pro-opus55-2026-11-04.json';

/**
 * Leaderboard of x2v conditional quota measurements, valued at public API list price.
 * No new measurements: every number comes from an existing report or guide.
 */
export const QUOTA_LEADERBOARD_PUBLISHED_AT = '2026-11-05';
export const QUOTA_LEADERBOARD_UPDATED_AT = '2026-11-05';

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
  /** Derived from another window (e.g. week × 4.35) rather than measured natively. */
  rough: boolean;
  tierVerified: boolean;
  date: string;
  confidence: 'low';
  anchor: string;
};

const codex = bench.records.find(r => r.id === 'codex-pro')!;
const cursor = bench.records.find(r => r.id === 'cursor-ultra')!;
const cw = (name: string) => claude.windows.find(w => w.window === name)!;
const range = (low: number, high: number, mid = (low + high) / 2) => ({ low, mid, high });
const scale = (u: { low: number; mid: number; high: number }, k: number) => ({ low: u.low * k, mid: u.mid * k, high: u.high * k });

// X Ultra: ≈ $1,500/week, ±25% (x2v estimate in cursor-x-subscription-pricing, 2026-11-05).
const xUltraWeek = range(1125, 1875, 1500);

export const QUOTA_LEADER_ROWS: LeaderRow[] = [
  { id: 'x-ultra-week', plan: 'X Subscription Ultra', model: 'grok-4.7-medium (Cursor CLI)', window: 'week', mix: 'mixed', feeUsdMonthly: 200, usd: xUltraWeek, rough: false, tierVerified: true, date: '2026-11-05', confidence: 'low', anchor: '/guides/cursor-x-subscription-pricing' },
  { id: 'x-ultra-month', plan: 'X Subscription Ultra', model: 'grok-4.7-medium (Cursor CLI)', window: 'month', mix: 'mixed', feeUsdMonthly: 200, usd: scale(xUltraWeek, WEEKS_PER_MONTH), rough: true, tierVerified: true, date: '2026-11-05', confidence: 'low', anchor: '/guides/cursor-x-subscription-pricing' },
  // Codex is measured weekly only; the monthly row is weekly × 4.35 (rough), per the boss on 2026-11-05.
  { id: 'codex-pro-month', plan: codex.plan, model: codex.model, window: 'month', mix: 'input', feeUsdMonthly: codex.tierVerification!.priceUsdPerMonth!, usd: scale(codex.apiEquivalentUsd!, WEEKS_PER_MONTH), rough: true, tierVerified: codex.tierVerified, date: codex.date, confidence: 'low', anchor: '#codex-pro' },
  { id: 'codex-pro-week', plan: codex.plan, model: codex.model, window: 'week', mix: 'input', feeUsdMonthly: codex.tierVerification!.priceUsdPerMonth!, usd: codex.apiEquivalentUsd!, rough: false, tierVerified: codex.tierVerified, date: codex.date, confidence: 'low', anchor: '#codex-pro' },
  ...(['5h', 'week', 'month'] as const).flatMap(window => {
    const src = cw(window);
    const rough = window === 'month';
    return [
      { id: `claude-pro-${window}-output`, plan: 'Claude Pro', model: claude.model, window, mix: 'output' as const, feeUsdMonthly: claude.planPriceUsdMonthly, usd: range(src.outputHeavy.apiUsd[0], src.outputHeavy.apiUsd[1]), rough, tierVerified: true, date: claude.date, confidence: 'low' as const, anchor: '#claude-pro-quota' },
      { id: `claude-pro-${window}-agentic`, plan: 'Claude Pro', model: claude.model, window, mix: 'agentic' as const, feeUsdMonthly: claude.planPriceUsdMonthly, usd: range(src.agentic.apiUsd[0], src.agentic.apiUsd[1]), rough, tierVerified: true, date: claude.date, confidence: 'low' as const, anchor: '#claude-pro-quota' },
    ];
  }),
  { id: 'cursor-legacy-month', plan: cursor.plan, model: cursor.model, window: 'month', mix: 'mixed', feeUsdMonthly: null, usd: cursor.apiEquivalentUsd!, rough: false, tierVerified: cursor.tierVerified, date: cursor.date, confidence: 'low', anchor: '#cursor-ultra' },
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

export function leaderboard(window: LeaderWindow, mix: LeaderMix, sort: LeaderSort = 'multiple'): LeaderRow[] {
  const key = (r: LeaderRow) => sort === 'usd' ? r.usd.mid : (feeMultiple(r)?.mid ?? -1);
  return QUOTA_LEADER_ROWS.filter(r => r.window === window && r.mix === mix)
    .sort((a, b) => key(b) - key(a) || b.usd.mid - a.usd.mid);
}

export const LEADER_MIXES: LeaderMix[] = ['output', 'agentic', 'input', 'mixed'];
