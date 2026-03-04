// Alternative: Run migrations using Supabase client
// Since Supabase client is already working, we can use it to add the schema manually

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔧 Running manual schema migration via Supabase client...\n');

// SQL to add new columns to plans table
const migrations = [
  {
    name: 'Add request limits to plans',
    sql: `
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS requests_per_minute INTEGER;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS requests_per_day INTEGER;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS requests_per_month INTEGER;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS qps INTEGER;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS concurrent_requests INTEGER;
    `
  },
  {
    name: 'Add token limits to plans',
    sql: `
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS tokens_per_minute INTEGER;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS tokens_per_day BIGINT;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS tokens_per_month BIGINT;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_tokens_per_request INTEGER;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_input_tokens INTEGER;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_output_tokens INTEGER;
    `
  },
  {
    name: 'Add yearly pricing to plans',
    sql: `
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_yearly_monthly REAL;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS yearly_discount_percent REAL;
    `
  },
  {
    name: 'Add plan metadata',
    sql: `
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(50);
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS billing_granularity VARCHAR(30);
    `
  },
  {
    name: 'Add overage pricing to plans',
    sql: `
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS has_overage_pricing BOOLEAN DEFAULT FALSE;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS overage_input_price_per_1m REAL;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS overage_output_price_per_1m REAL;
    `
  },
  {
    name: 'Create model_plan_mapping table',
    sql: `
      CREATE TABLE IF NOT EXISTS model_plan_mapping (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) NOT NULL,
        plan_id INTEGER REFERENCES plans(id) NOT NULL,
        override_rpm INTEGER,
        override_qps INTEGER,
        override_input_price_per_1m REAL,
        override_output_price_per_1m REAL,
        override_max_output_tokens INTEGER,
        is_available BOOLEAN DEFAULT TRUE,
        note VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(product_id, plan_id)
      );
    `
  }
];

async function runMigrations() {
  for (const migration of migrations) {
    console.log(`Running: ${migration.name}...`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_string: migration.sql });

      if (error) {
        console.error(`❌ Failed: ${error.message}`);
        console.log('\nNote: You may need to run this with service role key or directly in Supabase SQL editor.');
        console.log('Copy the SQL from this file and paste it into Supabase Dashboard → SQL Editor\n');
      } else {
        console.log(`✅ Success\n`);
      }
    } catch (err) {
      console.error(`❌ Error: ${err.message}`);
      console.log('\nAlternative: Run SQL directly in Supabase Dashboard → SQL Editor');
      console.log('SQL to run:');
      console.log(migration.sql);
      console.log('\n');
    }
  }

  console.log('Migration complete! (or use SQL Editor method above)');
}

runMigrations().catch(console.error);
