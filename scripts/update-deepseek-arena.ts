#!/usr/bin/env tsx

import { supabaseAdmin, getArenaBenchmarkTaskId, getOrCreateEloMetricId, upsertBenchmarkScore, getModelBySlug, createModel, getModelArenaElo } from './db/queries';

const DEEPSEEK_PROVIDER_ID = 36;

async function updateDeepSeekModels() {
  console.log('\n📊 UPDATING DEEPSEEK MODELS WITH ARENA ELO SCORES');
  console.log('='.repeat(70));

  // Get benchmark task and metric IDs
  const taskId = await getArenaBenchmarkTaskId();
  const metricId = await getOrCreateEloMetricId();

  if (!taskId || !metricId) {
    console.log('❌ Could not get Arena benchmark task or metric.');
    return;
  }

  // Models to add/update from arena
  const arenaModels = [
    { name: 'DeepSeek V3.2 Thinking', slug: 'deepseek-v3.2-thinking', elo: 1370 },
    { name: 'DeepSeek V3.2', slug: 'deepseek-v3.2', elo: 1319 },
    { name: 'DeepSeek V3.2 Exp', slug: 'deepseek-v3.2-exp', elo: 1286 },
  ];

  for (const model of arenaModels) {
    console.log(`\nChecking: ${model.name} (${model.slug})`);

    try {
      // Check if model exists
      const existing = await getModelBySlug(model.slug);

      if (existing) {
        const currentElo = await getModelArenaElo(existing.id);
        console.log(`  ✅ Found: id=${existing.id}, current ELO=${currentElo || 'none'}`);

        const result = await upsertBenchmarkScore({
          model_id: existing.id,
          benchmark_task_id: taskId,
          metric_id: metricId,
          value: model.elo,
        });

        if (result.action === 'updated') {
          console.log(`  ✅ Updated ELO: ${result.oldValue} → ${model.elo}`);
        } else if (result.action === 'inserted') {
          console.log(`  ✅ Inserted ELO: ${model.elo}`);
        } else {
          console.log(`  ⏭️  ELO already up to date: ${model.elo}`);
        }
      } else {
        // Add new model
        console.log(`  ➕ Adding new model with ELO ${model.elo}`);

        const newModel = await createModel({
          name: model.name,
          slug: model.slug,
          provider_ids: [DEEPSEEK_PROVIDER_ID],
          type: 'llm',
        });

        if (newModel) {
          await upsertBenchmarkScore({
            model_id: newModel.id,
            benchmark_task_id: taskId,
            metric_id: metricId,
            value: model.elo,
          });
          console.log(`  ✅ Added: id=${newModel.id}, ${model.name} with ELO ${model.elo}`);
        }
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Done!');
}

updateDeepSeekModels()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });