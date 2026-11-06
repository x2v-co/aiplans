import type { Sql } from 'postgres';
import { MORPH_REFLEX, MORPH_REFLEX_SPEC } from '../../src/lib/decision-models-2026-11-05';
import { verticalModelDescription } from './catalog-audit-vertical';
import { KIMI_HEADLINE_PRICE, KIMI_HEADLINE_SLUGS } from './catalog-2026-11-03-kimi-headline';
import { keepFresher } from './catalog-2026-11-05-intel';
import { seedChanges, seedValuesEqual } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';

/**
 * Intel 2026-11-05 18:00. Optional manual seed, never part of rollout.
 * Caller owns a serializable transaction (READ ONLY for default dry-run, like 11-03 P1).
 * Validate the entire diff before writes; no deletes. Fresh scraper notes/timestamps survive.
 * Models have no last_verified/notes/source_url columns: evidence lives in description/offical_link.
 * ERNIE follows open-weight-only catalog entries: metadata only, no fabricated price rows.
 */
export const VERIFIED = '2026-11-05';
export const VERIFIED_AT = new Date('2026-11-05T00:00:00Z');
export const ERNIE_SLUG = 'ernie-5.5-flash-base';
export const ERNIE_SOURCES = [
  'https://huggingface.co/baidu/ERNIE-5.5-Flash-Base',
  'https://ernie.baidu.com/release/ernie-5-5-flash-base/',
] as const;
export const KIMI_WEIGHTS_SOURCE = 'https://huggingface.co/moonshotai/Kimi-K3.1-Pro';
export const REFLEX_ALIASES = ['morph-reflex', 'morph/reflex', 'reflex'];
export const ERNIE_ALIASES = [ERNIE_SLUG, 'baidu-ernie-5-5-flash-base', 'ernie-5-5-flash-base', 'baidu/ERNIE-5.5-Flash-Base'];
const evidence = (note: string, sources: readonly string[]) => `${note} Verified ${VERIFIED}. Source: ${sources.join(' ; ')}`;
const appendEvidence = (previous: unknown, note: string) => String(previous ?? '').includes(note)
  ? String(previous) : [previous, note].filter(Boolean).join('\n');

/** context_window means maximum supported inference context, as in the 11-03 LongCat seed. */
export function ernieModelRow(providerId: number) {
  return {
    slug: ERNIE_SLUG, name: 'ERNIE-5.5-Flash-Base', type: 'llm', model_category: 'text',
    provider_ids: [providerId], open_source: true, parameters: '280B', 'active parameters': '14B',
    context_window: 1_048_576, released_at: new Date('2026-11-05T00:00:00Z'),
    license: 'ERNIE 5.5 Flash Base Model License v1.0', offical_link: ERNIE_SOURCES[0],
    description: evidence('Open weights released 2026-11-05. 280B total / 14B active MoE, pre-trained on 33.5T tokens. Base checkpoint at pre-training end; no post-training. FP8 and BF16 weights. Training context 131,072 (128K); fine-tune/inference context 1,048,576 (1M). context_window records max inference context, following the catalog convention. No official API price; model metadata only, no price rows. License: ERNIE 5.5 Flash Base Model License v1.0. Territory excludes EU, UK and South Korea; annual related revenue >US$50M requires a written commercial license; commercial use must display "Powered by ERNIE".', ERNIE_SOURCES),
  };
}

export function catalog202611051800SeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-05-1800.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}
type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'models' | 'api_channel_prices';
export interface Step { table: Table; target: string; action: 'insert' | 'update' | 'skip'; changes: ReturnType<typeof seedChanges>; reason?: string }

export async function seedCatalog202611051800(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) fail(`Ambiguous or missing ${target}`);
    return rows[0] ?? null;
  };
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(['morph', 'baidu', 'openrouter', 'moonshot-global'])}`;
  const owners = new Map(['morph', 'baidu'].map(slug => [slug, one(providers.filter(p => p.slug === slug), `providers/${slug}`)]));
  for (const [slug, owner] of owners) if (owner && !['official', 'producer'].includes(String(owner.type))) fail(`providers/${slug} has type ${String(owner.type)}`);
  const openrouter = one(providers.filter(p => p.slug === 'openrouter'), 'providers/openrouter', true)!;
  if (openrouter.type !== 'aggregator') fail('providers/openrouter is not an aggregator');
  const moonshot = one(providers.filter(p => p.slug === 'moonshot-global'), 'providers/moonshot-global', true)!;
  if (!['official', 'producer'].includes(String(moonshot.type))) fail(`providers/moonshot-global has type ${String(moonshot.type)}`);

  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx([...REFLEX_ALIASES, ...ERNIE_ALIASES, ...KIMI_HEADLINE_SLUGS])}`;
  const canonical = (aliases: readonly string[], slug: string) => {
    const matches = models.filter(m => aliases.includes(String(m.slug)));
    if (matches.some(m => m.slug !== slug)) fail(`Non-canonical row for ${slug} exists (${matches.map(m => m.slug).join(', ')}); review before seeding`);
    return one(matches, `models/${slug}`);
  };
  const reflex = canonical(REFLEX_ALIASES, MORPH_REFLEX_SPEC.slug);
  const ernie = canonical(ERNIE_ALIASES, ERNIE_SLUG);
  // Same unique alias, official provider and verified channel guards as the Kimi headline seed.
  const kimiRows = models.filter(m => KIMI_HEADLINE_SLUGS.includes(String(m.slug)));
  if (kimiRows.length !== 1) fail(`Expected one kimi-k3.1-pro model among ${KIMI_HEADLINE_SLUGS.join(', ')}, found ${kimiRows.length}`);
  const kimi = kimiRows[0];
  const kimiChannels = await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${kimi.id} AND provider_id = ${moonshot.id}`;
  if (kimiChannels.length !== 1) fail(`Expected one moonshot-global/kimi-k3.1-pro channel price, found ${kimiChannels.length}`);
  for (const [key, want] of [['input_price_per_1m', KIMI_HEADLINE_PRICE.input], ['output_price_per_1m', KIMI_HEADLINE_PRICE.output]] as const) {
    if (!seedValuesEqual(kimiChannels[0][key], want)) fail(`moonshot-global/kimi-k3.1-pro channel ${key} is ${String(kimiChannels[0][key])}, expected ${want}; review before seeding`);
  }
  if (kimiChannels[0].is_available === false) fail('moonshot-global/kimi-k3.1-pro channel price is unavailable; review before seeding');
  const channel = one(reflex ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${reflex.id} AND provider_id = ${openrouter.id}` : [], 'api_channel_prices/morph-reflex/openrouter');

  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const save = (table: Table, existing: Row | null, desired: Record<string, unknown>, target: string): Row => {
    const values = keepFresher(existing, desired);
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) return existing!;
    const id = existing?.id ?? previewId--;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    pending.push({ table, existing, values, id });
    return { ...existing, ...values, id };
  };
  for (const [slug, owner] of owners) if (!owner) {
    const source = slug === 'morph' ? MORPH_REFLEX_SPEC.source : ERNIE_SOURCES[0];
    owners.set(slug, save('providers', null, { slug, name: slug === 'morph' ? 'Morph' : 'Baidu', type: 'producer',
      website: source, access_from_china: null,
      notes: evidence('Provider identity only; other metadata unverified.', [source]) }, slug));
  }
  const morph = owners.get('morph')!;
  const model = save('models', reflex, {
    slug: MORPH_REFLEX.slug, name: MORPH_REFLEX.name, type: 'llm', model_category: 'decision',
    provider_ids: [...new Set([...((reflex?.provider_ids as number[] | undefined) ?? []), morph.id])],
    parameters: '27B', context_window: MORPH_REFLEX_SPEC.context, open_source: MORPH_REFLEX_SPEC.openWeights,
    released_at: new Date(`${MORPH_REFLEX_SPEC.releasedAt}T00:00:00Z`),
    input_type: MORPH_REFLEX.inputModalities, output_type: MORPH_REFLEX.outputModalities,
    input_modalities: MORPH_REFLEX.inputModalities, output_modalities: MORPH_REFLEX.outputModalities,
    capabilities: MORPH_REFLEX.capabilities, pricing_unit: 'per_1m_tokens', offical_link: MORPH_REFLEX.url,
    description: verticalModelDescription(MORPH_REFLEX),
  }, MORPH_REFLEX_SPEC.slug);
  save('api_channel_prices', channel, retainLockedUnavailable({
    model_id: model.id, provider_id: openrouter.id, input_price_per_1m: MORPH_REFLEX_SPEC.input,
    output_price_per_1m: MORPH_REFLEX_SPEC.output, cached_input_price_per_1m: MORPH_REFLEX_SPEC.cache,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, last_verified: VERIFIED_AT,
    notes: evidence(MORPH_REFLEX.notes!, [MORPH_REFLEX_SPEC.source]),
  }, channel), 'morph-reflex/openrouter');
  const baidu = owners.get('baidu')!;
  save('models', ernie, { ...ernieModelRow(baidu.id),
    provider_ids: [...new Set([...((ernie?.provider_ids as number[] | undefined) ?? []), baidu.id])] }, ERNIE_SLUG);
  if (kimi.open_source === true) steps.push({ table: 'models', target: 'kimi-k3.1-pro/open-weights', action: 'skip', changes: {},
    reason: `open_source already true; unchanged. Source: ${KIMI_WEIGHTS_SOURCE} (verified ${VERIFIED}).` });
  else save('models', kimi, { open_source: true,
    description: appendEvidence(kimi.description, evidence('Public Kimi K3.1 Pro weights; Hugging Face license metadata: other; repository created 2026-11-02.', [KIMI_WEIGHTS_SOURCE])) }, 'kimi-k3.1-pro/open-weights');

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
