#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔥 Finding Hot Models (ELO >= 1100 AND planCount > 0)...\n');

  // Get all products with type=llm
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, slug, provider_id, benchmark_arena_elo, type')
    .eq('type', 'llm');

  const productIds = allProducts?.map(p => p.id) || [];

  // Get plan counts
  const { data: modelsData } = await supabase
    .from('models')
    .select('product_id, plan_id')
    .in('product_id', productIds);

  const planCountMap = new Map();
  (modelsData || []).forEach((model: any) => {
    planCountMap.set(model.product_id, (planCountMap.get(model.product_id) || 0) + 1);
  });

  // Filter and sort hot models
  const hotModels = (allProducts || [])
    .filter((p: any) => {
      if (!p.benchmark_arena_elo) return false;
      if (p.benchmark_arena_elo < 1100) return false;
      if ((planCountMap.get(p.id) || 0) === 0) return false;
      return true;
    })
    .map((p: any) => ({
      ...p,
      planCount: planCountMap.get(p.id) || 0,
    }))
    .sort((a: any, b: any) => (b.benchmark_arena_elo || 0) - (a.benchmark_arena_elo || 0));

  console.log(`Found ${hotModels.length} hot models:\n`);
  hotModels.slice(0, 10).forEach((model, i) => {
    console.log(`${i + 1}. ${model.name} (${model.slug})`);
    console.log(`   ELO: ${model.benchmark_arena_elo}`);
    console.log(`   Plans: ${model.planCount}\n`);
  });

  // Also show models with ELO 1100-1200 that have plans
  console.log('Models with ELO 1100-1200 that have plans:\n');
  const midEloModels = (allProducts || [])
    .filter((p: any) => {
      if (!p.benchmark_arena_elo) return false;
      if (p.benchmark_arena_elo < 1100 || p.benchmark_arena_elo >= 1200) return false;
      if ((planCountMap.get(p.id) || 0) === 0) return false;
      return true;
    })
    .map((p: any) => ({
      ...p,
      planCount: planCountMap.get(p.id) || 0,
    }))
    .sort((a: any, b: any) => (b.benchmark_arena_elo || 0) - (a.benchmark_arena_elo || 0));

  midEloModels.forEach((model, i) => {
    console.log(`${model.name} (${model.slug}) - ELO: ${model.benchmark_arena_elo} - Plans: ${model.planCount}`);
  });
}

main().catch(console.error);
