import type { QuotaEvidence } from '../../db/schema/quota';

export type EvidenceRow = Pick<QuotaEvidence, 'id' | 'planSlug' | 'sourceName' | 'authorHandle' | 'observedAt' | 'capturedAt' | 'url' | 'screenshotUrl' | 'confidence' | 'reviewStatus' | 'rawValue' | 'notes'>;

function schemaUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('code' in error && (error.code === '42P01' || error.code === '42703')) return true;
  return 'cause' in error && schemaUnavailable(error.cause);
}

/** Permit deployments before manual migrations 0005/0012; other failures remain visible. */
export async function loadQuotaEvidence(read?: () => Promise<EvidenceRow[]>): Promise<EvidenceRow[]> {
  try {
    if (read) return await read();
    const [{ db }, { quotaEvidence: table }, { desc }] = await Promise.all([
      import('../db'), import('../../db/schema/quota'), import('drizzle-orm'),
    ]);
    return await db.select({
      id: table.id, planSlug: table.planSlug, sourceName: table.sourceName,
      authorHandle: table.authorHandle, observedAt: table.observedAt, capturedAt: table.capturedAt,
      url: table.url, screenshotUrl: table.screenshotUrl, confidence: table.confidence,
      reviewStatus: table.reviewStatus, rawValue: table.rawValue, notes: table.notes,
    }).from(table).orderBy(table.planSlug, desc(table.observedAt), desc(table.id));
  } catch (error) {
    if (schemaUnavailable(error)) return [];
    throw error;
  }
}

export function groupQuotaEvidence(rows: EvidenceRow[]): Map<string | null, EvidenceRow[]> {
  const groups = new Map<string | null, EvidenceRow[]>();
  for (const row of rows) {
    const group = groups.get(row.planSlug) ?? [];
    group.push(row);
    groups.set(row.planSlug, group);
  }
  return groups;
}

/** Older monitor rows did not have intake URL validation. */
export function evidenceLink(value: string | null): string | undefined {
  try {
    const url = new URL(value ?? '');
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}
