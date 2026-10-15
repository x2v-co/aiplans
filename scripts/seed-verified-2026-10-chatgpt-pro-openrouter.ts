#!/usr/bin/env tsx
/**
 * Seed ChatGPT Pro 100/200/500, verified 2026-10-13 against official sources.
 * OpenRouter floor writes retired by audit #5 (2026-10-15); use the scraper.
 *
 * Dry-run by default; --apply writes.
 * Atomic: phase 1 resolves every provider, plan, model and price row (read-only).
 * If anything fails to resolve, the script exits 1 and writes nothing. Phase 2
 * performs all writes inside one transaction.
 */
import { databaseSql as sql } from './db/postgres-admin';
import {
  CHATGPT_PRO_PLANS,
  LEGACY_CHATGPT_PRO_SLUG,
  LEGACY_CHATGPT_PRO_NOTE,
  CHATGPT_PRO_3P_NOTE,
  VERIFIED_AT_ISO,
} from './data/verified-2026-10-chatgpt-pro-openrouter';
import { subscriptionPlanRow } from './data/subscription-plan-row';
import type { SubscriptionSeed } from './data/verified-2026-10-subscriptions';

const APPLY = process.argv.includes('--apply');
const NOW = new Date();
const VERIFIED_AT = new Date(VERIFIED_AT_ISO);

type Id = { id: number };
type PlanStep = { seed: SubscriptionSeed; existingId: number | null };
type LegacyStep = { id: number; notes: string } | null;

const errors: string[] = [];

async function plan() {
  const providers = await sql<Array<{ id: number; slug: string }>>`
    SELECT id, slug FROM providers WHERE slug = 'openai'`;
  const openai = providers.find((p) => p.slug === 'openai');
  if (!openai) errors.push('missing provider openai');

  const plans: PlanStep[] = [];
  let legacy: LegacyStep = null;
  if (openai) {
    console.log('ChatGPT Pro tiers');
    for (const seed of CHATGPT_PRO_PLANS) {
      const [row] = await sql<Id[]>`SELECT id FROM plans WHERE provider_id = ${openai.id} AND slug = ${seed.slug}`;
      plans.push({ seed, existingId: row?.id ?? null });
      console.log(`  ${row ? '↻' : '➕'} plan openai/${seed.slug}: USD ${seed.price}/mo, quotas ${JSON.stringify(seed.quotas)}, third_party_coverage=${seed.thirdPartyCoverage}`);
    }
    const [old] = await sql<Array<{ id: number; notes: string | null }>>`
      SELECT id, notes FROM plans WHERE provider_id = ${openai.id} AND slug = ${LEGACY_CHATGPT_PRO_SLUG}`;
    if (!old) console.log(`  · legacy ${LEGACY_CHATGPT_PRO_SLUG}: not present`);
    else if ((old.notes ?? '').includes('[aiplans:superseded-by')) console.log(`  · legacy ${LEGACY_CHATGPT_PRO_SLUG}: already marked`);
    else {
      legacy = { id: old.id, notes: old.notes ?? '' };
      console.log(`  ↻ legacy ${LEGACY_CHATGPT_PRO_SLUG}: mark superseded (keep row), third_party_coverage=none`);
    }
  }

  return { openai, plans, legacy };
}

async function main() {
  console.log(`\n💵 seed-verified-2026-10-chatgpt-pro-openrouter ${APPLY ? '[APPLY]' : '[DRY-RUN]'}\n`);
  const p = await plan();

  if (errors.length) {
    console.error(`\n❌ ${errors.length} item(s) failed to resolve; nothing written:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nResolved: ${p.plans.length} plans, ${p.legacy ? 1 : 0} legacy mark, 0 OpenRouter writes (retired).`);
  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply to write (single transaction).');
    return;
  }

  await sql.begin(async (rawTx) => {
    // postgres.js TransactionSql typing drops the call signature; runtime is the same.
    const tx = rawTx as unknown as typeof sql;
    for (const step of p.plans) {
      const row = subscriptionPlanRow(step.seed, p.openai!.id, NOW);
      const keys = Object.keys(row) as Array<keyof typeof row>;
      if (step.existingId) await tx`UPDATE plans SET ${tx(row as never, ...(keys as never[]))} WHERE id = ${step.existingId}`;
      else await tx`INSERT INTO plans ${tx(row as never, ...(keys as never[]))}`;
    }
    if (p.legacy) {
      await tx`UPDATE plans SET notes = ${`${LEGACY_CHATGPT_PRO_NOTE}\n${p.legacy.notes}`.trim()},
        third_party_coverage = 'none', third_party_coverage_note = ${CHATGPT_PRO_3P_NOTE},
        last_verified = ${VERIFIED_AT}, updated_at = ${NOW} WHERE id = ${p.legacy.id}`;
    }

  });
  console.log('✅ Applied in one transaction.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => sql.end());
