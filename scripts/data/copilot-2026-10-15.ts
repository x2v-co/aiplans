import type { Sql } from 'postgres';
import { isDeepStrictEqual } from 'node:util';
import { COPILOT_PREVIEW_PLANS, COPILOT_PREVIEW_SELECTOR } from '../../src/lib/copilot';
import { resolveSelector, type SelectableModel } from '../../src/lib/plan-selector';
import { seedChanges } from './gemini-4-argon';

// Facts supplied in /workspace/aiplans-gaps-facts.md, GitHub Copilot section only.
export const COPILOT_SOURCE = 'https://github.com/features/copilot/plans';
export const HYDRAFUSION_SOURCE = 'https://github.blog/changelog/2026-10-14-hydrafusion-updates-and-new-max-option';
const VERIFIED_AT = new Date('2026-10-15T00:00:00Z');
const CREDIT_NOTE = 'GitHub AI Credits: 1 credit = $0.01. Flex credits may change.';
const PREVIEW_NOTE = 'HydraFusion and HydraFusion Max: research preview; enable experimental/preview features. Model pool: Claude Opus 5.5, GPT-6 Astra, GPT-6.1 Sol, GPT-6 Luna. [needs-verification] Billing multiplier undisclosed. Model links describe the preview pool, not direct model selection or guaranteed inclusion in credits.';
const INDIVIDUAL_NOTE = 'Interactions on Free, Pro and Pro+ may be used for training unless opted out. This is not a discount in exchange for data.';
const ORG_NOTE = 'Business and Enterprise interactions are not used for training.';

export const COPILOT_PLANS = [
  { slug: 'copilot-free', name: 'Copilot Free', price: 0, tier: 'free', credits: null, allowance: '2,000 completions + 50 chat requests; limited chat/agent usage.', training: INDIVIDUAL_NOTE },
  { slug: 'copilot-pro', name: 'Copilot Pro', price: 10, tier: 'pro', credits: 1500, allowance: '$15 total monthly AI credits = $10 base + $5 flex (1,500 credits).', training: INDIVIDUAL_NOTE },
  { slug: 'copilot-pro-plus', name: 'Copilot Pro+', price: 39, tier: 'pro', credits: 7000, allowance: '$70 total monthly AI credits = $39 base + $31 flex (7,000 credits).', training: INDIVIDUAL_NOTE },
  { slug: 'copilot-max', name: 'Copilot Max', price: 100, tier: 'pro', credits: 20000, allowance: '$200 total monthly AI credits; $100 base, remainder flex (20,000 credits).', training: '[needs-verification] Max plan training policy; the verified training statement lists Free, Pro and Pro+ only.' },
  { slug: 'copilot-business', name: 'Copilot Business', price: null, tier: 'team', credits: null, allowance: '[needs-verification] Per-seat price and included AI credits; the official plans page FAQ confirms this plan, without a seat price.', training: ORG_NOTE },
  { slug: 'copilot-enterprise', name: 'Copilot Enterprise', price: null, tier: 'enterprise', credits: null, allowance: '[needs-verification] Per-seat price and included AI credits; the official plans page FAQ confirms this plan, without a seat price.', training: ORG_NOTE },
] as const;

export function copilotSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-copilot-2026-10-15.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'plans' | 'model_plan_mapping';
export interface CopilotSeedStep { table: Table; target: string; action: 'insert' | 'update' | 'delete'; changes: ReturnType<typeof seedChanges> }

/** Caller owns a serializable transaction. Default preview issues SELECT only.
 * No models or API price rows are created; mappings use the shared selector.
 */
export async function seedCopilot(tx: Sql, apply = false): Promise<CopilotSeedStep[]> {
  const one = (rows: Row[], target: string) => {
    if (rows.length > 1) throw new Error(`Ambiguous ${target}; transaction aborted. Review duplicates before retrying.`);
    return rows[0] ?? null;
  };
  const existingProvider = one(await tx<Row[]>`SELECT * FROM providers WHERE slug = 'github'`, 'providers/github');
  const plans = existingProvider ? await tx<Row[]>`SELECT * FROM plans WHERE provider_id = ${existingProvider.id}` : [];
  const catalog = await tx<SelectableModel[]>`
    SELECT model.id, model.slug,
      ARRAY(SELECT slug FROM providers WHERE id = ANY(model.provider_ids)) AS "providerSlugs",
      (SELECT max(score.value) FROM model_benchmark_scores AS score
        JOIN benchmark_metrics AS metric ON metric.id = score.metric_id
        WHERE score.model_id = model.id AND metric.name = 'ELO') AS elo
    FROM models AS model
    WHERE (model.shutdown_date IS NULL OR model.shutdown_date > (now() AT TIME ZONE 'UTC')::date)
  `;
  const selected = resolveSelector(COPILOT_PREVIEW_SELECTOR, catalog).models;
  const planIds = plans.filter(plan => COPILOT_PLANS.some(seed => seed.slug === plan.slug)).map(plan => plan.id);
  const mappings = planIds.length ? await tx<Row[]>`SELECT * FROM model_plan_mapping WHERE plan_id IN ${tx(planIds)}` : [];
  const steps: CopilotSeedStep[] = [];
  let previewId = -1;
  const save = async (table: Table, existing: Row | null, values: Record<string, unknown>, target: string) => {
    const changes = seedChanges(existing, values);
    // JSONB may return object keys in a different order on subsequent runs.
    for (const key of Object.keys(changes)) {
      if (isDeepStrictEqual(existing?.[key], values[key])) delete changes[key];
    }
    if (!Object.keys(changes).length) return existing!;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    const payload = { ...values, ...(table === 'model_plan_mapping' ? {} : { updated_at: new Date() }) };
    const jsonColumns = ['features', 'quotas', 'model_selector'];
    const write = Object.fromEntries(Object.entries(payload).map(([key, value]) =>
      [key, jsonColumns.includes(key) && value !== null ? tx.json(value as never) : value]));
    let id = existing?.id ?? previewId--;
    if (apply) {
      if (existing) await tx`UPDATE ${tx(table)} SET ${tx(write, ...Object.keys(write))} WHERE id = ${existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(table)} ${tx(write, ...Object.keys(write))} RETURNING id`;
        id = inserted.id;
      }
    }
    return { ...existing, ...payload, id };
  };

  // Reuse GitHub's provider/product ID and point its pricing link at Copilot.
  const provider = await save('providers', existingProvider, existingProvider ? { pricing_url: COPILOT_SOURCE } : {
    name: 'GitHub', slug: 'github', website: 'https://github.com', pricing_url: COPILOT_SOURCE,
    type: 'official', currency: 'USD', region: null, access_from_china: null,
    description: 'GitHub Copilot subscription plans.',
    notes: `[needs-verification] Regional access and payment methods. Source: ${COPILOT_SOURCE}`,
  }, 'github');

  for (const [rank, seed] of COPILOT_PLANS.entries()) {
    const preview = COPILOT_PREVIEW_PLANS.includes(seed.slug);
    const modelNote = preview ? PREVIEW_NOTE : '[needs-verification] Model availability. The HydraFusion preview changelog does not list Free or the Max plan.';
    const notes = [seed.allowance, CREDIT_NOTE, seed.training, modelNote,
      '[needs-verification] Annual pricing, regional access and payment methods.',
      `Source: ${COPILOT_SOURCE}`, ...(preview ? [`Source: ${HYDRAFUSION_SOURCE}`] : [])].join('\n');
    const plan = await save('plans', one(plans.filter(plan => plan.slug === seed.slug), `plans/${seed.slug}`), {
      provider_id: provider.id, product_id: provider.id, name: seed.name, slug: seed.slug,
      price: seed.price, currency: 'USD', price_unit: 'per_month', pricing_model: 'subscription',
      annual_price: null, price_yearly_monthly: null, is_contact_sales: false,
      plan_kind: 'coding', plan_category: 'coding', plan_line: 'github-copilot', tier: seed.tier, tier_rank: rank,
      billing_granularity: 'flat_monthly', source: 'manual', is_official: true,
      quota_unit: 'credits', included_credits: seed.credits,
      included_usage_unit: seed.credits === null ? null : 'credit', included_usage_amount: seed.credits,
      quotas: seed.credits === null ? null : [{ amount: seed.credits, unit: 'credit', period: 'month', note: CREDIT_NOTE }],
      monthly_api_credit_usd: null, monthly_api_credit_status: null,
      monthly_message_limit: null, requests_per_month: null,
      model_selector: preview && selected.length ? COPILOT_PREVIEW_SELECTOR : null,
      third_party_coverage: 'unknown', third_party_coverage_note: preview ? PREVIEW_NOTE : modelNote,
      region: null, access_from_china: null, data_for_discount: false, data_for_discount_note: seed.training,
      features: [seed.allowance, seed.training, ...(preview ? [PREVIEW_NOTE] : [])],
      notes, last_verified: seed.price === null ? null : VERIFIED_AT,
    }, seed.slug);
    // Preserve manual exceptions; new/updated links remain owned by the materializer.
    const desired = preview ? selected : [];
    for (const mapping of mappings.filter(mapping => mapping.plan_id === plan.id && mapping.source === 'derived' && !desired.some(model => model.id === mapping.model_id))) {
      steps.push({ table: 'model_plan_mapping', target: `${seed.slug}/${mapping.model_id}`, action: 'delete', changes: { model_id: { from: mapping.model_id, to: null } } });
      if (apply) await tx`DELETE FROM model_plan_mapping WHERE id = ${mapping.id} AND source = 'derived'`;
    }
    for (const [priority, model] of desired.entries()) {
      const existing = one(mappings.filter(mapping => mapping.plan_id === plan.id && mapping.model_id === model.id), `mapping/${seed.slug}/${model.slug}`);
      if (existing?.source === 'manual') continue;
      await save('model_plan_mapping', existing, { plan_id: plan.id, model_id: model.id, priority, source: 'derived' }, `${seed.slug}/${model.slug}`);
    }
  }
  return steps;
}
