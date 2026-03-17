#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

async function main() {
  console.log('🔥 Finding Hot Models (ELO >= 1100 AND planCount > 0)...\n');

  // Get all models with type=llm
  const { data: allModels } = await supabaseAdmin
    .from('models')
    .select('id, name, slug, provider_ids, type')
    .eq('type', 'llm');

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

  // Filter and sort hot models
  const hotModels = (allModels || [])
    .filter((m: any) => {
      const elo = eloMap.get(m.id);
      if (!elo) return false;
      if (elo < 1100) return false;
      if ((planCountMap.get(m.id) || 0) === 0) return false;
      return true;
    })
    .map((m: any) => ({
      ...m,
      elo: eloMap.get(m.id),
      planCount: planCountMap.get(m.id) || 0,
    }))
    .sort((a: any, b: any) => (b.elo || 0) - (a.elo || 0));

  console.log(`Found ${hotModels.length} hot models:\n`);
  hotModels.slice(0, 10).forEach((model: any, i: number) => {
    console.log(`${i + 1}. ${model.name} (${model.slug})`);
    console.log(`   ELO: ${model.elo}`);
    console.log(`   Plans: ${model.planCount}\n`);
  });

  // Also show models with ELO 1100-1200 that have plans
  console.log('Models with ELO 1100-1200 that have plans:\n');
  const midEloModels = (allModels || [])
    .filter((m: any) => {
      const elo = eloMap.get(m.id);
      if (!elo) return false;
      if (elo < 1100 || elo >= 1200) return false;
      if ((planCountMap.get(m.id) || 0) === 0) return false;
      return true;
    })
    .map((m: any) => ({
      ...m,
      elo: eloMap.get(m.id),
      planCount: planCountMap.get(m.id) || 0,
    }))
    .sort((a: any, b: any) => (b.elo || 0) - (a.elo || 0));

  midEloModels.forEach((model: any, i: number) => {
    console.log(`${model.name} (${model.slug}) - ELO: ${model.elo} - Plans: ${model.planCount}`);
  });
}

main().catch(console.error);