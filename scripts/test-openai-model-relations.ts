#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Product slugs from PRODUCT_SLUGS in index-plans-dynamic.ts
const PRODUCT_SLUGS = {
  'chatgpt-free': ['gpt-4o-mini'],
  'chatgpt-plus': ['gpt-4o', 'gpt-4o-mini', 'gpt-5-nano'],
  'chatgpt-team': ['gpt-4o', 'gpt-4o-mini', 'o4', 'o4-mini-high', 'gpt-4-turbo', 'gpt-5-nano', 'gpt-5'],
  'chatgpt-enterprise': ['gpt-4o', 'gpt-4o-mini', 'o4', 'o4-mini-high', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-5-nano', 'gpt-5', 'gpt-5-pro'],
  'chatgpt-pro': ['o4', 'o4-mini-high', 'gpt-4o', 'gpt-4o-mini', 'gpt-5', 'gpt-5-pro', 'o3', 'o3-pro'],
};

async function main() {
  console.log('🔍 Testing OpenAI Plan-Model Relations...\n');

  // Get OpenAI plans
  const { data: plans } = await supabase
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
    const productSlugs = PRODUCT_SLUGS[plan.slug];
    console.log(`Expected models: ${productSlugs?.join(', ') || 'None'}`);

    if (productSlugs && productSlugs.length > 0) {
      for (const slug of productSlugs) {
        const { data: product } = await supabase
          .from('products')
          .select('id, name, slug')
          .eq('slug', slug)
          .single();

        if (product) {
          console.log(`  ✅ Found: ${product.name} (${product.slug}) ID:${product.id}`);

          // Check if relation exists
          const { data: model } = await supabase
            .from('models')
            .select('*')
            .eq('plan_id', plan.id)
            .eq('product_id', product.id)
            .single();

          if (model) {
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
