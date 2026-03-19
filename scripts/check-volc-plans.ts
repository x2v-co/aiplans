#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Get volcengine plans with models via model_plan_mapping junction table
  const { data: plans, error } = await supabase
    .from('plans')
    .select(`
      id, name, slug,
      model_plan_mapping (
        model_id,
        models (
          id, name, slug
        )
      )
    `)
    .eq('provider_id', 64)
    .order('price');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Volcengine plans with models:\n');
  plans?.forEach((p: any) => {
    console.log(`${p.name}:`);
    if (p.model_plan_mapping && p.model_plan_mapping.length > 0) {
      p.model_plan_mapping.forEach((m: any) => {
        console.log(`  - ${m.models?.name} (${m.models?.slug})`);
      });
    } else {
      console.log('  No models');
    }
    console.log('');
  });
}

main().catch(console.error);