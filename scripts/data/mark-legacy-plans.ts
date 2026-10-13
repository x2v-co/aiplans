/**
 * Mark pre-launch plans as closed to new users. Uses only the project's db
 * fluent API (select / eq / in) — no .lt, which postgres-admin does not implement.
 */
import {
  LEGACY_CLOSED_MARKER,
  LEGACY_CLOSED_NOTE,
  LEGACY_CLOSED_RULES,
  LEGACY_CREATED_BEFORE_ISO,
  X_SUBSCRIPTION_PLANS,
} from './verified-2026-10-subscriptions';

export interface LegacyProviderRow {
  id: number;
  slug: string;
  name: string;
}

export interface LegacyPlanRow {
  id: number;
  slug: string;
  name: string;
  notes: string | null;
  created_at: string | Date | null;
}

/** Minimal db surface used by markLegacyPlans. Intentionally has no .lt. */
export interface LegacyDb {
  from(table: string): {
    select(columns: string): {
      in(column: string, values: unknown[]): PromiseLike<{
        data: LegacyPlanRow[] | null;
        error: { message: string } | null;
      }>;
    };
    update(data: Record<string, unknown>): {
      eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

export function isCreatedBefore(createdAt: LegacyPlanRow['created_at'], beforeIso: string): boolean {
  if (createdAt == null) return false;
  const t = createdAt instanceof Date ? createdAt.getTime() : Date.parse(String(createdAt));
  if (!Number.isFinite(t)) return false;
  return t < Date.parse(beforeIso);
}

export function filterPlansCreatedBefore(
  rows: LegacyPlanRow[],
  beforeIso: string = LEGACY_CREATED_BEFORE_ISO,
): LegacyPlanRow[] {
  return rows.filter((row) => isCreatedBefore(row.created_at, beforeIso));
}

export async function markLegacyPlans(
  db: LegacyDb,
  providers: Map<string, LegacyProviderRow>,
  options: { apply: boolean; now?: Date; log?: (line: string) => void } = { apply: false },
): Promise<void> {
  const log = options.log ?? console.log;
  const now = options.now ?? new Date();
  const newSlugs = new Set(X_SUBSCRIPTION_PLANS.map((p) => p.slug));

  for (const rule of LEGACY_CLOSED_RULES) {
    const ids = rule.providerSlugs
      .map((s) => providers.get(s)?.id)
      .filter((id): id is number => id != null);
    if (!ids.length) {
      log(`  ⚠ legacy ${rule.label}: no provider among ${rule.providerSlugs.join('/')}`);
      continue;
    }

    // postgres-admin has no .lt — select created_at and filter in JS.
    const { data, error } = await db
      .from('plans')
      .select('id, slug, name, notes, created_at')
      .in('provider_id', ids);
    if (error) throw error;

    const candidates = filterPlansCreatedBefore(data ?? []);
    const hits = candidates.filter(
      (p) => !newSlugs.has(p.slug) && rule.nameRe.test(p.name),
    );
    if (!hits.length) log(`  ⚠ legacy ${rule.label}: no matching plans`);

    for (const p of hits) {
      if ((p.notes ?? '').includes(LEGACY_CLOSED_MARKER)) {
        log(`  = legacy ${p.slug} already marked`);
        continue;
      }
      log(`  ⛔ legacy ${p.slug} (${p.name}) → closed to new users (kept)`);
      if (options.apply) {
        const { error: e } = await db
          .from('plans')
          .update({
            notes: [p.notes, LEGACY_CLOSED_NOTE].filter(Boolean).join('\n'),
            updated_at: now,
          })
          .eq('id', p.id);
        if (e) throw e;
      }
    }
  }
}
