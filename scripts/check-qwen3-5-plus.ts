#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Check Qwen provider
  const { data: qwenProvider } = await supabase
    .from('providers')
    .select('id, name, slug')
    .ilike('slug', '%qwen%')
    .single();

  console.log('🔍 Qwen Provider:');
  console.log(`   ${JSON.stringify(qwenProvider, null, 2)}\n`);

  // Find products matching "3.5-plus" or similar
  const { data: plusProducts } = await supabase
    .from('products')
    .select('id, name, slug, provider_id')
    .ilike('name', '%3.5%plus%')
    .order('id');

  console.log('📋 Products matching "3.5 plus":');
  if (plusProducts && plusProducts.length > 0) {
    plusProducts.forEach(p => {
      console.log(`   - ${p.name} (${p.slug}) - ID: ${p.id}, Provider: ${p.provider_id}`);
    });
  } else {
    console.log('   None found');
  }

  // Check what products the Qwen plans currently link to
  const { data: qwenPlans } = await supabase
    .from('models')
    .select(`
      plan_id,
      plans:plan_id (name, slug, provider_id),
      product_id,
      products:product_id (name, slug, provider_id)
    `)
    .in('plan_id', (await supabase.from('plans').select('id').eq('provider_id', qwenProvider?.id || 46).then(r => r.data?.map(p => p.id) || [])));

  console.log('\n📦 Current Qwen plan-model relations:');
  if (qwenPlans) {
    qwenPlans.forEach(m => {
      console.log(`   Plan: ${m.plans?.name} (${m.plans?.slug}) -> Product: ${m.products?.name} (${m.products?.slug})`);
    });
  }

  // Check which products exist for Qwen provider
  const { data: qwenProducts } = await supabase
    .from('products')
    .select('id, name, slug')
    .eq('provider_id', qwenProvider?.id || 46)
    .ilike('slug', '%plus%')
    .order('name');

  console.log('\n📊 Qwen products with "plus" in name:');
  if (qwenProducts) {
    qwenProducts.forEach(p => {
      console.log(`   - ${p.name} (${p.slug}) - ID: ${p.id}`);
    });
  }
}

main().catch(console.error);
