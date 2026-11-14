import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';

/**
 * Intel 2026-11-14 evening aiplans gap. Manual seed only; never part of deploy
 * or seed-catalog.sh. CLI dry-run uses apply=true inside runRehearsable (writes
 * then ROLLBACK). :apply is a separate npm script. No deletes.
 *
 * Writes: DeepInfra provider identity and its first-party Inkling 2 Small
 * channel at the published 5%-off price, keeping the list price in regular_*.
 *
 * Not written: Gemini TTS preview shutdowns (no catalog rows; note on the 3.8
 * TTS static items), OpenAI platform deprecations (code-only provider block),
 * Inkling slug redirects (src/lib/legacy-slug-redirects.ts). The OpenRouter
 * DeepInfra upstream variant keeps OpenRouter's own $0.30/$1.00 (discount 0).
 */
export const VERIFIED = '2026-11-14';
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);
export const DEEPINFRA_SLUG = 'deepinfra';
export const INKLING_SLUG = 'thinkingmachines-inkling-2-small';
export const DEEPINFRA_MODEL_ID = 'thinkingmachines/Inkling-2-Small';
export const DEEPINFRA_PAGE = 'https://deepinfra.com/thinkingmachines/Inkling-2-Small';
export const DEEPINFRA_API = 'https://api.deepinfra.com/models/thinkingmachines/Inkling-2-Small';
export const DEEPINFRA_DISCOUNT = 0.05;
/** api pricing: cents_per_input_token 3e-05, cents_per_output_token 0.0001, rate_per_input_token_cached 0.1. */
export const INKLING_REGULAR = { input: 0.3, output: 1, cached: 0.03 } as const;
const off = (n: number) => Math.round(n * (1 - DEEPINFRA_DISCOUNT) * 1e6) / 1e6;
export const INKLING_CURRENT = {
  input: off(INKLING_REGULAR.input), output: off(INKLING_REGULAR.output), cached: off(INKLING_REGULAR.cached),
} as const;

export const INKLING_DEEPINFRA_NOTES = `DeepInfra ${DEEPINFRA_MODEL_ID} (serverless). The model page shows "5% off": current $0.285 in / $0.95 out / $0.028 cached per 1M tokens, list $0.30 / $1.00 / $0.03. The API payload (${DEEPINFRA_API}) has discount 0.05, discount_ends_at null, cents_per_input_token 3e-05, cents_per_output_token 0.0001 and rate_per_input_token_cached 0.1, so cached is $0.03 list and $0.0285 after the discount; the page rounds it to $0.028. Current prices are stored with the discount; regular_* keep the list price. promo_ends_at is NULL because no end date is published; nothing expires automatically. API max_tokens 1048576 is DeepInfra's route limit, not the model row's context_window. Currency USD. Source: ${DEEPINFRA_PAGE} (verified ${VERIFIED}).`;

export const SEED_TABLES = ['providers', 'api_channel_prices'] as const;
export type Table = (typeof SEED_TABLES)[number];

/** Production-shaped dry-run: thinkingmachines-inkling-2-small exists; no deepinfra provider and no DeepInfra channel yet (checked /api/providers and the model page 2026-11-14). */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 1, update: 0 },
  api_channel_prices: { insert: 1, update: 0 },
} as const;

export function catalog20261114EveningSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-14-evening.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
export interface Step {
  table: Table;
  target: string;
  action: 'insert' | 'update' | 'skip';
  changes: ReturnType<typeof seedChanges>;
  reason?: string;
}

export function seedStepCounts(steps: Step[]) {
  return Object.fromEntries(SEED_TABLES.map(table => {
    const own = steps.filter(step => step.table === table);
    return [table, {
      insert: own.filter(step => step.action === 'insert').length,
      update: own.filter(step => step.action === 'update').length,
    }];
  })) as Record<Table, { insert: number; update: number }>;
}

export async function seedCatalog20261114Evening(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string): Row | null => {
    if (rows.length > 1) fail(`Ambiguous ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };
  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const save = (table: Table, row: Row | null, desired: Record<string, unknown>, target: string): Row => {
    if (table === 'api_channel_prices' && row?.last_verified
      && new Date(String(row.last_verified)).getTime() > VERIFIED_AT.getTime()) return row;
    const changes = seedChanges(row, desired);
    if (!Object.keys(changes).length) return row!;
    const id = row?.id ?? previewId--;
    steps.push({ table, target, action: row ? 'update' : 'insert', changes });
    pending.push({ table, existing: row, values: desired, id });
    return { ...row, ...desired, id };
  };

  const models = await tx<Row[]>`SELECT * FROM models WHERE slug = ${INKLING_SLUG}`;
  const model = one(models, `models/${INKLING_SLUG}`);
  if (!model) {
    steps.push({ table: 'api_channel_prices', target: `${DEEPINFRA_SLUG}/${INKLING_SLUG}`, action: 'skip', changes: {},
      reason: `models/${INKLING_SLUG} is missing; this seed does not create it` });
    return steps;
  }

  const providerRows = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx([DEEPINFRA_SLUG, 'deep-infra'])}`;
  const existingProvider = one(providerRows, `providers/${DEEPINFRA_SLUG}`);
  if (existingProvider && !['aggregator', 'cloud', 'reseller'].includes(String(existingProvider.type))) {
    fail(`providers/${existingProvider.slug} has type ${String(existingProvider.type)}`);
  }
  const provider = existingProvider ?? save('providers', null, {
    name: 'DeepInfra', slug: DEEPINFRA_SLUG, type: 'aggregator',
    website: 'https://deepinfra.com', pricing_url: 'https://deepinfra.com/pricing',
    api_docs_url: 'https://deepinfra.com/docs', currency: 'USD', region: 'global', access_from_china: null,
    notes: `Provider identity (serverless inference host). Verified ${VERIFIED}. Source: ${DEEPINFRA_PAGE}. Supported regions and payment methods not researched.`,
  }, DEEPINFRA_SLUG);

  const channels = provider.id > 0
    ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${provider.id}`
    : [];
  const channel = one(channels, `api_channel_prices/${DEEPINFRA_SLUG}/${INKLING_SLUG}`);
  save('api_channel_prices', channel, retainLockedUnavailable({
    model_id: model.id, provider_id: provider.id,
    input_price_per_1m: INKLING_CURRENT.input, output_price_per_1m: INKLING_CURRENT.output,
    cached_input_price_per_1m: INKLING_CURRENT.cached,
    promo_ends_at: null,
    regular_input_price_per_1m: INKLING_REGULAR.input, regular_output_price_per_1m: INKLING_REGULAR.output,
    regular_cached_input_price_per_1m: INKLING_REGULAR.cached,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT,
    notes: INKLING_DEEPINFRA_NOTES,
  }, channel), `${DEEPINFRA_SLUG}/${INKLING_SLUG}`);

  if (apply) {
    const ids = new Map<number, number>();
    const resolveId = (id: unknown) => typeof id === 'number' && id < 0 ? ids.get(id)! : id;
    for (const op of pending) {
      const payload: Record<string, unknown> = { ...op.values, updated_at: new Date() };
      if ('provider_id' in payload) payload.provider_id = resolveId(payload.provider_id);
      if (op.existing) {
        await tx`UPDATE ${tx(op.table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${op.existing.id}`;
      } else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(op.table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        ids.set(op.id, inserted.id);
      }
    }
  }
  return steps;
}
