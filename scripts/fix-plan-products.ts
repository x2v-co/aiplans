#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

// Plan -> Product mapping for plans that need fix
const PLAN_TO_PRODUCT: Record<string, string> = {
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
  console.log('Fixing plan product associations...');

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const [planSlug, productSlug] of Object.entries(PLAN_TO_PRODUCT)) {
    // Get plan by slug
    const planResult = await supabaseAdmin
      .from('plans')
      .select('id, name, product_id')
      .eq('slug', planSlug)
      .single();

    const plan = planResult.data;

    if (!plan || planResult.error) {
      console.log(`  ❌ Plan not found: ${planSlug}`);
      continue;
    }

    if (plan && plan.product_id) {
      console.log(`  ✓ Plan ${plan.name} already has product_id=${plan.product_id}`);
      skipped++;
      continue;
    }

    // Get product by slug
    const productsResult = await supabaseAdmin
      .from('products')
      .select('id, name, slug')
      .eq('slug', productSlug)
      .limit(1);

    if (!productsResult.data || productsResult.error) {
      console.log(`  ⚠️  Product not found: ${productSlug}`);
      notFound++;
      continue;
    }

    const product = productsResult.data && productsResult.data[0];

    // Update plan with product_id
    const { error } = await supabaseAdmin
      .from('plans')
      .update({ product_id: product.id })
      .eq('id', plan.id);

    if (!error && plan) {
      updated++;
      console.log(`  ✅ Plan ${plan.name} -> Product ${product.name} (${product.slug})`);
    } else {
      console.log(`  ❌ Failed to update plan ${plan.name}:`, error);
    }
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ✓ Skipped (already set): ${skipped}`);
  console.log(`  ⚠️  Product not found: ${notFound}`);
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
