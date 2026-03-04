#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Checking for GPT-5 related products...\n');

  // Search for products with gpt-5, o5, or similar naming
  const { data: gpt5Products } = await supabase
    .from('products')
    .select('*')
    .or('slug.ilike.%gpt-5%,slug.ilike.%o5%,name.ilike.%gpt-5%,name.ilike.%o5%');

  console.log('GPT-5 / o5 related products:');
  if (gpt5Products && gpt5Products.length > 0) {
    gpt5Products.forEach(p => {
      console.log(`  - ${p.name} (${p.slug})`);
      console.log(`    ID: ${p.id}, ELO: ${p.benchmark_arena_elo}`);
    });
  } else {
    console.log('  None found!\n');
  }

  // Also check OpenAI products
  console.log('\nAll OpenAI products:');
  const { data: openaiProducts } = await supabase
    .from('products')
    .select('*')
    .eq('provider_id', 1)
    .order('name');

  if (openaiProducts) {
    openaiProducts.forEach(p => {
      console.log(`  - ${p.name} (${p.slug})`);
      console.log(`    ID: ${p.id}, ELO: ${p.benchmark_arena_elo}, Type: ${p.type}`);
    });
  }

  // Check ChatGPT plans
  console.log('\nChatGPT plans:');
  const { data: chatgptPlans } = await supabase
    .from('plans')
    .select(`
      *,
      providers (name),
      models (
        product_id,
        products (name, slug)
      )
    `)
    .ilike('name', '%ChatGPT%')
    .order('name');

  if (chatgptPlans) {
    chatgptPlans.forEach(plan => {
      console.log(`\n  ${plan.name} (${plan.slug})`);
      console.log(`    Price: $${plan.price_monthly}/month, Tier: ${plan.tier}`);
      console.log(`    Models: ${plan.models?.map((m: any) => m.products?.name || m.product_id).join(', ') || 'None'}`);
    });
  }
}

main().catch(console.error);
