import {
  AI_VERTICAL_CATALOG,
  RIGOROUS_MODEL_KINDS,
  type AiCatalogItem,
  type AiPricingConfidence,
} from '../src/lib/ai-vertical-catalog';

interface Finding {
  level: 'critical' | 'warning';
  row: string;
  message: string;
}

interface DbModelRow {
  slug: string;
  name: string;
  provider_ids: number[] | null;
  model_category: string | null;
  input_modalities: string[] | null;
  output_modalities: string[] | null;
  capabilities: string[] | null;
  pricing_unit: string | null;
  offical_link: string | null;
  open_source: boolean | null;
}

interface ProviderRow {
  id: number;
  slug: string;
}

const CHECK_DB = process.argv.includes('--db');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const findings: Finding[] = [];

const PRICING_UNIT_MAP: Record<AiPricingConfidence, string> = {
  verified: 'per_generation',
  'unit-only': 'unknown',
  unknown: 'unknown',
  'not-commercial': 'unknown',
};

function rowId(item: AiCatalogItem): string {
  return `${item.kind}:${item.slug ?? item.provider + '/' + item.name}`;
}

function critical(item: AiCatalogItem, message: string) {
  findings.push({ level: 'critical', row: rowId(item), message });
}

function warning(item: AiCatalogItem, message: string) {
  findings.push({ level: 'warning', row: rowId(item), message });
}

function requireNonEmpty(item: AiCatalogItem, field: keyof AiCatalogItem) {
  const value = item[field];
  if (typeof value === 'string' && value.trim().length > 0) return;
  if (Array.isArray(value) && value.length > 0) return;
  critical(item, `missing ${String(field)}`);
}

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

function sameStringArray(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  return JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());
}

function auditStaticCatalog() {
  const seenSlugs = new Map<string, string>();

  for (const item of AI_VERTICAL_CATALOG) {
    if (item.slug) {
      const previous = seenSlugs.get(item.slug);
      if (previous) {
        critical(item, `duplicate slug also used by ${previous}`);
      }
      seenSlugs.set(item.slug, rowId(item));
    }

    if (!RIGOROUS_MODEL_KINDS.includes(item.kind)) continue;

    requireNonEmpty(item, 'slug');
    requireNonEmpty(item, 'modelCategory');
    requireNonEmpty(item, 'inputModalities');
    requireNonEmpty(item, 'outputModalities');
    requireNonEmpty(item, 'access');
    requireNonEmpty(item, 'pricingUnit');
    requireNonEmpty(item, 'pricingConfidence');
    requireNonEmpty(item, 'sourceUrls');
    requireNonEmpty(item, 'lastVerified');

    if (item.kind === 'video-model' && item.modelCategory !== 'video') {
      critical(item, `video-model must have modelCategory=video, got ${item.modelCategory}`);
    }
    if (item.kind === 'music-model' && item.modelCategory !== 'music') {
      critical(item, `music-model must have modelCategory=music, got ${item.modelCategory}`);
    }
    if (item.kind === 'world-model' && item.modelCategory !== 'world') {
      critical(item, `world-model must have modelCategory=world, got ${item.modelCategory}`);
    }

    if (item.lastVerified && !ISO_DATE.test(item.lastVerified)) {
      critical(item, `lastVerified must be YYYY-MM-DD, got ${item.lastVerified}`);
    }

    if (item.sourceUrls) {
      if (item.sourceUrls.length < 1) {
        critical(item, 'sourceUrls must include at least one official source');
      }
      for (const source of item.sourceUrls) {
        if (!source.publisher?.trim()) critical(item, `source ${source.url} missing publisher`);
        if (!source.label?.trim()) critical(item, `source ${source.url} missing label`);
        if (!/^https:\/\//.test(source.url)) critical(item, `source URL must be https: ${source.url}`);
      }
    }

    if (item.pricingConfidence === 'verified') {
      warning(item, 'pricingConfidence=verified should only be used after numeric prices are in usage_prices or plan rows');
    }

    if (item.status === 'research' && item.pricingConfidence !== 'not-commercial' && item.pricingConfidence !== 'unknown') {
      warning(item, `research item should usually be not-commercial/unknown, got ${item.pricingConfidence}`);
    }
  }
}

async function auditDatabaseDrift() {
  const { db } = await import('./db/queries');
  const strictRows = AI_VERTICAL_CATALOG.filter((item) => RIGOROUS_MODEL_KINDS.includes(item.kind));
  const slugs = strictRows.map((item) => item.slug).filter(Boolean) as string[];

  const [{ data: modelRows, error: modelError }, { data: providerRows, error: providerError }] = await Promise.all([
    db.from('models')
      .select('slug, name, provider_ids, model_category, input_modalities, output_modalities, capabilities, pricing_unit, offical_link, open_source')
      .in('slug', slugs),
    db.from('providers').select('id, slug'),
  ]);

  if (modelError) throw new Error(`models query failed: ${modelError.message}`);
  if (providerError) throw new Error(`providers query failed: ${providerError.message}`);

  const modelBySlug = new Map((modelRows ?? []).map((model: DbModelRow) => [model.slug, model]));
  const providerBySlug = new Map((providerRows ?? []).map((provider: ProviderRow) => [provider.slug, provider]));

  for (const item of strictRows) {
    const model = modelBySlug.get(item.slug!);
    if (!model) {
      critical(item, 'DB drift: missing models row; run npm run seed:vertical-models');
      continue;
    }

    if (model.name !== item.name) critical(item, `DB drift: name ${model.name} != ${item.name}`);
    if (model.model_category !== item.modelCategory) critical(item, `DB drift: model_category ${model.model_category} != ${item.modelCategory}`);
    if (!sameStringArray(model.input_modalities, item.inputModalities)) critical(item, 'DB drift: input_modalities mismatch');
    if (!sameStringArray(model.output_modalities, item.outputModalities)) critical(item, 'DB drift: output_modalities mismatch');
    if (!sameStringArray(model.capabilities, item.capabilities)) critical(item, 'DB drift: capabilities mismatch');
    if (model.pricing_unit !== PRICING_UNIT_MAP[item.pricingConfidence ?? 'unknown']) critical(item, `DB drift: pricing_unit ${model.pricing_unit} != ${PRICING_UNIT_MAP[item.pricingConfidence ?? 'unknown']}`);
    if (model.offical_link !== officialLink(item)) critical(item, `DB drift: offical_link ${model.offical_link} != ${officialLink(item)}`);
    if ((model.open_source ?? false) !== (item.access?.includes('open-weights') ?? false)) critical(item, 'DB drift: open_source mismatch');

    const expectedProvider = providerBySlug.get(normalizeProviderSlug(item));
    if (!expectedProvider) {
      critical(item, `DB drift: provider ${normalizeProviderSlug(item)} missing`);
    } else if (!(model.provider_ids ?? []).includes(expectedProvider.id)) {
      critical(item, `DB drift: provider_ids missing ${normalizeProviderSlug(item)}#${expectedProvider.id}`);
    }
  }
}

async function main() {
  auditStaticCatalog();

  if (CHECK_DB) {
    await auditDatabaseDrift();
  }

  const criticalCount = findings.filter((finding) => finding.level === 'critical').length;
  const warningCount = findings.filter((finding) => finding.level === 'warning').length;

  if (findings.length === 0) {
    console.log(`vertical-catalog audit passed: ${AI_VERTICAL_CATALOG.length} rows, ${RIGOROUS_MODEL_KINDS.join(', ')} strict${CHECK_DB ? ' + DB drift' : ''}`);
    return;
  }

  for (const finding of findings) {
    const prefix = finding.level === 'critical' ? 'CRITICAL' : 'WARNING';
    console.log(`${prefix} ${finding.row}: ${finding.message}`);
  }

  console.log(`vertical-catalog audit finished: ${criticalCount} critical, ${warningCount} warnings`);
  process.exitCode = criticalCount > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
