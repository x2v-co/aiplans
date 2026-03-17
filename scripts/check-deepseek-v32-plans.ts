#!/usr/bin/env tsx

import { supabaseAdmin, getModelBySlug } from './db/queries';

async function main() {
  // Get deepseek-v3.2 model
  const model = await getModelBySlug('deepseek-v3.2');

  console.log(`deepseek-v3.2 model: ${model?.name || 'Not found'} (ID: ${model?.id || 'N/A'})`);

  if (!model) {
    return;
  }

  // Check deepseek-v3.2 plans via model_plan_mapping
  const { data: mappings } = await supabaseAdmin
    .from('model_plan_mapping')
    .select(`
      plan_id,
      plans (name, slug, provider_id)
    `)
    .eq('model_id', model.id);

  console.log('\ndeepseek-v3.2 model-plan relations:');
  if (mappings && mappings.length > 0) {
    mappings.forEach(m => {
      console.log(`  - ${m.plans?.name} (ID: ${m.plan_id}, Provider: ${m.plans?.provider_id})`);
    });
  } else {
    console.log('  No plans found');
  }
}

main().catch(console.error);