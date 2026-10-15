import type { WindowKind } from '../../src/lib/quota/engine';

export const COLLECTOR_IDS = ['codex-log', 'ccusage', 'cursor-dashboard', 'grok-bot', 'claude-usage'] as const;
export type CollectorId = typeof COLLECTOR_IDS[number];
export type Tokens = {
  tokensInput: number | null; // Fresh input; excludes cache reads.
  tokensCached: number | null;
  tokensCacheWrite: number | null;
  tokensOutput: number | null; // Includes reasoning; never add reasoning again.
  tokensReasoning: number | null;
};
export const TOKEN_KEYS = ['tokensInput', 'tokensCached', 'tokensCacheWrite', 'tokensOutput', 'tokensReasoning'] as const;
export type Sample = Tokens & {
  planSlug: string;
  collector: CollectorId;
  accountLabel: string;
  observedAt: string;
  window: WindowKind;
  windowMinutes: number | null;
  resetsAt: string | null;
  usedPct: number | null;
  model: string | null;
  raw: {
    source: 'token_count' | 'ccusage-daily';
    eventId: string;
    limitId?: string;
    channel?: 'primary' | 'secondary';
    usageStatus?: 'counted' | 'duplicate-total' | 'missing';
    totalTokenUsage?: Record<string, number | null>;
    usageEvents?: Array<Tokens & { eventId: string }>;
  };
  confidence: 'high' | 'medium' | 'low';
};

export type CollectOptions = {
  accountLabel: string;
  codexDir?: string; // Codex home; only its sessions/ subtree is traversed.
  ccusageJson?: string;
  ccusagePlan?: string;
  warn?: (message: string) => void;
};
export interface Collector {
  id: CollectorId;
  collect(opts: CollectOptions): Promise<Sample[]>;
}
export class CollectorSkipped extends Error {}

export function opaqueLabel(label: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(label)) {
    throw new Error('account-label must be an opaque alias (1–64 letters, digits, _ or -), never an email');
  }
  return label;
}

export function safeName(value: unknown): string | null {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,99}$/.test(value) ? value : null;
}
export function count(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('Token count must be a nonnegative safe integer');
  }
  return value;
}
export const emptyTokens = (): Tokens => Object.fromEntries(TOKEN_KEYS.map((key) => [key, null])) as Tokens;

/** Identity is deliberately identical to 0013. Conflicting rows must never silently overwrite. */
export function uniqueSamples(samples: Sample[]): Sample[] {
  const seen = new Map<string, Sample>();
  for (const sample of samples) {
    const key = JSON.stringify([sample.collector, sample.accountLabel, sample.observedAt, sample.window]);
    const previous = seen.get(key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(sample)) {
      throw new Error(`Conflicting sample identity for ${sample.collector} at ${sample.observedAt} (${sample.window}); use one account per invocation`);
    }
    seen.set(key, sample);
  }
  return [...seen.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.window.localeCompare(b.window));
}
