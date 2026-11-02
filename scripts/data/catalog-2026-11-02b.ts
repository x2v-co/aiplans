import type { Sql } from 'postgres';
import { KIMI_CACHE_WRITES, KIMI_CHANNELS } from './catalog-2026-11-02';
import { seedChanges } from './gemini-4-argon';
import { assertCacheWriteHeadlines } from '../utils/variant-headlines';

type Row = Record<string, unknown> & { id: number };
export interface HeadlineRepairStep {
  table: 'api_channel_price_variants';
  target: string;
  action: 'update';
  changes: ReturnType<typeof seedChanges>;
}

export function catalog20261102bSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || args.length > 1) {
    throw new Error('Usage: seed-catalog-2026-11-02b.ts [--dry-run (offline) | --apply]');
  }
  return { apply: args.includes('--apply') };
}

/** Caller owns a serializable transaction. Repair only existing headline flags;
 * never insert variants, change prices or update channel/model/provider rows.
 * All identities, rates and the projected C22 invariant are checked before writes.
 */
export async function seedCatalog20261102b(tx: Sql, apply = false): Promise<HeadlineRepairStep[]> {
  const one = (rows: Row[], target: string): Row => {
    if (rows.length !== 1) throw new Error(`Expected exactly one ${target}, found ${rows.length}; nothing written.`);
    return rows[0];
  };
  const provider = one(await tx<Row[]>`SELECT * FROM providers WHERE slug = ${'moonshot-global'}`, 'providers/moonshot-global');
  if (!['official', 'producer'].includes(String(provider.type))) throw new Error('Unexpected Moonshot provider type; nothing written.');
  const model = one(await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx([...KIMI_CHANNELS[0].slugs])}`, 'models/kimi-k3.1-pro (including exact aliases)');
  const channels = await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${provider.id}`;
  const channel = one(channels, 'moonshot-global/kimi-k3.1-pro channel');
  if (channel.is_available === false || channel.currency !== 'USD' || channel.price_unit !== 'per_1m_tokens') {
    throw new Error('Unexpected Kimi channel availability/currency/unit; nothing written.');
  }
  const variants = await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${model.id} AND provider_id = ${provider.id}`;
  const repairs = KIMI_CACHE_WRITES.map(spec => {
    const row = one(variants.filter(v => v.variant_key === spec.key), `kimi-k3.1-pro/${spec.key}`);
    if (row.is_available === false || row.currency !== channel.currency || row.price_unit !== channel.price_unit ||
        row.cache_create_price_per_1m == null || Number(row.cache_create_price_per_1m) !== spec.price ||
        row.input_price_per_1m == null || row.output_price_per_1m == null ||
        Number(row.input_price_per_1m) !== Number(channel.input_price_per_1m) || Number(row.output_price_per_1m) !== Number(channel.output_price_per_1m)) {
      throw new Error(`Unexpected cache-write rate/availability for ${spec.key}; nothing written.`);
    }
    return { row, values: { is_headline: spec.headline }, target: `moonshot-global/kimi-k3.1-pro/${spec.key}` };
  });
  const projected = variants.map(row => ({ ...row, ...repairs.find(repair => repair.row.id === row.id)?.values }));
  assertCacheWriteHeadlines(projected, channels);

  const steps: HeadlineRepairStep[] = [];
  for (const { row, values, target } of repairs) {
    const changes = seedChanges(row, values);
    if (!Object.keys(changes).length) continue;
    steps.push({ table: 'api_channel_price_variants', target, action: 'update', changes });
    if (apply) {
      const payload: Record<string, unknown> = { ...values, updated_at: new Date() };
      await tx`UPDATE ${tx('api_channel_price_variants')} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${row.id}`;
    }
  }
  return steps;
}
