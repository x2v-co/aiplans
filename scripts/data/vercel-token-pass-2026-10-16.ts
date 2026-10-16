import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

// Facts re-verified 2026-10-16 against the official changelog and docs.
export const TOKEN_PASS_SOURCE = 'https://vercel.com/changelog/introducing-token-pass';
export const TOKEN_PASS_DOCS = 'https://vercel.com/docs/ai-gateway/token-pass';
export const TOKEN_PASS_SLUG = 'vercel-token-pass';
const VERIFIED_AT = new Date('2026-10-16T00:00:00Z');
// Reuse either existing Vercel identity; do not create a second provider.
const VERCEL_SLUGS = ['vercel', 'vercel-ai-gateway'];

/** Featured models; slugs are catalog candidates, gateway id is Vercel's model id. */
export const TOKEN_PASS_MODELS = [
  { name: 'GLM 5.3', gatewayId: 'zai/glm-5.3', slugs: ['glm-5.3', 'glm-5-3', 'zai-glm-5-3', 'z-ai-glm-5.3'] },
  { name: 'Kimi K3', gatewayId: 'moonshotai/kimi-k3', slugs: ['kimi-k3', 'moonshotai-kimi-k3'] },
] as const;

export const TOKEN_PASS_FEATURES = [
  '$80 monthly credit for $30/month',
  'Covers GLM 5.3 and Kimi K3 only (fast variants excluded)',
  'Unused credit does not roll over',
  'Hard stop when credit runs out; no automatic overage',
  'Zero Data Retention by default',
  'Early access for Vercel Pro teams only',
];

const NOTES = [
  'Gateway subscription: $30 per team per month buys $80 of Token Pass credit on Vercel AI Gateway, deducted at the Token Pass provider\'s per-token prices.',
  'Featured models: GLM 5.3 (zai/glm-5.3) and Kimi K3 (moonshotai/kimi-k3); Vercel may change them. Requires a Token Pass API key; no failover to other providers.',
  'Unused credit expires each billing period. When credit runs out, requests fail with 403 until the next period; no automatic overage charges.',
  'ZDR enabled by default; prompts not used for training. Early access for Pro teams.',
  `Sources: ${TOKEN_PASS_SOURCE} ; ${TOKEN_PASS_DOCS}`,
].join('\n');

export function tokenPassSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-vercel-token-pass-2026-10-16.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

const JSON_COLUMNS = ['features', 'quotas', 'model_selector'];
type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'plans' | 'model_plan_mapping';
export interface TokenPassSeedStep { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }
export interface TokenPassSeedResult { steps: TokenPassSeedStep[]; missingModels: string[] }

/** Caller owns a serializable transaction. Default preview issues SELECT only.
 *  Never creates models: --apply aborts if a featured model is not in the catalog. */
export async function seedVercelTokenPass(tx: Sql, apply = false): Promise<TokenPassSeedResult> {
  const one = (rows: Row[], target: string) => {
    if (rows.length > 1) throw new Error(`Ambiguous ${target}; transaction aborted. Review duplicates before retrying.`);
    return rows[0] ?? null;
  };
  const existingGateway = one(await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(VERCEL_SLUGS)}`, 'providers/vercel');
  const catalog = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(TOKEN_PASS_MODELS.flatMap(m => [...m.slugs]))}`;
  const models: Row[] = [];
  const missingModels: string[] = [];
  for (const model of TOKEN_PASS_MODELS) {
    const found = one(catalog.filter(row => (model.slugs as readonly string[]).includes(String(row.slug))), `models/${model.slugs[0]}`);
    if (found) models.push(found); else missingModels.push(model.name);
  }
  if (apply && missingModels.length) {
    throw new Error(`Missing catalog models: ${missingModels.join(', ')}; add them first. Transaction aborted.`);
  }
  const existingPlan = existingGateway
    ? one(await tx<Row[]>`SELECT * FROM plans WHERE provider_id = ${existingGateway.id} AND slug = ${TOKEN_PASS_SLUG}`, `plans/${TOKEN_PASS_SLUG}`)
    : null;
  const mappings = existingPlan ? await tx<Row[]>`SELECT * FROM model_plan_mapping WHERE plan_id = ${existingPlan.id}` : [];

  const steps: TokenPassSeedStep[] = [];
  let previewId = -1;
  const save = async (table: Table, existing: Row | null, values: Record<string, unknown>, target: string) => {
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) return existing!;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    const payload = { ...values, ...(table === 'model_plan_mapping' ? {} : { updated_at: new Date() }) };
    const write = Object.fromEntries(Object.entries(payload).map(([key, value]) =>
      [key, JSON_COLUMNS.includes(key) && value !== null ? tx.json(value as never) : value]));
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

  const gateway = existingGateway ?? await save('providers', null, {
    name: 'Vercel AI Gateway', slug: 'vercel-ai-gateway', type: 'aggregator',
    website: 'https://vercel.com', pricing_url: TOKEN_PASS_DOCS, currency: 'USD',
    region: null, access_from_china: null, notes: `Source: ${TOKEN_PASS_SOURCE}`,
  }, 'vercel-ai-gateway');

  const plan = await save('plans', existingPlan, {
    provider_id: gateway.id, product_id: gateway.id, name: 'Token Pass', slug: TOKEN_PASS_SLUG,
    price: 30, currency: 'USD', pricing_model: 'subscription', price_unit: 'per_month',
    annual_price: null, price_yearly_monthly: null,
    plan_kind: 'gateway_subscription', plan_category: 'api', plan_line: 'vercel-token-pass', tier: 'team', tier_rank: 1,
    billing_granularity: 'flat_monthly', source: 'manual', is_official: true, is_contact_sales: false,
    quota_unit: 'usd', monthly_api_credit_usd: 80, monthly_api_credit_status: null,
    // [] = no token/request allowance published; the allowance is the USD credit above.
    quotas: [], included_usage_unit: null, included_usage_amount: null, pack_validity_days: null,
    has_overage_pricing: false, overage_input_price_per_1m: null, overage_output_price_per_1m: null,
    model_selector: { only_extra: true, extra: models.map(model => model.slug) },
    third_party_coverage: 'full', third_party_coverage_note: 'Only GLM 5.3 and Kimi K3 via the token-pass provider; fast variants and other models are not covered.',
    data_for_discount: false, data_for_discount_note: 'Zero Data Retention by default; prompts are not used for training.',
    region: null, access_from_china: null,
    features: TOKEN_PASS_FEATURES, notes: NOTES, last_verified: VERIFIED_AT,
  }, TOKEN_PASS_SLUG);

  for (const model of models) {
    const existing = one(mappings.filter(row => row.model_id === model.id), `${TOKEN_PASS_SLUG}/${model.slug}`);
    await save('model_plan_mapping', existing, { model_id: model.id, plan_id: plan.id, source: 'manual' }, `${TOKEN_PASS_SLUG}/${model.slug}`);
  }
  return { steps, missingModels };
}
