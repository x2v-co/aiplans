import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

// Only the Nemotron 3.5 Lightning section of /workspace/aiplans-gaps-facts.md.
export const NEMOTRON_SOURCE = 'https://vercel.com/changelog/nemotron-3-5-lightning-now-available-on-ai-gateway-for-free';
export const NEMOTRON_SLUG = 'nemotron-3.5-lightning';
export const NEMOTRON_ENDPOINT = 'nvidia/nemotron-3.5-lightning-free';
export const NEMOTRON_DATA_NOTE = 'Provider may retain prompts for model improvement on this free Vercel AI Gateway channel.';
const VERIFIED_AT = new Date('2026-10-15T00:00:00Z');
// Reuse either existing Vercel identity; do not create a second provider.
const VERCEL_SLUGS = ['vercel', 'vercel-ai-gateway'];
const MODEL_SLUGS = [NEMOTRON_SLUG, 'nvidia-nemotron-3-5-lightning', 'nvidia-nemotron-3-5-lightning-free',
  'nemotron-3.5-lightning-free', 'nvidia/nemotron-3.5-lightning', NEMOTRON_ENDPOINT];

export function nemotronSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-nemotron-lightning-2026-10-15.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'models' | 'api_channel_prices';
export interface NemotronSeedStep { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

/** Caller owns a serializable transaction. Default preview issues SELECT only. */
export async function seedNemotronLightning(tx: Sql, apply = false): Promise<NemotronSeedStep[]> {
  const one = (rows: Row[], target: string) => {
    if (rows.length > 1) throw new Error(`Ambiguous ${target}; transaction aborted. Review duplicates before retrying.`);
    return rows[0] ?? null;
  };
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(['nvidia', ...VERCEL_SLUGS])}`;
  const existingProducer = one(providers.filter(row => row.slug === 'nvidia'), 'providers/nvidia');
  const existingGateway = one(providers.filter(row => VERCEL_SLUGS.includes(String(row.slug))), 'providers/vercel');
  const existingModel = one(await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(MODEL_SLUGS)}`, `models/${NEMOTRON_SLUG}`);
  const existingChannel = one(existingModel && existingGateway
    ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${existingModel.id} AND provider_id = ${existingGateway.id}`
    : [], `api_channel_prices/${NEMOTRON_SLUG}/vercel`);

  const steps: NemotronSeedStep[] = [];
  let previewId = -1;
  const save = async (table: Table, existing: Row | null, values: Record<string, unknown>, target: string) => {
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) return existing!;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    const payload = { ...values, updated_at: new Date() };
    let id = existing?.id ?? previewId--;
    if (apply) {
      if (existing) await tx`UPDATE ${tx(table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        id = inserted.id;
      }
    }
    return { ...existing, ...payload, id };
  };

  const producer = existingProducer ?? await save('providers', null, {
    name: 'NVIDIA', slug: 'nvidia', type: 'producer', region: null, access_from_china: null,
    notes: `Model producer. Source: ${NEMOTRON_SOURCE}`,
  }, 'nvidia');
  const gateway = existingGateway ?? await save('providers', null, {
    name: 'Vercel AI Gateway', slug: 'vercel-ai-gateway', type: 'aggregator',
    website: 'https://vercel.com', pricing_url: NEMOTRON_SOURCE, currency: 'USD',
    region: null, access_from_china: null, notes: `Source: ${NEMOTRON_SOURCE}`,
  }, 'vercel-ai-gateway');
  const model = await save('models', existingModel, {
    name: 'Nemotron 3.5 Lightning', slug: NEMOTRON_SLUG, type: 'llm', model_category: 'text',
    provider_ids: [producer.id], open_source: true, context_window: 1_000_000,
    parameters: '30B', 'active parameters': '3B', offical_link: NEMOTRON_SOURCE,
    description: `NVIDIA open-weights hybrid Mamba-2 MoE: 30B total parameters, 3B active, 1M context. Source: ${NEMOTRON_SOURCE}`,
  }, NEMOTRON_SLUG);
  await save('api_channel_prices', existingChannel, {
    model_id: model.id, provider_id: gateway.id,
    // Free is verified for this channel only (audit-price-policy), not an unknown price.
    input_price_per_1m: 0, output_price_per_1m: 0, cached_input_price_per_1m: null,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
    data_for_discount: true, data_for_discount_note: NEMOTRON_DATA_NOTE,
    promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null,
    regular_cached_input_price_per_1m: null, last_verified: VERIFIED_AT,
    notes: `[free] Verified free Vercel AI Gateway channel: ${NEMOTRON_ENDPOINT}. ${NEMOTRON_DATA_NOTE}\nSource: ${NEMOTRON_SOURCE}`,
  }, `${NEMOTRON_SLUG}/${gateway.slug}`);
  return steps;
}
