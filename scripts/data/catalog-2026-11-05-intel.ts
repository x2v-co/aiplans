import type { Sql } from 'postgres';
import { CATALOG_1105, SOURCES_1105 } from '../../src/lib/catalog-2026-11-05';
import { verticalModelDescription } from './catalog-audit-vertical';
import { seedChanges } from './gemini-4-argon';
import { modelCapabilities } from './catalog-2026-11-04';
import { retainLockedUnavailable } from '../utils/manual-unavailable';

/** Intel 11-05 P1 manual seed; never part of rollout. Caller owns a serializable transaction
 * (READ ONLY for the default preview). Whole diff is validated before any write; exact identities, no deletes.
 * Every value below was re-read on the official page on 2026-11-05 SGT. */
export const VERIFIED = '2026-11-05';
export const VERIFIED_AT = new Date('2026-11-05T00:00:00Z');
export const FRESH_CUTOFF = new Date('2026-11-05T00:00:00+08:00');
export const GOOGLE_PRO_SOURCE = 'https://gemini.google/us/subscriptions/?hl=en';
export const GO_PRICING_SOURCE = 'https://chatgpt.com/pricing';
export const GO_ANNOUNCEMENT_SOURCE = 'https://openai.com/index/introducing-chatgpt-go/';
export const PLAN_SLUGS = ['gemini-advanced', 'chatgpt-go'] as const;
export const PROVIDER_SLUGS = ['openai', 'google', 'elevenlabs', 'deepgram', 'assemblyai'] as const;
export const MODEL_SLUGS = CATALOG_1105.map(i => i.slug!);
const REQUIRED_PROVIDERS = ['openai', 'google'];
const NAMES: Record<string, string> = { elevenlabs: 'ElevenLabs', deepgram: 'Deepgram', assemblyai: 'AssemblyAI' };

export function catalog20261105SeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-05-intel.ts [--dry-run (default, read-only) | --apply]');
  }
  return { apply: args.includes('--apply') };
}
type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'plans' | 'models' | 'usage_prices';
export interface Step { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

/** Rows already verified on/after 2026-11-05 SGT keep their timestamp and notes. */
export function keepFresher(existing: Row | null, values: Record<string, unknown>) {
  const value = existing?.last_verified;
  const time = value == null ? NaN : new Date(value instanceof Date ? value : String(value)).getTime();
  if (Number.isNaN(time) || time < FRESH_CUTOFF.getTime()) return values;
  const rest = { ...values };
  delete rest.last_verified;
  delete rest.notes;
  return rest;
}
const evidence = (note: string, source: string) => `${note} Verified ${VERIFIED}. Source: ${source}`;
function appendEvidence(existing: unknown, note: string) {
  const previous = String(existing ?? '');
  return previous.includes(note) ? previous : [previous, note].filter(Boolean).join('\n');
}
/** Stale plan-note lines that contradict the 11-05 price (data-trust/audit flag notes starting with [needs-verification]). */
export const STALE_PLAN_NOTE_PATTERNS: Record<(typeof PLAN_SLUGS)[number], RegExp[]> = {
  'gemini-advanced': [/^\s*\[needs-verification\]/i, /US price not identified|prices withheld/i],
  'chatgpt-go': [/^\s*\[needs-verification\]/i, /No current USD amount could be verified/i, /\$8\b.*\bhistorical\b|\bhistorical\b.*\$8\b/i, /price not verified in this audit/i],
};
/** Drop stale lines, keep every other line, append the new evidence once. Never leaves a [needs-verification] prefix. */
export function replaceStalePlanNotes(existing: unknown, patterns: RegExp[], note: string) {
  const kept = String(existing ?? '').split('\n')
    .filter(line => line.trim() !== '' && line !== note && !patterns.some(p => p.test(line)));
  return [...kept, note].join('\n');
}
const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim() !== '';

/** Voice rows follow the non-LLM seed convention (models.type 'multimodal'). A pre-existing non-llm type is kept;
 * an 'llm' left by an earlier preview/apply of this seed is corrected. */
export const VOICE_MODEL_TYPE = 'multimodal';
export function voiceModelType(existing: unknown) {
  return typeof existing === 'string' && existing.trim() !== '' && existing !== 'llm' ? existing : VOICE_MODEL_TYPE;
}

export async function seedCatalog20261105(tx: Sql, apply = false): Promise<Step[]> {
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) throw new Error(`Ambiguous or missing ${target}; nothing written.`);
    return rows[0] ?? null;
  };
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx([...PROVIDER_SLUGS])}`;
  const owners = new Map<string, Row | null>(PROVIDER_SLUGS.map(slug => [slug, one(providers.filter(r => r.slug === slug), `providers/${slug}`, REQUIRED_PROVIDERS.includes(slug))]));
  for (const [slug, owner] of owners) if (owner && !['official', 'producer'].includes(String(owner.type))) throw new Error(`Unexpected providers/${slug} type; nothing written.`);
  const plans = await tx<Row[]>`SELECT * FROM plans WHERE slug IN ${tx([...PLAN_SLUGS])}`;
  const byPlan = new Map(PLAN_SLUGS.map(slug => [slug, one(plans.filter(r => r.slug === slug), `plans/${slug}`, true)!]));
  for (const [slug, plan] of byPlan) {
    const owner = owners.get(slug === 'chatgpt-go' ? 'openai' : 'google')!;
    if ([plan.provider_id, plan.product_id].some(id => id != null && id !== owner.id)) throw new Error(`Wrong plans/${slug} ownership; nothing written.`);
  }
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(MODEL_SLUGS)}`;
  const byModel = new Map(MODEL_SLUGS.map(slug => [slug, one(models.filter(r => r.slug === slug), `models/${slug}`)]));

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
    const source = SOURCES_1105[slug as keyof typeof SOURCES_1105];
    owners.set(slug, save('providers', null, { slug, name: NAMES[slug], type: 'official', website: source, pricing_url: source,
      access_from_china: null, notes: evidence('Provider identity.', source) }, slug));
  }

  const pro = byPlan.get('gemini-advanced')!;
  save('plans', pro, { price: 19.99, currency: 'USD', price_unit: 'per_month', region: 'US', last_verified: VERIFIED_AT,
    notes: replaceStalePlanNotes(pro.notes, STALE_PLAN_NOTE_PATTERNS['gemini-advanced'], evidence('Google AI Pro US monthly price $19.99.', GOOGLE_PRO_SOURCE)) }, 'gemini-advanced');
  const go = byPlan.get('chatgpt-go')!;
  save('plans', go, { price: 8, currency: 'USD', price_unit: 'per_month', region: 'US', last_verified: VERIFIED_AT,
    notes: replaceStalePlanNotes(go.notes, STALE_PLAN_NOTE_PATTERNS['chatgpt-go'], evidence(`US monthly price $8 (official OpenAI announcement: "ChatGPT Go at $8 USD/month", US price displayed; localized in some markets). chatgpt.com/pricing renders the amount client-side by geography and did not show a USD figure to the audit fetch on ${VERIFIED}; Intel confirmed $8 there on 2026-11-03. Pricing page: ${GO_PRICING_SOURCE}`, GO_ANNOUNCEMENT_SOURCE)) }, 'chatgpt-go');

  for (const item of CATALOG_1105) {
    const owner = owners.get(item.providerSlug!)!;
    const old = byModel.get(item.slug!) ?? null;
    const model = save('models', old, {
      slug: item.slug, name: item.name, type: voiceModelType(old?.type), model_category: item.modelCategory,
      provider_ids: [...new Set([...((old?.provider_ids as number[] | undefined) ?? []), owner.id])],
      input_type: item.inputModalities, input_modalities: item.inputModalities,
      output_type: item.outputModalities, output_modalities: item.outputModalities,
      ...modelCapabilities(old, item.capabilities), pricing_unit: item.pricingUnit,
      ...(nonEmpty(old?.offical_link) ? {} : { offical_link: item.url }),
      description: nonEmpty(old?.description) ? appendEvidence(old!.description, verticalModelDescription(item)) : verticalModelDescription(item),
    }, item.slug!);
    const usage = old && owner.id > 0 ? await tx<Row[]>`SELECT * FROM usage_prices WHERE model_id = ${old.id} AND provider_id = ${owner.id}` : [];
    for (const rate of item.usageRates ?? []) {
      const existing = one(usage.filter(r => r.price_kind === rate.priceKind && r.unit === rate.unit), `usage_prices/${item.slug}/${rate.priceKind}`);
      save('usage_prices', existing, retainLockedUnavailable({
        model_id: model.id, provider_id: owner.id, plan_id: existing?.plan_id ?? null,
        price_kind: rate.priceKind, unit: rate.unit, price: rate.price, currency: item.currency,
        source_url: item.sourceUrls![0].url, last_verified: VERIFIED_AT, is_available: true,
        constraints_json: { publishedPricingText: item.pricing, note: item.notes ?? null, ...(rate.approximate ? { approximate: true } : {}) },
      }, existing), `${item.slug}/${rate.priceKind}/${rate.unit}`);
    }
  }

  if (apply) {
    const ids = new Map<number, number>();
    const resolveId = (id: unknown) => typeof id === 'number' && id < 0 ? ids.get(id)! : id;
    for (const operation of pending) {
      const payload: Record<string, unknown> = { ...operation.values, updated_at: new Date() };
      for (const key of ['model_id', 'provider_id', 'product_id', 'plan_id']) if (key in payload) payload[key] = resolveId(payload[key]);
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
