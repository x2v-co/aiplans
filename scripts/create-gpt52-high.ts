#!/usr/bin/env tsx

import { getArenaBenchmarkTaskId, getOrCreateEloMetricId, upsertBenchmarkScore, getModelBySlug, createModel } from './db/queries';

async function main() {
  console.log('🔧 Creating GPT-5.2-High model...\n');

  // Get benchmark task and metric IDs
  const taskId = await getArenaBenchmarkTaskId();
  const metricId = await getOrCreateEloMetricId();

  if (!taskId || !metricId) {
    console.log('❌ Could not get Arena benchmark task or metric.');
    return;
  }

  // Check if gpt-5.2-high already exists
  const existing = await getModelBySlug('gpt-5.2-high');

  if (existing) {
    console.log('⚠️  gpt-5.2-high already exists, updating ELO score...');
    const result = await upsertBenchmarkScore({
      model_id: existing.id,
      benchmark_task_id: taskId,
      metric_id: metricId,
      value: 1696,
    });
    console.log(result.action !== 'skipped' ? '✅ Updated' : '⏭️  Already up to date');
  } else {
    console.log('Creating gpt-5.2-high...');
    const newModel = await createModel({
      name: 'GPT-5.2-High',
      slug: 'gpt-5.2-high',
      provider_ids: [33], // OpenAI
      type: 'llm',
      context_window: 200000,
    });

    if (newModel) {
      await upsertBenchmarkScore({
        model_id: newModel.id,
        benchmark_task_id: taskId,
        metric_id: metricId,
        value: 1696,
      });
      console.log(`✅ Created model: ${newModel.name} (ID: ${newModel.id}) with ELO 1696`);
    } else {
      console.error('❌ Error creating model');
    }
  }

  // Update gpt-5.2 ELO to 1395
  console.log('\nUpdating gpt-5.2 ELO to 1395...');
  const gpt52 = await getModelBySlug('gpt-5.2');

  if (gpt52) {
    const result = await upsertBenchmarkScore({
      model_id: gpt52.id,
      benchmark_task_id: taskId,
      metric_id: metricId,
      value: 1395,
    });
    console.log(result.action !== 'skipped' ? '✅ Updated gpt-5.2 ELO to 1395' : '⏭️  Already 1395');
  } else {
    console.error('❌ gpt-5.2 model not found');
  }
}

main().catch(console.error);