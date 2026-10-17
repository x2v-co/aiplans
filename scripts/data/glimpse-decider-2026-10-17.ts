import type { Sql } from 'postgres';
import { DECIDER_SOURCE, PERPLEXITY_DECIDER_CATALOG } from '../../src/lib/perplexity-decider-catalog';
import { verticalModelDescription } from './catalog-audit-vertical';
import { seedChanges } from './gemini-4-argon';
import { keepUnavailableForSeed } from '../utils/manual-unavailable';

export const GLIMPSE_SLUG = 'elorian-glimpse';
export const GLIMPSE_SOURCE = 'https://elorian.ai/blog/introducing-glimpse';
const VERIFIED_AT = new Date('2026-10-17T00:00:00Z');
const VERCEL_SLUGS = ['vercel', 'vercel-ai-gateway'];
type Row = Record<string, unknown> & { id: number; is_available?: boolean | null; notes?: string | null };
type Table = 'providers' | 'models' | 'api_channel_prices';
export interface GlimpseDeciderSeedStep {
  table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges>;
}

export function glimpseDeciderSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-glimpse-decider-2026-10-17.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

/** Caller owns a serializable transaction. Preview issues SELECT only, including for absent providers. */
export async function seedGlimpseDecider(tx: Sql, apply = false): Promise<GlimpseDeciderSeedStep[]> {
  const one = (rows: Row[], target: string) => {
    if (rows.length > 1) throw new Error(`Ambiguous ${target}; transaction aborted. Review duplicates before retrying.`);
    return rows[0] ?? null;
  };
  const providerRows = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(['elorian', 'perplexity', 'openrouter', ...VERCEL_SLUGS])}`;
  const models = [
    { slug: GLIMPSE_SLUG, aliases: [GLIMPSE_SLUG, 'glimpse', 'elorian/glimpse'] },
    ...PERPLEXITY_DECIDER_CATALOG.map(item => ({ slug: item.slug!, aliases: [item.slug!,
      item.slug!.replace('perplexity-', ''), item.slug!.replace('perplexity-', 'perplexity/').replace('v1-2', 'v1.2'),
      item.slug!.replace('v1-2', 'v1.2'), item.slug!.replace('perplexity-', '').replace('v1-2', 'v1.2')] })),
  ];
  const modelRows = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(models.flatMap(model => model.aliases))}`;
  // Resolve ambiguity before planning or writing anything.
  const existingModels = new Map(models.map(model => [model.slug, one(modelRows.filter(row => model.aliases.includes(String(row.slug))), `models/${model.slug}`)]));
  const provider = (slugs: string[]) => one(providerRows.filter(row => slugs.includes(String(row.slug))), `providers/${slugs.join('|')}`);
  const existingProviders = [provider(['elorian']), provider(['perplexity']), provider(['openrouter']), provider(VERCEL_SLUGS)];
  const steps: GlimpseDeciderSeedStep[] = [];
  let previewId = -1;
  const save = async (table: Table, existing: Row | null, values: Record<string, unknown>, target: string): Promise<Row> => {
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) return existing!;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    const payload: Record<string, unknown> = { ...values, updated_at: new Date() };
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
  const identities = [
    { slug: 'elorian', name: 'Elorian', type: 'producer', source: GLIMPSE_SOURCE },
    { slug: 'perplexity', name: 'Perplexity', type: 'producer', source: DECIDER_SOURCE },
    { slug: 'openrouter', name: 'OpenRouter', type: 'aggregator', source: 'https://openrouter.ai/elorian/glimpse' },
    { slug: 'vercel-ai-gateway', name: 'Vercel AI Gateway', type: 'aggregator', source: DECIDER_SOURCE },
  ];
  const owners: Row[] = [];
  for (const [index, identity] of identities.entries()) {
    owners.push(existingProviders[index] ?? await save('providers', null, {
      slug: identity.slug, name: identity.name, type: identity.type, region: null, access_from_china: null,
      notes: `Identity verified 2026-10-17. Source: ${identity.source}; other provider metadata unverified.`,
    }, identity.slug));
  }
  const [elorian, perplexity, openrouter, vercel] = owners;
  const channel = async (model: Row, gateway: Row, input: number, output: number, cache: number | null, notes: string) => {
    const existing = one(model.id > 0 && gateway.id > 0
      ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${gateway.id}` : [],
    `api_channel_prices/${model.slug}/${gateway.slug}`);
    const desired = keepUnavailableForSeed({
      model_id: model.id, provider_id: gateway.id, input_price_per_1m: input, output_price_per_1m: output,
      cached_input_price_per_1m: cache, currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
      last_verified: VERIFIED_AT, notes,
    }, existing);
    await save('api_channel_prices', existing, desired, `${model.slug}/${gateway.slug}`);
  };
  const glimpse = await save('models', existingModels.get(GLIMPSE_SLUG)!, {
    slug: GLIMPSE_SLUG, name: 'Elorian Glimpse', type: 'llm', model_category: 'text',
    provider_ids: [elorian.id], context_window: 262_144,
    input_type: ['image', 'video'], output_type: ['text'], input_modalities: ['image', 'video'], output_modalities: ['text'],
    pricing_unit: 'per_1m_tokens', offical_link: GLIMPSE_SOURCE,
    description: `Image and video to text. Context is channel-specific: OpenRouter 262144 tokens; Vercel AI Gateway 220000 tokens. Verified 2026-10-17. Source: ${GLIMPSE_SOURCE}`,
  }, GLIMPSE_SLUG);
  await channel(glimpse, openrouter, 0.6, 3, 0.06,
    'elorian/glimpse. $0.60/$3 per 1M input/output; cache read $0.06/M. Context: 262144 tokens. Verified 2026-10-17. Source: https://openrouter.ai/elorian/glimpse');
  await channel(glimpse, vercel, 0.6, 3, 0.06,
    'elorian/glimpse. $0.60/$3 per 1M input/output; cache read $0.06/M. Context: 220000 tokens. Verified 2026-10-17. Source: https://vercel.com/ai-gateway/models/glimpse');
  for (const item of PERPLEXITY_DECIDER_CATALOG) {
    const model = await save('models', existingModels.get(item.slug!)!, {
      slug: item.slug, name: item.name, type: 'llm', model_category: 'decision',
      provider_ids: [perplexity.id], context_window: item.contextWindow, open_source: true, license: item.license,
      ...(item.slug === 'perplexity-pplx-decider-v1-2' ? { parameters: '27B' } : {}),
      input_type: item.inputModalities, output_type: item.outputModalities,
      input_modalities: item.inputModalities, output_modalities: item.outputModalities,
      capabilities: item.capabilities, pricing_unit: item.pricingUnit, offical_link: item.url,
      description: verticalModelDescription(item),
    }, item.slug!);
    await channel(model, vercel, item.inputPricePer1M!, item.outputPricePer1M!, null,
      `${item.notes} Context: 262144 tokens. Verified 2026-10-17. Source: ${DECIDER_SOURCE}`);
  }
  return steps;
}
