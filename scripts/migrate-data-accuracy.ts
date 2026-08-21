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
  {
    name: '012_fix_xai_provider_logo',
    sql: `
      -- Grok/X.AI was accidentally assigned Meta's logo during the initial
      -- provider-logo backfill. Keep the correction idempotent for every
      -- subsequent production deployment.
      UPDATE providers
         SET logo_url = '/providers/xai.ico',
             updated_at = now()
       WHERE slug = 'grok';
    `,
  },
  {
    name: '013_add_plan_kinds_and_model_selector',
    sql: `
      -- Product-line taxonomy. Orthogonal to \`tier\`: a vendor can sell a Pro
      -- chat plan, a Pro coding plan, and a token pack at the same time, and
      -- comparing across those lines is meaningless.
      --   chat       = consumer chat subscription (ChatGPT Plus, Claude Pro)
      --   coding     = IDE / CLI coding subscription (Copilot, Claude Code seats)
      --   agent      = autonomous-agent product (credits or task quotas)
      --   token_pack = prepaid token bundle, no recurring entitlement
      --   api_tier   = rate-limit tier on a pay-as-you-go API account
      --   bundle     = one price covering more than one of the above
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS plan_kind text DEFAULT 'chat';
      UPDATE plans SET plan_kind = 'chat' WHERE plan_kind IS NULL;
      ALTER TABLE plans ALTER COLUMN plan_kind SET NOT NULL;

      ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_plan_kind_chk;
      ALTER TABLE plans ADD CONSTRAINT plans_plan_kind_chk
        CHECK (plan_kind IN ('chat','coding','agent','token_pack','api_tier','bundle'));

      -- Named product line within a kind ('claude-code', 'minimax-highspeed').
      -- Two plans compare only when plan_kind AND plan_line match.
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS plan_line text;

      -- Ordering inside a line. Independent of \`tier\` because Max 5x and
      -- Max 20x are both tier='pro' but are not the same rung.
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS tier_rank integer;

      -- A bundle's non-primary kinds, for filtering without duplicating rows.
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS secondary_kinds text[] DEFAULT '{}';

      -- Rule that derives this plan's model list, materialized into
      -- model_plan_mapping after every scrape. Shape:
      --   { provider?: string, families?: string[], current_only?: boolean,
      --     extra?: string[], exclude?: string[] }
      -- current_only defaults to false: a model page for an older version in a
      -- series still needs to show the plans that include it.
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS model_selector jsonb;

      -- Token-pack economics, so a pack price can be shown as $/1M tokens.
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS included_tokens bigint;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS included_credits integer;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS pack_validity_days integer;

      CREATE INDEX IF NOT EXISTS plans_plan_kind_idx
        ON plans (plan_kind, plan_line, tier_rank);
    `,
  },
  {
    name: '014_add_model_plan_mapping_source',
    sql: `
      -- Mirrors plans.source. The materializer owns 'derived' rows and may
      -- replace them wholesale; 'manual' rows are hand-curated exceptions that
      -- rule derivation must never delete.
      --
      -- Both the default and the backfill are 'derived', which is the opposite
      -- of what "protect hand-made rows" suggests. The reason: every row that
      -- exists when this migration runs came from the hand-maintained
      -- plan-model-slugs.ts list, and that list is the thing being retired --
      -- it had drifted to 18 plan slugs that no longer exist while missing 19
      -- live plans. Labelling those rows 'manual' would freeze the drift
      -- permanently, since the materializer would then only ever add to them.
      -- Claiming them as 'derived' lets the first materializer run reconcile
      -- them against the selectors. A genuine exception is created after the
      -- fact by inserting with an explicit source='manual'; nothing needs one
      -- yet, because the concept did not exist before this migration.
      --
      -- The default follows the same logic: an unlabelled row is far more
      -- likely to be an automated writer that forgot the column than a curated
      -- exception, and treating it as 'derived' means the next run reports and
      -- reconciles it instead of silently keeping it forever.
      ALTER TABLE model_plan_mapping ADD COLUMN IF NOT EXISTS source text DEFAULT 'derived';
      ALTER TABLE model_plan_mapping ALTER COLUMN source SET DEFAULT 'derived';
      UPDATE model_plan_mapping SET source = 'derived' WHERE source IS NULL;
      ALTER TABLE model_plan_mapping ALTER COLUMN source SET NOT NULL;

      ALTER TABLE model_plan_mapping DROP CONSTRAINT IF EXISTS model_plan_mapping_source_chk;
      ALTER TABLE model_plan_mapping ADD CONSTRAINT model_plan_mapping_source_chk
        CHECK (source IN ('derived', 'manual'));

      -- This table never had a unique key, so it can already contain duplicate
      -- (plan_id, model_id) pairs. Collapse them onto the lowest id (keeping the
      -- highest priority seen) before the unique index can be created.
      UPDATE model_plan_mapping AS keeper
         SET priority = ranked.max_priority
        FROM (
          SELECT plan_id, model_id,
                 min(id) AS keep_id,
                 max(coalesce(priority, 0)) AS max_priority
            FROM model_plan_mapping
           GROUP BY plan_id, model_id
          HAVING count(*) > 1
        ) AS ranked
       WHERE keeper.id = ranked.keep_id
         AND keeper.priority IS DISTINCT FROM ranked.max_priority;

      DELETE FROM model_plan_mapping AS dupe
       WHERE dupe.id > (
         SELECT min(other.id)
           FROM model_plan_mapping AS other
          WHERE other.plan_id IS NOT DISTINCT FROM dupe.plan_id
            AND other.model_id IS NOT DISTINCT FROM dupe.model_id
       );

      CREATE UNIQUE INDEX IF NOT EXISTS model_plan_mapping_uniq
        ON model_plan_mapping (plan_id, model_id);
    `,
  },
  {
    name: '015_add_plan_published_quotas',
    sql: `
      -- What the vendor actually publishes as this plan's usage allowance.
      --
      -- The scalar columns above (tokens_per_month, 5_hours_message_limit,
      -- requests_per_day, included_credits...) each assume one unit over one
      -- period, and no vendor's page fits that. Surveyed 2026-08-19:
      --   z.ai / bigmodel GLM Coding  10,000 credits per *week*
      --   Aliyun Bailian Coding Plan  6,000 requests/5h AND 45,000/week
      --                               AND 90,000/month, simultaneously
      --   Gemini Code Assist          1,500 requests per user per day
      --   MiniMax Token Plan          nothing numeric at all -- "3-4 agents"
      --   MiniMax credit packs        credits, total, 365-day validity
      -- Three co-existing windows cannot be stored in three unrelated columns
      -- without losing which ones bind together, and a credits/week figure has
      -- no column at all.
      --
      -- Shape: an array of what the page states, one entry per published limit.
      --   [ { amount: 10000, unit: 'credit', period: 'week' } ]
      --   unit   ∈ token | credit | request | message | prompt
      --   period ∈ 5h | day | week | month | total
      -- Optional per entry:
      --   derived_from  slug of the tier this was multiplied from, when the
      --                 vendor publishes "6x Lite" instead of an absolute
      --   multiplier    that multiplier
      --   note          verbatim qualifier ("approximately", "shared with chat")
      --
      -- NULL means not yet researched; [] means researched and the vendor
      -- publishes no numeric allowance. Those are different facts, and the
      -- effective-rate math must refuse to guess for both.
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS quotas jsonb;
    `,
  },
  {
    name: '016_fix_openrouter_provider_type',
    sql: `
      -- OpenRouter is a reseller marketplace/aggregator, never the producer of
      -- any model it lists. One stale row had type='official', so the model
      -- detail page's "Official Price" card resolved to OpenRouter (its $3
      -- sorted ahead of the real producer's ¥20) instead of 月之暗面/Kimi and
      -- every other model's actual producer. provider-config.ts already declares
      -- it 'aggregator'; this keeps the database aligned idempotently.
      UPDATE providers
         SET type = 'aggregator',
             updated_at = now()
       WHERE slug = 'openrouter'
         AND type <> 'aggregator';
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
