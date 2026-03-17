#!/usr/bin/env tsx

import { supabaseAdmin, getArenaBenchmarkTaskId, getOrCreateEloMetricId, upsertBenchmarkScore, getModelBySlug, createModel } from './db/queries';

async function main() {
  console.log('Fixing data issues...');

  // Issue 1: Update minimax models provider_ids
  const { data: minimaxModels } = await supabaseAdmin
    .from('models')
    .select('id, name, slug, provider_ids')
    .ilike('slug', 'minimax-%');

  console.log(`\nFound ${minimaxModels?.length || 0} minimax models`);

  let fixed = 0;
  for (const m of minimaxModels || []) {
    // Check if already has Minimax provider (48)
    if (m.provider_ids?.includes(48)) {
      console.log(`  ✓ ${m.name} already has correct provider`);
      continue;
    }

    const newProviderIds = [...(m.provider_ids || []), 48];
    const { error } = await supabaseAdmin
      .from('models')
      .update({ provider_ids: newProviderIds })
      .eq('id', m.id);

    if (!error) {
      fixed++;
      console.log(`  ✅ Fixed ${m.name} (id=${m.id}): added Minimax provider`);
    } else {
      console.log(`  ❌ Failed to fix ${m.name}: `, error);
    }
  }

  console.log(`\n📦 Fixed ${fixed} minimax models`);

  // Issue 2: Add Qwen 3.5 model (latest)
  console.log('\n--- Issue 2: Adding Qwen 3.5 model ---');

  const existing = await getModelBySlug('qwen3.5');

  if (existing) {
    console.log(`  ⚠️  qwen3.5 already exists: ${existing.name} (id=${existing.id})`);
  } else {
    // Get benchmark task and metric IDs
    const taskId = await getArenaBenchmarkTaskId();
    const metricId = await getOrCreateEloMetricId();

    const newModel = await createModel({
      name: 'Qwen 3.5',
      slug: 'qwen3.5',
      provider_ids: [46], // Qwen provider id
      type: 'llm',
    });

    if (newModel && taskId && metricId) {
      // Add benchmark score
      await upsertBenchmarkScore({
        model_id: newModel.id,
        benchmark_task_id: taskId,
        metric_id: metricId,
        value: 1443,
      });
      console.log(`  ✅ Added Qwen 3.5 (id=${newModel.id}): ELO 1443`);
    } else {
      console.log(`  ❌ Failed to add Qwen 3.5`);
    }
  }
}

main()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });