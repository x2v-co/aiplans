#!/usr/bin/env tsx

/**
 * Quick database state check
 */

import { supabaseAdmin } from './db/queries';

async function main() {
  console.log('📊 Checking database state...\n');

  // Get counts from correct tables
  const [
    modelsResult,
    plansResult,
    modelPlanMappingResult,
    channelPricesResult,
    benchmarkScoresResult
  ] = await Promise.all([
    supabaseAdmin.from('models').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('plans').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('model_plan_mapping').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('api_channel_prices').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('model_benchmark_scores').select('id', { count: 'exact', head: true }),
  ]);

  console.log(`📦 Models: ${modelsResult.count || 0}`);
  console.log(`📋 Plans: ${plansResult.count || 0}`);
  console.log(`🔗 Model-Plan Relations: ${modelPlanMappingResult.count || 0}`);
  console.log(`💰 API Channel Prices: ${channelPricesResult.count || 0}`);
  console.log(`📊 Benchmark Scores: ${benchmarkScoresResult.count || 0}`);
  console.log();
}

main().catch(console.error);