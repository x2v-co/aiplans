#!/usr/bin/env tsx
/**
 * Seed official pricing/plan reference rows for audited Video / Music / World / Decision models.
 *
 * Reference plans have price=NULL. Usage prices come only from audited static
 * video/music/decision values; unknown prices remain NULL. Other units retain
 * auditable placeholders until source-specific parsing is available.
 *
 * Usage:
 *   npm run seed:vertical-pricing -- --slug omnihuman-2-0            # dry-run, field diff
 *   npm run seed:vertical-pricing -- --slug omnihuman-2-0 --apply    # write changed rows only
 */
import { db } from './db/queries';
import { AI_VERTICAL_CATALOG, RIGOROUS_MODEL_KINDS, type AiCatalogItem } from '../src/lib/ai-vertical-catalog';
import { diffRow, formatChanges, parseSeedArgs } from './utils/seed-diff';
import { shutdownReached } from '../src/lib/model-shutdown';
import { KIMI_K3_CONTEXT_FIX } from './data/catalog-2026-10-29';

// Default is dry-run. Only `--apply` writes; `--slug a,b` narrows the run.
// `--sync-availability` lets existing usage rows change is_available in either
// direction. Without that flag, only a discontinued/retired catalog row, or a
// model whose shutdown_date (UTC) has been reached, may change an existing row,
// and only from available to false.
const ARGS = parseSeedArgs(process.argv);
const APPLY = ARGS.apply;
const stats = { inserted: 0, updated: 0, unchanged: 0 };
const NOW = new Date();

type Unit = 'credit' | 'generation' | 'second' | 'minute' | 'compute_hour' | 'license' | 'availability';

interface ProviderRow { id: number; slug: string; name: string }
interface ModelRow { id: number; slug: string; name: string; provider_ids: number[] | null; shutdown_date?: string | Date | null }
interface PlanRow { id: number; slug: string; provider_id: number | null }

const UNIT_PRICE_KIND: Record<Unit, string> = {
  credit: 'credit',
  generation: 'generation',
  second: 'video_second',
  minute: 'minute',
  compute_hour: 'compute_hour',
  license: 'license',
  availability: 'availability',
};

const UNIT_PATTERNS: Array<[Unit, RegExp]> = [
  ['credit', /credit/i],
  ['generation', /generation|song/i],
  ['second', /second/i],
  ['minute', /minute|character/i],
  ['compute_hour', /compute/i],
  ['license', /license|enterprise/i],
  ['availability', /availability|not commercially priced/i],
];

function normalizeProviderSlug(item: AiCatalogItem): string {
  if (item.providerSlug) return item.providerSlug;
  return item.provider
    .toLowerCase()
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sourceUrl(item: AiCatalogItem): string | undefined {
  return item.sourceUrls?.find((source) => /pricing|api|docs|platform|model/i.test(source.label))?.url
    ?? item.sourceUrls?.[0]?.url
    ?? item.url;
}

function planSlug(item: AiCatalogItem): string {
  return `${item.slug}-official-pricing`;
}

function planName(item: AiCatalogItem): string {
  return `${item.name} official pricing`;
}

/** Catalog statuses whose usage reference must not stay marked available. */
function usageRetired(status: string): boolean {
  return status === 'discontinued' || status === 'retired';
}

/** Retired by status, or past its shutdown day (catalog date first, then the DB row). */
function usageOff(item: AiCatalogItem, model: ModelRow): boolean {
  return usageRetired(item.status) || shutdownReached(item.shutdownDate ?? model.shutdown_date, NOW);
}

function inferPrimaryUnit(item: AiCatalogItem): Unit {
  const text = `${item.pricingUnit ?? ''} ${item.unit ?? ''}`;
  return UNIT_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'availability';
}

async function loadProviders(): Promise<Map<string, ProviderRow>> {
  const { data, error } = await db.from('providers').select('id, slug, name');
  if (error) throw error;
  return new Map((data ?? []).map((provider: ProviderRow) => [provider.slug, provider]));
}

async function loadModels(slugs: string[]): Promise<Map<string, ModelRow>> {
  const { data, error } = await db.from('models').select('id, slug, name, provider_ids, shutdown_date').in('slug', slugs);
  if (error) throw error;
  return new Map((data ?? []).map((model: ModelRow) => [model.slug, model]));
}

async function upsertPlan(item: AiCatalogItem, provider: ProviderRow): Promise<PlanRow | null> {
  const slug = planSlug(item);
  const unit = inferPrimaryUnit(item);
  const existing = await db.from('plans').select('*').eq('provider_id', provider.id).eq('slug', slug).maybeSingle();
  if (existing.error) throw existing.error;

  const row = {
    provider_id: provider.id,
    product_id: provider.id,
    name: planName(item),
    slug,
    pricing_model: item.pricingConfidence === 'not-commercial' ? 'research' : 'official_reference',
    price: null,
    annual_price: null,
    currency: 'USD',
    price_unit: item.pricingUnit ?? item.unit,
    tier: item.pricingConfidence === 'not-commercial' ? 'research' : 'official',
    is_official: true,
    is_contact_sales: item.access?.includes('enterprise') ?? false,
    access_from_china: ['qwen', 'minimax-china', 'volcengine'].includes(provider.slug),
    region: ['qwen', 'minimax-china', 'volcengine'].includes(provider.slug) ? 'china' : 'global',
    source: 'manual',
    plan_kind: 'creative',
    plan_category: 'creative',
    plan_line: `${item.modelCategory}-${provider.slug}`,
    included_usage_unit: unit,
    included_usage_amount: null,
    features: item.capabilities,
    notes: [
      `Official pricing reference for ${item.name}.`,
      `Pricing confidence: ${item.pricingConfidence}.`,
      `Unit: ${item.pricingUnit}.`,
      `Source: ${sourceUrl(item) ?? 'unknown'}`,
    ].join('\n'),
    last_verified: item.lastVerified ? new Date(item.lastVerified) : NOW,
    updated_at: NOW,
  };

  if (existing.data) {
    const current = existing.data as Record<string, unknown>;
    const { changes, patch } = diffRow(current, row);
    const planRow = { id: current.id, slug: current.slug, provider_id: current.provider_id } as PlanRow;
    if (changes.length === 0) {
      console.log(`  ✓ plan ${provider.slug}/${slug}: unchanged`);
      stats.unchanged++;
      return planRow;
    }
    console.log(`  ↻ plan ${provider.slug}/${slug} (id ${current.id})\n${formatChanges(changes)}`);
    stats.updated++;
    if (APPLY) {
      const { error } = await db.from('plans').update({ ...patch, updated_at: NOW }).eq('id', current.id);
      if (error) throw error;
    }
    return planRow;
  }

  console.log(`  ➕ plan ${provider.slug}/${slug}`);
  stats.inserted++;
  if (!APPLY) return { id: -1, slug, provider_id: provider.id };
  const { data, error } = await db.from('plans').insert(row).select('id, slug, provider_id').single();
  if (error) throw error;
  return data as PlanRow;
}

async function upsertMapping(model: ModelRow, plan: PlanRow) {
  if (plan.id < 0) {
    console.log(`    ↳ map ${model.slug} → ${plan.slug}`);
    return;
  }
  const existing = await db.from('model_plan_mapping').select('id, source').eq('model_id', model.id).eq('plan_id', plan.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    if (existing.data.source !== 'manual') {
      console.log(`    ↻ map ${model.slug} → ${plan.slug}\n      source: ${JSON.stringify(existing.data.source)} → "manual"`);
      stats.updated++;
    } else stats.unchanged++;
    if (APPLY && existing.data.source !== 'manual') {
      const { error } = await db.from('model_plan_mapping').update({ source: 'manual' }).eq('id', existing.data.id);
      if (error) throw error;
    }
    return;
  }
  console.log(`    ↳ map ${model.slug} → ${plan.slug}`);
  stats.inserted++;
  if (APPLY) {
    const { error } = await db.from('model_plan_mapping').insert({ model_id: model.id, plan_id: plan.id, priority: 50, source: 'manual' });
    if (error) throw error;
  }
}

interface UsageReference { unit: string; priceKind: string; price: number | null }

function usageReferences(item: AiCatalogItem): UsageReference[] {
  const unit = inferPrimaryUnit(item);
  const references: UsageReference[] = [{
    unit,
    priceKind: UNIT_PRICE_KIND[unit],
    price: ['video-model', 'music-model'].includes(item.kind) ? item.pricePerUnit ?? null : null,
  }];
  if (item.kind === 'decision-model') {
    references.push(
      { unit: 'per_1m_tokens', priceKind: 'input_tokens', price: item.inputPricePer1M ?? null },
      { unit: 'per_1m_tokens', priceKind: 'output_tokens', price: item.outputPricePer1M ?? null },
      { unit: 'per_1m_tasks', priceKind: 'tasks', price: item.pricePer1MTasks ?? null },
    );
  }
  return references;
}

async function upsertUsagePrice(item: AiCatalogItem, model: ModelRow, provider: ProviderRow, plan: PlanRow | null, reference: UsageReference) {
  const { unit, priceKind, price } = reference;
  const src = sourceUrl(item);
  // Match only this script's own row (same plan link). The 2026-10-15 catalog audit owns a
  // separate plan-less row with the same model/provider/kind/unit; matching it made
  // maybeSingle() fail with PGRST116 and aborted every deploy after the audit apply.
  const planId = plan && plan.id > 0 ? plan.id : null;
  const existing = await db
    .from('usage_prices')
    .select('*')
    .eq('model_id', model.id)
    .eq('provider_id', provider.id)
    .eq('price_kind', priceKind)
    .eq('unit', unit)
    .eq('plan_id', planId) // null renders IS NULL
    .maybeSingle();
  if (existing.error) throw existing.error;

  const row = {
    model_id: model.id,
    provider_id: provider.id,
    plan_id: planId,
    price_kind: priceKind,
    unit,
    price,
    currency: item.currency ?? 'USD',
    constraints_json: {
      confidence: item.pricingConfidence,
      pricingUnit: item.pricingUnit,
      publishedPricingText: item.pricing,
      ...(item.pricePerUnitHigh == null ? {} : { price_high: item.pricePerUnitHigh }),
      ...(item.approximatePrice ? { approximate: true } : {}),
      note: price == null ? 'Numeric price intentionally null until parsed and verified from source.' : 'Numeric price from audited static catalog.',
    },
    source_url: src,
    is_available: item.status !== 'announced' && !usageOff(item, model),
    last_verified: item.lastVerified ? new Date(item.lastVerified) : NOW,
    updated_at: NOW,
  };

  if (existing.data) {
    const current = existing.data as Record<string, unknown>;
    const { changes, patch } = diffRow(current, row, {
      syncAvailability: ARGS.syncAvailability,
      retireAvailability: usageOff(item, model),
    });
    if (changes.length === 0) {
      console.log(`    ✓ usage ${model.slug}/${priceKind}/${unit}: unchanged`);
      stats.unchanged++;
      return;
    }
    console.log(`    ↻ usage ${model.slug}/${priceKind}/${unit} (id ${current.id})\n${formatChanges(changes, '        ')}`);
    stats.updated++;
    if (APPLY) {
      const { error } = await db.from('usage_prices').update({ ...patch, updated_at: NOW }).eq('id', current.id);
      if (error) throw error;
    }
    return;
  }

  console.log(`    ➕ usage ${model.slug}/${priceKind}/${unit}`);
  stats.inserted++;
  if (APPLY) {
    const { error } = await db.from('usage_prices').insert(row);
    if (error) throw error;
  }
}

async function main() {
  const eligible = AI_VERTICAL_CATALOG.filter((item) => RIGOROUS_MODEL_KINDS.includes(item.kind) && !item.deferredDbSeed);
  const items = ARGS.slugs ? eligible.filter((item) => ARGS.slugs!.has(item.slug!)) : eligible;
  if (ARGS.slugs) {
    const unknown = [...ARGS.slugs].filter((slug) => slug !== KIMI_K3_CONTEXT_FIX.slug && !items.some((item) => item.slug === slug));
    if (unknown.length) {
      console.error(`Unknown or non-seedable --slug: ${unknown.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    if (ARGS.slugs.has(KIMI_K3_CONTEXT_FIX.slug)) {
      console.log(`${KIMI_K3_CONTEXT_FIX.slug}: context-only repair in seed:vertical-models; no vertical pricing references`);
    }
  }
  if (!items.length) return;
  const providers = await loadProviders();
  const models = await loadModels(items.map((item) => item.slug!).filter(Boolean));

  let seeded = 0;
  let skipped = 0;
  console.log(`\n💵 seed-vertical-pricing-references ${APPLY ? '[APPLY]' : '[DRY-RUN]'} (${items.length} rows)\n`);

  for (const item of items) {
    const provider = providers.get(normalizeProviderSlug(item));
    const model = models.get(item.slug!);
    if (!provider || !model) {
      console.log(`  ⚠ ${item.slug}: missing ${provider ? '' : 'provider'} ${model ? '' : 'model'}; run seed:vertical-models first`);
      skipped++;
      continue;
    }

    const plan = await upsertPlan(item, provider);
    if (plan) await upsertMapping(model, plan);
    for (const reference of usageReferences(item)) {
      await upsertUsagePrice(item, model, provider, plan, reference);
    }
    seeded++;
  }

  console.log('\n━━━ Summary ━━━');
  console.log(`Seeded references: ${seeded}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Rows: ${stats.inserted} insert, ${stats.updated} update, ${stats.unchanged} unchanged`);
  if (!APPLY) console.log('Dry-run only. Re-run with --apply to write the rows listed above.');
  if (skipped > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
