import type { Sql } from 'postgres';
import { shutdownDay, shutdownReached } from '../../src/lib/model-shutdown';

/**
 * Past-shutdown availability sweep (deploy step).
 *
 * A model whose shutdown_date (UTC) has been reached cannot keep a live API
 * channel. Every rollout sets is_available=false on its channel and variant
 * rows and locks them (availability_locked) so a later scrape cannot turn them
 * back on. One way only: rows are never turned back on here, and models without a
 * shutdown_date, or with a future one, are not touched. Same boundary as
 * modelShutdownNotice, the scraper's sweep and seed-openai-shutdowns.
 */
export const SHUTDOWN_TABLES = ['api_channel_prices', 'api_channel_price_variants'] as const;
export type ShutdownTable = (typeof SHUTDOWN_TABLES)[number];
export type ShutdownMode = 'apply' | 'dry-run' | 'check';

export interface ShutdownModel { id: number; slug: string; shutdown_date: string | Date | null }
export interface ShutdownChannelRow { id: number; model_id: number | null; provider_id: number | null; is_available: boolean | null; availability_locked?: boolean | null }
/** disable: is_available true → false (+ lock). lock: already false, only set availability_locked so scrapes cannot turn it back on. */
export interface ShutdownTarget { table: ShutdownTable; id: number; model_id: number; provider_id: number | null; slug: string; shutdown_date: string; action: 'disable' | 'lock' }

/** Pure planner: rows still marked available whose model reached its shutdown day by `today` (YYYY-MM-DD, UTC). */
export function planShutdownAvailability(
  models: readonly ShutdownModel[],
  rows: Readonly<Record<ShutdownTable, readonly ShutdownChannelRow[]>>,
  today: string,
): ShutdownTarget[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`Bad UTC day ${today}`);
  const now = new Date(`${today}T12:00:00.000Z`);
  const retired = new Map<number, { slug: string; day: string }>();
  for (const model of models) {
    if (!shutdownReached(model.shutdown_date, now)) continue;
    retired.set(model.id, { slug: model.slug, day: shutdownDay(model.shutdown_date)! });
  }
  const targets: ShutdownTarget[] = [];
  for (const table of SHUTDOWN_TABLES) {
    for (const row of rows[table] ?? []) {
      if (row.model_id == null) continue;
      const model = retired.get(row.model_id);
      if (!model) continue;
      // true/NULL (NULL renders as available) is switched off; false stays false and only gains the lock.
      const action = row.is_available === false ? 'lock' : 'disable';
      if (action === 'lock' && row.availability_locked === true) continue;
      targets.push({ table, id: row.id, model_id: row.model_id, provider_id: row.provider_id, slug: model.slug, shutdown_date: model.day, action });
    }
  }
  return targets.sort((a, b) => a.table.localeCompare(b.table) || a.id - b.id);
}

export function shutdownAvailabilityMode(args: readonly string[]): ShutdownMode {
  const known = ['--apply', '--dry-run', '--check'];
  const flags = args.filter(arg => known.includes(arg));
  if (args.some(arg => !known.includes(arg)) || flags.length > 1) {
    throw new Error('Usage: seed-shutdown-availability.ts [--dry-run | --apply | --check]');
  }
  return flags[0] === '--apply' ? 'apply' : flags[0] === '--check' ? 'check' : 'dry-run';
}

/** Minimal store so the sweep runs against postgres.js in production and memory in tests. */
export interface ShutdownStore {
  today(): Promise<string>;
  models(): Promise<ShutdownModel[]>;
  rows(table: ShutdownTable, modelIds: number[]): Promise<ShutdownChannelRow[]>;
  /** Sets is_available=false and availability_locked=true on these ids. Never writes true. Returns rows changed. */
  disable(table: ShutdownTable, ids: number[]): Promise<number>;
}

export function sqlShutdownStore(tx: Sql): ShutdownStore {
  return {
    async today() {
      const [clock] = await tx<Array<{ today: string }>>`SELECT (now() AT TIME ZONE 'UTC')::date::text AS today`;
      return clock.today;
    },
    async models() {
      return tx<ShutdownModel[]>`SELECT id, slug, shutdown_date::text AS shutdown_date FROM models
        WHERE shutdown_date IS NOT NULL AND shutdown_date <= (now() AT TIME ZONE 'UTC')::date ORDER BY id`;
    },
    async rows(table, modelIds) {
      if (!modelIds.length) return [];
      return tx<ShutdownChannelRow[]>`SELECT id, model_id, provider_id, is_available, availability_locked FROM ${tx(table)}
        WHERE model_id IN ${tx(modelIds)} AND (is_available IS DISTINCT FROM false OR availability_locked = false) ORDER BY id`;
    },
    async disable(table, ids) {
      if (!ids.length) return 0;
      const result = await tx`UPDATE ${tx(table)} SET is_available = false, availability_locked = true, updated_at = now()
        WHERE id IN ${tx(ids)} AND (is_available IS DISTINCT FROM false OR availability_locked = false)`;
      return result.count;
    },
  };
}

export interface ShutdownSweepResult { mode: ShutdownMode; today: string; targets: ShutdownTarget[]; written: number }

/** Lists (dry-run/check) or switches off (apply) available rows of models past their shutdown day. */
export async function runShutdownAvailability(store: ShutdownStore, mode: ShutdownMode): Promise<ShutdownSweepResult> {
  const today = await store.today();
  const models = await store.models();
  const ids = models.filter(model => shutdownReached(model.shutdown_date, new Date(`${today}T12:00:00.000Z`))).map(model => model.id);
  const rows = Object.fromEntries(await Promise.all(SHUTDOWN_TABLES.map(async table => [table, await store.rows(table, ids)] as const))) as Record<ShutdownTable, ShutdownChannelRow[]>;
  const targets = planShutdownAvailability(models, rows, today);
  let written = 0;
  if (mode === 'apply') {
    for (const table of SHUTDOWN_TABLES) {
      written += await store.disable(table, targets.filter(target => target.table === table).map(target => target.id));
    }
  }
  return { mode, today, targets, written };
}
