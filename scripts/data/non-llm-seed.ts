import type { Sql } from 'postgres';
import { NON_LLM_CATALOG, MOONDREAM_SHUTDOWN } from '../../src/lib/non-llm-catalog';
import { IMAGE_MODEL_CATALOG } from '../../src/lib/image-model-catalog';
import type { AiCatalogItem } from '../../src/lib/ai-vertical-catalog';

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'models' | 'plans' | 'model_plan_mapping' | 'usage_prices';
export interface NonLlmStep { table: Table; target: string; changes: Record<string, unknown> }

// PostgreSQL can reorder jsonb keys and decodes timestamps as Date objects.
function comparable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, comparable(entry)]),
  );
  return value ?? null;
}

// Lifecycle columns are timestamps in the DB but date-only strings in the catalog;
// compare them at day precision so an applied seed reports zero drift.
const DATE_KEYS = new Set(['deprecated_at', 'shutdown_date']);
export function toDay(value: unknown): unknown {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(value)) {
    if (value.length === 10) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
  }
  return value ?? null;
}
export function sameColumnValue(key: string, existing: unknown, desired: unknown): boolean {
  if (DATE_KEYS.has(key)) return toDay(existing) === toDay(desired);
  return JSON.stringify(comparable(existing)) === JSON.stringify(comparable(desired));
}

/** Caller owns a serializable transaction. Dry-run is SELECT-only. No scraping. */
export async function seedNonLlm(tx: Sql, apply = false): Promise<NonLlmStep[]> {
  return seedCatalogItems(tx, apply, NON_LLM_CATALOG, { moondream: true });
}

/**
 * Image-model catalog (2026-10-15). Pre-existing model rows (e.g. gemini-nano-banana-2.1 from the LLM scrapers)
 * are reused: their name, type and description are kept; only category/modality/pricing metadata is aligned.
 */
export async function seedImageModels(tx: Sql, apply = false): Promise<NonLlmStep[]> {
  return seedCatalogItems(tx, apply, IMAGE_MODEL_CATALOG, { moondream: false, preserveExisting: true });
}

async function seedCatalogItems(tx: Sql, apply: boolean, items: AiCatalogItem[],
  options: { moondream: boolean; preserveExisting?: boolean }): Promise<NonLlmStep[]> {
  const tables: Table[] = ['providers', 'models', 'plans', 'model_plan_mapping', 'usage_prices'];
  const rows = {} as Record<Table, Row[]>;
  for (const table of tables) rows[table] = await tx<Row[]>`SELECT * FROM ${tx(table)}`;
  const steps: NonLlmStep[] = [];
  let previewId = -1;
  const save = async (table: Table, matches: Row[], values: Record<string, unknown>, target: string) => {
    if (matches.length > 1) throw new Error(`Ambiguous ${table}/${target}; transaction aborted.`);
    const existing = matches[0];
    const changes = Object.fromEntries(Object.entries(values)
      .filter(([key, value]) => !existing || !sameColumnValue(key, existing[key], value))
      .map(([key, value]) => [key, { from: existing?.[key] ?? null, to: value }]));
    if (!Object.keys(changes).length) return existing;
    steps.push({ table, target, changes });
    const payload = table === 'model_plan_mapping' ? values : { ...values, updated_at: new Date() };
    let id = existing?.id ?? previewId--;
    if (apply) {
      if (existing) await tx`UPDATE ${tx(table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        id = inserted.id;
      }
    }
    const result = { ...existing, ...payload, id };
    if (existing) Object.assign(existing, result);
    else rows[table].push(result);
    return result;
  };
  // Same aliases as the Nemotron seed: either existing Vercel identity is reused, never a second one.
  const PROVIDER_ALIASES: Record<string, string[]> = { 'vercel-ai-gateway': ['vercel-ai-gateway', 'vercel'] };
  const provider = async (slug: string, name: string, channel = false) => {
    const aliases = PROVIDER_ALIASES[slug] ?? [slug];
    const matches = aliases.map(alias => rows.providers.filter(row => row.slug === alias)).find(found => found.length) ?? [];
    if (matches.length > 1) throw new Error(`Ambiguous provider ${slug}`);
    return matches[0] ?? save('providers', [], { slug, name, type: channel ? 'aggregator' : 'producer',
      region: null, access_from_china: null, notes: '2026-10-15 verified identity; other provider metadata needs verification.' }, slug);
  };

  for (const item of items) {
    const owner = await provider(item.providerSlug!, item.provider);
    const channel = item.pricingProviderSlug ? await provider(item.pricingProviderSlug, item.pricingChannel!, true) : owner;
    const existing = rows.models.filter(row => row.slug === item.slug);
    const providerIds = Array.isArray(existing[0]?.provider_ids) ? existing[0].provider_ids as number[] : [];
    const keep = options.preserveExisting && existing.length === 1 ? existing[0] : null;
    const description = [item.bestFor, `Status: ${item.status}. Pricing confidence: ${item.pricingConfidence}. Unit: ${item.pricingUnit}. Last verified: ${item.lastVerified}.`,
      item.notes, ...(item.needsVerification ?? []).map(note => `[needs-verification] ${note}`),
      `Sources: ${item.sourceUrls?.map(source => `${source.publisher}: ${source.url}`).join(' | ')}`].filter(Boolean).join('\n');
    const model = await save('models', existing, {
      slug: item.slug, name: keep ? keep.name : item.name, type: existing[0]?.type ?? (item.kind === 'decision-model' ? 'llm' : 'multimodal'),
      model_category: item.modelCategory, provider_ids: [...new Set([...providerIds, owner.id])],
      open_source: item.access?.includes('open-weights') ?? false,
      input_type: item.inputModalities, output_type: item.outputModalities,
      input_modalities: item.inputModalities, output_modalities: item.outputModalities, capabilities: item.capabilities,
      pricing_unit: item.pricingUnit,
      offical_link: item.url, ...(item.contextWindow == null ? {} : { context_window: item.contextWindow }),
      ...(item.releasedAt ? { released_at: `${item.releasedAt}T00:00:00.000Z` } : {}),
      ...(item.deprecatedAt ? { deprecated_at: item.deprecatedAt } : {}),
      ...(item.shutdownDate ? { shutdown_date: item.shutdownDate } : {}),
      ...(item.replacementModel ? { replacement_model: item.replacementModel } : {}),
      ...(item.deprecationSourceUrl ? { deprecation_source_url: item.deprecationSourceUrl } : {}),
      description: keep ? keep.description : description,
    }, item.slug!);
    const unit = /minute|character/i.test(item.pricingUnit ?? '') ? 'minute' : /hour/i.test(item.pricingUnit ?? '') ? 'hour' : 'availability';
    const slug = `${item.slug}-official-pricing`;
    const source = item.sourceUrls![0].url;
    const plan = await save('plans', rows.plans.filter(row => row.slug === slug && row.provider_id === channel.id), {
      slug, name: `${item.name} pricing reference`, provider_id: channel.id, product_id: channel.id,
      price: null, annual_price: null, currency: 'USD', pricing_model: 'official_reference',
      price_unit: item.pricingUnit, source: 'manual', plan_kind: 'creative', plan_category: 'creative',
      included_usage_unit: unit, included_usage_amount: null, is_official: true,
      notes: `${item.pricingChannel ?? item.provider} pricing reference. Source: ${source}`,
      last_verified: '2026-10-15T00:00:00.000Z',
    }, slug);
    await save('model_plan_mapping', rows.model_plan_mapping.filter(row => row.model_id === model.id && row.plan_id === plan.id), {
      model_id: model.id, plan_id: plan.id, priority: 50, source: 'manual',
    }, slug);
    // Itemized usageRates win; decision defaults only fill kinds the item did not itemize.
    const itemized = item.usageRates ?? [];
    // Itemized items get exactly their rates; only un-itemized items keep a unit placeholder row.
    const rates = [...(itemized.length ? [] : [{ priceKind: unit, unit, price: null as number | null }]), ...itemized,
      ...(item.kind === 'decision-model' && !itemized.length ? [
        { priceKind: 'input_tokens', unit: 'per_1m_tokens', price: item.inputPricePer1M ?? null },
        { priceKind: 'output_tokens', unit: 'per_1m_tokens', price: item.outputPricePer1M ?? null },
        { priceKind: 'tasks', unit: 'per_1m_tasks', price: null },
      ] : [])];
    for (const rate of rates) {
      await save('usage_prices', rows.usage_prices.filter(row => row.model_id === model.id && row.provider_id === channel.id && row.price_kind === rate.priceKind && row.unit === rate.unit), {
        model_id: model.id, provider_id: channel.id, plan_id: plan.id, price_kind: rate.priceKind, unit: rate.unit,
        price: rate.price, currency: 'USD', source_url: source, last_verified: '2026-10-15T00:00:00.000Z',
        is_available: item.status !== 'discontinued',
        constraints_json: { price_status: rate.price == null ? 'needs-verification' : item.priceStatus,
          ...('approximate' in rate && rate.approximate ? { approximate: true } : {}),
          context_window_label: item.contextWindowLabel ?? null, notes: item.notes ?? null },
      }, `${item.slug}/${rate.priceKind}/${rate.unit}`);
    }
  }

  // Apply the Cloud lifecycle notice to every pre-existing Moondream identity.
  // Keep its own weights/license/pricing fields intact.
  for (const model of !options.moondream ? [] : rows.models.filter(row => /moondream|vikhyatk/i.test(`${row.slug} ${row.name} ${row.offical_link ?? ''}`))) {
    const note = MOONDREAM_SHUTDOWN.notes;
    await save('models', [model], {
      deprecated_at: MOONDREAM_SHUTDOWN.deprecatedAt, shutdown_date: MOONDREAM_SHUTDOWN.shutdownDate,
      deprecation_source_url: MOONDREAM_SHUTDOWN.deprecationSourceUrl,
      description: String(model.description ?? '').includes(note) ? model.description : [model.description, note].filter(Boolean).join('\n'),
    }, String(model.slug));
  }
  return steps;
}
