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
  id: number;
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

interface PlanRow {
  id: number;
  slug: string;
  provider_id: number | null;
  price: number | null;
  annual_price: number | null;
  currency: string | null;
  included_usage_unit: string | null;
  included_usage_amount: number | null;
  plan_kind: string | null;
  plan_category: string | null;
  source: string | null;
  last_verified: string | null;
  notes: string | null;
}

interface MappingRow {
  model_id: number | null;
  plan_id: number | null;
  source: string | null;
}

interface UsagePriceRow {
  model_id: number | null;
  provider_id: number | null;
  plan_id: number | null;
  price_kind: string;
  unit: string;
  source_url: string | null;
  is_available: boolean | null;
}

const CHECK_DB = process.argv.includes('--db');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const findings: Finding[] = [];

interface VerifiedCreativePlanExpectation {
  providerSlug: string;
  modelSlug: string;
  slug: string;
  price: number | null;
  annualPrice: number | null;
  currency: string;
  includedUsageUnit: string;
  includedUsageAmount: number | null;
  sourceUrl: string;
}

const VERIFIED_CREATIVE_PLAN_EXPECTATIONS: VerifiedCreativePlanExpectation[] = [
  { providerSlug: 'runway', modelSlug: 'runway-gen-4', slug: 'runway-free-verified', price: 0, annualPrice: null, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 125, sourceUrl: 'https://runwayml.com/pricing' },
  { providerSlug: 'runway', modelSlug: 'runway-gen-4', slug: 'runway-standard-yearly-verified', price: 12, annualPrice: 144, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 625, sourceUrl: 'https://runwayml.com/pricing' },
  { providerSlug: 'runway', modelSlug: 'runway-gen-4', slug: 'runway-pro-yearly-verified', price: 28, annualPrice: 336, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 2250, sourceUrl: 'https://runwayml.com/pricing' },
  { providerSlug: 'runway', modelSlug: 'runway-gen-4', slug: 'runway-max-yearly-verified', price: 76, annualPrice: 912, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 9500, sourceUrl: 'https://runwayml.com/pricing' },
  { providerSlug: 'pika', modelSlug: 'pika', slug: 'pika-free-yearly-verified', price: 0, annualPrice: null, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: null, sourceUrl: 'https://pika.art/pricing' },
  { providerSlug: 'pika', modelSlug: 'pika', slug: 'pika-basic-yearly-verified', price: 8, annualPrice: 96, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 80, sourceUrl: 'https://pika.art/pricing' },
  { providerSlug: 'pika', modelSlug: 'pika', slug: 'pika-standard-yearly-verified', price: 28, annualPrice: 336, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 700, sourceUrl: 'https://pika.art/pricing' },
  { providerSlug: 'pika', modelSlug: 'pika', slug: 'pika-pro-yearly-verified', price: 76, annualPrice: 912, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 2300, sourceUrl: 'https://pika.art/pricing' },
  { providerSlug: 'luma-ai', modelSlug: 'luma-ray', slug: 'luma-plus-monthly-verified', price: 30, annualPrice: null, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 10000, sourceUrl: 'https://lumalabs.ai/dream-machine' },
  { providerSlug: 'luma-ai', modelSlug: 'luma-ray', slug: 'luma-pro-monthly-verified', price: 90, annualPrice: null, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 40000, sourceUrl: 'https://lumalabs.ai/dream-machine' },
  { providerSlug: 'luma-ai', modelSlug: 'luma-ray', slug: 'luma-premier-monthly-verified', price: 300, annualPrice: null, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 150000, sourceUrl: 'https://lumalabs.ai/dream-machine' },
  { providerSlug: 'udio', modelSlug: 'udio', slug: 'udio-free-verified', price: 0, annualPrice: null, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 100, sourceUrl: 'https://www.udio.com/pricing' },
  { providerSlug: 'udio', modelSlug: 'udio', slug: 'udio-standard-yearly-verified', price: 8, annualPrice: 96, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 2400, sourceUrl: 'https://www.udio.com/pricing' },
  { providerSlug: 'udio', modelSlug: 'udio', slug: 'udio-pro-yearly-verified', price: 24, annualPrice: 288, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 6000, sourceUrl: 'https://www.udio.com/pricing' },
  { providerSlug: 'udio', modelSlug: 'udio', slug: 'udio-100-credit-pack-verified', price: 3, annualPrice: null, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 100, sourceUrl: 'https://www.udio.com/pricing' },
  { providerSlug: 'udio', modelSlug: 'udio', slug: 'udio-1000-credit-pack-verified', price: 25, annualPrice: null, currency: 'USD', includedUsageUnit: 'credit', includedUsageAmount: 1000, sourceUrl: 'https://www.udio.com/pricing' },
];

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

function pricingSourceUrl(item: AiCatalogItem): string | undefined {
  return item.sourceUrls?.find((source) => /pricing|api|docs|platform|model/i.test(source.label))?.url
    ?? item.sourceUrls?.[0]?.url
    ?? item.url;
}

function referencePlanSlug(item: AiCatalogItem): string {
  return `${item.slug}-official-pricing`;
}

function referenceUnit(item: AiCatalogItem): string {
  const text = `${item.pricingUnit ?? ''} ${item.unit ?? ''}`;
  if (/credit/i.test(text)) return 'credit';
  if (/generation|song/i.test(text)) return 'generation';
  if (/second/i.test(text)) return 'second';
  if (/minute|character/i.test(text)) return 'minute';
  if (/compute/i.test(text)) return 'compute_hour';
  if (/license|enterprise/i.test(text)) return 'license';
  return 'availability';
}

function referencePriceKind(item: AiCatalogItem): string {
  const unit = referenceUnit(item);
  if (unit === 'second') return 'video_second';
  return unit;
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

  const planSlugs = [...new Set([
    ...strictRows.map(referencePlanSlug),
    ...VERIFIED_CREATIVE_PLAN_EXPECTATIONS.map((plan) => plan.slug),
  ])];
  const [{ data: modelRows, error: modelError }, { data: providerRows, error: providerError }, { data: planRows, error: planError }] = await Promise.all([
    db.from('models')
      .select('id, slug, name, provider_ids, model_category, input_modalities, output_modalities, capabilities, pricing_unit, offical_link, open_source')
      .in('slug', slugs),
    db.from('providers').select('id, slug'),
    db.from('plans').select('id, slug, provider_id, price, annual_price, currency, included_usage_unit, included_usage_amount, plan_kind, plan_category, source, last_verified, notes').in('slug', planSlugs),
  ]);

  if (modelError) throw new Error(`models query failed: ${modelError.message}`);
  if (providerError) throw new Error(`providers query failed: ${providerError.message}`);
  if (planError) throw new Error(`plans query failed: ${planError.message}`);

  const modelBySlug = new Map((modelRows ?? []).map((model: DbModelRow) => [model.slug, model]));
  const providerBySlug = new Map((providerRows ?? []).map((provider: ProviderRow) => [provider.slug, provider]));
  const planBySlug = new Map((planRows ?? []).map((plan: PlanRow) => [plan.slug, plan]));
  const modelIds = (modelRows ?? []).map((model: DbModelRow) => model.id);
  const planIds = (planRows ?? []).map((plan: PlanRow) => plan.id);

  const [{ data: mappingRows, error: mappingError }, { data: usageRows, error: usageError }] = await Promise.all([
    modelIds.length > 0 && planIds.length > 0
      ? db.from('model_plan_mapping').select('model_id, plan_id, source').in('model_id', modelIds)
      : Promise.resolve({ data: [], error: null }),
    modelIds.length > 0
      ? db.from('usage_prices').select('model_id, provider_id, plan_id, price_kind, unit, source_url, is_available').in('model_id', modelIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (mappingError) throw new Error(`model_plan_mapping query failed: ${mappingError.message}`);
  if (usageError) throw new Error(`usage_prices query failed: ${usageError.message}`);

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

    const referencePlan = planBySlug.get(referencePlanSlug(item));
    if (!referencePlan) {
      critical(item, `DB drift: missing official pricing reference plan ${referencePlanSlug(item)}`);
    } else {
      if (expectedProvider && referencePlan.provider_id !== expectedProvider.id) {
        critical(item, `DB drift: pricing reference plan provider_id ${referencePlan.provider_id} != ${expectedProvider.id}`);
      }
      if (referencePlan.plan_kind !== 'creative') critical(item, `DB drift: reference plan_kind ${referencePlan.plan_kind} != creative`);
      if (referencePlan.plan_category !== 'creative') critical(item, `DB drift: reference plan_category ${referencePlan.plan_category} != creative`);
      if (referencePlan.source !== 'manual') critical(item, `DB drift: reference plan source ${referencePlan.source} != manual`);

      const hasMapping = (mappingRows ?? []).some((mapping: MappingRow) =>
        mapping.model_id === model.id && mapping.plan_id === referencePlan.id && mapping.source === 'manual'
      );
      if (!hasMapping) critical(item, `DB drift: missing manual mapping to ${referencePlanSlug(item)}`);
    }

    const usage = (usageRows ?? []).filter((row: UsagePriceRow) => row.model_id === model.id);
    const expectedSource = pricingSourceUrl(item);
    const expectedProviderId = expectedProvider?.id;
    const expectedPlanId = referencePlan?.id;
    const hasUsageReference = usage.some((row) =>
      row.provider_id === expectedProviderId &&
      (expectedPlanId == null || row.plan_id === expectedPlanId) &&
      row.price_kind === referencePriceKind(item) &&
      row.unit === referenceUnit(item) &&
      row.source_url === expectedSource &&
      row.is_available !== false
    );
    if (!hasUsageReference) {
      critical(item, `DB drift: missing usage_prices reference ${referencePriceKind(item)}/${referenceUnit(item)} from ${expectedSource}`);
    }
  }

  for (const expected of VERIFIED_CREATIVE_PLAN_EXPECTATIONS) {
    const catalogItem = strictRows.find((item) => item.slug === expected.modelSlug);
    if (!catalogItem) continue;
    const model = modelBySlug.get(expected.modelSlug);
    const provider = providerBySlug.get(expected.providerSlug);
    const plan = planBySlug.get(expected.slug);

    if (!model) {
      critical(catalogItem, `DB drift: cannot verify ${expected.slug}; missing model ${expected.modelSlug}`);
      continue;
    }
    if (!provider) {
      critical(catalogItem, `DB drift: cannot verify ${expected.slug}; missing provider ${expected.providerSlug}`);
      continue;
    }
    if (!plan) {
      critical(catalogItem, `DB drift: missing verified creative plan ${expected.slug}; run npm run seed:verified-creative-plans`);
      continue;
    }

    if (plan.provider_id !== provider.id) critical(catalogItem, `DB drift: ${expected.slug} provider_id ${plan.provider_id} != ${provider.id}`);
    if (plan.price !== expected.price) critical(catalogItem, `DB drift: ${expected.slug} price ${plan.price} != ${expected.price}`);
    if (plan.annual_price !== expected.annualPrice) critical(catalogItem, `DB drift: ${expected.slug} annual_price ${plan.annual_price} != ${expected.annualPrice}`);
    if (plan.currency !== expected.currency) critical(catalogItem, `DB drift: ${expected.slug} currency ${plan.currency} != ${expected.currency}`);
    if (plan.included_usage_unit !== expected.includedUsageUnit) critical(catalogItem, `DB drift: ${expected.slug} included_usage_unit ${plan.included_usage_unit} != ${expected.includedUsageUnit}`);
    if (plan.included_usage_amount !== expected.includedUsageAmount) critical(catalogItem, `DB drift: ${expected.slug} included_usage_amount ${plan.included_usage_amount} != ${expected.includedUsageAmount}`);
    if (plan.plan_kind !== 'creative') critical(catalogItem, `DB drift: ${expected.slug} plan_kind ${plan.plan_kind} != creative`);
    if (plan.plan_category !== 'creative') critical(catalogItem, `DB drift: ${expected.slug} plan_category ${plan.plan_category} != creative`);
    if (plan.source !== 'manual') critical(catalogItem, `DB drift: ${expected.slug} source ${plan.source} != manual`);
    if (!plan.last_verified) critical(catalogItem, `DB drift: ${expected.slug} missing last_verified`);
    if (!plan.notes?.includes(`Source: ${expected.sourceUrl}`)) critical(catalogItem, `DB drift: ${expected.slug} notes missing Source: ${expected.sourceUrl}`);

    const hasMapping = (mappingRows ?? []).some((mapping: MappingRow) =>
      mapping.model_id === model.id && mapping.plan_id === plan.id && mapping.source === 'manual'
    );
    if (!hasMapping) critical(catalogItem, `DB drift: missing manual mapping to verified creative plan ${expected.slug}`);
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
