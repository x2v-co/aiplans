#!/usr/bin/env tsx
/** Read-only preview by default. --db-dry-run rehearses writes; only --apply commits. */
import { pathToFileURL } from 'node:url';
import type { Sql } from 'postgres';
import { getExchangeRateSync } from '../src/lib/exchange-rates';
import {
  PAYG_MIXES, payAsYouGoEstimate, type PaygChannelPrice, type PaygMix, type PaygRecord,
} from '../src/lib/quota/pay-as-you-go';
import { runRehearsable } from './db/rehearsal';

export type PaygSeedMode = 'dry-run' | 'db-dry-run' | 'apply';

export function paygSeedMode(args: string[]): PaygSeedMode {
  if (args.length > 1 || args.some(arg => !['--dry-run', '--db-dry-run', '--apply'].includes(arg))) {
    throw new Error('Usage: seed-quota-payg.ts [--dry-run | --db-dry-run | --apply]');
  }
  return args[0] === '--apply' ? 'apply' : args[0] === '--db-dry-run' ? 'db-dry-run' : 'dry-run';
}

type CurrentEstimate = PaygRecord & { id: number };
type Change = { previousId: number | null; blendedPriceUsdPerMTok: number; record: PaygRecord };
type SeedPlan = {
  changes: Change[]; unchanged: number;
  skipped: { channelId: number; reason: string }[]; scannedChannels: number;
};

function identity(row: Pick<PaygRecord, 'plan_slug' | 'served_model' | 'window' | 'usage_mix_id'>): string {
  return JSON.stringify([row.plan_slug, row.served_model, row.window, row.usage_mix_id]);
}

/** Fail before querying any quota table when 0005 has not been applied. */
async function requireQuotaSchema(sql: Sql): Promise<void> {
  const [tables] = await sql<{ estimates: boolean; mixes: boolean }[]>`
    SELECT to_regclass('quota_estimates') IS NOT NULL AS estimates,
           to_regclass('usage_mixes') IS NOT NULL AS mixes
  `;
  if (!tables?.estimates || !tables?.mixes) throw new Error('需先应用 0005：缺少 quota_estimates 或 usage_mixes 表。');
}

async function preview(sql: Sql, asOf: Date, lock: boolean): Promise<SeedPlan> {
  await requireQuotaSchema(sql);
  const mixRows = await sql<{ id: string; cache_read_pct: string; input_pct: string; output_pct: string }[]>`
    SELECT id, cache_read_pct, input_pct, output_pct FROM usage_mixes
    WHERE id IN ('coding-high-cache', 'chat') ORDER BY id
  `;
  const mixes: PaygMix[] = mixRows.map(row => ({ id: row.id,
    cacheReadPct: Number(row.cache_read_pct), inputPct: Number(row.input_pct), outputPct: Number(row.output_pct) }));
  for (const expected of PAYG_MIXES) {
    const mix = mixes.find(row => row.id === expected.id);
    if (!mix || mix.cacheReadPct !== expected.cacheReadPct || mix.inputPct !== expected.inputPct || mix.outputPct !== expected.outputPct) {
      throw new Error(`usage_mixes 缺失或配比不符：${expected.id}；需先应用 0005 并核对配比。`);
    }
  }
  // Same availability/lifecycle scope as provider pages; no provider-type whitelist.
  // Unit/currency/verification/price exclusions are reported rather than silently filtered.
  const channels = await sql<PaygChannelPrice[]>`
    SELECT cp.*, p.slug AS provider_slug, m.slug AS model_slug, p.pricing_url
    FROM api_channel_prices cp
    JOIN providers p ON p.id = cp.provider_id JOIN models m ON m.id = cp.model_id
    WHERE cp.is_available = true
      AND (m.shutdown_date IS NULL OR m.shutdown_date > ${asOf.toISOString().slice(0, 10)}::date)
    ORDER BY p.slug, m.slug, cp.id
  `;
  const current = lock
    ? await sql<CurrentEstimate[]>`SELECT * FROM quota_estimates WHERE is_current AND plan_slug LIKE 'payg:%' FOR UPDATE`
    : await sql<CurrentEstimate[]>`SELECT * FROM quota_estimates WHERE is_current AND plan_slug LIKE 'payg:%'`;
  const byKey = new Map(current.map(row => [identity(row), row]));
  const seen = new Set<string>();
  const plan: SeedPlan = { changes: [], unchanged: 0, skipped: [], scannedChannels: channels.length };
  for (const channel of channels) {
    for (const mix of mixes) {
      const result = payAsYouGoEstimate(channel, mix, {
        asOf, usdPerCurrencyUnit: getExchangeRateSync(channel.currency ?? '', 'USD'),
      });
      if (result.status === 'skipped') {
        plan.skipped.push({ channelId: channel.id, reason: result.reason });
        break; // Channel-level exclusions are identical for both mixes.
      }
      const { record } = result;
      const key = identity(record);
      if (seen.has(key)) throw new Error(`Duplicate channel identity (${channel.id}): ${key}; resolve source rows before seeding.`);
      seen.add(key);
      const old = byKey.get(key);
      if (old && old.plan_id === null && String(old.est_tokens_low) === record.est_tokens_low
        && String(old.est_tokens_high) === record.est_tokens_high && old.confidence === record.confidence
        && old.verified_at != null && new Date(old.verified_at).toISOString() === record.verified_at && old.notes === record.notes) {
        plan.unchanged++;
      } else {
        plan.changes.push({ previousId: old?.id ?? null, blendedPriceUsdPerMTok: result.blendedPriceUsdPerMTok, record });
      }
    }
  }
  return plan;
}

async function writeChanges(sql: Sql, changes: Change[]): Promise<void> {
  for (const { previousId, record: row } of changes) {
    // Insert replacements as noncurrent, link the old version, then activate.
    // The old range, price notes and verification timestamp are never overwritten.
    const [inserted] = await sql<{ id: number }[]>`
      INSERT INTO quota_estimates
        (plan_id, plan_slug, served_model, "window", est_tokens_low, est_tokens_high,
         usage_mix_id, confidence, verified_at, notes, is_current)
      VALUES (NULL, ${row.plan_slug}, ${row.served_model}, ${row.window}, ${row.est_tokens_low}, ${row.est_tokens_high},
              ${row.usage_mix_id}, ${row.confidence}, ${row.verified_at}, ${row.notes}, ${previousId === null})
      RETURNING id
    `;
    if (previousId !== null) {
      await sql`UPDATE quota_estimates SET is_current = false, superseded_by = ${inserted.id} WHERE id = ${previousId}`;
      await sql`UPDATE quota_estimates SET is_current = true WHERE id = ${inserted.id}`;
    }
  }
}

/** Import-safe and injectable: tests never load credentials or create a real client. */
export async function seedQuotaPayg(sql: Sql, mode: PaygSeedMode, asOf = new Date()) {
  const plan = mode === 'dry-run'
    ? await sql.begin('isolation level repeatable read read only', tx => preview(tx as unknown as Sql, asOf, false))
    : await runRehearsable(sql, mode === 'apply', async rawTx => {
      const tx = rawTx as unknown as Sql;
      const planned = await preview(tx, asOf, true);
      await writeChanges(tx, planned.changes);
      return planned;
    });
  return {
    mode, scannedChannels: plan.scannedChannels,
    inserted: plan.changes.filter(change => change.previousId === null).length,
    superseded: plan.changes.filter(change => change.previousId !== null).length,
    unchanged: plan.unchanged, skipped: plan.skipped,
    samples: plan.changes.slice(0, 3),
  };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const mode = paygSeedMode(args);
  // Deliberately no dotenv or postgres-admin import: credentials must be supplied by the operator.
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required (supply via environment; .env files are not loaded).');
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, { max: 1, connect_timeout: 10, prepare: false });
  try {
    const report = await seedQuotaPayg(sql, mode);
    console.log(JSON.stringify(report, null, 2));
    console.log(mode === 'dry-run' ? 'Read-only preview; no writes executed.'
      : mode === 'db-dry-run' ? 'DB rehearsal: writes executed then ROLLBACK; nothing committed.' : 'Committed.');
  } finally { await sql.end({ timeout: 5 }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
