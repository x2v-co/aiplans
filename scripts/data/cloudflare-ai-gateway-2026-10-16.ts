import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

// Facts re-verified 2026-10-16 against the official Cloudflare docs.
export const CF_GATEWAY_PRICING = 'https://developers.cloudflare.com/ai-gateway/reference/pricing/';
export const CF_GATEWAY_UNIFIED_BILLING = 'https://developers.cloudflare.com/ai-gateway/features/unified-billing/';
export const CF_GATEWAY_SLUG = 'cloudflare-ai-gateway';
/** Fee on prepaid credit purchases ($100 credit => $105 charge). Per-token prices pass through unchanged. */
export const CF_UNIFIED_BILLING_FEE_PCT = 5;

/** Effective USD cost of model usage bought through Unified Billing credits. */
export function cfUnifiedBillingEffectiveCost(providerListCostUsd: number): number {
  if (!Number.isFinite(providerListCostUsd) || providerListCostUsd < 0) throw new RangeError('cost must be a non-negative number');
  return Math.round(providerListCostUsd * (100 + CF_UNIFIED_BILLING_FEE_PCT)) / 100;
}

export const CF_GATEWAY_NOTES = [
  'Pay-as-you-go aggregator channel (Unified Billing); NOT a gateway subscription: no monthly fee, no discounted credit.',
  `Prepaid credits loaded in the Cloudflare dashboard; a ${CF_UNIFIED_BILLING_FEE_PCT}% fee applies to every credit purchase (e.g. $100 credit = $105 charge). Optional auto top-up.`,
  'Provider per-token inference prices are passed through with no markup (same rates as going direct), so effective cost = provider list price × 1.05.',
  'In rare cases the credit balance can go negative; the shortfall is charged to the card on file at the start of the next month.',
  'AI Gateway is available on all Cloudflare plans. Unified Billing covers Workers AI plus third-party models (e.g. OpenAI, Anthropic, Google AI Studio, Google Vertex AI, xAI, Groq).',
  // TODO: per-model api_channel_prices rows are intentionally not seeded; reuse official provider prices if listings are added.
  `Sources: ${CF_GATEWAY_PRICING} ; ${CF_GATEWAY_UNIFIED_BILLING}`,
].join('\n');

export const CF_GATEWAY_PROVIDER = {
  name: 'Cloudflare AI Gateway', slug: CF_GATEWAY_SLUG, type: 'aggregator',
  website: 'https://developers.cloudflare.com/ai-gateway/', pricing_url: CF_GATEWAY_PRICING,
  api_docs_url: CF_GATEWAY_UNIFIED_BILLING, console_url: 'https://dash.cloudflare.com/?to=/:account/ai/ai-gateway',
  currency: 'USD', region: 'global', access_from_china: null, priority: 2,
  payment_methods: ['prepaid_credits'],
  notes: CF_GATEWAY_NOTES,
};

export function cfGatewaySeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-cloudflare-ai-gateway-2026-10-16.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
export interface CfGatewaySeedStep { table: 'providers'; target: string; action: 'insert' | 'update'; changes: ReturnType<typeof seedChanges> }

/** Caller owns the transaction. Default preview issues SELECT only; creates no plans or models. */
export async function seedCloudflareAiGateway(tx: Sql, apply = false): Promise<CfGatewaySeedStep[]> {
  const rows = await tx<Row[]>`SELECT * FROM providers WHERE slug = ${CF_GATEWAY_SLUG}`;
  if (rows.length > 1) throw new Error(`Ambiguous providers/${CF_GATEWAY_SLUG}; transaction aborted.`);
  const existing = rows[0] ?? null;
  const changes = seedChanges(existing, CF_GATEWAY_PROVIDER);
  if (!Object.keys(changes).length) return [];
  if (apply) {
    const write = { ...CF_GATEWAY_PROVIDER, payment_methods: tx.json(CF_GATEWAY_PROVIDER.payment_methods as never), updated_at: new Date() };
    const keys = Object.keys(write);
    if (existing) await tx`UPDATE ${tx('providers')} SET ${tx(write, ...keys)} WHERE id = ${existing.id}`;
    else await tx`INSERT INTO ${tx('providers')} ${tx(write, ...keys)} RETURNING id`;
  }
  return [{ table: 'providers', target: CF_GATEWAY_SLUG, action: existing ? 'update' : 'insert', changes }];
}
