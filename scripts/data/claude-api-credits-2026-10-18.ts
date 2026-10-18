import type { Sql } from 'postgres';
import { MAX_API_CREDIT_NOTE } from './catalog-audit-2026-10-15';

/**
 * Claude Max/Team monthly API credits, verified 2026-10-18 against
 * https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers
 * Max 5x $100, Max 20x $200; Team $20/Standard seat, $100/Premium seat, pooled per team, capped at $500.
 * Plans store the per-plan (or per-seat) amount; the pool cap lives in the note.
 */
export const CLAUDE_API_CREDITS_SOURCE = 'https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers';
export const CLAUDE_API_CREDITS_VERIFIED_AT = new Date('2026-10-18T00:00:00Z');
const SCOPE = 'Covers the Claude API, Claude Managed Agents, the Claude Agent SDK and playground in the Claude Console only; excludes Claude Code, extra usage in the Claude apps, and Claude on AWS/Bedrock/Google Cloud/Microsoft Foundry. Claim by linking a Console organization after 7 days on the plan. Refreshes each billing cycle (monthly on annual plans); unused credit expires, no rollover.';
export const CLAUDE_API_CREDITS: Record<string, { usd: number; note: string }> = {
  'claude-max-5x': { usd: 100, note: `[api-credit] Includes $100/month Claude API credit. ${SCOPE} Source: ${CLAUDE_API_CREDITS_SOURCE} (verified 2026-10-18).` },
  'claude-max-20x': { usd: 200, note: `[api-credit] Includes $200/month Claude API credit. ${SCOPE} Source: ${CLAUDE_API_CREDITS_SOURCE} (verified 2026-10-18).` },
  'claude-team': { usd: 20, note: `[api-credit] Includes $20/month Claude API credit per Standard seat; all seats pool into one team balance capped at $500/month (discounted Team plans same). ${SCOPE} Source: ${CLAUDE_API_CREDITS_SOURCE} (verified 2026-10-18).` },
  'claude-team-premium': { usd: 100, note: `[api-credit] Includes $100/month Claude API credit per Premium seat; all seats pool into one team balance capped at $500/month (discounted Team plans same). ${SCOPE} Source: ${CLAUDE_API_CREDITS_SOURCE} (verified 2026-10-18).` },
};

/** Drop the 10-15 [needs-verification] credit note and any older [api-credit] line, then append the verified one. */
export function claudeCreditNotes(notes: unknown, slug: string): string {
  const credit = CLAUDE_API_CREDITS[slug];
  if (!credit) throw new Error(`No verified Claude API credit for ${slug}`);
  const kept = String(notes ?? '').split('\n').filter(line => line.trim() && line !== MAX_API_CREDIT_NOTE && !line.startsWith('[api-credit]'));
  return [...kept, credit.note].join('\n');
}

export function claudeCreditValues(plan: { slug?: unknown; notes?: unknown }) {
  const slug = String(plan.slug);
  return { monthly_api_credit_usd: CLAUDE_API_CREDITS[slug].usd, monthly_api_credit_status: null, notes: claudeCreditNotes(plan.notes, slug) };
}

export function claudeCreditSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-claude-api-credits-2026-10-18.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Plan = { id: number; slug: string; notes: string | null; monthly_api_credit_usd: number | null; monthly_api_credit_status: string | null };
export interface ClaudeCreditStep { table: 'plans'; target: string; id: number; changes: Record<string, { from: unknown; to: unknown }> }

/** Caller owns a serializable transaction. Only touches anthropic Max 5x/20x and Team plans; missing rows are skipped. */
export async function seedClaudeApiCredits(tx: Sql, apply = false): Promise<ClaudeCreditStep[]> {
  const providers = await tx<Array<{ id: number }>>`SELECT id FROM providers WHERE slug = 'anthropic'`;
  if (providers.length !== 1) throw new Error(`Expected exactly one anthropic provider, found ${providers.length}; nothing written.`);
  const plans = await tx<Plan[]>`
    SELECT id, slug, notes, monthly_api_credit_usd, monthly_api_credit_status FROM plans
    WHERE provider_id = ${providers[0].id} AND slug IN ${tx(Object.keys(CLAUDE_API_CREDITS))}`;
  const steps: ClaudeCreditStep[] = [];
  for (const slug of Object.keys(CLAUDE_API_CREDITS)) {
    const matches = plans.filter(p => p.slug === slug);
    if (matches.length > 1) throw new Error(`Duplicate anthropic/${slug} plans; nothing written.`);
    const [plan] = matches;
    if (!plan) continue;
    const to = claudeCreditValues(plan);
    const changes: ClaudeCreditStep['changes'] = {};
    for (const [key, value] of Object.entries(to)) {
      const from = (plan as Record<string, unknown>)[key];
      if (from !== value) changes[key] = { from, to: value };
    }
    if (!Object.keys(changes).length) continue;
    if (apply) {
      await tx`UPDATE plans SET monthly_api_credit_usd = ${to.monthly_api_credit_usd}, monthly_api_credit_status = ${to.monthly_api_credit_status},
        notes = ${to.notes}, last_verified = ${CLAUDE_API_CREDITS_VERIFIED_AT}, updated_at = ${new Date()} WHERE id = ${plan.id}`;
    }
    steps.push({ table: 'plans', target: `anthropic/${slug}`, id: plan.id, changes });
  }
  return steps;
}
