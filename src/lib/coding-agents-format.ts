/**
 * Client-safe types and display helpers for the Artificial Analysis Coding
 * Agent Index. Database access lives in ./coding-agents so the 'fs'-bound
 * postgres client never enters a client-component bundle.
 */

/** Agent-harness × host-model row (scripts/ingest-coding-agents.ts). */
export interface CodingAgentRow {
  agentName: string;
  agentDisplayLabel: string;
  hostModelSlug: string;
  providerSlug: string | null;
  indexVersion: string;
  indexScore: number; // 0..1 fraction
  deepsweScore: number | null;
  terminalbenchScore: number | null;
  sweatlasScore: number | null;
  costPerTaskUsd: number | null;
  wallTimePerTaskSec: number | null;
  stepsPerTask: number | null;
  refusalRate: number | null;
  isDefault: boolean;
  isHighlighted: boolean;
  sourceMaterializedAt: string | null;
  modelSlug: string | null;
  modelName: string | null;
  modelLogoUrl: string | null;
}

export interface CodingAgentLeaderboard {
  rows: CodingAgentRow[];
  indexVersion: string | null;
  sourceMaterializedAt: string | null;
}

/** Fraction 0..1 → "62.2%". */
export function formatIndexScore(fraction: number, locale = 'en'): string {
  return `${(fraction * 100).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

/** Seconds → "34.8m" / "1.1h", matching the source page's compact style. */
export function formatTaskTime(seconds: number | null, locale = 'en'): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const nf = new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: 1 });
  if (seconds < 60) return `${nf.format(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${nf.format(minutes)}m`;
  return `${nf.format(minutes / 60)}h`;
}

/** USD cost per task with two decimals, "—" when null. */
export function formatTaskCost(usd: number | null, locale = 'en'): string {
  if (usd == null || !Number.isFinite(usd)) return '—';
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usd);
}
