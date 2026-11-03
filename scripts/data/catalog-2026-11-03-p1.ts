import type { Sql } from 'postgres';
import { catalogForKind, type AiCatalogItem } from '../../src/lib/ai-vertical-catalog';
import { DECISION_1103_SPECS, DECISION_MODELS_2026_11_03 } from '../../src/lib/decision-models-2026-11-03';
import { verticalModelDescription } from './catalog-audit-vertical';
import { seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';

/**
 * Intel 2026-11-03 audit, new P1-1 and P1-2. Optional SRE seed, never part of deploy.
 * Default dry-run runs in a READ ONLY transaction; --apply writes in one serializable
 * transaction. Diff-only writes, no deletes.
 *
 * P1-1 Veo 3.1 / Fast / Lite: the Gemini API previews shut down 2026-10-22, but Vertex AI
 *   still sells them (https://cloud.google.com/vertex-ai/generative-ai/pricing, checked
 *   2026-11-03). Models: clear shutdown_date / replacement_model (a model-level shutdown_date
 *   makes the shutdown sweep retire every channel) and refresh the audited description.
 *   usage_prices: one row per Vertex rate (video + audio and video-only), keyed like
 *   seed-vertical-pricing (model, google, the item's official-pricing plan, price_kind, unit).
 *   Older usage rows of these models are left untouched. The family row "veo" gets only its
 *   description. Veo 3 / Veo 3 Fast / Veo 2 are noted on the family row, not new rows.
 * P1-2 decision models: 8 models + one api_channel_prices row each (Workers AI official
 *   for Cloudflare; Vercel AI Gateway for Baseten / Liquid). Missing producer providers
 *   (cloudflare, baseten) are created; liquid / vercel-ai-gateway are reused.
 *
 * Rows refreshed by the scheduled scraper keep their own state: an existing row whose
 * last_verified is newer than or equal to this seed keeps last_verified and notes.
 */
export const VERIFIED = '2026-11-03';
export const VERIFIED_AT = new Date('2026-11-03T00:00:00Z');
export const VERTEX_SOURCE = 'https://cloud.google.com/vertex-ai/generative-ai/pricing';
export const VEO_SLUGS = ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite'] as const;
export const VEO_FAMILY = 'veo';
const video = () => catalogForKind('video-model');
export const veoItem = (slug: string) => video().find(item => item.slug === slug)!;

export function catalog20261103P1SeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-03-p1.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'models' | 'usage_prices' | 'api_channel_prices';
export interface Step { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

/** #300 moved numeric-string normalization into seedChanges; keep one comparison rule. */
export const seedDiff = (existing: Row | null, values: Record<string, unknown>) => seedChanges(existing, values);

/** Anything verified on/after 2026-11-03 in SGT (the scraper's zone) counts as fresher than this audit. */
export const SCRAPER_FRESH_CUTOFF = new Date('2026-11-03T00:00:00+08:00');

/** Keep scraper-owned freshness: never move last_verified back or replace its notes. */
export function keepFresher(existing: Row | null, values: Record<string, unknown>) {
  if (!existing || existing.last_verified == null) return values;
  const current = new Date(String(existing.last_verified instanceof Date ? existing.last_verified.toISOString() : existing.last_verified));
  if (Number.isNaN(current.getTime()) || current.getTime() < SCRAPER_FRESH_CUTOFF.getTime()) return values;
  const rest = { ...values };
  delete rest.last_verified;
  delete rest.notes;
  return rest;
}

export function decisionAliases(slug: string) {
  const spec = DECISION_1103_SPECS.find(s => s.slug === slug)!;
  const bare = slug.replace(/^(cloudflare|baseten|liquid)-/, '');
  return [...new Set([slug, bare, spec.endpoint, spec.endpoint.replace('@cf/', ''), `${spec.providerSlug}/${bare}`])];
}

export async function seedCatalog20261103P1(tx: Sql, apply = false): Promise<Step[]> {
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) throw new Error(`Ambiguous or missing ${target}; nothing written.`);
    return rows[0] ?? null;
  };
  // ---- Validate the whole scope before the first write.
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(['google', 'cloudflare', 'baseten', 'liquid', 'vercel-ai-gateway'])}`;
  const google = one(providers.filter(p => p.slug === 'google'), 'providers/google', true)!;
  const vercel = one(providers.filter(p => p.slug === 'vercel-ai-gateway'), 'providers/vercel-ai-gateway', true)!;
  if (vercel.type !== 'aggregator') throw new Error('providers/vercel-ai-gateway is not an aggregator; nothing written.');
  const owners = new Map(['cloudflare', 'baseten', 'liquid'].map(slug => [slug, one(providers.filter(p => p.slug === slug), `providers/${slug}`)]));
  for (const [slug, row] of owners) if (row && !['official', 'producer'].includes(String(row.type))) throw new Error(`providers/${slug} has type ${String(row.type)}; nothing written.`);

  const veoModels = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx([...VEO_SLUGS, VEO_FAMILY])}`;
  const veo = new Map([...VEO_SLUGS, VEO_FAMILY].map(slug => [slug, one(veoModels.filter(m => m.slug === slug), `models/${slug}`, true)!]));
  const veoPlans = await tx<Row[]>`SELECT * FROM plans WHERE provider_id = ${google.id} AND slug IN ${tx(VEO_SLUGS.map(s => `${s}-official-pricing`))}`;
  const veoUsage = new Map<string, Row[]>();
  const veoPlanId = new Map<string, number | null>();
  for (const slug of VEO_SLUGS) {
    const planId = one(veoPlans.filter(p => p.slug === `${slug}-official-pricing`), `plans/${slug}-official-pricing`)?.id ?? null;
    const rows = await tx<Row[]>`SELECT * FROM usage_prices WHERE model_id = ${veo.get(slug)!.id} AND provider_id = ${google.id}`;
    for (const rate of veoItem(slug).usageRates!) one(rows.filter(r => r.price_kind === rate.priceKind && r.unit === rate.unit && (r.plan_id ?? null) === planId), `usage ${slug}/${rate.priceKind}`);
    veoUsage.set(slug, rows);
    veoPlanId.set(slug, planId);
  }

  const decisionModels = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(DECISION_1103_SPECS.flatMap(s => decisionAliases(s.slug)))}`;
  for (const spec of DECISION_1103_SPECS) {
    const matches = decisionModels.filter(m => decisionAliases(spec.slug).includes(String(m.slug)));
    if (matches.some(m => m.slug !== spec.slug)) throw new Error(`Non-canonical row for ${spec.slug} exists (${matches.map(m => m.slug).join(', ')}); review before seeding. Nothing written.`);
    one(matches, `models/${spec.slug}`);
  }

  // ---- Writes (diff-only).
  const steps: Step[] = [];
  let previewId = -1;
  const save = async (table: Table, existing: Row | null, desired: Record<string, unknown>, target: string): Promise<Row> => {
    const values = keepFresher(existing, desired);
    const changes = seedDiff(existing, values);
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

  // P1-1 Veo.
  for (const slug of VEO_SLUGS) {
    const item = veoItem(slug);
    const model = veo.get(slug)!;
    await save('models', model, { shutdown_date: null, replacement_model: null, pricing_unit: 'per_second', description: verticalModelDescription(item) }, slug);
    const rows = veoUsage.get(slug)!;
    const planId = veoPlanId.get(slug) ?? null;
    for (const rate of item.usageRates!) {
      const existing = rows.find(r => r.price_kind === rate.priceKind && r.unit === rate.unit && (r.plan_id ?? null) === planId) ?? null;
      await save('usage_prices', existing, {
        model_id: model.id, provider_id: google.id, plan_id: planId, price_kind: rate.priceKind, unit: rate.unit,
        price: rate.price, currency: 'USD', is_available: true, source_url: VERTEX_SOURCE, last_verified: VERIFIED_AT,
        constraints_json: { channel: 'Vertex AI', note: item.notes, publishedPricingText: item.pricing },
      }, `${slug}/${rate.priceKind}`);
    }
  }
  await save('models', veo.get(VEO_FAMILY)!, { description: verticalModelDescription(veoItem(VEO_FAMILY)) }, VEO_FAMILY);

  // P1-2 decision models.
  const names: Record<string, string> = { cloudflare: 'Cloudflare', baseten: 'Baseten', liquid: 'Liquid AI' };
  const sites: Record<string, string> = { cloudflare: 'https://developers.cloudflare.com/workers-ai/', baseten: 'https://www.baseten.co', liquid: 'https://www.liquid.ai' };
  const savedOwners = new Map<string, Row>();
  for (const [slug, row] of owners) {
    savedOwners.set(slug, row ?? await save('providers', null, {
      slug, name: names[slug], type: 'producer', region: 'global', website: sites[slug], access_from_china: null,
      notes: `Identity verified ${VERIFIED} (decision models). Other provider metadata unverified.`,
    }, slug));
  }
  for (const item of DECISION_MODELS_2026_11_03 as AiCatalogItem[]) {
    const spec = DECISION_1103_SPECS.find(s => s.slug === item.slug)!;
    const owner = savedOwners.get(spec.providerSlug)!;
    const existing = decisionModels.find(m => m.slug === item.slug) ?? null;
    const model = await save('models', existing, {
      slug: item.slug, name: item.name, type: 'llm', model_category: 'decision',
      provider_ids: [...new Set([...((existing?.provider_ids as number[] | undefined) ?? []), owner.id])],
      context_window: item.contextWindow, open_source: spec.openWeights,
      input_type: item.inputModalities, output_type: item.outputModalities,
      input_modalities: item.inputModalities, output_modalities: item.outputModalities,
      capabilities: item.capabilities, pricing_unit: 'per_1m_tokens', offical_link: item.url,
      description: verticalModelDescription(item),
    }, item.slug!);
    const gateway = spec.channel === 'vercel' ? vercel : owner;
    const channel = one(model.id > 0 && gateway.id > 0
      ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${gateway.id}` : [],
    `api_channel_prices/${item.slug}/${String(gateway.slug)}`);
    await save('api_channel_prices', channel, retainLockedUnavailable({
      model_id: model.id, provider_id: gateway.id, input_price_per_1m: spec.input, output_price_per_1m: 0,
      cached_input_price_per_1m: null, currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
      last_verified: VERIFIED_AT,
      notes: `${item.notes} Context: ${spec.context} tokens. Verified ${VERIFIED}. Source: ${item.sourceUrls!.map(s => s.url).join(' ; ')}`,
    }, channel as never), `${item.slug}/${String(gateway.slug)}`);
  }
  return steps;
}
