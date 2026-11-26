import type { Sql } from 'postgres';
import { VOYAGE_CATALOG_1126, VOYAGE_PRICING_1126, VERIFIED_1126 } from '../../src/lib/catalog-2026-11-26-voyage';
import { verticalModelDescription } from './catalog-audit-vertical';
import { modelCapabilities } from './catalog-2026-11-04';
import { seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';

/** Optional manual seed; never part of rollout. The CLI rehearses writes then rolls back.
 * Exact identities, no deletes. Prices come only from the official pages cited on each catalog row. */
export const VERIFIED_AT = new Date(`${VERIFIED_1126}T00:00:00Z`);
export const SEED_TABLES = ['providers', 'models', 'usage_prices'] as const;
/** Production-shaped expectation, NOT a measured production dry-run.
 * Assumes all six models and their usage prices are absent, and voyage is absent.
 * If voyage already exists, provider inserts are 0 instead of 1. All updates: 0. */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 1, update: 0 },
  models: { insert: 6, update: 0 },
  usage_prices: { insert: 6, update: 0 },
} as const;

export function voyageSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run', '--db'].includes(arg)) ||
      (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-26-voyage.ts [--dry-run | --apply] [--db]');
  }
  return { apply: args.includes('--apply'), db: args.includes('--db') || args.includes('--apply') };
}

type Row = Record<string, unknown> & {
  id: number;
  is_available?: boolean | null;
  availability_locked?: boolean | null;
  notes?: string | null;
};
type Table = 'providers' | 'models' | 'usage_prices';
export interface Step { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim() !== '';
const evidence = (note: string, source: string) => `${note} Verified ${VERIFIED_1126}. Source: ${source}`;
function appendEvidence(existing: unknown, note: string) {
  const previous = String(existing ?? '');
  return previous.includes(note) ? previous : [previous, note].filter(Boolean).join('\n');
}

export async function seedVoyage1126(tx: Sql, apply = false): Promise<Step[]> {
  const items = VOYAGE_CATALOG_1126;
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) throw new Error(`Ambiguous or missing ${target}; nothing written.`);
    return rows[0] ?? null;
  };
  const providerSlugs = [...new Set(items.map(item => item.providerSlug!))];
  const providers = providerSlugs.length
    ? await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(providerSlugs)}`
    : [];
  const owners = new Map(providerSlugs.map(slug => [slug, one(providers.filter(row => row.slug === slug), `providers/${slug}`)]));
  for (const [slug, owner] of owners) if (owner && !['official', 'producer'].includes(String(owner.type))) throw new Error(`Unexpected providers/${slug} type; nothing written.`);
  const modelSlugs = items.map(item => item.slug!);
  const models = modelSlugs.length ? await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(modelSlugs)}` : [];
  const byModel = new Map(modelSlugs.map(slug => [slug, one(models.filter(row => row.slug === slug), `models/${slug}`)]));

  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const save = (table: Table, existing: Row | null, desired: Record<string, unknown>, target: string): Row => {
    const changes = seedChanges(existing, desired);
    if (!Object.keys(changes).length) return existing!;
    const id = existing?.id ?? previewId--;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    pending.push({ table, existing, values: desired, id });
    return { ...existing, ...desired, id };
  };

  if (!owners.get('voyage') && providerSlugs.includes('voyage')) {
    owners.set('voyage', save('providers', null, {
      slug: 'voyage', name: 'Voyage AI', type: 'official',
      website: 'https://docs.voyageai.com', pricing_url: VOYAGE_PRICING_1126, access_from_china: null,
      notes: evidence('Provider identity.', VOYAGE_PRICING_1126),
    }, 'voyage'));
  }

  for (const item of items) {
    const owner = owners.get(item.providerSlug!)!;
    const old = byModel.get(item.slug!) ?? null;
    const model = save('models', old, {
      slug: item.slug, name: item.name, ...(old?.type ? {} : { type: 'llm' }), model_category: item.modelCategory,
      provider_ids: [...new Set([...((old?.provider_ids as number[] | undefined) ?? []), owner.id])],
      input_type: item.inputModalities, input_modalities: item.inputModalities,
      output_type: item.outputModalities, output_modalities: item.outputModalities,
      ...modelCapabilities(old, item.capabilities), pricing_unit: item.pricingUnit,
      ...(item.contextWindow ? { context_window: item.contextWindow } : {}),
      ...(nonEmpty(old?.offical_link) ? {} : { offical_link: item.url }),
      description: nonEmpty(old?.description) ? appendEvidence(old!.description, verticalModelDescription(item)) : verticalModelDescription(item),
    }, item.slug!);
    const usage = old && owner.id > 0 ? await tx<Row[]>`SELECT * FROM usage_prices WHERE model_id = ${old.id} AND provider_id = ${owner.id}` : [];
    // The official pixel unit is static-only: never send an invented unit to Postgres.
    // Keep its exact official price and unit in the token row's constraints instead.
    const catalogOnlyRates = item.usageRates?.filter(rate => rate.unit !== 'per_1m_tokens') ?? [];
    for (const rate of item.usageRates?.filter(rate => rate.unit === 'per_1m_tokens') ?? []) {
      const existing = one(usage.filter(row => row.price_kind === rate.priceKind && row.unit === rate.unit), `usage_prices/${item.slug}/${rate.priceKind}`);
      save('usage_prices', existing, retainLockedUnavailable({
        model_id: model.id, provider_id: owner.id, plan_id: existing?.plan_id ?? null,
        price_kind: rate.priceKind, unit: rate.unit, price: rate.price, currency: item.currency,
        source_url: item.sourceUrls![0].url, last_verified: VERIFIED_AT, is_available: true,
        constraints_json: { publishedPricingText: item.pricing, note: item.notes ?? null, catalogOnlyRates },
      }, existing), `${item.slug}/${rate.priceKind}/${rate.unit}`);
    }
  }

  if (apply) {
    const ids = new Map<number, number>();
    const resolveId = (id: unknown) => typeof id === 'number' && id < 0 ? ids.get(id)! : id;
    for (const operation of pending) {
      const payload: Record<string, unknown> = { ...operation.values, updated_at: new Date() };
      for (const key of ['model_id', 'provider_id']) if (key in payload) payload[key] = resolveId(payload[key]);
      if (Array.isArray(payload.provider_ids)) payload.provider_ids = payload.provider_ids.map(resolveId);
      if (operation.existing) await tx`UPDATE ${tx(operation.table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${operation.existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(operation.table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        ids.set(operation.id, inserted.id);
      }
    }
  }
  return steps;
}

export function seedStepCounts(steps: Step[]) {
  const counts = Object.fromEntries(SEED_TABLES.map(table => [table, { insert: 0, update: 0 }])) as Record<Table, { insert: number; update: number }>;
  for (const step of steps) counts[step.table][step.action]++;
  return counts;
}
