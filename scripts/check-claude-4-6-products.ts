#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Checking Claude 4.6 products in database...\n');

  const slugsToCheck = [
    'claude-3-5-sonnet',
    'claude-sonnet-4-6',
    'claude-opus-4-6',
    'claude-3-5-haiku',
    'claude-3-haiku-4-5',
  ];

  for (const slug of slugsToCheck) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, benchmark_arena_elo')
      .eq('slug', slug)
      .single();

    if (data) {
      console.log(`✅ ${slug}:`);
      console.log(`   ID: ${data.id}`);
      console.log(`   Name: ${data.name}`);
      console.log(`   Arena ELO: ${data.benchmark_arena_elo || 'N/A'}\n`);
    } else {
      console.log(`❌ ${slug}: Not found\n`);
    }
  }
}

main().catch(console.error);
