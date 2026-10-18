/**
 * Shared helpers for catalog seeds that must be safe to run on production:
 * - default dry-run; only an explicit --apply writes;
 * - --slug a,b (or repeated --slug x) narrows the run to catalog slugs;
 * - field-level diff so only rows that actually changed are written;
 * - last_verified never moves backwards; is_available is only set on insert
 *   unless --sync-availability is passed.
 */

export interface SeedArgs {
  apply: boolean;
  slugs: Set<string> | null;
  syncAvailability: boolean;
}

export function parseSeedArgs(argv: string[]): SeedArgs {
  const slugs: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--slug' && argv[i + 1]) slugs.push(...argv[++i].split(','));
    else if (arg.startsWith('--slug=')) slugs.push(...arg.slice('--slug='.length).split(','));
  }
  const cleaned = slugs.map((s) => s.trim()).filter(Boolean);
  return {
    apply: argv.includes('--apply'),
    slugs: cleaned.length ? new Set(cleaned) : null,
    syncAvailability: argv.includes('--sync-availability'),
  };
}

const DATE_KEYS = new Set(['last_verified', 'updated_at', 'created_at']);

function toTime(value: unknown): number | null {
  if (value == null) return null;
  const t = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  return Number.isNaN(t) ? null : t;
}

function stable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as object).sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => [k, stable((value as Record<string, unknown>)[k])]));
  }
  return value;
}

export function sameValue(key: string, before: unknown, after: unknown): boolean {
  if (before === undefined) before = null;
  if (after === undefined) after = null;
  if (DATE_KEYS.has(key)) return toTime(before) === toTime(after);
  if (before === null || after === null) return before === after;
  if (typeof before === 'number' || typeof after === 'number') {
    const a = Number(before);
    const b = Number(after);
    if (!Number.isNaN(a) && !Number.isNaN(b)) return a === b;
  }
  if (typeof before === 'string' && typeof after !== 'string' && typeof after === 'object') {
    try { before = JSON.parse(before); } catch { /* compare as is */ }
  }
  return JSON.stringify(stable(before)) === JSON.stringify(stable(after));
}

export interface FieldChange { key: string; before: unknown; after: unknown }

export interface DiffOptions {
  /** Keys never compared nor written on update (e.g. updated_at). */
  ignore?: string[];
  /** Write is_available on update too (default: insert only). */
  syncAvailability?: boolean;
}

/**
 * Compare the desired row with the stored row. Returns the changed fields and the
 * patch to write (empty patch = no write). last_verified only moves forward.
 */
export function diffRow(existing: Record<string, unknown>, desired: Record<string, unknown>, options: DiffOptions = {}) {
  const ignore = new Set(['updated_at', ...(options.ignore ?? [])]);
  if (!options.syncAvailability) ignore.add('is_available');
  const changes: FieldChange[] = [];
  const patch: Record<string, unknown> = {};
  for (const [key, after] of Object.entries(desired)) {
    if (after === undefined || ignore.has(key)) continue;
    const before = existing[key];
    if (key === 'last_verified') {
      const b = toTime(before);
      const a = toTime(after);
      if (b != null && (a == null || b >= a)) continue; // never move backwards
    }
    if (sameValue(key, before, after)) continue;
    changes.push({ key, before: before ?? null, after });
    patch[key] = after;
  }
  return { changes, patch };
}

function show(value: unknown): string {
  const s = value instanceof Date ? value.toISOString() : JSON.stringify(stable(value));
  return s === undefined ? 'null' : s.length > 120 ? `${s.slice(0, 117)}...` : s;
}

export function formatChanges(changes: FieldChange[], indent = '      '): string {
  return changes.map((c) => `${indent}${c.key}: ${show(c.before)} → ${show(c.after)}`).join('\n');
}
