#!/usr/bin/env tsx
/**
 * One-shot migrations for data accuracy work (2026-04-13):
 *
 *   1. Create price_history table (was referenced by logPriceChange but never existed)
 *   2. Add notes column to plans (currently stored in features.jsonb as a workaround)
 *   3. Backfill plans.notes from features.notes / features.contactSales
 *
 * Idempotent (uses IF NOT EXISTS / IF EXISTS). Safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/migrate-data-accuracy.ts            # apply
 *   npx tsx scripts/migrate-data-accuracy.ts --dry-run  # print SQL only
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';

const DRY_RUN = process.argv.includes('--dry-run');
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set in .env.local');
  process.exit(1);
}

interface Migration {
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    name: '001_create_price_history',
    sql: `
      CREATE TABLE IF NOT EXISTS price_history (
        id              bigserial PRIMARY KEY,
        channel_price_id integer NOT NULL,
        old_input_price  real,
        new_input_price  real,
        old_output_price real,
        new_output_price real,
        change_percent   real,
        currency         varchar(8),
        source           text,
        recorded_at      timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_price_history_channel_price_id
        ON price_history (channel_price_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at
        ON price_history (recorded_at DESC);
    `,
  },
  {
    name: '002_add_plans_notes',
    sql: `
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS notes text;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_contact_sales boolean DEFAULT false;
    `,
  },
  {
    name: '003_backfill_plans_notes_from_features',
    sql: `
      -- Move features.notes -> notes column (only where notes is empty)
      UPDATE plans
         SET notes = features->>'notes'
       WHERE notes IS NULL
         AND features ? 'notes';

      -- Move features.contactSales -> is_contact_sales
      UPDATE plans
         SET is_contact_sales = true
       WHERE (features->>'contactSales')::boolean IS TRUE
         AND is_contact_sales IS DISTINCT FROM true;

      -- Keep features for forward-compat but drop the migrated keys
      UPDATE plans
         SET features = features - 'notes' - 'contactSales'
       WHERE features ? 'notes' OR features ? 'contactSales';
    `,
  },
  {
    name: '004_add_plans_source_column',
    sql: `
      -- Source of truth for each plan row:
      --   'scraper' = inserted/maintained by a plan-*-dynamic.ts scraper
      --   'manual'  = inserted by hand or fix-plans-audit.ts (web-verified
      --               ground truth that may not appear on the vendor's
      --               public marketing page, e.g. claude-team-premium)
      -- cleanupOutdatedPlans() must only delete source='scraper' rows so
      -- that scrapers can never wipe out manually-curated entries.
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS source text DEFAULT 'scraper';

      -- Backfill: any plan whose slug matches a NEW_PLANS entry from
      -- fix-plans-audit.ts is manual. Listed explicitly so the migration
      -- doesn't accidentally re-classify legitimate scraper rows.
      UPDATE plans SET source = 'manual'
       WHERE slug IN (
         -- MiniMax 6 official Token Plan tiers
         'minimax-standard-starter', 'minimax-standard-plus',
         'minimax-standard-max', 'minimax-highspeed-plus',
         'minimax-highspeed-max', 'minimax-highspeed-ultra',
         -- OpenAI plans referenced by config but not always on pricing page
         'chatgpt-team', 'chatgpt-enterprise',
         -- Anthropic plans (Max 5x/20x and Team Premium are not on the
         -- main marketing page)
         'claude-free', 'claude-max', 'claude-max-5x', 'claude-max-20x',
         'claude-team', 'claude-team-premium', 'claude-enterprise',
         -- Google AI tiers (Plus and Ultra are post-Gemini-Advanced rebrand)
         'gemini-advanced', 'google-ai-plus', 'google-ai-ultra',
         -- Mistral Le Chat tiers
         'le-chat-pro', 'le-chat-team'
       )
         AND source IS DISTINCT FROM 'manual';
    `,
  },
  {
    name: '005_create_clicks',
    sql: `
      -- Click tracking for affiliate short-links under /go/:source/:campaign/:product
      -- Schema kept minimal per office-hours 2026-04-15 design doc:
      -- no ip_hash / ua_hash (Vercel logs have those) and no converted column
      -- (conversions read from each vendor's affiliate dashboard).
      CREATE TABLE IF NOT EXISTS clicks (
        id              bigserial PRIMARY KEY,
        utm_source      text NOT NULL,
        utm_campaign    text NOT NULL,
        product         text NOT NULL,
        ts              timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_clicks_campaign_ts
        ON clicks (utm_campaign, ts DESC);
      CREATE INDEX IF NOT EXISTS idx_clicks_product_ts
        ON clicks (product, ts DESC);
    `,
  },
];

async function main() {
  console.log(`\n🔧 migrate-data-accuracy ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);

  if (DRY_RUN) {
    for (const m of MIGRATIONS) {
      console.log(`-- ${m.name}`);
      console.log(m.sql.trim());
      console.log();
    }
    return;
  }

  const sql = postgres(DATABASE_URL, { onnotice: () => {} });
  try {
    for (const m of MIGRATIONS) {
      console.log(`▶ ${m.name}`);
      try {
        await sql.unsafe(m.sql);
        console.log(`  ✓ applied`);
      } catch (e) {
        console.error(`  ❌ ${(e as Error).message}`);
        throw e;
      }
    }
    console.log(`\n✅ All migrations applied`);
  } finally {
    await sql.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
