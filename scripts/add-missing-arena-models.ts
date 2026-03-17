#!/usr/bin/env tsx

import { supabaseAdmin, getArenaBenchmarkTaskId, getOrCreateEloMetricId, upsertBenchmarkScore, getModelBySlug, createModel } from './db/queries';

// Missing models from arena.ai leaderboard
const MISSING_MODELS = [
  {
    name: 'Claude Opus 4.5 Thinking',
    slug: 'claude-opus-4.5-thinking',
    providerIds: [34], // Anthropic
    type: 'llm',
    description: 'Claude Opus 4.5 with thinking mode (32k context)',
    contextWindow: 200000,
    arenaElo: 1499,
  },
  {
    name: 'Claude Opus 4.5',
    slug: 'claude-opus-4.5',
    providerIds: [34], // Anthropic
    type: 'llm',
    description: 'Claude Opus 4.5',
    contextWindow: 200000,
    arenaElo: 1471,
  },
  {
    name: 'Claude Sonnet 4.5 Thinking',
    slug: 'claude-sonnet-4.5-thinking',
    providerIds: [34], // Anthropic
    type: 'llm',
    description: 'Claude Sonnet 4.5 with thinking mode (32k context)',
    contextWindow: 200000,
    arenaElo: 1388,
  },
  {
    name: 'Gemini 3 Flash Thinking',
    slug: 'gemini-3-flash-thinking',
    providerIds: [35], // Google Gemini
    type: 'llm',
    description: 'Gemini 3 Flash with thinking mode',
    contextWindow: 1000000,
    arenaElo: 1399,
  },
  {
    name: 'Qwen 3.5 397B',
    slug: 'qwen3.5-397b',
    providerIds: [46], // 阿里 Qwen
    type: 'llm',
    description: 'Qwen 3.5 397B model',
    contextWindow: 32768,
    arenaElo: 1396,
  },
  {
    name: 'Kimi K2.5 Thinking',
    slug: 'kimi-k2.5-thinking',
    providerIds: [40], // 月之暗面 国际 (Moonshot Global)
    type: 'llm',
    description: 'Moonshot Kimi K2.5 with thinking mode',
    contextWindow: 128000,
    arenaElo: 1436,
  },
  {
    name: 'Kimi K2.5 Instant',
    slug: 'kimi-k2.5-instant',
    providerIds: [40], // 月之暗面 国际 (Moonshot Global)
    type: 'llm',
    description: 'Moonshot Kimi K2.5 Instant',
    contextWindow: 128000,
    arenaElo: 1419,
  },
];

async function addMissingModels() {
  console.log('🏆 Adding missing Arena models to database...');
  console.log('='.repeat(60));

  // Get benchmark task and metric IDs
  const taskId = await getArenaBenchmarkTaskId();
  const metricId = await getOrCreateEloMetricId();

  if (!taskId || !metricId) {
    console.log('❌ Could not get Arena benchmark task or metric. Please set up benchmark tables first.');
    return;
  }

  let addedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const model of MISSING_MODELS) {
    console.log(`\n📝 Processing: ${model.name}`);

    try {
      // Check if model already exists
      const existing = await getModelBySlug(model.slug);

      if (existing) {
        console.log(`   ⏭️  Already exists: ${existing.name} (id: ${existing.id})`);

        // Update ELO score
        const result = await upsertBenchmarkScore({
          model_id: existing.id,
          benchmark_task_id: taskId,
          metric_id: metricId,
          value: model.arenaElo,
        });

        if (result.action === 'updated') {
          console.log(`   ✅ Updated ELO: ${result.oldValue} → ${model.arenaElo}`);
          addedCount++;
        } else if (result.action === 'skipped') {
          console.log(`   ⏭️  ELO already up to date: ${model.arenaElo}`);
          skippedCount++;
        } else {
          console.log(`   ✅ Inserted ELO: ${model.arenaElo}`);
          addedCount++;
        }
        continue;
      }

      // Insert new model
      const newModel = await createModel({
        name: model.name,
        slug: model.slug,
        provider_ids: model.providerIds,
        type: model.type,
        description: model.description,
        context_window: model.contextWindow,
      });

      if (newModel) {
        console.log(`   ✅ Added model: ${newModel.name} (id: ${newModel.id})`);

        // Insert benchmark score
        await upsertBenchmarkScore({
          model_id: newModel.id,
          benchmark_task_id: taskId,
          metric_id: metricId,
          value: model.arenaElo,
        });

        console.log(`   ✅ Added ELO: ${model.arenaElo}`);
        addedCount++;
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Added/Updated: ${addedCount}`);
  console.log(`⏭️  Skipped (already exists): ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('='.repeat(60));
}

addMissingModels()
  .then(() => {
    console.log('\n✅ Missing models processing completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });