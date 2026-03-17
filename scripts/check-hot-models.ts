#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

async function main() {
  console.log('🔥 Checking Hot Models (Arena ELO >= 1280 AND planCount > 0)...\n');

  // Get all models with their plan counts
  const { data: allModels } = await supabaseAdmin
    .from('models')
    .select('id, name, slug, provider_ids, type');

  const modelIds = allModels?.map(m => m.id) || [];

  // Get plan counts from model_plan_mapping
  const { data: planMappings } = await supabaseAdmin
    .from('model_plan_mapping')
    .select('model_id')
    .in('model_id', modelIds);

  const planCountMap = new Map<number, number>();
  (planMappings || []).forEach((mapping: any) => {
    planCountMap.set(mapping.model_id, (planCountMap.get(mapping.model_id) || 0) + 1);
  });

  // Get ELO scores from model_benchmark_scores
  const { data: eloScores } = await supabaseAdmin
    .from('model_benchmark_scores')
    .select('model_id, value')
    .in('model_id', modelIds);

  const eloMap = new Map<number, number>();
  (eloScores || []).forEach((score: any) => {
    const current = eloMap.get(score.model_id);
    if (!current || score.value > current) {
      eloMap.set(score.model_id, score.value);
    }
  });

  // Filter hot models
  const hotModels = (allModels || [])
    .filter((m: any) => {
      const elo = eloMap.get(m.id);
      if (!elo) return false;
      if (elo < 1280) return false;
      const planCount = planCountMap.get(m.id) || 0;
      if (planCount === 0) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      return (eloMap.get(b.id) || 0) - (eloMap.get(a.id) || 0);
    })
    .slice(0, 8);

  console.log(`Found ${hotModels.length} hot models:\n`);
  hotModels.forEach((model: any, i: number) => {
    const planCount = planCountMap.get(model.id) || 0;
    const elo = eloMap.get(model.id);
    console.log(`${i + 1}. ${model.name} (${model.slug})`);
    console.log(`   Arena ELO: ${elo}`);
    console.log(`   Plans: ${planCount}\n`);
  });

  // Also check top models by Arena ELO regardless of plan count
  console.log('\n📊 Top 10 models by Arena ELO (regardless of plans):\n');
  const topEloModels = (allModels || [])
    .filter((m: any) => eloMap.has(m.id))
    .sort((a: any, b: any) => (eloMap.get(b.id) || 0) - (eloMap.get(a.id) || 0))
    .slice(0, 10);

  topEloModels.forEach((model: any, i: number) => {
    const planCount = planCountMap.get(model.id) || 0;
    const elo = eloMap.get(model.id);
    console.log(`${i + 1}. ${model.name} - ELO: ${elo} - Plans: ${planCount}`);
  });
}

main().catch(console.error);