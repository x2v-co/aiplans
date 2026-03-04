#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Get deepseek-v3.2 product
  const { data: product } = await supabase
    .from('products')
    .select('id, name, slug')
    .eq('slug', 'deepseek-v3.2')
    .single();

  console.log(`deepseek-v3.2 product: ${product?.name} (ID: ${product?.id})`);

  // Check deepseek-v3.2 plans
  const { data: models } = await supabase
    .from('models')
    .select(`
      plan_id,
      plans (name, slug, provider_id)
    `)
    .eq('product_id', product?.id || 0);

  console.log('\ndeepseek-v3.2 model-plan relations:');
  if (models && models.length > 0) {
    models.forEach(m => {
      console.log(`  - ${m.plans?.name} (ID: ${m.plan_id}, Provider: ${m.plans?.provider_id})`);
    });
  } else {
    console.log('  No plans found');
  }
}

main().catch(console.error);
