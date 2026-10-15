import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

// Facts: /workspace/aiplans-gaps-facts.md, Manus Team section only.
export const MANUS_TEAM_SOURCE = 'https://manus.im/team';
export const MANUS_TEAM_CREDITS = 'Base 4,000 credits/seat/month, pooled across the team.';
export const MANUS_TEAM_SSO = 'SSO is free at >=30 seats; below 30 seats, SSO is a flat US$150 add-on. [needs-verification] Add-on billing interval.';
export const MANUS_TEAM_TRAINING = 'Manus Team never trains on data.';
const VERIFIED_AT = new Date('2026-10-15T00:00:00Z');

export function manusTeamSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-manus-team-2026-10-15.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'plans';
export interface ManusTeamSeedStep { table: Table; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

/** Caller owns a serializable transaction. Default preview issues SELECT only. */
export async function seedManusTeam(tx: Sql, apply = false): Promise<ManusTeamSeedStep[]> {
  const one = (rows: Row[], target: string) => {
    if (rows.length > 1) throw new Error(`Ambiguous ${target}; transaction aborted. Review duplicates before retrying.`);
    return rows[0] ?? null;
  };
  const existingProvider = one(await tx<Row[]>`SELECT * FROM providers WHERE slug = 'manus'`, 'providers/manus');
  const existingPlan = one(await tx<Row[]>`SELECT * FROM plans WHERE slug = 'manus-team'`, 'plans/manus-team');
  // A slug collision must never transfer another provider's plan to Manus.
  if (existingPlan && (!existingProvider || [existingPlan.provider_id, existingPlan.product_id]
    .some(id => id != null && id !== existingProvider.id))) {
    throw new Error('Ambiguous plans/manus-team ownership; transaction aborted.');
  }

  const steps: ManusTeamSeedStep[] = [];
  let previewId = -1;
  const save = async (table: Table, existing: Row | null, values: Record<string, unknown>, target: string) => {
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) return existing!;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    const payload = { ...values, updated_at: new Date() };
    const write = Object.fromEntries(Object.entries(payload).map(([key, value]) =>
      [key, ['features', 'quotas'].includes(key) && value !== null ? tx.json(value as never) : value]));
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

  // Existing provider metadata belongs to the wider catalog; preserve it.
  const provider = existingProvider ?? await save('providers', null, {
    name: 'Manus', slug: 'manus', website: 'https://manus.im', pricing_url: MANUS_TEAM_SOURCE,
    type: 'official', currency: 'USD', region: null, access_from_china: null,
    description: 'Manus Team subscription plans.',
    notes: `[needs-verification] Regional access and payment methods. Source: ${MANUS_TEAM_SOURCE}`,
  }, 'manus');

  await save('plans', existingPlan, {
    provider_id: provider.id, product_id: provider.id, name: 'Manus Team', slug: 'manus-team',
    price: 20, annual_price: 200, price_yearly_monthly: null,
    currency: 'USD', price_unit: 'per_month', pricing_model: 'subscription',
    billing_granularity: 'flat_monthly', is_contact_sales: false,
    plan_kind: 'agent', plan_category: 'agent', plan_line: 'manus', tier: 'team', tier_rank: 1,
    source: 'manual', is_official: true,
    quota_unit: 'credits', included_credits: 4000, included_usage_unit: 'credit', included_usage_amount: 4000,
    quotas: [{ amount: 4000, unit: 'credit', period: 'month', note: MANUS_TEAM_CREDITS }],
    monthly_api_credit_usd: null, monthly_api_credit_status: null,
    monthly_message_limit: null, requests_per_month: null,
    third_party_coverage: 'unknown', third_party_coverage_note: '[needs-verification] Included models.',
    region: null, access_from_china: null,
    data_for_discount: false, data_for_discount_note: MANUS_TEAM_TRAINING,
    features: [MANUS_TEAM_CREDITS, MANUS_TEAM_SSO, MANUS_TEAM_TRAINING],
    notes: ['From US$20/seat/month or US$200/seat/year. Both prices are per seat.',
      MANUS_TEAM_CREDITS, MANUS_TEAM_SSO, MANUS_TEAM_TRAINING,
      '[needs-verification] Regional access, payment methods and included models.',
      `Source: ${MANUS_TEAM_SOURCE}`].join('\n'),
    last_verified: VERIFIED_AT,
  }, 'manus-team');
  return steps;
}
