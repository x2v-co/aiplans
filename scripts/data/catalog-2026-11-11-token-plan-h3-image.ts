import type { Sql } from 'postgres';
import { h3ImageCatalog, H3_IMAGE_PROMO, H3_IMAGE_SLUGS } from '../../src/lib/image-model-catalog';
import { QWEN_TOKEN_PLAN_CLASSIFICATIONS } from '../config/plan-classifications';
import { seedChanges } from './gemini-4-argon';
import { modelCapabilities } from './catalog-2026-11-04';
import { retainLockedUnavailable } from '../utils/manual-unavailable';

/** Manual Intel 11-11 13:05 seed. Caller owns a serializable transaction.
 * Validate and plan every operation before writing; no deletes. CLI rehearsals roll back.
 * Uses the Intel itemized usage_prices path: non-llm-seed's private seedCatalogItems
 * hardcodes USD and creates reference plans, so cannot safely seed these regional rates.
 */
export const VERIFIED = '2026-11-11';
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00.000Z`);
export const TOKEN_PLAN_EFFECTIVE_AT = '2026-11-09T20:00:00+08:00';
export const QWEN_PREVIEW_SLUG = 'qwen4-max-preview';
export const QWEN_PREVIEW_ALIAS = 'qwen4.0-max-preview';
export const QWEN_PREVIEW_SHUTDOWN_AT = '2026-11-26T00:00:00+08:00';
export const QWEN_CN_SOURCE = 'https://help.aliyun.com/zh/model-studio/token-plan-personal-overview';
export const QWEN_INTL_SOURCE = 'https://www.alibabacloud.com/help/en/model-studio/token-plan-personal-overview';
export const QWEN_CLOUD_SOURCE = 'https://docs.qwencloud.com/token-plan/personal/token-plan-personal-overview';
export const QWEN_CHANGELOG = 'https://platform.qianwenai.com/docs/changelog/token-plan-credits-1109';
export const TOKEN_PLAN_TIERS = [
  { tier: 'lite', name: 'Lite', credits: 20_000, cny: 39, usd: 6, newCny: 19.5, newUsd: 3, concurrent: '1-2' },
  { tier: 'essential', name: 'Essential', credits: 45_000, cny: 79, usd: 10, newCny: 39.5, newUsd: 5, concurrent: '2-3' },
  { tier: 'standard', name: 'Standard', credits: 80_000, cny: 139, usd: 18, newCny: null, newUsd: null, concurrent: '3-4' },
  { tier: 'pro', name: 'Pro', credits: 200_000, cny: 312, usd: 43, newCny: null, newUsd: null, concurrent: '6-8' },
] as const;
const evidence = (note: string, sources: readonly string[]) => `${note} Verified ${VERIFIED}. Sources: ${sources.join(' ; ')}`;
export const QWEN_PREVIEW_NOTES = evidence(
  `Token Plan only, billed in Credits; no official pay-as-you-go token price. Alias ${QWEN_PREVIEW_ALIAS}; both IDs work and bills show ${QWEN_PREVIEW_ALIAS}. Preview from 2026-11-11T10:00:00+08:00 until ${QWEN_PREVIEW_SHUTDOWN_AT} (11-25 24:00 UTC+8), then offline. Credits consumption as low as 20% (2折 / 5x usage). Night discount 待定 / pending: help.aliyun.com CN says additional 4折, 0.8折 of standard; alibabacloud.com EN says additional 60% off, 8% of standard; docs.qwencloud.com says additional 80% off, 4% of standard (0.4折). Official sources conflict; no structured night rate. Capabilities: reasoning, visual understanding, text generation. Context length unpublished. shutdown_date is date-only; exact shutdown instant is preserved here.`,
  [QWEN_CN_SOURCE, QWEN_INTL_SOURCE, QWEN_CLOUD_SOURCE],
);
export const REQUIRED_PROVIDERS = ['qwen', 'minimax-china', 'minimax-global'] as const;
export const SEED_TABLES = ['providers', 'models', 'api_channel_prices', 'api_channel_price_variants', 'plans', 'model_plan_mapping', 'usage_prices'] as const;
type Table = typeof SEED_TABLES[number];
type Row = Record<string, unknown> & { id: number; is_available?: boolean | null; availability_locked?: boolean | null; notes?: string | null };
export interface Step { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 0, update: 0 }, models: { insert: 3, update: 0 },
  api_channel_prices: { insert: 0, update: 0 }, api_channel_price_variants: { insert: 0, update: 0 },
  plans: { insert: 8, update: 0 }, model_plan_mapping: { insert: 8, update: 0 }, usage_prices: { insert: 16, update: 0 },
} as const;
export function seedStepCounts(steps: Step[]) {
  return Object.fromEntries(SEED_TABLES.map(table => [table, {
    insert: steps.filter(s => s.table === table && s.action === 'insert').length,
    update: steps.filter(s => s.table === table && s.action === 'update').length,
  }])) as Record<Table, { insert: number; update: number }>;
}
export function catalog20261111TokenPlanH3ImageSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-11-token-plan-h3-image.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}
const isFresher = (row: Row | null) => row?.last_verified != null && new Date(String(row.last_verified)).getTime() > VERIFIED_AT.getTime();
/** A later verification owns the entire row, including its prices, quotas and evidence. */
export function keepFresher(existing: Row | null, values: Record<string, unknown>) {
  return isFresher(existing) ? {} : values;
}
const append = (old: unknown, note: string) => String(old ?? '').includes(note) ? old : [old, note].filter(Boolean).join('\n');

export async function seedCatalog20261111TokenPlanH3Image(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], label: string, required = false): Row | null => {
    if (rows.length > 1 || (required && rows.length !== 1)) fail(`Ambiguous or missing ${label} (${rows.length} rows)`);
    return rows[0] ?? null;
  };
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx([...REQUIRED_PROVIDERS])}`;
  const owners = Object.fromEntries(REQUIRED_PROVIDERS.map(slug => [slug, one(providers.filter(p => p.slug === slug), `providers/${slug}`, true)!]));
  for (const [slug, owner] of Object.entries(owners)) {
    if (!['official', 'producer'].includes(String(owner.type))) fail(`Wrong provider type for ${slug}`);
  }
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx([QWEN_PREVIEW_SLUG, QWEN_PREVIEW_ALIAS, ...H3_IMAGE_SLUGS])}`;
  if (models.some(m => m.slug === QWEN_PREVIEW_ALIAS)) fail(`Non-canonical model alias ${QWEN_PREVIEW_ALIAS} exists`);
  const modelBy = new Map([QWEN_PREVIEW_SLUG, ...H3_IMAGE_SLUGS].map(slug => [slug, one(models.filter(m => m.slug === slug), `models/${slug}`)]));
  const plans = await tx<Row[]>`SELECT * FROM plans WHERE slug IN ${tx(QWEN_TOKEN_PLAN_CLASSIFICATIONS.map(c => c.planSlug))}`;
  const planBy = new Map(QWEN_TOKEN_PLAN_CLASSIFICATIONS.map(c => {
    const plan = one(plans.filter(p => p.slug === c.planSlug), `plans/${c.planSlug}`);
    if (plan && [plan.provider_id, plan.product_id].some(id => id != null && id !== owners.qwen.id)) fail(`Wrong plan owner for ${c.planSlug}`);
    return [c.planSlug, plan];
  }));
  const mappings = await tx<Row[]>`SELECT * FROM ${tx('model_plan_mapping')}`;
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
  const oldPreview = modelBy.get(QWEN_PREVIEW_SLUG)!;
  const preview = save('models', oldPreview, {
    slug: QWEN_PREVIEW_SLUG, name: 'Qwen4 Max Preview', type: 'llm', model_category: 'text', pricing_unit: 'subscription_only',
    provider_ids: [...new Set([...((oldPreview?.provider_ids as number[] | null) ?? []), owners.qwen.id])],
    input_type: ['text', 'image'], input_modalities: ['text', 'image'], output_type: ['text'], output_modalities: ['text'],
    ...modelCapabilities(oldPreview, ['reasoning', 'visual understanding', 'text generation']),
    offical_link: QWEN_CN_SOURCE, shutdown_date: '2026-11-26', description: append(oldPreview?.description, QWEN_PREVIEW_NOTES),
  }, QWEN_PREVIEW_SLUG);
  for (const c of QWEN_TOKEN_PLAN_CLASSIFICATIONS) {
    const intl = c.planSlug.endsWith('-intl');
    const tier = TOKEN_PLAN_TIERS[c.rank - 1];
    const source = intl ? QWEN_INTL_SOURCE : QWEN_CN_SOURCE;
    const promo = intl ? tier.newUsd : tier.newCny;
    const note = evidence([
      `Token Plan Personal ${tier.name}; ${intl ? 'Singapore region only' : 'Beijing region only'}. Effective ${TOKEN_PLAN_EFFECTIVE_AT}. ${tier.credits} Credits per subscription month; concurrent agents ${tier.concurrent}. Interactive use in coding/agent tools only, not batch/backends. Unused monthly Credits do not roll over.`,
      c.rank >= 3 ? 'Includes Harness benefits.' : 'No Standard/Pro Harness benefits.',
      promo == null ? 'No new-user half-price discount for Standard or Pro.' : `New-user half price ${intl ? '$' : '¥'}${promo} until 2026-11-30 23:59:59 UTC+8, only accounts that have never bought Token Plan Personal; stored price is the published standard monthly price.`,
      tier.tier === 'pro' ? `Existing Pro subscribers keep their old price for the current cycle; new price starts next cycle.${intl ? '' : ' Official discounted monthly price ¥312; former list/目录价 ¥499 is not the current purchase price.'}` : '',
      'Optional add-on pack: 20,000 Credits, max 5, active subscription required; not seeded as a standalone token_pack.',
    ].filter(Boolean).join(' '), [source, QWEN_CHANGELOG]);
    const old = planBy.get(c.planSlug)!;
    const plan = save('plans', old, {
      slug: c.planSlug, name: `Qwen Token Plan ${tier.name}${intl ? ' (Singapore)' : ' (Beijing)'}`,
      provider_id: owners.qwen.id, product_id: owners.qwen.id, pricing_model: 'subscription',
      price: intl ? tier.usd : tier.cny, currency: intl ? 'USD' : 'CNY', price_unit: 'per_month',
      tier: 'individual', plan_kind: c.kind, plan_category: 'agent', plan_line: c.line, tier_rank: c.rank,
      model_selector: c.selector, billing_granularity: 'flat_monthly', quota_unit: 'credits', included_credits: tier.credits,
      included_usage_unit: 'credit', included_usage_amount: tier.credits,
      quotas: [{ amount: tier.credits, unit: 'credit', period: 'month' }],
      region: intl ? 'Singapore' : 'Beijing', is_official: true, source: 'manual',
      notes: note, last_verified: VERIFIED_AT,
    }, c.planSlug);
    // Respect later plan entitlement evidence as well as its price and quota.
    if (!isFresher(old)) save('model_plan_mapping', one(mappings.filter(m => m.model_id === preview.id && m.plan_id === plan.id), c.planSlug), {
      model_id: preview.id, plan_id: plan.id, priority: 50, source: 'derived',
    }, `${QWEN_PREVIEW_SLUG}/${c.planSlug}`);
  }
  for (const item of h3ImageCatalog('CNY')) {
    const old = modelBy.get(item.slug!)!;
    const model = save('models', old, {
      slug: item.slug, name: item.name, type: 'multimodal', model_category: 'image', pricing_unit: 'per_1m_tokens',
      provider_ids: [...new Set([...((old?.provider_ids as number[] | null) ?? []), owners['minimax-china'].id, owners['minimax-global'].id])],
      input_type: item.inputModalities, input_modalities: item.inputModalities, output_type: ['image'], output_modalities: ['image'],
      ...modelCapabilities(old, item.capabilities), offical_link: item.url,
      ...(item.slug === H3_IMAGE_SLUGS[0] ? { open_source: true, license: 'minimax-h3-image-community-license-agreement', license_url: 'https://huggingface.co/MiniMaxAI/MiniMax-H3-Image#license' } : {}),
      description: append(old?.description, evidence(`${item.name}. ${item.notes}`, item.sourceUrls!.map(s => s.url))),
    }, item.slug!);
    for (const regional of [item, h3ImageCatalog('USD').find(i => i.slug === item.slug)!]) {
      const owner = owners[regional.providerSlug!];
      const usage = old ? await tx<Row[]>`SELECT * FROM usage_prices WHERE model_id = ${old.id} AND provider_id = ${owner.id}` : [];
      for (const rate of regional.usageRates!) {
        const target = `${regional.providerSlug}/${item.slug}/${rate.priceKind}`;
        const existing = one(usage.filter(r => r.price_kind === rate.priceKind && r.unit === rate.unit), target);
        save('usage_prices', existing, retainLockedUnavailable({
          model_id: model.id, provider_id: owner.id, plan_id: existing?.plan_id ?? null,
          price_kind: rate.priceKind, unit: rate.unit, price: rate.price, currency: regional.currency,
          source_url: regional.url, last_verified: VERIFIED_AT, is_available: true,
          constraints_json: { conditional_promo: H3_IMAGE_PROMO, notes: regional.notes,
            ...(rate.approximate ? { approximate: true, task: 'text-to-image', reference_only: true } : {}) },
        }, existing), target);
      }
    }
  }
  if (apply) {
    const ids = new Map<number, number>();
    const resolve = (id: unknown) => typeof id === 'number' && id < 0 ? ids.get(id)! : id;
    for (const op of pending) {
      // model_plan_mapping has no updated_at column.
      const payload: Record<string, unknown> = { ...op.values, ...(op.table === 'model_plan_mapping' ? {} : { updated_at: new Date() }) };
      for (const key of ['model_id', 'provider_id', 'product_id', 'plan_id']) if (key in payload) payload[key] = resolve(payload[key]);
      if (Array.isArray(payload.provider_ids)) payload.provider_ids = payload.provider_ids.map(resolve);
      if (op.existing) await tx`UPDATE ${tx(op.table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${op.existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(op.table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        ids.set(op.id, inserted.id);
      }
    }
  }
  return steps;
}
