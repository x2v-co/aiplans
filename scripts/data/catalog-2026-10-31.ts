import type { Sql } from 'postgres';
import { CLASSIFICATIONS } from '../config/plan-classifications';
import { seedChanges } from './gemini-4-argon';

/** Official pricing pages checked 2026-10-31. Optional seed, never part of deploy. */
export const VERIFIED_AT = new Date('2026-10-31T00:00:00Z');
export const CLAUDE_SOURCE = 'https://claude.com/pricing';
export const OPENAI_SOURCE = 'https://developers.openai.com/api/docs/pricing';
// Same producer-prefixed slug convention as openai-gpt-6-astra.
export const LAW_SLUG = 'openai-gpt-6-astra-law';
export const CLAUDE_REPLACEMENTS = [
  { oldSlug: 'claude-max-5x', slug: 'claude-max', name: 'Claude Max', price: 100 },
  { oldSlug: 'claude-max-20x', slug: 'claude-ultra', name: 'Claude Ultra', price: 200 },
] as const;

export function currentClaudePlan(providerId: number, slug: string) {
  const plan = CLAUDE_REPLACEMENTS.find(p => p.slug === slug);
  const classification = CLASSIFICATIONS.find(c => c.providerSlug === 'anthropic' && c.planSlug === slug);
  if (!plan || !classification) throw new Error(`Unknown current Claude plan ${slug}`);
  const usage = slug === 'claude-max'
    ? '5x Pro usage every 5 hours and every week.'
    : '10x Pro usage every week. No 5-hour limit for verified accounts.';
  const features = [
    usage,
    'Fable included, up to half the weekly usage limit.',
    `$${plan.price}/month in API credits to build on the Claude Platform.`,
    'Monthly billing only; no annual plan.',
    'Claude Code included; shared usage limits apply.',
  ];
  return {
    provider_id: providerId, product_id: providerId, slug: plan.slug, name: plan.name,
    pricing_model: 'subscription', price: plan.price, annual_price: null, price_yearly_monthly: null,
    price_unit: 'per_month', currency: 'USD', tier: 'pro', is_official: true,
    is_contact_sales: false, source: 'manual', access_from_china: false, region: 'global',
    plan_kind: classification.kind, plan_line: classification.line, tier_rank: classification.rank,
    secondary_kinds: classification.secondaryKinds, model_selector: classification.selector,
    billing_granularity: 'flat_monthly',
    // Relative allowances and conditional limits are prose, never invented message/token counts.
    daily_message_limit: null, weekly_message_limit: null, monthly_message_limit: null,
    '5_hours_message_limit': null, quotas: [],
    monthly_api_credit_usd: plan.price, monthly_api_credit_status: null,
    features, notes: `${features.join('\n')}\nSource: ${CLAUDE_SOURCE} (verified 2026-10-31).`,
    last_verified: VERIFIED_AT,
  };
}

export function lawModel(providerId: number) {
  return {
    name: 'GPT-6 Astra for Law', slug: LAW_SLUG, type: 'llm', model_category: 'text',
    provider_ids: [providerId], offical_link: OPENAI_SOURCE,
    description: `OpenAI legal model configuration gpt-6-astra-law. 促销价至少至 2026-12-31 (promotional pricing available at least through December 31, 2026). Source: ${OPENAI_SOURCE} (verified 2026-10-31).`,
    // Pricing evidence does not establish context, output limits or release date.
  };
}

export function lawChannel(providerId: number, modelId: number) {
  return {
    model_id: modelId, provider_id: providerId,
    input_price_per_1m: 10, output_price_per_1m: 50, cached_input_price_per_1m: 1,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true,
    // "At least through" is not an exact cutoff, and no regular rates are published.
    promo_ends_at: null, regular_input_price_per_1m: null,
    regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
    last_verified: VERIFIED_AT,
    notes: `Legal model configurations: gpt-6-astra-law, USD per 1M tokens: input $10.00, output $50.00, cached input $1.00. 促销价至少至 2026-12-31 (promotional pricing available at least through December 31, 2026). No exact expiry or post-promotion price is published. Only this pricing tier is recorded; no Batch or long-context variants inferred. Source: ${OPENAI_SOURCE} (verified 2026-10-31).`,
  };
}

export function catalog20261031SeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-10-31.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'plans' | 'models' | 'api_channel_prices';
export interface Step { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

/** Caller owns a serializable transaction (READ ONLY for dry-run). No deletes or schema changes.
 * Superseded plan rows retain their IDs, slugs and references, as in the Kimi/ChatGPT seeds.
 * Current-plan queries hide the marker; the legacy /plans slug catalog deliberately retains it.
 * Selectors carry current entitlements; the standard materializer can derive their mappings.
 */
export async function seedCatalog20261031(tx: Sql, apply = false): Promise<Step[]> {
  const one = (rows: Row[], target: string, required = false): Row | null => {
    if (rows.length > 1 || (required && !rows.length)) throw new Error(`Expected ${required ? 'exactly' : 'at most'} one ${target}, found ${rows.length}; nothing written.`);
    return rows[0] ?? null;
  };
  // Validate the entire write scope before executing any mutation.
  const providers = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(['anthropic', 'openai'])}`;
  const anthropic = one(providers.filter(p => p.slug === 'anthropic'), 'providers/anthropic', true)!;
  const openai = one(providers.filter(p => p.slug === 'openai'), 'providers/openai', true)!;
  for (const p of [anthropic, openai]) {
    if (!['official', 'producer'].includes(String(p.type))) throw new Error(`Expected official/producer ${p.slug}; nothing written.`);
  }
  const slugs = CLAUDE_REPLACEMENTS.flatMap(p => [p.oldSlug, p.slug]);
  const plans = await tx<Row[]>`SELECT * FROM plans WHERE provider_id = ${anthropic.id} AND slug IN ${tx(slugs)}`;
  for (const slug of slugs) one(plans.filter(p => p.slug === slug), `plans/anthropic/${slug}`);
  const model = one(await tx<Row[]>`SELECT * FROM models WHERE slug = ${LAW_SLUG}`, `models/${LAW_SLUG}`);
  const channel = model ? one(await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${openai.id}`, `api_channel_prices/openai/${LAW_SLUG}`) : null;

  const steps: Step[] = [];
  let previewId = -1;
  const save = async (table: Table, existing: Row | null, values: Record<string, unknown>, target: string): Promise<Row> => {
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) return existing!;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    const payload = { ...values, updated_at: new Date() };
    let id = existing?.id ?? previewId--;
    if (apply) {
      if (existing) await tx`UPDATE ${tx(table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        id = inserted.id;
      }
    }
    return { ...existing, ...payload, id };
  };

  for (const p of CLAUDE_REPLACEMENTS) {
    await save('plans', plans.find(row => row.slug === p.slug) ?? null, currentClaudePlan(anthropic.id, p.slug), `anthropic/${p.slug}`);
    const legacy = plans.find(row => row.slug === p.oldSlug);
    if (!legacy) continue; // Fresh catalogs need no historical placeholder.
    const marker = `[aiplans:superseded-by ${p.slug}]`;
    const notes = String(legacy.notes ?? '');
    await save('plans', legacy, {
      source: 'manual', model_selector: { only_extra: true, extra: [] },
      notes: notes.includes(marker) ? notes : [notes, `${marker} Replaced by ${p.name}. Source: ${CLAUDE_SOURCE} (verified 2026-10-31).`].filter(Boolean).join('\n'),
    }, `anthropic/${p.oldSlug}`);
  }
  const savedModel = await save('models', model, lawModel(openai.id), LAW_SLUG);
  await save('api_channel_prices', channel, lawChannel(openai.id, savedModel.id), `openai/${LAW_SLUG}`);
  return steps;
}
