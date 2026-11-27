import type { Sql } from 'postgres';
import { VOYAGE_CATALOG_1126 } from '../../src/lib/catalog-2026-11-26-voyage';
import { verticalModelDescription } from './catalog-audit-vertical';
import { seedChanges } from './gemini-4-argon';

export const SEED_TABLES = ['providers', 'models', 'usage_prices'] as const;
/** Shape expectation, NOT a measured production dry-run.
 * SRE's 2026-11-26 21:12 SGT dump: six existing models with notes in their
 * descriptions, and six existing usage rows whose notes already match exactly. */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 0, update: 0 },
  models: { insert: 0, update: 6 },
  usage_prices: { insert: 0, update: 0 },
} as const;

export function voyageCopySeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run', '--db'].includes(arg)) ||
      (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-26-voyage-copy.ts [--dry-run | --apply] [--db]');
  }
  return { apply: args.includes('--apply'), db: args.includes('--db') || args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = typeof SEED_TABLES[number];
export interface CopyStep { table: Table; target: string; action: 'update'; changes: ReturnType<typeof seedChanges> }

/** Replace the description without changing the shared helper or original seed. */
export function voyageCopyDescription(item: typeof VOYAGE_CATALOG_1126[number]): string {
  return verticalModelDescription({ ...item, notes: undefined });
}

/** UPDATE only. All identities and JSON shapes are validated before any write.
 * Call within runRehearsable's serializable transaction for DB rehearsal/apply. */
export async function seedVoyageCopy1126(tx: Sql, apply = false): Promise<CopyStep[]> {
  const one = (rows: Row[], target: string): Row => {
    if (rows.length !== 1) throw new Error(`Ambiguous or missing ${target}; nothing written.`);
    return rows[0];
  };
  const provider = one(await tx<Row[]>`SELECT * FROM providers WHERE slug = ${'voyage'}`, 'providers/voyage');
  if (!['official', 'producer'].includes(String(provider.type))) throw new Error('Unexpected providers/voyage type; nothing written.');
  const slugs = VOYAGE_CATALOG_1126.map(item => item.slug!);
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(slugs)}`;
  const steps: CopyStep[] = [];
  const pending: { table: 'models' | 'usage_prices'; id: number; values: Record<string, unknown> }[] = [];
  const replace = (table: 'models' | 'usage_prices', row: Row, values: Record<string, unknown>, target: string) => {
    const changes = seedChanges(row, values);
    if (!Object.keys(changes).length) return;
    steps.push({ table, target, action: 'update', changes });
    pending.push({ table, id: row.id, values });
  };
  for (const item of VOYAGE_CATALOG_1126) {
    const model = one(models.filter(row => row.slug === item.slug), `models/${item.slug}`);
    const rates = await tx<Row[]>`SELECT * FROM usage_prices WHERE model_id = ${model.id} AND provider_id = ${provider.id}`;
    const rate = one(rates, `usage_prices/${item.slug}`);
    const expected = item.usageRates!.find(rate => rate.unit === 'per_1m_tokens')!;
    if (rate.unit !== expected.unit || rate.price_kind !== expected.priceKind || rate.plan_id != null) {
      throw new Error(`Unexpected usage_prices/${item.slug} identity; nothing written.`);
    }
    const constraints = rate.constraints_json;
    if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)) {
      throw new Error(`Unexpected usage_prices/${item.slug} constraints; nothing written.`);
    }
    replace('models', model, { description: voyageCopyDescription(item) }, item.slug!);
    // Preserve every other JSON key. A matching note causes NO usage_prices UPDATE.
    const previous = constraints as Record<string, unknown>;
    if (previous.note !== item.notes) {
      replace('usage_prices', rate, { constraints_json: { ...previous, note: item.notes } }, item.slug!);
    }
  }
  if (apply) for (const operation of pending) {
    // Deliberately no updated_at or other columns: only the two explanation fields.
    await tx`UPDATE ${tx(operation.table)} SET ${tx(operation.values, ...Object.keys(operation.values))} WHERE id = ${operation.id}`;
  }
  return steps;
}

export function copySeedStepCounts(steps: CopyStep[]) {
  const counts = Object.fromEntries(SEED_TABLES.map(table => [table, { insert: 0, update: 0 }])) as Record<Table, { insert: number; update: number }>;
  for (const step of steps) counts[step.table].update++;
  return counts;
}
