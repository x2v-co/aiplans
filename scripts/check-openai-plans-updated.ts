#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Get OpenAI plans with models via model_plan_mapping junction table
  const { data: plans, error } = await supabase
    .from('plans')
    .select(`
      id, name, slug, price, tier,
      model_plan_mapping (
        model_id,
        priority,
        models (
          id, name, slug
        )
      )
    `)
    .eq('provider_id', 33)
    .order('price');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('OpenAI Plans with associated models:\n');
  plans?.forEach((plan: any) => {
    console.log(`${plan.name} ($${plan.price}/month) [Tier: ${plan.tier}]`);
    if (plan.model_plan_mapping && plan.model_plan_mapping.length > 0) {
      plan.model_plan_mapping.forEach((m: any, i: number) => {
        console.log(`  ${i + 1}. ${m.models?.name} (${m.models?.slug})`);
      });
    } else {
      console.log('  No models associated');
    }
    console.log('');
  });
}

main().catch(console.error);