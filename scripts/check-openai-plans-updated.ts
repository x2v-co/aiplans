#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Get OpenAI plans with models
  const { data: plans } = await supabase
    .from('plans')
    .select(`
      id, name, slug, price_monthly, tier,
      models (
        product_id,
        is_available,
        is_default,
        products (name, slug)
      )
    `)
    .eq('provider_id', 33)
    .order('price_monthly');

  console.log('OpenAI Plans with associated models:\n');
  plans?.forEach(plan => {
    console.log(`${plan.name} ($${plan.price_monthly}/month) [Tier: ${plan.tier}]`);
    plan.models.forEach((m: any, i: number) => {
      const marker = m.is_default ? '→ ' : '  ';
      console.log(`  ${marker}${i + 1}. ${m.products?.name} (${m.products?.slug}) [Default: ${m.is_default}]`);
    });
    console.log('');
  });
}

main().catch(console.error);
