import type { Sql } from 'postgres';
import { verticalModelDescription } from './catalog-audit-vertical';
import { seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';
import {
  GEMINI_DECISION_1, GEMINI_DECISION_ALIASES, GEMINI_DECISION_SPEC,
} from '../../src/lib/decision-models-2026-11-12';

/**
 * Intel 2026-11-12 audit. Manual seed only; never part of deploy or seed-catalog.sh.
 * The CLI dry-run calls this with apply=true inside runRehearsable, which rolls back.
 * :apply is a separate npm script. No deletes.
 *
 * This seed adds Gemini Decision 1 (P1-7): official Google channel and, when the
 * provider row exists, Vercel AI Gateway at the same published input-only rate.
 *
 * P0-2, P0-3, P1-1, P1-5 and P1-R are already in seed:catalog-2026-11-11-audit-fixes
 * (#350, merged, not applied). P1-8 and P1-9 are already in
 * seed:catalog-2026-11-11-token-plan-h3-image (#351, merged, not applied). P1-6
 * (xAI video resolution prices) is not seeded.
 */
export const VERIFIED = '2026-11-12';
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);
export const GOOGLE_SLUG = 'google';
export const VERCEL_SLUGS = ['vercel-ai-gateway', 'vercel'] as const;
export const SEED_TABLES = ['providers', 'models', 'api_channel_prices'] as const;
type Table = typeof SEED_TABLES[number];

const evidence = (note: string, sources: readonly string[]) => `${note} Verified ${VERIFIED}. Source: ${sources.join(' ; ')}`;

export const OFFICIAL_NOTES = evidence(
  GEMINI_DECISION_NOTES_SHORT(),
  [GEMINI_DECISION_SPEC.officialPage, GEMINI_DECISION_SPEC.pricingPage, GEMINI_DECISION_SPEC.deprecationsPage],
);

export const VERCEL_NOTES = evidence(
  `Vercel AI Gateway ${GEMINI_DECISION_SPEC.vercelId}. GET /v1/models lists context_window 262144, max_tokens 0, type evaluation, pricing.input 0.0000001 ($0.10 / 1M tokens), pricing.output "0". Gateway modalities: text, image, pdf.`,
  [GEMINI_DECISION_SPEC.vercelModels, GEMINI_DECISION_SPEC.pricingPage],
);

function GEMINI_DECISION_NOTES_SHORT() {
  return [
    'Gemini Decision 1 (gemini-decision-1) on the Decisions API.',
    'Paid standard tier $0.10 / 1M input tokens; same price for text, image, video, audio, and PDF.',
    'Output not applicable (0 output tokens). Context caching not available. Batch API is not supported.',
    'Free tier is available. Input token limit 262,144. No shutdown date announced.',
  ].join(' ');
}

/** Production-shaped dry-run: google and vercel-ai-gateway exist; the model and both channels do not. */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 0, update: 0 },
  models: { insert: 1, update: 0 },
  api_channel_prices: { insert: 2, update: 0 },
} as const;

export function catalog20261112AuditFixesSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-12-audit-fixes.ts [--dry-run | --apply]');
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

export async function seedCatalog20261112AuditFixes(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string): Row | null => {
    if (rows.length > 1) fail(`Ambiguous ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };

  const providerSlugs = [GOOGLE_SLUG, ...VERCEL_SLUGS];
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(providerSlugs)}`;
  const google = one(providers.filter(row => row.slug === GOOGLE_SLUG), `providers/${GOOGLE_SLUG}`);
  if (!google) fail('providers/google is missing');
  if (!['official', 'producer'].includes(String(google.type))) fail(`providers/google has type ${String(google.type)}`);
  const vercelPreferred = one(providers.filter(row => row.slug === 'vercel-ai-gateway'), 'providers/vercel-ai-gateway');
  const vercelFallback = one(providers.filter(row => row.slug === 'vercel'), 'providers/vercel');
  const vercel = vercelPreferred ?? vercelFallback;
  if (vercel && String(vercel.type) !== 'aggregator') fail(`providers/${String(vercel.slug)} has type ${String(vercel.type)}`);

  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(GEMINI_DECISION_ALIASES)}`;
  const canonical = one(models.filter(row => row.slug === GEMINI_DECISION_SPEC.slug), `models/${GEMINI_DECISION_SPEC.slug}`);
  const aliased = one(models.filter(row => row.slug !== GEMINI_DECISION_SPEC.slug), 'models/google-gemini-decision-1');
  if (canonical && aliased) fail('Both gemini-decision-1 and google-gemini-decision-1 exist; review before seeding');
  const existing = canonical ?? aliased ?? null;

  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const save = (table: Table, row: Row | null, desired: Record<string, unknown>, target: string): Row => {
    if ((table === 'api_channel_prices') && row?.last_verified
      && new Date(String(row.last_verified)).getTime() > VERIFIED_AT.getTime()) {
      return row;
    }
    const changes = seedChanges(row, desired);
    if (!Object.keys(changes).length) return row ?? { ...desired, id: row?.id ?? previewId } as Row;
    const id = row?.id ?? previewId--;
    steps.push({ table, target, action: row ? 'update' : 'insert', changes });
    pending.push({ table, existing: row, values: desired, id });
    return { ...row, ...desired, id };
  };
  const skip = (table: Table, target: string, reason: string) => {
    steps.push({ table, target, action: 'skip', changes: {}, reason });
  };

  const item = GEMINI_DECISION_1;
  const ownerIds = [google.id, ...(vercel ? [vercel.id] : [])];
  const model = save('models', existing, {
    slug: item.slug, name: item.name, type: 'llm', model_category: 'decision',
    provider_ids: [...new Set([...((existing?.provider_ids as number[] | undefined) ?? []), ...ownerIds])],
    context_window: GEMINI_DECISION_SPEC.context, max_output_tokens: 0,
    open_source: GEMINI_DECISION_SPEC.openWeights,
    released_at: new Date(`${GEMINI_DECISION_SPEC.releasedAt}T00:00:00Z`),
    input_type: item.inputModalities, output_type: item.outputModalities,
    input_modalities: item.inputModalities, output_modalities: item.outputModalities,
    capabilities: item.capabilities, pricing_unit: 'per_1m_tokens',
    offical_link: item.url,
    description: verticalModelDescription(item),
  }, GEMINI_DECISION_SPEC.slug);

  const channelOf = async (providerId: number) => {
    if (model.id < 0 || providerId < 0) return [];
    return tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${providerId}`;
  };

  const official = one(await channelOf(google.id), `api_channel_prices/google/${GEMINI_DECISION_SPEC.slug}`);
  save('api_channel_prices', official, retainLockedUnavailable({
    model_id: model.id, provider_id: google.id,
    input_price_per_1m: GEMINI_DECISION_SPEC.input, output_price_per_1m: 0,
    cached_input_price_per_1m: null, currency: 'USD', price_unit: 'per_1m_tokens',
    is_available: true, last_verified: VERIFIED_AT, notes: OFFICIAL_NOTES,
  }, official), `google/${GEMINI_DECISION_SPEC.slug}`);

  if (!vercel) {
    skip('api_channel_prices', `vercel-ai-gateway/${GEMINI_DECISION_SPEC.slug}`, 'providers/vercel-ai-gateway and providers/vercel are missing; official channel only');
  } else {
    const gateway = one(await channelOf(vercel.id), `api_channel_prices/${String(vercel.slug)}/${GEMINI_DECISION_SPEC.slug}`);
    save('api_channel_prices', gateway, retainLockedUnavailable({
      model_id: model.id, provider_id: vercel.id,
      input_price_per_1m: GEMINI_DECISION_SPEC.input, output_price_per_1m: 0,
      cached_input_price_per_1m: null, currency: 'USD', price_unit: 'per_1m_tokens',
      is_available: true, last_verified: VERIFIED_AT, notes: VERCEL_NOTES,
    }, gateway), `${String(vercel.slug)}/${GEMINI_DECISION_SPEC.slug}`);
  }

  if (apply) {
    const ids = new Map<number, number>();
    const resolveId = (id: unknown) => typeof id === 'number' && id < 0 ? ids.get(id)! : id;
    for (const op of pending) {
      const payload = { ...op.values };
      if ('model_id' in payload) payload.model_id = resolveId(payload.model_id);
      if ('provider_id' in payload) payload.provider_id = resolveId(payload.provider_id);
      if ('provider_ids' in payload && Array.isArray(payload.provider_ids)) {
        payload.provider_ids = payload.provider_ids.map(resolveId);
      }
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
