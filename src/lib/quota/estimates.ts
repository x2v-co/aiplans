import { orderOfMagnitude, toRange, weeklyToMonthly, type WindowKind } from './engine';

export type QuotaEvidenceLink = { id: number; url: string; capturedAt: string; type: string };
export type VerifiedQuotaEstimate = {
  id: number;
  planSlug: string;
  planName: string;
  providerName: string | null;
  servedModel: string | null;
  window: WindowKind;
  low: number;
  high: number;
  mix: { id: string; name: string; cacheReadPct: number; inputPct: number; outputPct: number };
  confidence: 'high' | 'medium' | 'low';
  verifiedAt: string;
  createdAt: string;
  notes: string | null;
  isCurrent: boolean;
  supersededBy: number | null;
  evidence: QuotaEvidenceLink[];
};

/** SQL boundary; int8 values stay strings until checked for safe JS arithmetic. */
export type QuotaEstimateRow = {
  id: number; plan_slug: string; plan_name: string | null; provider_name: string | null;
  served_model: string | null; window: string; est_tokens_low: string; est_tokens_high: string;
  usage_mix_id: string; mix_name: string; cache_read_pct: string; input_pct: string; output_pct: string;
  confidence: string; verified_at: Date | string | null; created_at: Date | string;
  notes: string | null; is_current: boolean; superseded_by: number | null;
  evidence: { id: number; url: string | null; screenshot_url: string | null; captured_at: string; evidence_type: string }[];
};

function isoDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function evidenceUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function verifiedEstimate(row: QuotaEstimateRow): VerifiedQuotaEstimate | null {
  const verifiedAt = isoDate(row.verified_at);
  const createdAt = isoDate(row.created_at);
  const low = Number(row.est_tokens_low);
  const high = Number(row.est_tokens_high);
  const confidence = row.confidence;
  const window = row.window;
  const [cacheReadPct, inputPct, outputPct] = [row.cache_read_pct, row.input_pct, row.output_pct].map(Number);
  if (!verifiedAt || !createdAt || !row.plan_slug || !row.usage_mix_id || !row.mix_name
    || !Number.isSafeInteger(low) || !Number.isSafeInteger(high) || low < 0 || low > high
    || ![cacheReadPct, inputPct, outputPct].every(value => Number.isFinite(value) && value >= 0)
    || Math.abs(cacheReadPct + inputPct + outputPct - 100) > 1e-9
    || !['high', 'medium', 'low'].some(value => value === confidence)
    || !['5h', 'daily', 'weekly', 'monthly'].some(value => value === window)) return null;

  return {
    id: row.id, planSlug: row.plan_slug, planName: row.plan_name || row.plan_slug,
    providerName: row.provider_name, servedModel: row.served_model || null,
    window: window as WindowKind, low, high,
    mix: { id: row.usage_mix_id, name: row.mix_name, cacheReadPct, inputPct, outputPct },
    confidence: confidence as VerifiedQuotaEstimate['confidence'], verifiedAt, createdAt,
    notes: row.notes, isCurrent: row.is_current, supersededBy: row.superseded_by,
    evidence: (row.evidence ?? []).flatMap(evidence => {
      const capturedAt = isoDate(evidence.captured_at);
      if (!capturedAt) return [];
      return [...new Set([evidenceUrl(evidence.url), evidenceUrl(evidence.screenshot_url)])]
        .flatMap(url => url ? [{ id: evidence.id, url, capturedAt, type: evidence.evidence_type }] : []);
    }),
  };
}

/** Missing migration, empty tables and DB outages all produce the same safe empty state. */
export async function readVerifiedQuotaEstimates(fetchRows: () => Promise<QuotaEstimateRow[]>): Promise<VerifiedQuotaEstimate[]> {
  try {
    return (await fetchRows()).flatMap(row => {
      const estimate = verifiedEstimate(row);
      return estimate ? [estimate] : [];
    });
  } catch { return []; }
}

export function currentPlanEstimates(estimates: VerifiedQuotaEstimate[], planSlug: string): VerifiedQuotaEstimate[] {
  return estimates.filter(estimate => estimate.planSlug === planSlug && estimate.isCurrent && estimate.supersededBy === null);
}

export type QuotaChange = { previous: VerifiedQuotaEstimate; next: VerifiedQuotaEstimate };

export function quotaChanges(estimates: VerifiedQuotaEstimate[]): QuotaChange[] {
  const byId = new Map(estimates.map(estimate => [estimate.id, estimate]));
  return estimates.flatMap(previous => {
    const next = previous.supersededBy === null ? undefined : byId.get(previous.supersededBy);
    if (!next || previous.isCurrent || previous.id === next.id
      || previous.planSlug !== next.planSlug || previous.servedModel !== next.servedModel
      || previous.window !== next.window || previous.mix.id !== next.mix.id) return [];
    // A corrupt cyclic chain cannot establish a chronological revision.
    const visited = new Set([previous.id]);
    let cursor: VerifiedQuotaEstimate | undefined = next;
    while (cursor) {
      if (visited.has(cursor.id)) return [];
      visited.add(cursor.id);
      cursor = cursor.supersededBy === null ? undefined : byId.get(cursor.supersededBy);
    }
    return [{ previous, next }];
  }).sort((a, b) => b.next.createdAt.localeCompare(a.next.createdAt) || b.next.id - a.next.id);
}

export function tokenRange(estimate: VerifiedQuotaEstimate, locale: string, monthly = false): string | null {
  if (monthly && estimate.window !== 'weekly' && estimate.window !== 'monthly') return null;
  const low = monthly && estimate.window === 'weekly' ? weeklyToMonthly(estimate.low) : estimate.low;
  const high = monthly && estimate.window === 'weekly' ? weeklyToMonthly(estimate.high) : estimate.high;
  if (!Number.isSafeInteger(low) || !Number.isSafeInteger(high)) return null;
  const range = toRange(low, high);
  const format = (value: number) => value.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: 0 });
  const endpoints = range.low === range.high ? format(range.low) : `${format(range.low)}–${format(range.high)}`;
  const magnitudes = [orderOfMagnitude(low), orderOfMagnitude(high)];
  return `${endpoints} tokens (${[...new Set(magnitudes)].join('–')})`;
}
