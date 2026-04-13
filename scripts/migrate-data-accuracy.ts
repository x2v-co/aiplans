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
