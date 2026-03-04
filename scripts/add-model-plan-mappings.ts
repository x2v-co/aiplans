#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

// Plan -> Models mapping
// Each plan should be associated with models that are covered by that plan
const PLAN_MODELS: Record<string, string[]> = {
  // ChatGPT plans -> ChatGPT models
  'chatgpt-free': ['gpt-4o-mini', 'gpt-4o'],
  'chatgpt-plus': ['gpt-4o-mini', 'gpt-4o'],
  'chatgpt-pro': ['gpt-4o-mini', 'gpt-4o'],
  'chatgpt-team': ['gpt-4o-mini', 'gpt-4o'],
  'chatgpt-enterprise': ['gpt-4o-mini', 'gpt-4o'],

  // Claude plans -> Claude models
  'claude-pro': ['claude-sonnet-4.6'],
  'claude-team': ['claude-sonnet-4.6'],
  'claude-enterprise': ['claude-sonnet-4.6'],

  // Gemini plans -> Gemini models
  'gemini-free': ['gemini-1.5-pro', 'gemini-1.5-flash'],
  'gemini-advanced': ['gemini-3-pro', 'gemini-3-flash'],

  // Google One AI -> Google models
  'google-one-ai-premium': ['gemini-3-pro', 'gemini-3-flash'],

  // Minimax plans -> Minimax models
  'minimax-free': ['minimax-m2.5'],
  'minimax-lite': ['minimax-m2.1'],
  'minimax-pro': ['minimax-m2.5'],
  'minimax-global-free': ['minimax-m2.5'],
  'minimax-global-lite': ['minimax-m2.1'],
  'minimax-global-pro': ['minimax-m2.5'],

  // GLM Coding plans -> GLM models
  'glm-coding-lite': ['glm-4.7'],
  'glm-coding-pro': ['glm-5'],
  'glm-coding-max': ['glm-4.7'],
  'glm-coding-team': ['glm-5'],

  // Z.AI plans -> GLM models (Z.ai is Zhipu)
  'z-ai-free': ['glm-4.7'],
  'z-ai-lite': ['glm-5'],
  'z-ai-pro': ['glm-4.7'],

  // Kimi plans -> Kimi models
  'kimi-free': ['kimi-k2.5-thinking'],
  'kimi-basic': ['kimi-k2.5-instant'],
  'kimi-pro': ['kimi-k2.5-thinking'],
  'kimi-team': ['kimi-k2.5-thinking'],
  'kimi-enterprise': ['kimi-k2.5-thinking'],

  // ERNIE plans -> ERNIE models
  'ernie-free': ['ernie-bot-4-turbo'],
  'ernie-monthly': ['ernie-bot-4-turbo'],
  'ernie-annual': ['ernie-bot-4-turbo'],

  // Seed plans -> Seed models
  'seed-free-trial': ['seed-2.0'],
  'seed-lite': ['seed-2.0'],
  'seed-pro': ['seed-2.0'],
  'seed-enterprise': ['seed-2.0'],

  // Qwen plans -> Qwen models
  'qwen-free-trial': ['qwen3.5-397b'],
  'qwen-pay-as-you-go': ['qwen-max'],
  'qwen-token-pack': ['qwen-max'],
  'qwen-enterprise': ['qwen-max'],
};

async function main() {
  console.log('Adding model-plan mappings...');

  // Get all plans
  const { data: plans } = await supabaseAdmin
    .from('plans')
    .select('id, slug, name, product_id')
    .order('id');

  let added = 0;
  let skipped = 0;
  let notFoundModel = 0;
  let notFoundPlan = 0;

  for (const plan of plans || []) {
    const planSlug = plan.slug;
    const modelSlugs = PLAN_MODELS[planSlug];

    if (!modelSlugs) {
      console.log(`  ⚠️  No models defined for plan: ${planSlug}`);
      continue;
    }

    console.log(`\nProcessing plan: ${plan.name} (${planSlug})`);

    for (const modelSlug of modelSlugs) {
      // Check if mapping already exists
      const { data: existing } = await supabaseAdmin
        .from('model_plan_mapping')
        .select('id')
        .eq('plan_id', plan.id)
        .eq('product_id', (await supabaseAdmin.from('products').select('id').eq('slug', modelSlug).single()).data?.id);

      if (existing && existing.length > 0) {
        console.log(`    ✓ Mapping exists: plan ${plan.id} -> ${modelSlug}`);
        skipped++;
        continue;
      }

      // Get product id by slug
      const result = await supabaseAdmin
        .from('products')
        .select('id')
        .eq('slug', modelSlug)
        .single();

      if (!result.data || result.error) {
        console.log(`    ⚠️  Product not found: ${modelSlug}`);
        notFoundModel++;
        continue;
      }

      const product = result.data;

      // Create model-plan mapping
      const { error } = await supabaseAdmin
        .from('model_plan_mapping')
        .insert({
          plan_id: plan.id,
          product_id: product.id,
          is_available: true,
        });

      if (!error) {
        added++;
        console.log(`    ✅ Added mapping: plan ${plan.id} -> ${modelSlug}`);
      } else {
        console.log(`    ❌ Failed to add mapping: ${modelSlug}`, error);
      }
    }
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`  ✅ Mappings added: ${added}`);
  console.log(`  ✓ Skipped (already exist): ${skipped}`);
  console.log(`  ⚠️  Product not found: ${notFoundModel}`);
  console.log(`  ⚠️  Plan not found: ${notFoundPlan}`);
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
