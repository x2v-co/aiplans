#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Get Zhipu plans with models
  const { data: plans } = await supabase
    .from('plans')
    .select(`
      id, name, slug, price, tier,
      models (
        products (name, slug)
      )
    `)
    .eq('provider_id', 43)
    .order('price');

  console.log('Zhipu (ChatGLM) Plans:\n');
  plans?.forEach(p => {
    console.log(`${p.name} (¥${p.price}/month) [Tier: ${p.tier}]`);
    if (p.models && p.models.length > 0) {
      p.models.forEach((m: any) => {
        console.log(`  - ${m.products?.name} (${m.products?.slug})`);
      });
    } else {
      console.log('  No models');
    }
  });
}

main().catch(console.error);
