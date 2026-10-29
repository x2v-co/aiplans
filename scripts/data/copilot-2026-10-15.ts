import type { Sql } from 'postgres';
import { isDeepStrictEqual } from 'node:util';
import { COPILOT_PREVIEW_PLANS, COPILOT_PREVIEW_SELECTOR } from '../../src/lib/copilot';
import { resolveSelector, type SelectableModel } from '../../src/lib/plan-selector';
import { seedChanges } from './gemini-4-argon';

// Official Copilot facts refreshed 2026-10-29; keep the original seed entry point.
export const COPILOT_SOURCE = 'https://github.com/features/copilot/plans';
export const COPILOT_ACCESS_SOURCE = 'https://github.blog/changelog/2026-10-28-github-enterprise-now-includes-access-to-github-copilot';
export const COPILOT_BILLING_SOURCE = 'https://docs.github.com/en/copilot/get-started/whats-changing-with-github-enterprise-and-copilot';
export const COPILOT_DOCS_SOURCE = 'https://docs.github.com/en/copilot/get-started/plans';
export const HYDRAFUSION_SOURCE = 'https://github.blog/changelog/2026-10-14-hydrafusion-updates-and-new-max-option';
const VERIFIED_AT = new Date('2026-10-29T00:00:00Z');
const claim = (text: string, sources: readonly string[] = [COPILOT_SOURCE]) =>
  `${text} Sources: ${sources.join(', ')}; verified 2026-10-29.`;
const ACCESS_SOURCES = [COPILOT_ACCESS_SOURCE, COPILOT_BILLING_SOURCE, COPILOT_DOCS_SOURCE];
const CREDIT_NOTE = claim('GitHub AI Credits: 1 credit = $0.01. Flex credits may change.');
const PREVIEW_NOTE = claim('HydraFusion and HydraFusion Max: research preview; enable experimental/preview features. Model pool: Claude Opus 5.5, GPT-6 Astra, GPT-6.1 Sol, GPT-6 Luna. [needs-verification] Billing multiplier undisclosed. Model links describe the preview pool, not direct model selection or guaranteed inclusion in credits.', [HYDRAFUSION_SOURCE]);
const INDIVIDUAL_NOTE = 'Interactions on Free, Pro and Pro+ may be used for training unless opted out. This is not a discount in exchange for data.';
const ORG_NOTE = 'Business and Enterprise interactions are not used for training.';
const STANDALONE_TERMS = [
  claim('Sales-assisted only through a GitHub/Microsoft account team from 2026-10-28. Self-serve is not yet available (coming in stages). Unavailable to GitHub Free/Team organizations and self-service GitHub Enterprise Cloud trials.', ACCESS_SOURCES),
  claim('Same features and model eligibility as Copilot Enterprise, subject to administrator policies and spending controls.', ACCESS_SOURCES),
  claim('Code completion and next edit suggestions work with no budget. Copilot Chat, code review and Copilot cloud agent require available enterprise budget. An exhausted budget never removes the seat.', [COPILOT_ACCESS_SOURCE]),
  claim('One billing model per enterprise: Copilot access (GitHub Enterprise Cloud-included or Standalone) cannot coexist with Business/Enterprise seats in the same enterprise. Transition is voluntary.', [COPILOT_BILLING_SOURCE]),
  claim('Copilot access through GitHub Enterprise Cloud: $0 Copilot seat charge for users who hold a GitHub Enterprise Cloud license (license cost excluded here). Same features/models as Copilot Enterprise; no included AI credits; metered usage billed separately from first use against the enterprise budget. Sales-assisted only for now. Enterprise owners must still assign seats; this option can coexist with Standalone.', ACCESS_SOURCES),
];

export const COPILOT_PLANS = [
  { slug: 'copilot-free', name: 'Copilot Free', price: 0, tier: 'free', credits: null, allowance: '2,000 completions + 50 chat requests; limited chat/agent usage.', training: INDIVIDUAL_NOTE },
  { slug: 'copilot-pro', name: 'Copilot Pro', price: 10, tier: 'pro', credits: 1500, allowance: '$15 total monthly AI credits = $10 base + $5 flex (1,500 credits).', training: INDIVIDUAL_NOTE },
  { slug: 'copilot-pro-plus', name: 'Copilot Pro+', price: 39, tier: 'pro', credits: 7000, allowance: '$70 total monthly AI credits = $39 base + $31 flex (7,000 credits).', training: INDIVIDUAL_NOTE },
  { slug: 'copilot-max', name: 'Copilot Max', price: 100, tier: 'pro', credits: 20000, allowance: '$200 total monthly AI credits; $100 base, remainder flex (20,000 credits).', training: '[needs-verification] Max plan training policy; the verified training statement lists Free, Pro and Pro+ only.' },
  { slug: 'copilot-business', name: 'Copilot Business', price: 19, tier: 'team', credits: 1900, allowance: '1,900 AI credits per user per month, pooled across the organization.', training: ORG_NOTE },
  { slug: 'copilot-enterprise', name: 'Copilot Enterprise', price: 39, tier: 'enterprise', credits: 3900, allowance: '3,900 AI credits per user per month, pooled across the organization. Available for organizations using GitHub Enterprise Cloud.', training: ORG_NOTE },
  { slug: 'copilot-standalone', name: 'Copilot Standalone', price: 10, tier: 'enterprise', credits: 0, allowance: 'Per-user monthly seat fee only; no included AI credits; metered usage billed separately from first use at model rates against the enterprise budget.', training: '[needs-verification] Standalone training policy; the supplied Business/Enterprise training statement does not explicitly name Standalone.' },
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
    notes: claim('[needs-verification] Regional access and payment methods.'),
  }, 'github');

  for (const [rank, seed] of COPILOT_PLANS.entries()) {
    const standalone = seed.slug === 'copilot-standalone';
    const organization = seed.tier === 'team' || seed.tier === 'enterprise';
    const sources = standalone ? ACCESS_SOURCES : organization ? [COPILOT_SOURCE, COPILOT_BILLING_SOURCE] : [COPILOT_SOURCE];
    const preview = COPILOT_PREVIEW_PLANS.includes(seed.slug);
    const modelNote = preview ? PREVIEW_NOTE : claim('[needs-verification] Model availability. The HydraFusion preview changelog does not list Free or the Max plan.', [HYDRAFUSION_SOURCE]);
    const allowance = claim(`${seed.name}: $${seed.price} USD ${organization ? 'per user per month' : 'per month'}. ${seed.allowance}`, sources);
    const training = claim(seed.training);
    const terms = standalone ? STANDALONE_TERMS : [];
    const coverageNote = standalone ? [allowance, terms[1], modelNote].join('\n') : modelNote;
    const notes = [allowance, ...terms, CREDIT_NOTE, training, modelNote,
      claim('[needs-verification] Annual pricing, regional access and payment methods.')].join('\n');
    const plan = await save('plans', one(plans.filter(plan => plan.slug === seed.slug), `plans/${seed.slug}`), {
      provider_id: provider.id, product_id: provider.id, name: seed.name, slug: seed.slug,
      price: seed.price, currency: 'USD', price_unit: 'per_month', pricing_model: 'subscription',
      annual_price: null, price_yearly_monthly: null, is_contact_sales: standalone,
      plan_kind: 'coding', plan_category: 'coding', plan_line: 'github-copilot', tier: seed.tier, tier_rank: rank,
      billing_granularity: 'flat_monthly', source: 'manual', is_official: true,
      quota_unit: 'credits', included_credits: seed.credits,
      included_usage_unit: seed.credits === null ? null : 'credit', included_usage_amount: seed.credits,
      quotas: standalone ? [] : seed.credits === null ? null : [{ amount: seed.credits, unit: 'credit', period: 'month', note: allowance }],
      monthly_api_credit_usd: null, monthly_api_credit_status: null,
      monthly_message_limit: null, requests_per_month: null,
      model_selector: preview && selected.length ? COPILOT_PREVIEW_SELECTOR : null,
      third_party_coverage: 'unknown', third_party_coverage_note: coverageNote,
      region: null, access_from_china: null, data_for_discount: false, data_for_discount_note: training,
      features: [allowance, ...terms, training, ...(preview ? [PREVIEW_NOTE] : [])],
      notes, last_verified: VERIFIED_AT,
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
