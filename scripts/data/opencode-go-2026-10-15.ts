import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

// Only the OpenCode Go section of /workspace/aiplans-gaps-facts.md supplies facts.
export const GO_SOURCE = 'https://opencode.ai/docs/go/';
const VERIFIED_AT = new Date('2026-10-15T00:00:00Z');
const WINDOWS = 'Monthly USD limits are separate per model: 5-hour = 20%, weekly = 50%, monthly = 100% of that model\'s monthly limit. Single-member workspaces only. Token prices are identical on Go and Go Plus.';
const GOOGLE_TERMS = 'Prompts and outputs may train future Google models in exchange for the temporarily doubled quota; not ZDR. Go monthly quota $30 -> $60; Go Plus $120 -> $240 (limited time). [needs-verification] Promotion end date.';
const META_TERMS = 'Heavily discounted in exchange for Meta training on prompts and outputs. Limited regions; [needs-verification] exact region list.';

type Rate = readonly [input: number, output: number, cached: number];
interface GoModel {
  slugs: string[];
  name: string;
  rate: Rate;
  peak?: Rate;
  limits: readonly [go: number, plus: number];
  dataTerms?: string;
}

export const GO_MODELS: GoModel[] = [
  // Contributor is a channel term for Argon, not a different base model.
  { slugs: ['gemini-4-argon'], name: 'Gemini 4 Argon', rate: [4, 20, 0.2], limits: [60, 240], dataTerms: GOOGLE_TERMS },
  { slugs: ['meta-muse-spark-1-3-contributor', 'muse-spark-1.3-contributor'], name: 'Muse Spark 1.3 Contributor', rate: [0.1, 0.2, 0.002], limits: [60, 120], dataTerms: META_TERMS },
  { slugs: ['meta-muse-spark-1-2-contributor', 'muse-spark-1.2-contributor'], name: 'Muse Spark 1.2 Contributor', rate: [0.1, 0.2, 0.002], limits: [60, 120], dataTerms: META_TERMS },
  // Do not silently attach a V4.1 price to the older deepseek-v4-flash identity.
  { slugs: ['deepseek-v4.1-flash', 'deepseek-v4-1-flash'], name: 'DeepSeek V4.1 Flash', rate: [0.15, 0.6, 0.003], peak: [0.3, 1.2, 0.006], limits: [80, 160] },
  { slugs: ['deepseek-v4-pro'], name: 'DeepSeek V4 Pro', rate: [0.66, 1.98, 0.022], peak: [1.32, 3.96, 0.044], limits: [15, 60] },
];

export function goSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-opencode-go-2026-10-15.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'models' | 'plans' | 'api_channel_prices' | 'api_channel_price_variants' | 'model_plan_mapping';
export interface GoSeedStep { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

/** Caller owns the serializable transaction. Default preview issues SELECT only. */
export async function seedOpenCodeGo(tx: Sql, apply = false): Promise<GoSeedStep[]> {
  const rows: Record<Table, Row[]> = {
    providers: await tx<Row[]>`SELECT * FROM providers WHERE slug = 'opencode-go'`,
    models: await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(GO_MODELS.flatMap(model => model.slugs))}`,
    plans: [], api_channel_prices: [], api_channel_price_variants: [], model_plan_mapping: [],
  };
  const one = (table: Table, candidates: Row[], target: string) => {
    if (candidates.length > 1) throw new Error(`Ambiguous ${table}/${target}; transaction aborted. Review duplicates before retrying.`);
    return candidates[0] ?? null;
  };
  const existingProvider = one('providers', rows.providers, 'opencode-go');
  if (existingProvider) {
    for (const table of ['plans', 'api_channel_prices', 'api_channel_price_variants'] as const) {
      rows[table] = await tx<Row[]>`SELECT * FROM ${tx(table)} WHERE provider_id = ${existingProvider.id}`;
    }
    const planIds = rows.plans.filter(row => ['opencode-go', 'opencode-go-plus'].includes(String(row.slug))).map(row => row.id);
    if (planIds.length) rows.model_plan_mapping = await tx<Row[]>`SELECT * FROM model_plan_mapping WHERE plan_id IN ${tx(planIds)}`;
  }

  const steps: GoSeedStep[] = [];
  let previewId = -1;
  const save = async (table: Table, existing: Row | null, values: Record<string, unknown>, target: string) => {
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) return existing!;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    const payload = { ...values, ...(table === 'model_plan_mapping' ? {} : { updated_at: new Date() }) };
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

  const provider = existingProvider ?? await save('providers', null, {
    name: 'OpenCode Go', slug: 'opencode-go', website: 'https://opencode.ai', pricing_url: GO_SOURCE,
    type: 'aggregator', currency: 'USD', region: null, access_from_china: null,
    notes: `[needs-verification] Regional access and payment methods. Source: ${GO_SOURCE}`,
  }, 'opencode-go');

  const models: Row[] = [];
  for (const model of GO_MODELS) {
    const existing = one('models', rows.models.filter(row => model.slugs.includes(String(row.slug))), model.slugs[0]);
    // Reuse catalog IDs and producer metadata; never assign OpenCode as producer.
    models.push(existing ?? await save('models', null, {
      slug: model.slugs[0], name: model.name, type: 'llm', model_category: 'text',
      provider_ids: [], context_window: null, max_output_tokens: null, open_source: null,
      offical_link: GO_SOURCE,
      description: `[needs-verification] Model specifications and producer metadata. Listed on OpenCode Go. Source: ${GO_SOURCE}`,
    }, model.slugs[0]));
  }

  for (const [index, name, slug, price] of [[0, 'Go', 'opencode-go', 10], [1, 'Go Plus', 'opencode-go-plus', 40]] as const) {
    const existing = one('plans', rows.plans.filter(row => row.slug === slug), slug);
    const limits = GO_MODELS.map(model => `${model.name}${model.slugs[0] === 'gemini-4-argon' ? ' Contributor' : ''}: $${model.limits[index]}/month`).join('; ');
    const plan = await save('plans', existing, {
      provider_id: provider.id, product_id: provider.id, name, slug, price, currency: 'USD',
      pricing_model: 'subscription', price_unit: 'per_month', annual_price: null, price_yearly_monthly: null,
      plan_kind: 'coding', plan_category: 'coding', plan_line: 'opencode-go', tier: index === 0 ? 'basic' : 'pro', tier_rank: index + 1,
      billing_granularity: 'flat_monthly', source: 'manual', is_official: true, is_contact_sales: false,
      quota_unit: 'usd', quotas: [], monthly_api_credit_usd: null,
      model_selector: { only_extra: true, extra: models.map(model => model.slug) },
      third_party_coverage: 'full', third_party_coverage_note: 'Included up to separate per-model USD limits; not a shared credit pool.',
      region: null, access_from_china: null, data_for_discount: null,
      data_for_discount_note: 'Training terms depend on the model: Gemini Contributor (Google) and Muse Contributor (Meta).',
      notes: `${WINDOWS}\n${limits}.\n${GOOGLE_TERMS}\n${META_TERMS}\n[needs-verification] Annual pricing and exact regional access. Source: ${GO_SOURCE}`,
      last_verified: VERIFIED_AT,
    }, slug);
    for (const model of models) {
      const mapping = one('model_plan_mapping', rows.model_plan_mapping.filter(row => row.model_id === model.id && row.plan_id === plan.id), `${slug}/${model.slug}`);
      await save('model_plan_mapping', mapping, { model_id: model.id, plan_id: plan.id, source: 'manual' }, `${slug}/${model.slug}`);
    }
  }

  for (const [index, model] of GO_MODELS.entries()) {
    const modelId = models[index].id;
    const target = String(models[index].slug);
    const identity = { model_id: modelId, provider_id: provider.id };
    const prices = ([input, output, cached]: Rate) => ({ input_price_per_1m: input, output_price_per_1m: output, cached_input_price_per_1m: cached });
    const notes = [
      model.slugs[0] === 'gemini-4-argon' ? 'Gemini 4 Argon Contributor on OpenCode Go.' : model.name,
      `Go $${model.limits[0]}/month; Go Plus $${model.limits[1]}/month per-model USD limit.`, WINDOWS,
      model.dataTerms,
      model.peak ? 'Headline is conditional off-peak pricing; see peak/off-peak variants. [needs-verification] OpenCode Go peak schedule.' : null,
      `Source: ${GO_SOURCE}`,
    ].filter(Boolean).join('\n');
    const common = { ...identity, currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, notes, last_verified: VERIFIED_AT };
    const channel = one('api_channel_prices', rows.api_channel_prices.filter(row => row.model_id === modelId), target);
    await save('api_channel_prices', channel, {
      ...common, ...prices(model.rate), quota_unit: 'usd', data_for_discount: model.dataTerms ? true : null,
      data_for_discount_note: model.dataTerms ?? null,
      promo_ends_at: null, regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
    }, target);
    if (!model.peak) continue;
    for (const [key, rate] of [['off-peak', model.rate], ['peak', model.peak]] as const) {
      const variant = one('api_channel_price_variants', rows.api_channel_price_variants.filter(row => row.model_id === modelId && row.variant_key === key), `${target}/${key}`);
      await save('api_channel_price_variants', variant, {
        ...common, ...prices(rate), variant_key: key, variant_name: key === 'peak' ? 'Peak' : 'Off-peak', variant_kind: 'time_window',
        source_url: GO_SOURCE, is_public: true, is_headline: key === 'off-peak',
        constraints_json: { time_window: key, schedule_status: 'needs-verification', subscription_required: true, quota_unit: 'usd' },
      }, `${target}/${key}`);
    }
  }
  return steps;
}
