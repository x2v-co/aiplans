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
      -- no ip_hash / ua_hash (request logs can provide those) and no converted column
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
  {
    name: '006_add_sgd_currency',
    sql: `
      ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_currency_check;
      ALTER TABLE plans ADD CONSTRAINT plans_currency_check
        CHECK (currency IN ('USD', 'CNY', 'EUR', 'GBP', 'JPY', 'KRW', 'SGD'));

      ALTER TABLE api_channel_prices DROP CONSTRAINT IF EXISTS channel_prices_currency_check;
      ALTER TABLE api_channel_prices ADD CONSTRAINT channel_prices_currency_check
        CHECK (currency IN ('USD', 'CNY', 'EUR', 'GBP', 'JPY', 'KRW', 'SGD'));

      ALTER TABLE exchange_rates DROP CONSTRAINT IF EXISTS exchange_rates_from_currency_check;
      ALTER TABLE exchange_rates ADD CONSTRAINT exchange_rates_from_currency_check
        CHECK (from_currency IN ('USD', 'CNY', 'EUR', 'GBP', 'JPY', 'KRW', 'SGD'));

      ALTER TABLE exchange_rates DROP CONSTRAINT IF EXISTS exchange_rates_to_currency_check;
      ALTER TABLE exchange_rates ADD CONSTRAINT exchange_rates_to_currency_check
        CHECK (to_currency IN ('USD', 'CNY', 'EUR', 'GBP', 'JPY', 'KRW', 'SGD'));

      -- This table predates a unique key on (from_currency, to_currency), so
      -- use an exact-key delete/insert pair instead of ON CONFLICT.
      DELETE FROM exchange_rates
       WHERE (from_currency = 'USD' AND to_currency = 'SGD')
          OR (from_currency = 'SGD' AND to_currency = 'USD');

      INSERT INTO exchange_rates (from_currency, to_currency, rate, source, is_active, valid_at, updated_at)
      VALUES
        ('USD', 'SGD', 1.35, 'fixed', true, now(), now()),
        ('SGD', 'USD', 0.7407407407, 'fixed', true, now(), now());
    `,
  },
  {
    name: '007_disable_retired_pricing_channels',
    sql: `
      -- DMXAPI disabled its pricing API, and Anyscale no longer publishes
      -- per-token model pricing. Keep historical rows for auditability, but
      -- do not expose them as currently purchasable offers.
      UPDATE api_channel_prices AS price
         SET is_available = false,
             notes = concat_ws(
               ' | ',
               nullif(price.notes, ''),
               'disabled 2026-08-18: provider no longer publishes per-token model pricing'
             ),
             updated_at = now()
        FROM providers AS provider
       WHERE price.provider_id = provider.id
         AND provider.slug IN ('dmxapi', 'anyscale')
         AND price.is_available IS DISTINCT FROM false;
    `,
  },
  {
    name: '008_disable_unverified_aggregator_prices',
    sql: `
      -- SiliconFlow's current public pricing page no longer verifies any of
      -- these legacy rows. Preserve them as history, but do not present stale
      -- and previously parser-corrupted prices as active offers.
      UPDATE api_channel_prices AS price
         SET is_available = false,
             notes = concat_ws(
               ' | ',
               nullif(price.notes, ''),
               'disabled 2026-08-18: current provider page does not verify the legacy model catalog'
             ),
             updated_at = now()
        FROM providers AS provider
       WHERE price.provider_id = provider.id
         AND provider.slug = 'siliconflow'
         AND price.is_available IS DISTINCT FROM false;

      -- The old Fireworks scraper guessed prices from nearby marketing-page
      -- numbers. These rows are absent from the official named-model pricing
      -- table now used by the scraper.
      UPDATE api_channel_prices AS price
         SET is_available = false,
             notes = concat_ws(
               ' | ',
               nullif(price.notes, ''),
               'disabled 2026-08-18: legacy guessed price absent from official named-model table'
             ),
             updated_at = now()
        FROM providers AS provider, models AS model
       WHERE price.provider_id = provider.id
         AND price.model_id = model.id
         AND provider.slug = 'fireworks'
         AND model.slug IN ('mixtral-8x22b', 'mixtral-8x7b', 'qwen3-72b', 'qwen-vl', 'deepseek-v3')
         AND price.is_available IS DISTINCT FROM false;

      -- Replicate's pricing examples currently contain Claude 3.7 and
      -- DeepSeek R1 only. Claude 3.5 was emitted by the previous range-based
      -- parser even though no matching card existed.
      UPDATE api_channel_prices AS price
         SET is_available = false,
             notes = concat_ws(
               ' | ',
               nullif(price.notes, ''),
               'disabled 2026-08-18: legacy parser emitted a model not listed in token-priced examples'
             ),
             updated_at = now()
        FROM providers AS provider, models AS model
       WHERE price.provider_id = provider.id
         AND price.model_id = model.id
         AND provider.slug = 'replicate'
         AND model.slug = 'claude-3.5-sonnet'
         AND price.is_available IS DISTINCT FROM false;
    `,
  },
  {
    name: '009_remove_transient_fireworks_duplicates',
    sql: `
      -- These four slugs were created by the pre-canonical Fireworks display
      -- names during the 2026-08-18 refresh. Each is an orphan apart from its
      -- duplicate Fireworks price; the corrected scraper writes the canonical
      -- model slugs instead.
      DELETE FROM api_channel_prices AS price
       USING providers AS provider, models AS model
       WHERE price.provider_id = provider.id
         AND price.model_id = model.id
         AND provider.slug = 'fireworks'
         AND model.slug IN (
           'openai-gpt-oss-120b',
           'openai-gpt-oss-20b',
           'qwen-3.7-plus',
           'deepseek-v4-flash-(0731)'
         );

      DELETE FROM models AS model
       WHERE model.slug IN (
           'openai-gpt-oss-120b',
           'openai-gpt-oss-20b',
           'qwen-3.7-plus',
           'deepseek-v4-flash-(0731)'
         )
         AND NOT EXISTS (SELECT 1 FROM api_channel_prices p WHERE p.model_id = model.id)
         AND NOT EXISTS (SELECT 1 FROM model_plan_mapping m WHERE m.model_id = model.id)
         AND NOT EXISTS (SELECT 1 FROM model_offical o WHERE o.model_id = model.id)
         AND NOT EXISTS (SELECT 1 FROM model_benchmark_scores s WHERE s.model_id = model.id)
         AND NOT EXISTS (SELECT 1 FROM evaluation_run r WHERE r.model_id = model.id);
    `,
  },
  {
    name: '010_mark_disabled_plan_sources_manual',
    sql: `
      -- These plan scrapers are intentionally disabled (the products are
      -- auth-walled, free, or not present in rendered public pricing). Their
      -- curated rows must follow the manual freshness contract instead of
      -- producing recurring scraper-stale warnings.
      UPDATE plans AS plan
         SET source = 'manual',
             updated_at = now()
        FROM providers AS provider
       WHERE plan.provider_id = provider.id
         AND provider.slug IN ('moonshot', 'moonshot-china', 'baidu', 'volcengine', 'seed')
         AND plan.source = 'scraper';
    `,
  },
  {
    name: '011_remove_retired_zai_free_plan',
    sql: `
      -- Z.AI's current official subscription page lists Lite, Pro, and Max.
      -- The former Free plan is no longer offered, so remove its mappings
      -- before deleting the stale scraper row.
      DELETE FROM model_plan_mapping AS mapping
       USING plans AS plan, providers AS provider
       WHERE mapping.plan_id = plan.id
         AND plan.provider_id = provider.id
         AND provider.slug = 'zhipu-global'
         AND plan.slug = 'z-ai-free';

      DELETE FROM plans AS plan
       USING providers AS provider
       WHERE plan.provider_id = provider.id
         AND provider.slug = 'zhipu-global'
         AND plan.slug = 'z-ai-free';
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
