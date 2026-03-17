#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

async function checkAndDelete() {
  console.log('Checking for Claude 3 Opus (id=2013)');

  const modelsResult = await supabaseAdmin
    .from('models')
    .select('id, name, slug')
    .eq('id', 2013)
    .single();

  if (!modelsResult.data || modelsResult.error) {
    console.log('  Model 2013 not found');
    process.exit(0);
  }

  const model = modelsResult.data;
  console.log('Found:', model);

  // Check api_channel_prices references (note: correct table name)
  const channelPricesResult = await supabaseAdmin
    .from('api_channel_prices')
    .select('id, model_id')
    .eq('model_id', 2013);

  const channelPrices = channelPricesResult.data;
  console.log('Channel price references:', channelPrices?.length || 0);

  // Delete channel price references
  if (channelPrices && channelPrices.length > 0) {
    for (const ref of channelPrices) {
      const { error } = await supabaseAdmin
        .from('api_channel_prices')
        .delete()
        .eq('id', ref.id);

      if (!error) {
        console.log('Deleted channel price ref:', ref.id);
      }
    }
  }

  // Delete benchmark scores
  const benchmarkScoresResult = await supabaseAdmin
    .from('model_benchmark_scores')
    .select('id')
    .eq('model_id', 2013);

  if (benchmarkScoresResult.data && benchmarkScoresResult.data.length > 0) {
    const { error } = await supabaseAdmin
      .from('model_benchmark_scores')
      .delete()
      .eq('model_id', 2013);

    if (!error) {
      console.log('Deleted benchmark score references');
    }
  }

  // Delete the model
  console.log('Deleting model 2013...');
  const { error } = await supabaseAdmin
    .from('models')
    .delete()
    .eq('id', 2013);

  if (!error) {
    console.log('Deleted model 2013');
  } else {
    console.log('Delete model error:', error);
    process.exit(1);
  }
}

checkAndDelete()
  .then(() => {
    console.log('Done');
    process.exit(0);
  });