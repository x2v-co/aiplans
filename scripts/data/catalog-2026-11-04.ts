import type { Sql } from 'postgres';
import { CATALOG_1104, MUREKA_1104, SOURCES_1104 } from '../../src/lib/catalog-2026-11-04';
import { verticalModelDescription } from './catalog-audit-vertical';
import { seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';

/** Optional manual seed; never part of rollout. Caller owns a serializable transaction
 * (READ ONLY for preview). Build and validate the entire diff before issuing any writes.
 * Exact identities only, no deletes, numeric-string-aware diffs (#300), no freshness rollback.
 * Facts and source URLs were supplied by the reviewer, verified 2026-11-04.
 */
export const VERIFIED = '2026-11-04';
export const VERIFIED_AT = new Date('2026-11-04T00:00:00Z');
export const SCRAPER_FRESH_CUTOFF = new Date('2026-11-04T00:00:00+08:00');
export const CREDIT_SOURCE = 'https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions';
export const GO_SOURCE = 'https://platform.openai.com/docs/supported-countries';
export const GO_AVAILABILITY_SOURCE = 'https://help.openai.com/en/articles/11989085';
export const PLUS_SOURCE = 'https://gemini.google/us/subscriptions/?hl=en';
export const QODER_SOURCE = 'https://www.alibabacloud.com/blog/introducing-qoder-lite-start-creating-with-qoder-for-%2410-a-month_603718';
export const LONGCAT_SOURCE = 'https://longcat.chat/platform/docs/zh/pricing/longcat-2.5';
export const PLAN_CREDITS = [
  ['chatgpt-pro-100', 100], ['chatgpt-pro-200', 200], ['chatgpt-pro-500', 500],
  ['chatgpt-business', 20], ['chatgpt-business-premium', 100],
] as const;
export const QODER_PLANS = [
  { slug: 'qoder-lite', name: 'Qoder Lite', price: 10, credits: 1000, tier: 'basic', note: 'Curated cost-effective models. First Lite purchase double credits; +500 credits per Lite renewal.' },
  { slug: 'qoder-pro', name: 'Qoder Pro', price: 20, credits: 2000, tier: 'pro', note: 'All models.' },
] as const;
export const CATALOG_ITEMS = [...CATALOG_1104, MUREKA_1104];
export const PLAN_SLUGS = ['chatgpt-go', 'google-ai-plus', ...PLAN_CREDITS.map(([s]) => s), ...QODER_PLANS.map(s => s.slug)];
export const MODEL_SLUGS = [...CATALOG_ITEMS.map(i => i.slug!), 'gpt-6.1-terra', 'meituan-longcat-2-5', 'embedding-2-preview', 'gemini-embedding-2-preview', 'gemini-embedding-001'];

export function catalog20261104SeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-04.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}
type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'plans' | 'models' | 'usage_prices' | 'api_channel_prices' | 'api_channel_price_variants';
export interface Step { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

/** Preserve scraper-owned notes and verification timestamps on same-day/newer rows (#301). */
export function keepFresher(existing: Row | null, values: Record<string, unknown>) {
  const value = existing?.last_verified;
  if (value == null || new Date(value instanceof Date ? value : String(value)).getTime() < SCRAPER_FRESH_CUTOFF.getTime()
    || Number.isNaN(new Date(String(value)).getTime())) return values;
  const rest = { ...values };
  delete rest.last_verified;
  delete rest.notes;
  return rest;
}
/** Never regress an existing row: keep its capabilities and add any new ones (an empty catalog list adds nothing). */
export function modelCapabilities(existing: Row | null, wanted: readonly string[] | undefined) {
  const current = Array.isArray(existing?.capabilities) ? existing.capabilities as string[] : [];
  const merged = [...new Set([...current, ...(wanted ?? [])])];
  return existing && merged.length === current.length ? {} : { capabilities: merged };
}
const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim() !== '';
const evidence = (note: string, source: string) => `${note} Verified ${VERIFIED}. Source: ${source}`;
function appendEvidence(existing: unknown, note: string) {
  const previous = String(existing ?? '');
  return previous.includes(note) ? previous : [previous, note].filter(Boolean).join('\n');
}

export async function seedCatalog20261104(tx: Sql, apply = false): Promise<Step[]> {
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) throw new Error(`Ambiguous or missing ${target}; nothing written.`);
    return rows[0] ?? null;
  };
  const providerSlugs = ['openai', 'google', 'xai', 'meituan', 'elevenlabs', 'mureka', 'sarvam', 'qoder'];
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(providerSlugs)}`;
  const owners = new Map(providerSlugs.map(slug => [slug, one(providers.filter(r => r.slug === slug), `providers/${slug}`, ['openai', 'google', 'xai', 'meituan'].includes(slug))]));
  for (const [slug, owner] of owners) if (owner && !['official', 'producer'].includes(String(owner.type))) throw new Error(`Unexpected providers/${slug} type; nothing written.`);
  const plans = await tx<Row[]>`SELECT * FROM plans WHERE slug IN ${tx(PLAN_SLUGS)}`;
  const byPlan = new Map(PLAN_SLUGS.map(slug => [slug, one(plans.filter(r => r.slug === slug), `plans/${slug}`, !slug.startsWith('qoder-'))]));
  for (const [slug, plan] of byPlan) {
    const owner = owners.get(slug.startsWith('qoder-') ? 'qoder' : slug === 'google-ai-plus' ? 'google' : 'openai');
    if (plan && (!owner || [plan.provider_id, plan.product_id].some(id => id != null && id !== owner.id))) throw new Error(`Wrong plans/${slug} ownership; nothing written.`);
  }
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(MODEL_SLUGS)}`;
  const byModel = new Map(MODEL_SLUGS.map(slug => [slug, one(models.filter(r => r.slug === slug), `models/${slug}`, ['gpt-6.1-terra', 'meituan-longcat-2-5'].includes(slug))]));
  if (byModel.get('embedding-2-preview') && byModel.get('gemini-embedding-2-preview')) throw new Error('Both preview aliases exist; review before seeding. Nothing written.');

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
  // Missing providers: only identity and sourced metadata; no invented regional access.
  const names: Record<string, string> = { elevenlabs: 'ElevenLabs', mureka: 'Mureka', sarvam: 'Sarvam AI', qoder: 'Qoder' };
  const sources: Record<string, string> = { elevenlabs: SOURCES_1104.elevenlabs, mureka: SOURCES_1104.mureka, sarvam: SOURCES_1104.sarvam, qoder: QODER_SOURCE };
  for (const [slug, owner] of owners) if (!owner) owners.set(slug, save('providers', null, {
    slug, name: names[slug], type: 'official', website: sources[slug], pricing_url: sources[slug], access_from_china: null,
    notes: evidence('Provider identity.', sources[slug]),
  }, slug));
  const openai = owners.get('openai')!;
  const go = byPlan.get('chatgpt-go')!;
  save('plans', go, {
    access_from_china: false, last_verified: VERIFIED_AT,
    notes: appendEvidence(go.notes, evidence(`China is not listed; Go is available in all countries ChatGPT supports. Price not verified in this audit. ${GO_AVAILABILITY_SOURCE}`, GO_SOURCE)),
  }, 'chatgpt-go');
  for (const [slug, credit] of PLAN_CREDITS) {
    const plan = byPlan.get(slug)!;
    const note = slug.includes('business') ? `$${credit} API credit per paid seat, pooled per workspace, capped at $500/month; annual prepaid cap $6,000.` : `$${credit} monthly API credit.`;
    save('plans', plan, { monthly_api_credit_usd: credit, monthly_api_credit_status: 'verified', last_verified: VERIFIED_AT,
      notes: appendEvidence(plan.notes, evidence(note, CREDIT_SOURCE)) }, slug);
  }
  const plus = byPlan.get('google-ai-plus')!;
  save('plans', plus, { price: 4.99, currency: 'USD', price_unit: 'per_month', last_verified: VERIFIED_AT,
    notes: appendEvidence(plus.notes, evidence('US monthly price $4.99.', PLUS_SOURCE)) }, 'google-ai-plus');
  for (const spec of QODER_PLANS) {
    const owner = owners.get('qoder')!;
    save('plans', byPlan.get(spec.slug)!, {
      slug: spec.slug, name: spec.name, provider_id: owner.id, product_id: owner.id,
      price: spec.price, currency: 'USD', price_unit: 'per_month', pricing_model: 'subscription',
      plan_kind: 'coding', plan_category: 'coding', plan_line: 'qoder', tier: spec.tier,
      source: 'manual', is_official: true, quota_unit: 'credits', included_credits: spec.credits,
      included_usage_unit: 'credit', included_usage_amount: spec.credits, last_verified: VERIFIED_AT,
      notes: evidence(`International plan: ${spec.credits.toLocaleString('en-US')} Credits/month. ${spec.note}`, QODER_SOURCE),
    }, spec.slug);
  }

  for (const item of CATALOG_ITEMS) {
    const owner = owners.get(item.providerSlug!)!;
    const old = byModel.get(item.slug!) ?? null;
    const model = save('models', old, {
      // Existing rows keep their legacy type (e.g. 'video', 'multimodal'); only new rows get 'llm'.
      slug: item.slug, name: item.name, ...(old?.type ? {} : { type: 'llm' }), model_category: item.modelCategory,
      provider_ids: [...new Set([...((old?.provider_ids as number[] | undefined) ?? []), owner.id])],
      ...(item.inputModalities ? { input_type: item.inputModalities, input_modalities: item.inputModalities } : {}),
      ...(item.outputModalities ? { output_type: item.outputModalities, output_modalities: item.outputModalities } : {}),
      ...modelCapabilities(old, item.capabilities), pricing_unit: item.pricingUnit,
      ...(nonEmpty(old?.offical_link) ? {} : { offical_link: item.url }),
      // Append to an existing description (e.g. Arena leaderboard evidence) instead of replacing it.
      description: nonEmpty(old?.description) ? appendEvidence(old!.description, verticalModelDescription(item)) : verticalModelDescription(item),
      ...(item.releasedAt ? { released_at: new Date(`${item.releasedAt}T00:00:00Z`) } : {}),
      ...(item.shutdownDate ? { shutdown_date: item.shutdownDate, replacement_model: item.replacementModel, deprecation_source_url: item.deprecationSourceUrl } : {}),
    }, item.slug!);
    const usage = old && owner.id > 0 ? await tx<Row[]>`SELECT * FROM usage_prices WHERE model_id = ${old.id} AND provider_id = ${owner.id}` : [];
    for (const rate of item.usageRates ?? []) {
      // Respect an existing official-pricing plan identity (as #301 does), otherwise plan-less.
      const matches = usage.filter(r => r.price_kind === rate.priceKind && r.unit === rate.unit);
      const existing = one(matches, `usage_prices/${item.slug}/${rate.priceKind}`);
      save('usage_prices', existing, retainLockedUnavailable({
        model_id: model.id, provider_id: owner.id, plan_id: existing?.plan_id ?? null,
        price_kind: rate.priceKind, unit: rate.unit, price: rate.price, currency: item.currency,
        source_url: item.sourceUrls![0].url, last_verified: VERIFIED_AT, is_available: !item.shutdownDate,
        constraints_json: { publishedPricingText: item.pricing, note: item.notes ?? null,
          ...(rate.approximate ? { approximate: true } : {}),
          ...(rate.validFrom ? { valid_from: rate.validFrom } : {}), ...(rate.validThrough ? { valid_through: rate.validThrough } : {}) },
      }, existing), `${item.slug}/${rate.priceKind}`);
    }
    // Sarvam Prism's official ₹4/1M channel price is NOT written: api_channel_prices.currency is limited
    // to USD/CNY/EUR/GBP/JPY/KRW/SGD (channel_prices_currency_check) and the app's CurrencyCode/FX has no INR.
    // The native INR price stays in the static catalog and the model description until INR is supported end to end.
  }

  const terra = byModel.get('gpt-6.1-terra')!;
  const terraChannels = await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${terra.id} AND provider_id = ${openai.id}`;
  const terraChannel = one(terraChannels, 'gpt-6.1-terra/openai', true)!;
  save('api_channel_prices', terraChannel, { input_price_per_1m: 1, output_price_per_1m: 5, cached_input_price_per_1m: 0.05,
    currency: 'USD', price_unit: 'per_1m_tokens', last_verified: VERIFIED_AT,
    notes: appendEvidence(terraChannel.notes, evidence('Short context ≤272K input tokens; long context >272K has separate variants.', SOURCES_1104.openai)) }, 'gpt-6.1-terra/openai');
  const variants = await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${terra.id} AND provider_id = ${openai.id}`;
  const tiers = [
    { key: 'standard', name: 'Short context (≤272K input tokens)', input: 1, output: 5, cached: 0.05, headline: true, constraints: { max_input_tokens: 272000 } },
    { key: 'long-context', name: 'Long context (>272K input tokens)', input: 2, output: 7.5, cached: 0.1, headline: false, constraints: { min_input_tokens_exclusive: 272000 } },
  ];
  if (variants.some(v => v.is_headline === true && v.variant_key !== 'standard')) throw new Error('Terra already has another headline; review before seeding. Nothing written.');
  for (const tier of tiers) {
    const current = one(variants.filter(v => v.variant_key === tier.key), `terra/${tier.key}`);
    save('api_channel_price_variants', current, retainLockedUnavailable({
      model_id: terra.id, provider_id: openai.id, variant_key: tier.key, variant_name: tier.name, variant_kind: 'tier',
      input_price_per_1m: tier.input, output_price_per_1m: tier.output, cached_input_price_per_1m: tier.cached,
      currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
      is_public: true, is_self_service: true, is_partner_only: false, is_headline: tier.headline, headline_rank: tier.headline ? 0 : 1,
      headline_reason: tier.headline ? 'Official short-context list price.' : null,
      constraints_json: tier.constraints, source_url: SOURCES_1104.openai, last_verified: VERIFIED_AT,
      notes: evidence(tier.name, SOURCES_1104.openai),
    }, current), `gpt-6.1-terra/openai/${tier.key}`);
  }
  // Models do not have an access_from_china column: the UI reads the official channel's provider.
  const meituan = owners.get('meituan')!;
  save('providers', meituan, { access_from_china: true, pricing_url: LONGCAT_SOURCE,
    notes: appendEvidence(meituan.notes, evidence('China platform; LongCat-2.5 CNY input ¥2/output ¥8/cache ¥0.04 per 1M tokens.', LONGCAT_SOURCE)) }, 'meituan');
  const longcat = byModel.get('meituan-longcat-2-5')!;
  if (!((longcat.provider_ids as number[] | undefined) ?? []).includes(meituan.id)) throw new Error('LongCat is not owned by Meituan; nothing written.');
  save('models', longcat, { description: appendEvidence(longcat.description, evidence('Official Meituan China platform; access from China available.', LONGCAT_SOURCE)) }, 'meituan-longcat-2-5');
  const preview = byModel.get('gemini-embedding-2-preview') ?? byModel.get('embedding-2-preview');
  if (preview) save('models', preview, { shutdown_date: '2026-08-10', replacement_model: 'gemini-embedding-2', deprecation_source_url: SOURCES_1104.deprecations,
    description: appendEvidence(preview.description, evidence('DEPRECATED gemini-embedding-2-preview (formerly embedding-2-preview); shut down 2026-08-10; replacement gemini-embedding-2.', SOURCES_1104.deprecations)) }, String(preview.slug));
  const embedding001 = byModel.get('gemini-embedding-001');
  if (embedding001) save('models', embedding001, { shutdown_date: '2028-05-14', deprecation_source_url: SOURCES_1104.deprecations,
    description: appendEvidence(embedding001.description, evidence('Shutdown 2028-05-14.', SOURCES_1104.deprecations)) }, 'gemini-embedding-001');

  // No writes until every identity and rate above has passed validation.
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
