#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Get volcengine plans with models
  const { data: plans } = await supabase
    .from('plans')
    .select(`
      id, name, slug,
      models (
        product_id,
        products (name, slug)
      )
    `)
    .eq('provider_id', 64)
    .order('price');

  console.log('Volcengine plans with models:\n');
  plans?.forEach(p => {
    console.log(`${p.name}:`);
    if (p.models && p.models.length > 0) {
      p.models.forEach((m: any) => {
        console.log(`  - ${m.products?.name} (${m.products?.slug})`);
      });
    } else {
      console.log('  No models');
    }
    console.log('');
  });
}

main().catch(console.error);
