#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: claudeProducts } = await supabase
    .from('products')
    .select('id, name, slug, benchmark_arena_elo')
    .ilike('slug', '%claude%')
    .order('name');

  console.log('📋 All Claude products in database:\n');
  (claudeProducts || []).forEach((p: any) => {
    console.log(`- ${p.name} (${p.slug}) - ELO: ${p.benchmark_arena_elo || 'N/A'}`);
  });

  console.log(`\nTotal: ${claudeProducts?.length || 0} Claude products`);
}

main().catch(console.error);
