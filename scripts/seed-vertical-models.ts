#!/usr/bin/env tsx
/**
 * Materialize the audited Video / Music / World / Decision catalog into models.
 *
 * This is deliberately narrower than a scraper:
 * - source of truth for public product identity is src/lib/ai-vertical-catalog.ts;
 * - exact numeric prices still belong in plans / usage_prices after source-specific parsing;
 * - this script only seeds model taxonomy, modalities, capabilities and official links.
 *
 * Usage:
 *   npm run seed:vertical-models -- --slug omnihuman-2-0            # dry-run (default), field diff
 *   npm run seed:vertical-models -- --slug omnihuman-2-0 --apply    # write changed rows only
 */
import { db } from './db/queries';
import {
  AI_VERTICAL_CATALOG,
  RIGOROUS_MODEL_KINDS,
  type AiCatalogItem,
  type AiPricingConfidence,
} from '../src/lib/ai-vertical-catalog';
import { auditVerticalModelFields, isAuditOwnedVertical, verticalModelDescription } from './data/catalog-audit-vertical';
import { diffRow, formatChanges, parseSeedArgs } from './utils/seed-diff';

const ARGS = parseSeedArgs(process.argv);
const APPLY = ARGS.apply;

interface ProviderRow {
  id: number;
  slug: string;
  name: string;
}

interface ModelRow {
  id: number;
  slug: string;
  name: string;
  type: string | null;
  context_window: number | null;
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

function sameStringArray(a: string[] | null | undefined, b: string[] | undefined): boolean {
  return JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());
}

function dateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : String(value);
}

/** Only columns the catalog actually states. A missing date must not clear a stored one. */
function lifecycleFields(item: AiCatalogItem): Record<string, string> {
  const fields: Record<string, string> = {};
  if (item.shutdownDate) fields.shutdown_date = item.shutdownDate;
  if (item.deprecatedAt) fields.deprecated_at = item.deprecatedAt;
  if (item.replacementModel) fields.replacement_model = item.replacementModel;
  if (item.deprecationSourceUrl) fields.deprecation_source_url = item.deprecationSourceUrl;
  return fields;
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
    .select('*')
    .in('slug', slugs);
  if (error) throw error;
  return new Map((data ?? []).map((model: ModelRow) => [model.slug, model]));
}

async function main() {
  const eligible = AI_VERTICAL_CATALOG.filter((item) => RIGOROUS_MODEL_KINDS.includes(item.kind) && !item.deferredDbSeed);
  const rows = ARGS.slugs ? eligible.filter((item) => ARGS.slugs!.has(item.slug!)) : eligible;
  if (ARGS.slugs) {
    const unknown = [...ARGS.slugs].filter((slug) => !rows.some((item) => item.slug === slug));
    if (unknown.length) {
      console.error(`Unknown or non-seedable --slug: ${unknown.join(', ')}`);
      process.exitCode = 1;
      return;
    }
  }
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
    // Video / music / decision rows are owned by the catalog audit; use its exact fields
    // so every deploy no longer reverts pricing_unit / model_category.
    const owned = isAuditOwnedVertical(item) ? auditVerticalModelFields(item) : null;
    const payload = {
      name: item.name,
      slug,
      // A catalog entry can share its slug with an existing token API model.
      type: existing?.type ?? (item.kind === 'decision-model' ? 'llm' : 'multimodal'),
      ...(item.contextWindow != null ? { context_window: item.contextWindow } : {}),
      model_category: owned?.model_category ?? item.modelCategory,
      provider_ids: [...new Set([...(existing?.provider_ids ?? []), provider.id])],
      description: verticalModelDescription(item),
      offical_link: officialLink(item),
      input_type: item.inputModalities,
      output_type: item.outputModalities,
      input_modalities: item.inputModalities,
      output_modalities: item.outputModalities,
      capabilities: item.capabilities,
      pricing_unit: owned?.pricing_unit ?? PRICING_UNIT_MAP[item.pricingConfidence ?? 'unknown'],
      open_source: item.access?.includes('open-weights') ?? false,
      ...lifecycleFields(item),
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

    // Order of modality/capability arrays is not meaningful; keep the stored order.
    const row = existing as unknown as Record<string, unknown>;
    for (const key of ['input_type', 'output_type', 'input_modalities', 'output_modalities', 'capabilities'] as const) {
      if (sameStringArray(row[key] as string[] | null, (payload as Record<string, unknown>)[key] as string[] | undefined)) {
        (payload as Record<string, unknown>)[key] = row[key];
      }
    }
    const comparable = {
      ...row,
      shutdown_date: dateOnly(row.shutdown_date),
      deprecated_at: dateOnly(row.deprecated_at),
    };
    const { changes, patch } = diffRow(comparable, payload);
    if (changes.length === 0) {
      console.log(`  ✓ ${slug}: up to date`);
      skipped++;
      continue;
    }

    console.log(`  ↻ update ${slug} (id ${existing.id})\n${formatChanges(changes, '    ')}`);
    if (APPLY) {
      const { error } = await db.from('models').update({ ...patch, updated_at: payload.updated_at }).eq('id', existing.id);
      if (error) throw error;
    }
    updated++;
  }

  console.log('\n━━━ Summary ━━━');
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Missing providers: ${missingProviders}`);
  if (!APPLY) console.log('Dry-run only. Re-run with --apply to write the rows listed above.');

  if (missingProviders > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
