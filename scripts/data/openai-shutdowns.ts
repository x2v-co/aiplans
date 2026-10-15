/**
 * Exact-slug shutdown catalog, extended from audit A2 #1 (2026-10-15).
 * Verified 2026-10-14: https://platform.openai.com/docs/deprecations
 * Fine-tunes follow their base; we do not invent fine-tune catalog rows.
 */
export const OPENAI_DEPRECATION_SOURCE = 'https://platform.openai.com/docs/deprecations';

export interface Shutdown {
  ids: readonly string[];
  announcedOn?: string;
  shutdownDate: string;
  replacementModel?: string;
  /** Informational only. Never use this to choose an update target. */
  snapshotFamily?: string;
}

const batchA = { announcedOn: '2026-10-14', shutdownDate: '2027-01-14', replacementModel: 'gpt-6-luna' };
const batchB = { announcedOn: '2026-04-22', shutdownDate: '2026-10-23' };

export const OPENAI_SHUTDOWNS: readonly Shutdown[] = [
  { ...batchA, ids: ['gpt-4o-2024-08-06', 'gpt-4o-2024-11-20'], snapshotFamily: 'gpt-4o' },
  { ...batchA, ids: ['gpt-4o-mini-2024-07-18'], snapshotFamily: 'gpt-4o-mini' },
  { ...batchA, ids: ['gpt-4.1-2025-04-14'], snapshotFamily: 'gpt-4.1' },
  { ...batchA, ids: ['gpt-4.1-mini-2025-04-14'], snapshotFamily: 'gpt-4.1-mini' },
  { ...batchB, ids: ['gpt-3.5-turbo-0125', 'gpt-3.5-turbo', 'gpt-3.5-turbo-completions'], replacementModel: 'gpt-5.6-terra' },
  { ...batchB, ids: ['gpt-4-0613', 'gpt-4', 'gpt-4-0613-completions', 'gpt-4-completions'], replacementModel: 'gpt-5.6-sol' },
  { ...batchB, ids: ['gpt-4-1106-preview'], replacementModel: 'gpt-5.6-sol' },
  { ...batchB, ids: ['gpt-4-turbo', 'gpt-4-turbo-2024-04-09', 'gpt-4-turbo-completions'], replacementModel: 'gpt-5.6-sol' },
  { ...batchB, ids: ['gpt-4.1-nano', 'gpt-4.1-nano-2025-04-14'], replacementModel: 'gpt-5.6-luna' },
  { ...batchB, ids: ['gpt-4o-2024-05-13'], snapshotFamily: 'gpt-4o', replacementModel: 'gpt-5.6-sol' },
  { ...batchB, ids: ['gpt-image-1'], replacementModel: 'gpt-image-2.5-sunburst or gpt-image-2.5-flare' },
  { ...batchB, ids: ['o1-2024-12-17', 'o1'], replacementModel: 'gpt-5.6-sol' },
  { ...batchB, ids: ['o1-pro-2025-03-19', 'o1-pro'], replacementModel: 'gpt-5.6-sol (reasoning.mode: pro)' },
  { ...batchB, ids: ['o3-mini-2025-01-31', 'o3-mini'], replacementModel: 'gpt-5.6-sol' },
  { ...batchB, ids: ['o4-mini-2025-04-16', 'o4-mini'], replacementModel: 'gpt-5.6-terra' },
  // Audit explicitly includes these aliases / production slugs. Do not normalize.
  { shutdownDate: '2026-07-23', ids: ['gpt-5-codex', 'gpt-5.1-codex', 'gpt-5.1-codex-max', 'gpt-5.2-codex'] },
  { shutdownDate: '2026-10-23', ids: ['openai-o1-pro', 'openai-o4-mini', 'o4-mini-high', 'openai-gpt-4-turbo', 'openai-gpt-4-1-nano-batch', 'openai-gpt-4o-batch'] },
  { shutdownDate: '2026-12-11', ids: ['openai-o3', 'openai-o3-pro'] },
  { shutdownDate: '2026-12-01', ids: ['gpt-image-1.5', 'gpt-image-1.5-mini'] },
  { ...batchA, ids: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'] },
  { shutdownDate: '2027-04-01', ids: ['gpt-5.1', 'gpt-5.3-codex', 'gpt-5.4-nano'] },
  { shutdownDate: '2027-01-06', ids: ['tts-1', 'tts-1-hd'] },
  // gpt-5.1-codex-mini: sitemap evidence only; shutdown date needs verification.

];

export interface ShutdownModelRow {
  id: number;
  slug: string;
  shutdown_date: string | null;
  deprecated_at?: string | null;
  replacement_model: string | null;
  deprecation_source_url: string | null;
}

export function planOpenAIShutdowns(rows: readonly ShutdownModelRow[], shutdowns: readonly Shutdown[] = OPENAI_SHUTDOWNS) {
  const bySlug = new Map<string, ShutdownModelRow>();
  for (const row of rows) {
    if (bySlug.has(row.slug)) throw new Error(`Ambiguous model slug: ${row.slug}; nothing written.`);
    bySlug.set(row.slug, row);
  }
  const desiredDates = new Map<number, string>();
  const updates = new Map<number, { id: number; slug: string; from: Omit<ShutdownModelRow, 'id' | 'slug'>; to: Omit<ShutdownModelRow, 'id' | 'slug'> }>();
  const matches = shutdowns.flatMap(shutdown => shutdown.ids.map(apiId => {
    // Never call normalizeSlug, resolve a redirect, or match a display name here.
    const exact = bySlug.get(apiId);
    const row = exact;
    if (!row) return {
      apiId, slug: null, status: shutdown.snapshotFamily ? 'ambiguous' : 'not-present',
      reason: shutdown.snapshotFamily
        ? `No exact snapshot row; ${shutdown.snapshotFamily} is a separate target.`
        : 'No exact model slug.',
    };
    const previousDate = desiredDates.get(row.id);
    if (previousDate && previousDate !== shutdown.shutdownDate) throw new Error(`Conflicting shutdown dates for ${row.slug}; nothing written.`);
    desiredDates.set(row.id, shutdown.shutdownDate);
    const from = { shutdown_date: row.shutdown_date, replacement_model: row.replacement_model, deprecation_source_url: row.deprecation_source_url, deprecated_at: row.deprecated_at ?? null };
    const to = { shutdown_date: shutdown.shutdownDate, replacement_model: shutdown.replacementModel ?? row.replacement_model, deprecation_source_url: OPENAI_DEPRECATION_SOURCE, deprecated_at: shutdown.announcedOn ?? row.deprecated_at ?? null };
    if (Object.keys(to).some(key => from[key as keyof typeof to] !== to[key as keyof typeof to])) {
      const previous = updates.get(row.id);
      if (previous && JSON.stringify(previous.to) !== JSON.stringify(to)) throw new Error(`Conflicting shutdowns for ${row.slug}; nothing written.`);
      updates.set(row.id, { id: row.id, slug: row.slug, from, to });
    }
    return { apiId, slug: row.slug, status: 'exact', reason: null };
  }));
  return { matches, updates: [...updates.values()] };
}

export function shutdownSeedMode(args: readonly string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-openai-shutdowns.ts [--dry-run | --apply]');
  }
  return args.includes('--apply') ? 'apply' : 'dry-run';
}
