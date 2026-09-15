#!/usr/bin/env tsx
/**
 * Seed official pricing/plan reference rows for audited Video / Music / World models.
 *
 * This is not a numeric-price scraper. It creates auditable placeholders with
 * price=NULL where the vendor publishes credit/seconds/generation pricing that
 * still needs source-specific parsing. Detail pages can then show official
 * pricing links and related plan/API entry points without inventing numbers.
 */
import { db } from './db/queries';
import { AI_VERTICAL_CATALOG, RIGOROUS_MODEL_KINDS, type AiCatalogItem } from '../src/lib/ai-vertical-catalog';

const APPLY = process.argv.includes('--apply');
const NOW = new Date();

type Unit = 'credit' | 'generation' | 'second' | 'minute' | 'compute_hour' | 'license' | 'availability';

interface ProviderRow { id: number; slug: string; name: string }
interface ModelRow { id: number; slug: string; name: string; provider_ids: number[] | null }
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
  const { data, error } = await db.from('models').select('id, slug, name, provider_ids').in('slug', slugs);
  if (error) throw error;
  return new Map((data ?? []).map((model: ModelRow) => [model.slug, model]));
}

async function upsertPlan(item: AiCatalogItem, provider: ProviderRow): Promise<PlanRow | null> {
  const slug = planSlug(item);
  const unit = inferPrimaryUnit(item);
  const existing = await db.from('plans').select('id, slug, provider_id').eq('provider_id', provider.id).eq('slug', slug).maybeSingle();
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
    console.log(`  ↻ plan ${provider.slug}/${slug}`);
    if (APPLY) {
      const { error } = await db.from('plans').update(row).eq('id', existing.data.id);
      if (error) throw error;
    }
    return existing.data as PlanRow;
  }

  console.log(`  ➕ plan ${provider.slug}/${slug}`);
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
  const existing = await db.from('model_plan_mapping').select('id').eq('model_id', model.id).eq('plan_id', plan.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return;
  console.log(`    ↳ map ${model.slug} → ${plan.slug}`);
  if (APPLY) {
    const { error } = await db.from('model_plan_mapping').insert({ model_id: model.id, plan_id: plan.id, priority: 50, source: 'manual' });
    if (error) throw error;
  }
}

async function upsertUsagePrice(item: AiCatalogItem, model: ModelRow, provider: ProviderRow, plan: PlanRow | null) {
  const unit = inferPrimaryUnit(item);
  const priceKind = UNIT_PRICE_KIND[unit];
  const src = sourceUrl(item);
  const existing = await db
    .from('usage_prices')
    .select('id')
    .eq('model_id', model.id)
    .eq('provider_id', provider.id)
    .eq('price_kind', priceKind)
    .eq('unit', unit)
    .maybeSingle();
  if (existing.error) throw existing.error;

  const row = {
    model_id: model.id,
    provider_id: provider.id,
    plan_id: plan && plan.id > 0 ? plan.id : null,
    price_kind: priceKind,
    unit,
    price: null,
    currency: 'USD',
    constraints_json: {
      confidence: item.pricingConfidence,
      pricingUnit: item.pricingUnit,
      publishedPricingText: item.pricing,
      note: 'Numeric price intentionally null until parsed and verified from source.',
    },
    source_url: src,
    is_available: item.status !== 'announced' && item.status !== 'discontinued',
    last_verified: item.lastVerified ? new Date(item.lastVerified) : NOW,
    updated_at: NOW,
  };

  if (existing.data) {
    console.log(`    ↻ usage ${model.slug}/${priceKind}/${unit}`);
    if (APPLY) {
      const { error } = await db.from('usage_prices').update(row).eq('id', existing.data.id);
      if (error) throw error;
    }
    return;
  }

  console.log(`    ➕ usage ${model.slug}/${priceKind}/${unit}`);
  if (APPLY) {
    const { error } = await db.from('usage_prices').insert(row);
    if (error) throw error;
  }
}

async function main() {
  const items = AI_VERTICAL_CATALOG.filter((item) => RIGOROUS_MODEL_KINDS.includes(item.kind));
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
    await upsertUsagePrice(item, model, provider, plan);
    seeded++;
  }

  console.log('\n━━━ Summary ━━━');
  console.log(`Seeded references: ${seeded}`);
  console.log(`Skipped: ${skipped}`);
  if (!APPLY) console.log('Dry-run only. Re-run with --apply or npm run seed:vertical-pricing to write.');
  if (skipped > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
