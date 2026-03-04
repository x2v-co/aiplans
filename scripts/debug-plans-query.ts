#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Simple query first
  console.log('Simple query - plans only:');
  const { data: plansSimple, error: error1 } = await supabase
    .from('plans')
    .select('id, name, slug, price')
    .eq('provider_id', 33)
    .order('price');

  console.log('Plans:', plansSimple?.length);
  console.log('Error:', error1);

  if (plansSimple) {
    for (const plan of plansSimple) {
      console.log(`  - ${plan.name} ($${plan.price}) ID:${plan.id}`);
    }
  }

  // Query with models
  console.log('\nQuery with models:');
  const { data: plansWithModels, error: error2 } = await supabase
    .from('plans')
    .select(`
      id, name, slug, price, tier,
      models (
        product_id,
        is_available,
        is_default,
        products (name, slug)
      )
    `)
    .eq('provider_id', 33)
    .order('price');

  console.log('Plans with models:', plansWithModels?.length);
  console.log('Error:', error2);

  if (plansWithModels) {
    plansWithModels.forEach(plan => {
      console.log(`\n${plan.name} ($${plan.price})`);
      console.log(`  Models array length: ${plan.models?.length || 0}`);
      if (plan.models && plan.models.length > 0) {
        plan.models.forEach((m: any) => {
          console.log(`    - ${m.products?.name || m.product_id}`);
        });
      }
    });
  }

  // Check models table directly
  console.log('\nModels table for OpenAI:');
  const { data: models } = await supabase
    .from('models')
    .select('*')
    .eq('provider_id', 33);

  console.log('Total models:', models?.length);
  if (models) {
    models.forEach(m => {
      console.log(`  Plan:${m.plan_id} -> Product:${m.product_id} [Available:${m.is_available}, Default:${m.is_default}]`);
    });
  }
}

main().catch(console.error);
