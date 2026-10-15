import type { Sql } from 'postgres';
import { NON_LLM_CATALOG, MOONDREAM_SHUTDOWN } from '../../src/lib/non-llm-catalog';

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

/** Caller owns a serializable transaction. Dry-run is SELECT-only. No scraping. */
export async function seedNonLlm(tx: Sql, apply = false): Promise<NonLlmStep[]> {
  const tables: Table[] = ['providers', 'models', 'plans', 'model_plan_mapping', 'usage_prices'];
  const rows = {} as Record<Table, Row[]>;
  for (const table of tables) rows[table] = await tx<Row[]>`SELECT * FROM ${tx(table)}`;
  const steps: NonLlmStep[] = [];
  let previewId = -1;
  const save = async (table: Table, matches: Row[], values: Record<string, unknown>, target: string) => {
    if (matches.length > 1) throw new Error(`Ambiguous ${table}/${target}; transaction aborted.`);
    const existing = matches[0];
    const changes = Object.fromEntries(Object.entries(values)
      .filter(([key, value]) => !existing || JSON.stringify(comparable(existing[key])) !== JSON.stringify(comparable(value)))
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
  const provider = async (slug: string, name: string, channel = false) => {
    const matches = rows.providers.filter(row => row.slug === slug);
    if (matches.length > 1) throw new Error(`Ambiguous provider ${slug}`);
    return matches[0] ?? save('providers', [], { slug, name, type: channel ? 'aggregator' : 'producer',
      region: null, access_from_china: null, notes: '2026-10-15 verified identity; other provider metadata needs verification.' }, slug);
  };

  for (const item of NON_LLM_CATALOG) {
    const owner = await provider(item.providerSlug!, item.provider);
    const channel = item.pricingProviderSlug ? await provider(item.pricingProviderSlug, item.pricingChannel!, true) : owner;
    const existing = rows.models.filter(row => row.slug === item.slug);
    const providerIds = Array.isArray(existing[0]?.provider_ids) ? existing[0].provider_ids as number[] : [];
    const model = await save('models', existing, {
      slug: item.slug, name: item.name, type: existing[0]?.type ?? (item.kind === 'decision-model' ? 'llm' : 'multimodal'),
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
      description: [item.bestFor, `Status: ${item.status}. Pricing confidence: ${item.pricingConfidence}. Unit: ${item.pricingUnit}. Last verified: ${item.lastVerified}.`,
        item.notes, ...(item.needsVerification ?? []).map(note => `[needs-verification] ${note}`),
        `Sources: ${item.sourceUrls?.map(source => `${source.publisher}: ${source.url}`).join(' | ')}`].filter(Boolean).join('\n'),
    }, item.slug!);
    const unit = /minute|character/i.test(item.pricingUnit ?? '') ? 'minute' : 'availability';
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
    const rates = [{ priceKind: unit, unit, price: null as number | null }, ...(item.usageRates ?? []),
      ...(item.kind === 'decision-model' ? [
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
  for (const model of rows.models.filter(row => /moondream/i.test(`${row.slug} ${row.name}`))) {
    const note = MOONDREAM_SHUTDOWN.notes;
    await save('models', [model], {
      deprecated_at: MOONDREAM_SHUTDOWN.deprecatedAt, shutdown_date: MOONDREAM_SHUTDOWN.shutdownDate,
      deprecation_source_url: MOONDREAM_SHUTDOWN.deprecationSourceUrl,
      description: String(model.description ?? '').includes(note) ? model.description : [model.description, note].filter(Boolean).join('\n'),
    }, String(model.slug));
  }
  return steps;
}
