import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

export const CARBON_SLUG = 'gemini-4-carbon';
export const CARBON_SOURCE = 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-carbon/';
export const CARBON_ACCESS_NOTE = 'Announced; developer API not yet available. Access is limited to cyber defenders and trusted partners through the Fairwind Program.';

export function carbonModelRow(googleId: number) {
  return {
    name: 'Gemini 4 Carbon', slug: CARBON_SLUG, type: 'llm', model_category: 'text',
    provider_ids: [googleId], offical_link: CARBON_SOURCE,
    description: `Status: announced.\n${CARBON_ACCESS_NOTE}\nSource: ${CARBON_SOURCE} (page dated 2026-10-28; verified 2026-10-29).`,
    context_window: null, max_output_tokens: null, released_at: null,
    parameters: null, 'active parameters': null, open_source: null,
    input_type: null, output_type: null, input_modalities: null, output_modalities: null,
    capabilities: null, features: null, license: null, license_url: null,
  };
}

export function carbonChannelRow(googleId: number, modelId: number | null) {
  return {
    model_id: modelId, provider_id: googleId,
    input_price_per_1m: 2, output_price_per_1m: 10, cached_input_price_per_1m: 0.1,
    currency: 'USD', price_unit: 'per_1m_tokens',
    is_available: false, availability_locked: true,
    // No published cutoff: do not borrow Argon's promotion schedule.
    promo_ends_at: null, regular_input_price_per_1m: null,
    regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
    last_verified: new Date('2026-10-29T00:00:00Z'),
    notes: `${CARBON_ACCESS_NOTE} Announced introductory list prices, reference only: $2 input / $10 output / $0.10 cached input per 1M tokens (cached input 95% off). The announcement lists $4/$20 after the introductory period, with no cutoff date. Source: ${CARBON_SOURCE}`,
  };
}

export function carbonSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-gemini-4-carbon.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
export interface CarbonSeedStep {
  table: 'models' | 'api_channel_prices';
  action: 'insert' | 'update';
  target: string;
  changes: ReturnType<typeof seedChanges>;
}

/** Caller owns the transaction. Default preview issues SELECT only; no deletes,
 * subscription entitlements, price history, or writes to other models/providers.
 */
export async function seedCarbon(tx: Sql, apply = false, now = new Date()): Promise<CarbonSeedStep[]> {
  const one = (rows: Row[], target: string): Row | null => {
    if (rows.length > 1) throw new Error(`Ambiguous ${target}; nothing written.`);
    return rows[0] ?? null;
  };
  const google = one(await tx<Row[]>`SELECT id, type FROM providers WHERE slug = 'google'`, 'providers/google');
  if (!google || !['official', 'producer'].includes(String(google.type))) throw new Error('Expected official/producer google; nothing written.');
  const model = one(await tx<Row[]>`SELECT * FROM models WHERE lower(slug) = ${CARBON_SLUG}`, CARBON_SLUG);
  const channels = model ? await tx<Row[]>`
    SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${google.id}` : [];
  const channel = one(channels, `google/${CARBON_SLUG}`);
  const pending: Array<{ step: CarbonSeedStep; id: number | null; values: Record<string, unknown> }> = [];
  const plan = (table: CarbonSeedStep['table'], target: string, existing: Row | null, values: Record<string, unknown>) => {
    const changes = seedChanges(existing, values);
    if (Object.keys(changes).length) pending.push({ step: { table, target, action: existing ? 'update' : 'insert', changes }, id: existing?.id ?? null, values });
  };
  plan('models', CARBON_SLUG, model, carbonModelRow(google.id));
  plan('api_channel_prices', `google/${CARBON_SLUG}`, channel, carbonChannelRow(google.id, model?.id ?? null));

  if (apply) {
    let modelId = model?.id ?? null;
    for (const { step, id, values } of pending) {
      const payload: Record<string, unknown> = { ...values, updated_at: now };
      if (step.table === 'api_channel_prices') {
        if (modelId == null) throw new Error('Model insert did not return an ID.');
        payload.model_id = modelId;
      }
      if (step.action === 'update') {
        await tx`UPDATE ${tx(step.table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${id}`;
      } else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(step.table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        if (step.table === 'models') modelId = inserted.id;
      }
    }
  }
  return pending.map(({ step }) => step);
}
