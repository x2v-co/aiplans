/**
 * Corrects Workers AI shutdown_date 2026-11-15 → 2026-11-20 on the 24 cloudflare-* rows
 * written by seed:catalog-2026-11-06-workers-ai-deprecations (#341, 1bbf9e7).
 *
 * Cloudflare's 2026-11-05 changelog first said November 15, then moved removal to
 * November 20, 2026. From that day requests fail HTTP 410 Gone / error 5028.
 * Source (re-read live 2026-11-07):
 * https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/
 *
 * Update only. Never inserts. Never touches a slug outside the cloudflare-<id> list
 * (kimi / glm / deepseek official rows stay as they are). A shared or non-Cloudflare
 * provider on one of those slugs is skipped, because shutdown_date retires every
 * channel of the row. Default dry-run; --apply writes one transaction.
 */
import {
  CF_DEPRECATIONS, CF_SHUTDOWN_DATE, CF_SHUTDOWN_DATE_PREVIOUS, workersAiCatalogSlug, workersAiModelInsert,
  type CfDeprecation,
} from './catalog-2026-11-06-workers-ai-deprecations';

export { CF_SHUTDOWN_DATE, CF_SHUTDOWN_DATE_PREVIOUS };

const bySlug = new Map<string, CfDeprecation>();
for (const item of CF_DEPRECATIONS) {
  const slug = workersAiCatalogSlug(item.endpoint);
  if (!slug.startsWith('cloudflare-')) throw new Error(`Workers AI correction slug is not cloudflare-*: ${slug}`);
  if (bySlug.has(slug)) throw new Error(`Duplicate Workers AI correction slug: ${slug}`);
  bySlug.set(slug, item);
}

/** The 24 catalog slugs this correction may update. All are cloudflare-<model id>. */
export const WORKERS_AI_CORRECTION_SLUGS = [...bySlug.keys()];

export interface WorkersAiDateRow {
  id: number;
  slug: string;
  shutdown_date: string | null;
  description: string | null;
  /** Provider slugs from provider_ids and api_channel_prices. Empty means unknown. */
  providerSlugs: readonly string[];
}

export interface WorkersAiDateUpdate {
  id: number;
  slug: string;
  endpoint: string;
  from: { shutdown_date: string | null; description: string | null };
  to: { shutdown_date: string; description: string | null };
}

export interface SkippedDateRow {
  endpoint: string;
  slug: string;
  status: 'missing' | 'not-exclusive-cloudflare';
}

export interface UntouchedDateRow {
  slug: string;
  status: 'not-workers-ai-slug';
}

const DATE_TEXT: readonly [string, string][] = [
  [CF_SHUTDOWN_DATE_PREVIOUS, CF_SHUTDOWN_DATE],
  ['November 15, 2026', 'November 20, 2026'],
  ['November 15 2026', 'November 20 2026'],
  ['Nov 15, 2026', 'Nov 20, 2026'],
  ['2026年11月15日', '2026年11月20日'],
];

/** Rewrites a stored description that still names November 15. Blank notes get the current template. */
export function correctedWorkersAiDescription(description: string | null, item: CfDeprecation): string | null {
  if (description == null || description.trim() === '') return workersAiModelInsert(item).values.description;
  return DATE_TEXT.reduce((text, [from, to]) => text.replaceAll(from, to), description);
}

function exclusiveCloudflare(slugs: readonly string[]): boolean {
  const set = [...new Set(slugs)];
  return set.length === 1 && set[0] === 'cloudflare';
}

/**
 * Pure plan. inserts is always empty. Throws before any caller writes when a
 * slug is ambiguous or an exclusive Cloudflare row carries some other shutdown day.
 */
export function planWorkersAiDeprecationDate(rows: readonly WorkersAiDateRow[]) {
  const seen = new Map<string, WorkersAiDateRow>();
  for (const row of rows) {
    if (seen.has(row.slug)) throw new Error(`Ambiguous model slug: ${row.slug}; nothing written.`);
    seen.set(row.slug, row);
  }
  const updates: WorkersAiDateUpdate[] = [];
  const skipped: SkippedDateRow[] = [];
  const untouched: UntouchedDateRow[] = [];
  for (const row of rows) {
    if (!bySlug.has(row.slug)) untouched.push({ slug: row.slug, status: 'not-workers-ai-slug' });
  }
  for (const slug of WORKERS_AI_CORRECTION_SLUGS) {
    const item = bySlug.get(slug)!;
    const row = seen.get(slug);
    if (!row) {
      skipped.push({ endpoint: item.endpoint, slug, status: 'missing' });
      continue;
    }
    if (!exclusiveCloudflare(row.providerSlugs) || !slug.startsWith('cloudflare-')) {
      skipped.push({ endpoint: item.endpoint, slug, status: 'not-exclusive-cloudflare' });
      continue;
    }
    if (row.shutdown_date && row.shutdown_date !== CF_SHUTDOWN_DATE_PREVIOUS && row.shutdown_date !== CF_SHUTDOWN_DATE) {
      throw new Error(`Conflicting shutdown date for ${row.slug} (${row.shutdown_date}); nothing written.`);
    }
    const description = correctedWorkersAiDescription(row.description, item);
    const to = { shutdown_date: CF_SHUTDOWN_DATE, description };
    if (row.shutdown_date === to.shutdown_date && row.description === to.description) continue;
    updates.push({
      id: row.id,
      slug,
      endpoint: item.endpoint,
      from: { shutdown_date: row.shutdown_date, description: row.description },
      to,
    });
  }
  const inserts: [] = [];
  return { updates, inserts, skipped, untouched };
}

export function workersAiDateSeedOptions(args: readonly string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-07-workers-ai-deprecation-date.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}
