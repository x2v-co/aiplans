import type { Sql } from 'postgres';
import { ARGON_PROMO_ENDS_AT, seedChanges } from './gemini-4-argon';

export const CARBON_SLUG = 'gemini-4-carbon';
/** Same instant as Gemini 4 Argon: Pacific midnight at the start of 2026-12-01 (PST, UTC-8). */
export const CARBON_PROMO_ENDS_AT = ARGON_PROMO_ENDS_AT;
export const CARBON_SOURCE = 'https://ai.google.dev/gemini-api/docs/pricing#gemini-4-carbon';
export const CARBON_BLOG = 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-carbon-now-available/';
export const CARBON_ANNOUNCEMENT = 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-carbon/';
export const CARBON_VERTEX = 'https://cloud.google.com/model-garden/pricing';
export const CARBON_VERCEL = 'https://vercel.com/changelog/gemini-4-carbon-now-available-on-ai-gateway';
export const CARBON_INTRO = { input: 2, output: 10, cache: 0.1 } as const;
export const CARBON_STANDARD = { input: 4, output: 20, cache: 0.2 } as const;
const CARBON_VERIFIED = new Date('2026-11-11T00:00:00Z');

export function carbonModelRow(googleId: number) {
  return {
    name: 'Gemini 4 Carbon', slug: CARBON_SLUG, type: 'llm', model_category: 'text',
    provider_ids: [googleId], offical_link: CARBON_SOURCE,
    description: [
      'Status: available.',
      'Paid Gemini API model id gemini-4-carbon is generally available to paying developers and enterprises in Google AI Studio and Gemini for business. Introductory Standard prices are live offers through 2026-11-30, not reference-only. Fairwind remains the cyber-access program and is not the only access path.',
      'Not available on the free tier. Implicit caching only; explicit caching is not supported. Thinking tokens are billed as output.',
      `Standard per 1M tokens: through 2026-11-30, input $2 / output $10 / cache $0.10; from 2026-12-01, input $4 / output $20 / cache $0.20. Google publishes no timezone. promo_ends_at follows the Gemini 4 Argon convention, Pacific midnight ${CARBON_PROMO_ENDS_AT}.`,
      'Context length is not stored. The Vercel changelog says "1M-token context window" and does not print an integer. OpenRouter context_length is 1048576. Model Garden says completions can be up to 1 million tokens. 1000000 and 1048576 are not written.',
      'Input types on the Model Garden price row are text, image, video and audio. Text output includes response and reasoning.',
      `Verified 2026-11-11. Catalog 2026-11-11. Source: ${CARBON_SOURCE} ; ${CARBON_BLOG} ; ${CARBON_VERTEX} ; ${CARBON_VERCEL} ; ${CARBON_ANNOUNCEMENT}`,
    ].join('\n'),
    context_window: null, max_output_tokens: null, released_at: new Date('2026-11-10T00:00:00Z'),
    parameters: null, 'active parameters': null, open_source: null,
    input_type: ['text', 'image', 'audio', 'video'], output_type: ['text'],
    input_modalities: ['text', 'image', 'audio', 'video'], output_modalities: ['text'],
    capabilities: ['reasoning'], features: null, license: null, license_url: null,
  };
}

export function carbonChannelRow(googleId: number, modelId: number | null) {
  return {
    model_id: modelId, provider_id: googleId,
    input_price_per_1m: CARBON_INTRO.input, output_price_per_1m: CARBON_INTRO.output,
    cached_input_price_per_1m: CARBON_INTRO.cache,
    currency: 'USD', price_unit: 'per_1m_tokens',
    is_available: true, availability_locked: false,
    promo_ends_at: CARBON_PROMO_ENDS_AT,
    regular_input_price_per_1m: CARBON_STANDARD.input,
    regular_output_price_per_1m: CARBON_STANDARD.output,
    regular_cached_input_price_per_1m: CARBON_STANDARD.cache,
    last_verified: CARBON_VERIFIED,
    notes: [
      'Paid Gemini API Standard tier for gemini-4-carbon. Not on the free tier. Implicit caching only; explicit caching is not supported. Thinking tokens are billed as output. Every token is billed, including internal tool system instructions and function declarations when using grounding.',
      `Introductory Standard prices are a live offer, not reference-only: input $2 / output $10 / cached input $0.10 per 1M tokens through 2026-11-30; regular $4 / $20 / $0.20 from 2026-12-01. Cached input stays 5% of input. Google publishes no timezone; promo_ends_at uses the Gemini 4 Argon convention, Pacific midnight, ${CARBON_PROMO_ENDS_AT}.`,
      'Batch and Flex $1 / $5 / cache $0.05, then $2 / $10 / cache $0.10. Priority $3.60 / $18 / cache $0.18, then $7.20 / $36 / cache $0.36. Those tiers are recorded in this note: Google does not currently use api_channel_price_variants for them.',
      'Grounding with Google Search: 5,000 free requests/month shared across Gemini 3 and newer, then $14 / 1,000 requests, daily cap 1,500/day. No other tool price is stored.',
      'Fairwind remains the cyber-access program and is not the only API path. The 2026-10-29 availability lock (API not yet available) is cleared.',
      `Verified 2026-11-11. Source: ${CARBON_SOURCE} ; ${CARBON_BLOG}`,
    ].join(' '),
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
