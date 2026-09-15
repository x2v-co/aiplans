#!/usr/bin/env tsx
/**
 * Materialize the audited Video / Music / World catalog into models.
 *
 * This is deliberately narrower than a scraper:
 * - source of truth for public product identity is src/lib/ai-vertical-catalog.ts;
 * - exact numeric prices still belong in plans / usage_prices after source-specific parsing;
 * - this script only seeds model taxonomy, modalities, capabilities and official links.
 *
 * Usage:
 *   npm run seed:vertical-models:dry-run
 *   DATABASE_URL=... npm run seed:vertical-models
 */
import { db } from './db/queries';
import {
  AI_VERTICAL_CATALOG,
  RIGOROUS_MODEL_KINDS,
  type AiCatalogItem,
  type AiPricingConfidence,
} from '../src/lib/ai-vertical-catalog';

const APPLY = process.argv.includes('--apply');

interface ProviderRow {
  id: number;
  slug: string;
  name: string;
}

interface ModelRow {
  id: number;
  slug: string;
  name: string;
  provider_ids: number[] | null;
  model_category: string | null;
  input_modalities: string[] | null;
  output_modalities: string[] | null;
  capabilities: string[] | null;
  pricing_unit: string | null;
  description: string | null;
  offical_link: string | null;
  open_source: boolean | null;
}

const PRICING_UNIT_MAP: Record<AiPricingConfidence, string> = {
  verified: 'per_generation',
  'unit-only': 'unknown',
  unknown: 'unknown',
  'not-commercial': 'unknown',
};

function normalizeProviderSlug(item: AiCatalogItem): string {
  if (item.providerSlug) return item.providerSlug;
  return item.provider
    .toLowerCase()
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function officialLink(item: AiCatalogItem): string | undefined {
  return item.url ?? item.sourceUrls?.[0]?.url;
}

function description(item: AiCatalogItem): string {
  const sources = item.sourceUrls?.map((source) => `${source.publisher}: ${source.url}`).join(' | ');
  return [
    item.bestFor,
    `Status: ${item.status}. Pricing confidence: ${item.pricingConfidence}. Unit: ${item.pricingUnit}. Last verified: ${item.lastVerified}.`,
    item.notes,
    sources ? `Sources: ${sources}` : undefined,
  ].filter(Boolean).join('\n');
}

function sameStringArray(a: string[] | null | undefined, b: string[] | undefined): boolean {
  return JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());
}

function providerWebsite(item: AiCatalogItem): string | undefined {
  if (item.sourceUrls?.[0]?.url) {
    const parsed = new URL(item.sourceUrls[0].url);
    return `${parsed.protocol}//${parsed.hostname}`;
  }
  if (item.url) {
    const parsed = new URL(item.url);
    return `${parsed.protocol}//${parsed.hostname}`;
  }
  return undefined;
}

function providerRegion(slug: string): 'china' | 'global' {
  return ['qwen', 'minimax-china', 'volcengine'].includes(slug) ? 'china' : 'global';
}

function providerAccessFromChina(slug: string): boolean {
  return providerRegion(slug) === 'china';
}

async function loadProviders(): Promise<Map<string, ProviderRow>> {
  const { data, error } = await db.from('providers').select('id, slug, name');
  if (error) throw error;
  return new Map((data ?? []).map((provider: ProviderRow) => [provider.slug, provider]));
}

async function ensureProvider(
  providers: Map<string, ProviderRow>,
  item: AiCatalogItem,
): Promise<ProviderRow | null> {
  const slug = normalizeProviderSlug(item);
  const existing = providers.get(slug);
  if (existing) return existing;

  const payload = {
    slug,
    name: item.provider.replace(/\s*\/.*$/, ''),
    website: providerWebsite(item),
    pricing_url: item.sourceUrls?.find((source) => /pricing/i.test(source.label))?.url,
    api_docs_url: item.sourceUrls?.find((source) => /api|docs/i.test(source.label))?.url,
    description: `${item.provider} provider record created from audited ${item.kind} catalog.`,
    region: providerRegion(slug),
    type: 'official',
    access_from_china: providerAccessFromChina(slug),
    notes: `Seeded by seed-vertical-models from ${item.slug}; verify before attaching scraped prices.`,
  };

  console.log(`  🏷 create provider ${slug} (${payload.name})`);
  if (!APPLY) {
    const dryRunProvider = { id: -providers.size - 1, slug, name: payload.name };
    providers.set(slug, dryRunProvider);
    return dryRunProvider;
  }

  const { data, error } = await db.from('providers').insert(payload).select('id, slug, name').single();
  if (error) throw error;
  providers.set(slug, data as ProviderRow);
  return data as ProviderRow;
}

async function loadExistingModels(slugs: string[]): Promise<Map<string, ModelRow>> {
  if (slugs.length === 0) return new Map();
  const { data, error } = await db
    .from('models')
    .select('id, slug, name, provider_ids, model_category, input_modalities, output_modalities, capabilities, pricing_unit, description, offical_link, open_source')
    .in('slug', slugs);
  if (error) throw error;
  return new Map((data ?? []).map((model: ModelRow) => [model.slug, model]));
}

async function main() {
  const rows = AI_VERTICAL_CATALOG.filter((item) => RIGOROUS_MODEL_KINDS.includes(item.kind));
  const slugs = rows.map((item) => item.slug).filter(Boolean) as string[];
  const providers = await loadProviders();
  const existingModels = await loadExistingModels(slugs);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let missingProviders = 0;

  console.log(`\n🌱 seed-vertical-models ${APPLY ? '[APPLY]' : '[DRY-RUN]'} (${rows.length} audited rows)\n`);

  for (const item of rows) {
    const slug = item.slug!;
    const provider = await ensureProvider(providers, item);
    if (!provider) {
      console.log(`  ⚠ ${slug}: provider not available; skip`);
      missingProviders++;
      continue;
    }

    const existing = existingModels.get(slug);
    const payload = {
      name: item.name,
      slug,
      type: 'multimodal',
      model_category: item.modelCategory,
      provider_ids: [provider.id],
      description: description(item),
      offical_link: officialLink(item),
      input_type: item.inputModalities,
      output_type: item.outputModalities,
      input_modalities: item.inputModalities,
      output_modalities: item.outputModalities,
      capabilities: item.capabilities,
      pricing_unit: PRICING_UNIT_MAP[item.pricingConfidence ?? 'unknown'],
      open_source: item.access?.includes('open-weights') ?? false,
      updated_at: new Date().toISOString(),
    };

    if (!existing) {
      console.log(`  ➕ create ${slug} (${item.modelCategory}) → ${provider.slug}`);
      if (APPLY) {
        const { error } = await db.from('models').insert(payload);
        if (error) throw error;
      }
      created++;
      continue;
    }

    const needsUpdate =
      existing.name !== payload.name ||
      existing.model_category !== payload.model_category ||
      existing.pricing_unit !== payload.pricing_unit ||
      existing.offical_link !== payload.offical_link ||
      existing.open_source !== payload.open_source ||
      JSON.stringify(existing.provider_ids ?? []) !== JSON.stringify(payload.provider_ids) ||
      !sameStringArray(existing.input_modalities, payload.input_modalities) ||
      !sameStringArray(existing.output_modalities, payload.output_modalities) ||
      !sameStringArray(existing.capabilities, payload.capabilities) ||
      existing.description !== payload.description;

    if (!needsUpdate) {
      console.log(`  ✓ ${slug}: up to date`);
      skipped++;
      continue;
    }

    console.log(`  ↻ update ${slug} (${existing.model_category ?? '-'} → ${payload.model_category})`);
    if (APPLY) {
      const { error } = await db.from('models').update(payload).eq('id', existing.id);
      if (error) throw error;
    }
    updated++;
  }

  console.log('\n━━━ Summary ━━━');
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Missing providers: ${missingProviders}`);
  if (!APPLY) console.log('Dry-run only. Re-run with --apply or npm run seed:vertical-models to write.');

  if (missingProviders > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
