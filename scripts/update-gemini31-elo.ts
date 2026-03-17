#!/usr/bin/env tsx

import { supabaseAdmin, getArenaBenchmarkTaskId, getOrCreateEloMetricId, upsertBenchmarkScore, getModelBySlug } from './db/queries';

const GEMINI_ELO_SCORES: Record<string, number> = {
  'gemini-3.1-pro-preview-custom-tools': 1461,
  'gemini-3.1-pro': 1461,
  'gemini-3-pro': 1443,
  'gemini-3-flash': 1441,
};

async function main() {
  console.log('🏆 Updating Gemini 3.1 ELO scores...\n');

  // Get benchmark task and metric IDs
  const taskId = await getArenaBenchmarkTaskId();
  const metricId = await getOrCreateEloMetricId();

  if (!taskId || !metricId) {
    console.log('❌ Could not get Arena benchmark task or metric.');
    return;
  }

  let updatedCount = 0;
  let notFoundCount = 0;

  for (const [slug, elo] of Object.entries(GEMINI_ELO_SCORES)) {
    try {
      const model = await getModelBySlug(slug);

      if (!model) {
        console.log(`⚠️  Model not found: ${slug}`);
        notFoundCount++;
        continue;
      }

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
      }
    } catch (error: any) {
      console.error(`❌ Error processing ${slug}:`, error.message);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`✅ Updated: ${updatedCount}`);
  console.log(`⚠️  Not found: ${notFoundCount}`);
}

main().catch(console.error);