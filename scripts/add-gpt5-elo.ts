#!/usr/bin/env tsx

import { supabaseAdmin, getArenaBenchmarkTaskId, getOrCreateEloMetricId, upsertBenchmarkScore, getModelBySlug } from './db/queries';

// Estimated Arena ELO scores for GPT-5 models (placeholder until official scores are available)
const GPT5_ELO_SCORES: Record<string, number> = {
  'gpt-5': 1580,          // Slightly higher than Claude Opus 4.6 (1553)
  'gpt-5-pro': 1600,       // Highest tier
  'gpt-5-nano': 1450,      // Slightly higher than GPT-4o-mini (1438)
  'gpt-5-codex': 1490,    // Coding variant
  'gpt-5-image': 1440,     // Image generation variant
  'gpt-5.1': 1590,
  'gpt-5.1-codex': 1500,
  'gpt-5.1-codex-max': 1520,
  'gpt-5.2': 1595,
  'gpt-5.2-codex': 1510,
  'gpt-5.2-pro': 1610,
  'gpt-5.3-codex': 1530,
};

async function main() {
  console.log('🏆 Adding Arena ELO scores for GPT-5 models...\n');

  // Get benchmark task and metric IDs
  const taskId = await getArenaBenchmarkTaskId();
  const metricId = await getOrCreateEloMetricId();

  if (!taskId || !metricId) {
    console.log('❌ Could not get Arena benchmark task or metric.');
    return;
  }

  let updatedCount = 0;
  let skippedCount = 0;
  let notFoundCount = 0;

  for (const [slug, elo] of Object.entries(GPT5_ELO_SCORES)) {
    try {
      // Check if model exists
      const model = await getModelBySlug(slug);

      if (!model) {
        console.log(`⚠️  Model not found: ${slug}`);
        notFoundCount++;
        continue;
      }

      // Update ELO score
      const result = await upsertBenchmarkScore({
        model_id: model.id,
        benchmark_task_id: taskId,
        metric_id: metricId,
        value: elo,
      });

      if (result.action === 'updated') {
        console.log(`✅ Updated ${model.name}: ${result.oldValue} → ${elo}`);
        updatedCount++;
      } else if (result.action === 'inserted') {
        console.log(`✅ Inserted ${model.name}: ELO ${elo}`);
        updatedCount++;
      } else {
        console.log(`⏭️  Skipped ${model.name}: already ${elo}`);
        skippedCount++;
      }
    } catch (error: any) {
      console.error(`❌ Error processing ${slug}:`, error.message);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`✅ Updated: ${updatedCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
  console.log(`⚠️  Not found: ${notFoundCount}`);
}

main().catch(console.error);