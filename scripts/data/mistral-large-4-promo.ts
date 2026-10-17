import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

export const MISTRAL_LARGE_4_SLUG = 'mistral-large-4';
export const MISTRAL_LARGE_4_SOURCE = 'https://docs.mistral.ai/models/mistral-large-4';

// User-verified official originalPrice fields, 2026-10-17. No published cutoff.
export const MISTRAL_LARGE_4_PROMO = {
  input_price_per_1m: 0.68,
  output_price_per_1m: 2.09,
  cached_input_price_per_1m: 0.07,
  regular_input_price_per_1m: 1.36,
  regular_output_price_per_1m: 4.18,
  regular_cached_input_price_per_1m: 0.14,
  promo_ends_at: null,
  currency: 'USD',
  price_unit: 'per_1m_tokens',
  last_verified: new Date('2026-10-17T00:00:00Z'),
  notes: `Source: ${MISTRAL_LARGE_4_SOURCE} (verified 2026-10-17, originalPrice fields). Launch promotion: 50% off; current input/output/cached input $0.68/$2.09/$0.07 per 1M tokens; regular $1.36/$4.18/$0.14. The promotion end date has not been announced; refer to the official model page for updates. No automatic expiry is scheduled.`,
} as const;

export function mistralLarge4SeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-mistral-large-4-promo.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
function exactlyOne(rows: Row[], target: string): Row {
  if (rows.length !== 1) throw new Error(`${rows.length ? 'Ambiguous' : 'Missing'} ${target}; nothing written.`);
  return rows[0];
}

/** Caller owns a serializable transaction. Preview executes SELECT only.
 * Requires the introductory-price migration; updates an existing official row.
 */
export async function seedMistralLarge4Promo(tx: Sql, apply = false) {
  const model = exactlyOne(await tx<Row[]>`SELECT id FROM models WHERE slug = ${MISTRAL_LARGE_4_SLUG}`,
    `models/${MISTRAL_LARGE_4_SLUG}`);
  const provider = exactlyOne(await tx<Row[]>`SELECT id, type FROM providers WHERE slug = ${'mistral'}`,
    'providers/mistral');
  if (!['official', 'producer'].includes(String(provider.type))) {
    throw new Error('Expected official/producer provider mistral; nothing written.');
  }
  const channel = exactlyOne(await tx<Row[]>`
    SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${provider.id}`,
  `api_channel_prices/mistral/${MISTRAL_LARGE_4_SLUG}`);
  const changes = seedChanges(channel, MISTRAL_LARGE_4_PROMO);
  if (!Object.keys(changes).length) return [];
  if (apply) {
    // upsertChannelPrice clears regular rates when promo_ends_at is null.
    // Preserve verified originalPrice data even though the cutoff is unknown.
    const payload: Record<string, unknown> = { ...MISTRAL_LARGE_4_PROMO, updated_at: new Date() };
    await tx`UPDATE api_channel_prices SET ${tx(payload, ...Object.keys(payload))}
      WHERE id = ${channel.id} AND model_id = ${model.id} AND provider_id = ${provider.id}`;
  }
  return [{ table: 'api_channel_prices', target: `mistral/${MISTRAL_LARGE_4_SLUG}`, action: 'update', changes }];
}
