#!/usr/bin/env tsx

import { getArenaBenchmarkTaskId, getOrCreateEloMetricId, upsertBenchmarkScore, getModelBySlug, createModel } from './db/queries';

// Models to add with their arena data
const MISSING_MODELS = [
  {
    name: 'Claude Opus 4.6 Thinking',
    slug: 'claude-opus-4.6-thinking',
    providerIds: [34], // Anthropic
    type: 'llm',
    elo: 1553,
  },
  {
    name: 'Claude Opus 4.5',
    slug: 'claude-opus-4.5',
    providerIds: [34], // Anthropic
    type: 'llm',
    elo: 1471,
  },
  {
    name: 'Gemini 3 Flash Thinking',
    slug: 'gemini-3-flash-thinking',
    providerIds: [35], // Google Gemini
    type: 'llm',
    elo: 1399,
  },
  {
    name: 'Claude Opus 4.1',
    slug: 'claude-opus-4.1',
    providerIds: [34], // Anthropic
    type: 'llm',
    elo: 1388,
  },
  {
    name: 'GPT-5.1 Medium',
    slug: 'gpt-5.1-medium',
    providerIds: [33], // OpenAI
    type: 'llm',
    elo: 1387,
  },
  {
    name: 'GLM-4.6',
    slug: 'glm-4.6',
    providerIds: [43], // Zhipu AI (智谱)
    type: 'llm',
    elo: 1355,
  },
  {
    name: 'MIMO V2 Flash',
    slug: 'mimo-v2-flash',
    providerIds: [48], // Xiaomi
    type: 'llm',
    elo: 1341,
  },
];

async function addMissingModels() {
  console.log('\n📊 ADDING MISSING ARENA MODELS');
  console.log('='.repeat(70));

  // Get benchmark task and metric IDs
  const taskId = await getArenaBenchmarkTaskId();
  const metricId = await getOrCreateEloMetricId();

  if (!taskId || !metricId) {
    console.log('❌ Could not get Arena benchmark task or metric.');
    return;
  }

  let added = 0;
  let skipped = 0;

  for (const model of MISSING_MODELS) {
    console.log(`\nChecking: ${model.name} (${model.slug})`);

    // Check if already exists
    const existing = await getModelBySlug(model.slug);

    if (existing) {
      console.log(`  ⚠️  Already exists: id=${existing.id}`);
      skipped++;
    } else {
      // Add new model
      const newModel = await createModel({
        name: model.name,
        slug: model.slug,
        provider_ids: model.providerIds,
        type: model.type,
      });

      if (newModel) {
        // Insert benchmark score
        await upsertBenchmarkScore({
          model_id: newModel.id,
          benchmark_task_id: taskId,
          metric_id: metricId,
          value: model.elo,
        });
        console.log(`  ✅ Added: id=${newModel.id}, ${model.name} (ELO: ${model.elo})`);
        added++;
      } else {
        console.log(`  ❌ Insert failed`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Successfully added: ${added}`);
  console.log(`⚠️  Already existed (skipped): ${skipped}`);
  console.log('='.repeat(70));
}

addMissingModels()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });