#!/usr/bin/env tsx

import { supabaseAdmin, getModelBySlug } from './db/queries';

// Model slugs from PRODUCT_SLUGS in index-plans-dynamic.ts
const MODEL_SLUGS: Record<string, string[]> = {
  'chatgpt-free': ['gpt-4o-mini'],
  'chatgpt-plus': ['gpt-4o', 'gpt-4o-mini', 'gpt-5-nano'],
  'chatgpt-team': ['gpt-4o', 'gpt-4o-mini', 'o4', 'o4-mini-high', 'gpt-4-turbo', 'gpt-5-nano', 'gpt-5'],
  'chatgpt-enterprise': ['gpt-4o', 'gpt-4o-mini', 'o4', 'o4-mini-high', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-5-nano', 'gpt-5', 'gpt-5-pro'],
  'chatgpt-pro': ['o4', 'o4-mini-high', 'gpt-4o', 'gpt-4o-mini', 'gpt-5', 'gpt-5-pro', 'o3', 'o3-pro'],
};

async function main() {
  console.log('🔍 Testing OpenAI Plan-Model Relations...\n');

  // Get OpenAI plans
  const { data: plans } = await supabaseAdmin
    .from('plans')
    .select('id, name, slug')
    .eq('provider_id', 33);

  if (!plans) {
    console.log('No OpenAI plans found');
    return;
  }

  console.log('Found OpenAI plans:');
  plans.forEach(p => console.log(`  - ${p.name} (${p.slug}) ID:${p.id}`));

  // For each plan, check what models should be linked
  for (const plan of plans) {
    console.log(`\n=== ${plan.name} (${plan.slug}) ===`);
    const modelSlugs = MODEL_SLUGS[plan.slug];
    console.log(`Expected models: ${modelSlugs?.join(', ') || 'None'}`);

    if (modelSlugs && modelSlugs.length > 0) {
      for (const slug of modelSlugs) {
        const model = await getModelBySlug(slug);

        if (model) {
          console.log(`  ✅ Found: ${model.name} (${model.slug}) ID:${model.id}`);

          // Check if relation exists
          const { data: mapping } = await supabaseAdmin
            .from('model_plan_mapping')
            .select('id')
            .eq('plan_id', plan.id)
            .eq('model_id', model.id)
            .single();

          if (mapping) {
            console.log(`     → Relation exists`);
          } else {
            console.log(`     ⚠️  NO relation exists!`);
          }
        } else {
          console.log(`  ❌ Not found: ${slug}`);
        }
      }
    }
  }
}

main().catch(console.error);