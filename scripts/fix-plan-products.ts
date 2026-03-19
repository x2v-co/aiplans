#!/usr/bin/env tsx

import { supabaseAdmin, getModelBySlug } from './db/queries';

// Plan -> Model mapping for plans that need fix
const PLAN_TO_MODEL: Record<string, string> = {
  'gemini-free': 'gemini-1.5-pro',
  'gemini-advanced': 'gemini-3-pro',
  'minimax-free': 'minimax-m2.5',
  'minimax-lite': 'minimax-m2.1',
  'minimax-pro': 'minimax-m2.5',
  'minimax-global-free': 'minimax-m2.5',
  'minimax-global-lite': 'minimax-m2.1',
  'minimax-global-pro': 'minimax-m2.5',
  'glm-coding-lite': 'glm-4.7',
  'glm-coding-pro': 'glm-5',
  'glm-coding-max': 'glm-4.7',
  'glm-coding-team': 'glm-5',
  'z-ai-free': 'glm-4.7',
  'z-ai-lite': 'glm-5',
  'z-ai-pro': 'glm-4.7',
  'kimi-free': 'kimi-k2.5-thinking',
  'kimi-basic': 'kimi-k2.5-instant',
  'kimi-pro': 'kimi-k2.5-thinking',
  'kimi-team': 'kimi-k2.5-thinking',
  'ernie-free': 'ernie-bot-4-turbo',
  'ernie-monthly': 'ernie-bot-4-turbo',
  'ernie-annual': 'ernie-bot-4-turbo',
  'seed-free-trial': 'seed-2.0',
  'seed-lite': 'seed-2.0',
  'seed-pro': 'seed-2.0',
  'seed-enterprise': 'seed-2.0',
  'qwen-free-trial': 'qwen3.5-397b',
  'qwen-pay-as-you-go': 'qwen-max',
  'qwen-token-pack': 'qwen-max',
  'qwen-enterprise': 'qwen-max',
};

async function main() {
  console.log('Fixing plan model associations via model_plan_mapping...');

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const [planSlug, modelSlug] of Object.entries(PLAN_TO_MODEL)) {
    // Get plan by slug
    const planResult = await supabaseAdmin
      .from('plans')
      .select('id, name')
      .eq('slug', planSlug)
      .single();

    const plan = planResult.data;

    if (!plan || planResult.error) {
      console.log(`  ❌ Plan not found: ${planSlug}`);
      continue;
    }

    // Check if mapping already exists
    const { data: existingMapping } = await supabaseAdmin
      .from('model_plan_mapping')
      .select('id')
      .eq('plan_id', plan.id);

    if (existingMapping && existingMapping.length > 0) {
      console.log(`  ✓ Plan ${plan.name} already has model mappings`);
      skipped++;
      continue;
    }

    // Get model by slug
    const model = await getModelBySlug(modelSlug);

    if (!model) {
      console.log(`  ⚠️  Model not found: ${modelSlug}`);
      notFound++;
      continue;
    }

    // Create model-plan mapping
    const { error } = await supabaseAdmin
      .from('model_plan_mapping')
      .insert({
        plan_id: plan.id,
        model_id: model.id,
      });

    if (!error) {
      updated++;
      console.log(`  ✅ Plan ${plan.name} -> Model ${model.name} (${model.slug})`);
    } else {
      console.log(`  ❌ Failed to create mapping for plan ${plan.name}:`, error);
    }
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ✓ Skipped (already set): ${skipped}`);
  console.log(`  ⚠️  Model not found: ${notFound}`);
}

main()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });