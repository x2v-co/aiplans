#!/usr/bin/env tsx

import { supabaseAdmin, getProviderBySlug } from './db/queries';

async function main() {
  // Check Qwen provider
  const qwenProvider = await getProviderBySlug('qwen');

  console.log('🔍 Qwen Provider:');
  console.log(`   ${JSON.stringify(qwenProvider, null, 2)}\n`);

  // Find models matching "3.5-plus" or similar
  const { data: plusModels } = await supabaseAdmin
    .from('models')
    .select('id, name, slug, provider_ids')
    .ilike('name', '%3.5%plus%')
    .order('id');

  console.log('📋 Models matching "3.5 plus":');
  if (plusModels && plusModels.length > 0) {
    plusModels.forEach(m => {
      console.log(`   - ${m.name} (${m.slug}) - ID: ${m.id}, Providers: ${m.provider_ids?.join(', ')}`);
    });
  } else {
    console.log('   None found');
  }

  // Check what models the Qwen plans currently link to
  const { data: qwenPlans } = await supabaseAdmin
    .from('model_plan_mapping')
    .select(`
      plan_id,
      plans:plan_id (name, slug, provider_id),
      model_id,
      models:model_id (name, slug, provider_ids)
    `)
    .in('plan_id', (await supabaseAdmin.from('plans').select('id').eq('provider_id', qwenProvider?.id || 46).then(r => r.data?.map(p => p.id) || [])));

  console.log('\n📦 Current Qwen plan-model relations:');
  if (qwenPlans) {
    qwenPlans.forEach(m => {
      console.log(`   Plan: ${m.plans?.name} (${m.plans?.slug}) -> Model: ${m.models?.name} (${m.models?.slug})`);
    });
  }

  // Check which models exist for Qwen provider
  const { data: qwenModels } = await supabaseAdmin
    .from('models')
    .select('id, name, slug')
    .contains('provider_ids', [qwenProvider?.id || 46])
    .ilike('slug', '%plus%')
    .order('name');

  console.log('\n📊 Qwen models with "plus" in slug:');
  if (qwenModels) {
    qwenModels.forEach(m => {
      console.log(`   - ${m.name} (${m.slug}) - ID: ${m.id}`);
    });
  }
}

main().catch(console.error);