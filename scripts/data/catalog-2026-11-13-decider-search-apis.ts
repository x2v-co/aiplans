import type { Sql } from 'postgres';
import { verticalModelDescription } from './catalog-audit-vertical';
import { seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';
import {
  CONTEXT, DECIDER_V13_MODELS, PPLX_CHANGELOG, PPLX_PRICING, PPLX_QUICKSTART, VERIFIED,
  type DeciderV13Spec,
} from '../../src/lib/decision-models-2026-11-13';
import { PERPLEXITY_DECIDER_V13_CATALOG } from '../../src/lib/decision-models-2026-11-13';

/**
 * Intel 2026-11-13 18:00 brief. Manual seed only; never part of deploy or seed-catalog.sh.
 * The CLI dry-run calls this with apply=true inside runRehearsable, which rolls back.
 * :apply is a separate npm script. No deletes.
 *
 * Adds Perplexity Decider v1.3 / Flash v1.3 official, Vercel AI Gateway, and
 * OpenRouter :free channels. Brave x402 and Octen search prices are static
 * (src/lib/tool-api-pricing.ts) and are not written by this seed. Muse Power /
 * Maximum consumer plans are not seeded (official pages unverified).
 */
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);
export const PERPLEXITY_SLUG = 'perplexity';
export const VERCEL_SLUGS = ['vercel-ai-gateway', 'vercel'] as const;
export const OPENROUTER_SLUG = 'openrouter';
export const SEED_TABLES = ['providers', 'models', 'api_channel_prices'] as const;
export type Table = (typeof SEED_TABLES)[number];

const evidence = (note: string, sources: readonly string[]) => `${note} Verified ${VERIFIED}. Source: ${sources.join(' ; ')}`;

export const officialNotes = (spec: DeciderV13Spec) => evidence(
  `${spec.apiId} (${spec.parameters}) official Decisions API: $${spec.input}/1M input, output free, no per-request fee. Alias ${spec.latestAlias} selects this model. Official context label 256K tokens (stored as 262,144). Web grounding Fast Search $0.001/search and $0.001 per successful URL fetch are extra.`,
  [PPLX_PRICING, PPLX_CHANGELOG, PPLX_QUICKSTART],
);
export const vercelNotes = (spec: DeciderV13Spec) => evidence(
  `Vercel AI Gateway perplexity/${spec.apiId}: $${spec.input}/1M input, max output tokens 0, context_window 262144.`,
  [spec.vercelPage, PPLX_PRICING],
);
export const openrouterNotes = (spec: DeciderV13Spec) => evidence(
  `OpenRouter ${spec.apiId}:free published free channel: Input Free / Output Free, context 262K, released 2026-11-12. Public /api/v1/models does not list this id; the model page is the source.`,
  [spec.openrouterFree],
);

/** Production-shaped dry-run: official/producer perplexity, vercel-ai-gateway, and openrouter exist; the two models and six channels do not. */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 0, update: 0 },
  models: { insert: 2, update: 0 },
  api_channel_prices: { insert: 6, update: 0 },
} as const;

export function catalog20261113DeciderSearchApisSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-13-decider-search-apis.ts [--dry-run | --apply]');
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

export async function seedCatalog20261113DeciderSearchApis(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) fail(`Ambiguous or missing ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };

  const providerSlugs = [PERPLEXITY_SLUG, OPENROUTER_SLUG, ...VERCEL_SLUGS];
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(providerSlugs)}`;
  const provider = (slugs: readonly string[], required = false) =>
    one(providers.filter(row => slugs.includes(String(row.slug))), `providers/${slugs.join('|')}`, required);
  const perplexity = provider([PERPLEXITY_SLUG], true)!;
  if (!['official', 'producer'].includes(String(perplexity.type))) {
    fail(`providers/${PERPLEXITY_SLUG} has type ${String(perplexity.type)}`);
  }
  const vercel = provider(VERCEL_SLUGS);
  const openrouter = provider([OPENROUTER_SLUG]);
  if (openrouter && String(openrouter.type) !== 'aggregator') {
    fail(`providers/${OPENROUTER_SLUG} has type ${String(openrouter.type)}`);
  }

  const lookup = DECIDER_V13_MODELS.flatMap(spec => [...spec.aliases]);
  const modelRows = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(lookup)}`;

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

  const catalogBySlug = Object.fromEntries(PERPLEXITY_DECIDER_V13_CATALOG.map(item => [item.slug, item]));
  const ownerExtras = [vercel, openrouter].flatMap(row => row ? [row.id] : []);

  for (const spec of DECIDER_V13_MODELS) {
    const matches = modelRows.filter(row => spec.aliases.includes(String(row.slug)));
    if (matches.length > 1) fail(`Ambiguous models for ${spec.slug} (${matches.map(row => row.slug).join(', ')})`);
    const existing = matches[0] ?? null;
    const item = catalogBySlug[spec.slug]!;
    const ownerIds = [...new Set([
      ...((existing?.provider_ids as number[] | undefined) ?? []),
      perplexity.id,
      ...ownerExtras,
    ])];
    const model = save('models', existing, {
      slug: spec.slug, name: item.name, type: 'llm', model_category: 'decision',
      provider_ids: ownerIds, context_window: CONTEXT, max_output_tokens: 0,
      open_source: true, license: item.license, parameters: spec.parameters,
      released_at: new Date('2026-11-12T00:00:00Z'),
      input_type: item.inputModalities, output_type: item.outputModalities,
      input_modalities: item.inputModalities, output_modalities: item.outputModalities,
      capabilities: item.capabilities, pricing_unit: 'per_1m_tokens',
      offical_link: item.url, description: verticalModelDescription(item),
    }, spec.slug);

    const channelOf = async (providerId: number) => {
      if (model.id < 0 || providerId < 0) return [];
      return tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${providerId}`;
    };

    const official = one(await channelOf(perplexity.id), `api_channel_prices/perplexity/${spec.slug}`);
    save('api_channel_prices', official, retainLockedUnavailable({
      model_id: model.id, provider_id: perplexity.id,
      input_price_per_1m: spec.input, output_price_per_1m: 0,
      cached_input_price_per_1m: null, currency: 'USD', price_unit: 'per_1m_tokens',
      is_available: true, last_verified: VERIFIED_AT, notes: officialNotes(spec),
    }, official), `perplexity/${spec.slug}`);

    if (!vercel) {
      skip('api_channel_prices', `vercel-ai-gateway/${spec.slug}`, 'providers/vercel-ai-gateway and providers/vercel are missing; official channel only');
    } else {
      const gateway = one(await channelOf(vercel.id), `api_channel_prices/${String(vercel.slug)}/${spec.slug}`);
      save('api_channel_prices', gateway, retainLockedUnavailable({
        model_id: model.id, provider_id: vercel.id,
        input_price_per_1m: spec.input, output_price_per_1m: 0,
        cached_input_price_per_1m: null, currency: 'USD', price_unit: 'per_1m_tokens',
        is_available: true, last_verified: VERIFIED_AT, notes: vercelNotes(spec),
      }, gateway), `${String(vercel.slug)}/${spec.slug}`);
    }

    if (!openrouter) {
      skip('api_channel_prices', `openrouter/${spec.slug}`, 'providers/openrouter is missing; official channel only');
    } else {
      const free = one(await channelOf(openrouter.id), `api_channel_prices/openrouter/${spec.slug}`);
      save('api_channel_prices', free, retainLockedUnavailable({
        model_id: model.id, provider_id: openrouter.id,
        input_price_per_1m: 0, output_price_per_1m: 0,
        cached_input_price_per_1m: null, currency: 'USD', price_unit: 'per_1m_tokens',
        is_available: true, last_verified: VERIFIED_AT, notes: openrouterNotes(spec),
      }, free), `openrouter/${spec.slug}`);
    }
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
