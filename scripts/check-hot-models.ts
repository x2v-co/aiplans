#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔥 Checking Hot Models (Arena ELO >= 1280 AND planCount > 0)...\n');

  // Get all products with plan counts
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, slug, provider_id, benchmark_arena_elo, type');

  const productIds = allProducts?.map(p => p.id) || [];

  const { data: modelsData } = await supabase
    .from('models')
    .select('product_id, plan_id')
    .in('product_id', productIds);

  const planCountMap = new Map();
  (modelsData || []).forEach((model: any) => {
    planCountMap.set(model.product_id, (planCountMap.get(model.product_id) || 0) + 1);
  });

  // Filter hot models
  const hotModels = (allProducts || [])
    .filter((p: any) => {
      if (!p.benchmark_arena_elo) return false;
      if (p.benchmark_arena_elo < 1280) return false;
      const planCount = planCountMap.get(p.id) || 0;
      if (planCount === 0) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      return (b.benchmark_arena_elo || 0) - (a.benchmark_arena_elo || 0);
    })
    .slice(0, 8);

  console.log(`Found ${hotModels.length} hot models:\n`);
  hotModels.forEach((model, i) => {
    const planCount = planCountMap.get(model.id) || 0;
    console.log(`${i + 1}. ${model.name} (${model.slug})`);
    console.log(`   Arena ELO: ${model.benchmark_arena_elo}`);
    console.log(`   Plans: ${planCount}\n`);
  });

  // Also check top models by Arena ELO regardless of plan count
  console.log('\n📊 Top 10 models by Arena ELO (regardless of plans):\n');
  const topEloModels = (allProducts || [])
    .filter((p: any) => p.benchmark_arena_elo)
    .sort((a: any, b: any) => (b.benchmark_arena_elo || 0) - (a.benchmark_arena_elo || 0))
    .slice(0, 10);

  topEloModels.forEach((model, i) => {
    const planCount = planCountMap.get(model.id) || 0;
    console.log(`${i + 1}. ${model.name} - ELO: ${model.benchmark_arena_elo} - Plans: ${planCount}`);
  });
}

main().catch(console.error);
