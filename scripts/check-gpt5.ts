#!/usr/bin/env tsx

import { supabaseAdmin, getModelBySlug } from './db/queries';

async function main() {
  console.log('🔍 Checking for GPT-5 related models...\n');

  // Search for models with gpt-5, o5, or similar naming
  const { data: gpt5Models } = await supabaseAdmin
    .from('models')
    .select('*')
    .or('slug.ilike.%gpt-5%,slug.ilike.%o5%,name.ilike.%gpt-5%,name.ilike.%o5%');

  console.log('GPT-5 / o5 related models:');
  if (gpt5Models && gpt5Models.length > 0) {
    for (const m of gpt5Models) {
      // Get ELO from benchmark scores
      const { data: eloScore } = await supabaseAdmin
        .from('model_benchmark_scores')
        .select('value')
        .eq('model_id', m.id)
        .order('value', { ascending: false })
        .limit(1)
        .single();

      console.log(`  - ${m.name} (${m.slug})`);
      console.log(`    ID: ${m.id}, ELO: ${eloScore?.value || 'N/A'}`);
    }
  } else {
    console.log('  None found!\n');
  }

  // Also check OpenAI models (provider_id 33 or 1)
  console.log('\nAll OpenAI models:');
  const { data: openaiModels } = await supabaseAdmin
    .from('models')
    .select('*')
    .contains('provider_ids', [33])
    .order('name');

  if (openaiModels) {
    for (const m of openaiModels) {
      const { data: eloScore } = await supabaseAdmin
        .from('model_benchmark_scores')
        .select('value')
        .eq('model_id', m.id)
        .order('value', { ascending: false })
        .limit(1)
        .single();

      console.log(`  - ${m.name} (${m.slug})`);
      console.log(`    ID: ${m.id}, ELO: ${eloScore?.value || 'N/A'}, Type: ${m.type}`);
    }
  }

  // Check ChatGPT plans
  console.log('\nChatGPT plans:');
  const { data: chatgptPlans } = await supabaseAdmin
    .from('plans')
    .select(`
      *,
      providers (name),
      model_plan_mapping (
        model_id,
        models (name, slug)
      )
    `)
    .ilike('name', '%ChatGPT%')
    .order('name');

  if (chatgptPlans) {
    chatgptPlans.forEach(plan => {
      console.log(`\n  ${plan.name} (${plan.slug})`);
      console.log(`    Price: $${plan.price_monthly}/month, Tier: ${plan.tier}`);
      console.log(`    Models: ${plan.model_plan_mapping?.map((m: any) => m.models?.name || m.model_id).join(', ') || 'None'}`);
    });
  }
}

main().catch(console.error);