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

  // Query with models through model_plan_mapping junction table
  console.log('\nQuery with models (via model_plan_mapping):');
  const { data: plansWithModels, error: error2 } = await supabase
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

  console.log('Plans with models:', plansWithModels?.length);
  console.log('Error:', error2);

  if (plansWithModels) {
    plansWithModels.forEach((plan: any) => {
      console.log(`\n${plan.name} ($${plan.price})`);
      console.log(`  Models array length: ${plan.model_plan_mapping?.length || 0}`);
      if (plan.model_plan_mapping && plan.model_plan_mapping.length > 0) {
        plan.model_plan_mapping.forEach((m: any) => {
          console.log(`    - ${m.models?.name || m.model_id}`);
        });
      }
    });
  }

  // Check model_plan_mapping table directly
  console.log('\nModel_plan_mapping entries for plans of provider 33:');
  const { data: planIds } = await supabase
    .from('plans')
    .select('id')
    .eq('provider_id', 33);

  if (planIds && planIds.length > 0) {
    const ids = planIds.map(p => p.id);
    const { data: mappings } = await supabase
      .from('model_plan_mapping')
      .select(`
        plan_id,
        model_id,
        priority,
        models (name, slug),
        plans (name)
      `)
      .in('plan_id', ids);

    console.log('Total mappings:', mappings?.length);
    if (mappings) {
      mappings.forEach((m: any) => {
        console.log(`  Plan:${m.plans?.name} -> Model:${m.models?.name}`);
      });
    }
  }

  // Check models table - using provider_ids array
  console.log('\nModels table with provider_ids containing 33:');
  const { data: models } = await supabase
    .from('models')
    .select('id, name, slug, provider_ids');

  // Filter in JS since we're querying an array
  const openaiModels = models?.filter(m => m.provider_ids?.includes(33)) || [];

  console.log('Total models with provider_ids containing 33:', openaiModels.length);
  openaiModels.slice(0, 10).forEach(m => {
    console.log(`  ${m.name} (provider_ids: ${JSON.stringify(m.provider_ids)})`);
  });
}

main().catch(console.error);