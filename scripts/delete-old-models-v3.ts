#!/usr/bin/env tsx

import { supabaseAdmin, getModelBySlug } from './db/queries';

async function deleteModel(modelId: number, modelName: string) {
  console.log(`\n=== Deleting ${modelName} (id=${modelId}) ===`);

  // Check channel price references (note: table is api_channel_prices)
  const { data: channelPrices } = await supabaseAdmin
    .from('api_channel_prices')
    .select('id, model_id')
    .eq('model_id', modelId);

  console.log(`Channel price references: ${channelPrices?.length || 0}`);

  // Delete channel price references
  if (channelPrices && channelPrices.length > 0) {
    for (const ref of channelPrices) {
      const { error } = await supabaseAdmin
        .from('api_channel_prices')
        .delete()
        .eq('id', ref.id);

      if (!error) {
        console.log(`  Deleted channel price ref: ${ref.id}`);
      } else {
        console.log(`  Failed to delete channel price ref: ${ref.id}`, error);
      }
    }
  }

  // Delete benchmark scores
  const { data: benchmarkScores } = await supabaseAdmin
    .from('model_benchmark_scores')
    .select('id')
    .eq('model_id', modelId);

  if (benchmarkScores && benchmarkScores.length > 0) {
    const { error } = await supabaseAdmin
      .from('model_benchmark_scores')
      .delete()
      .eq('model_id', modelId);

    if (!error) {
      console.log(`  Deleted ${benchmarkScores.length} benchmark score references`);
    }
  }

  // Delete the model
  console.log(`Deleting model ${modelId}...`);
  const { error } = await supabaseAdmin
    .from('models')
    .delete()
    .eq('id', modelId);

  if (!error) {
    console.log(`✅ Deleted model ${modelId}`);
    return true;
  } else {
    console.log(`❌ Delete model error:`, error);
    return false;
  }
}

async function main() {
  console.log('Deleting old models: GPT-4o and gemini-1.5-pro\n');

  // Find models by slug first
  const gpt4o = await getModelBySlug('gpt-4o');
  const gemini = await getModelBySlug('gemini-1.5-pro');

  if (!gpt4o) {
    console.log('⚠️  GPT-4o model not found by slug, skipping');
  }

  if (!gemini) {
    console.log('⚠️  gemini-1.5-pro model not found by slug, skipping');
  }

  const gpt4oDeleted = gpt4o ? await deleteModel(gpt4o.id, 'GPT-4o') : true;
  const geminiDeleted = gemini ? await deleteModel(gemini.id, 'gemini-1.5-pro') : true;

  if (gpt4oDeleted && geminiDeleted) {
    console.log('\n✅ All old models deleted successfully');
  } else {
    console.log('\n⚠️  Some deletions failed');
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log('\nDone');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });