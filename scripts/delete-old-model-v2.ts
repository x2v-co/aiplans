#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

async function checkAndDelete() {
  console.log('Checking for Claude 3 Opus (id=2013)');

  const productsResult = await supabaseAdmin
    .from('products')
    .select('id, name, slug, benchmark_arena_elo')
    .eq('id', 2013)
    .single();

  if (!productsResult.data || productsResult.error) {
    console.log('  Product 2013 not found');
    process.exit(0);
  }

  const products = productsResult.data;
  console.log('Found:', products);

  const channelPricesResult = await supabaseAdmin
    .from('channel_prices')
    .select('id, product_id')
    .eq('product_id', 2013);

  const channelPrices = channelPricesResult.data;
  console.log('Channel price references:', channelPrices?.length || 0);

  // Delete channel price references
  if (channelPrices && channelPrices.length > 0) {
    for (const ref of channelPrices) {
      const error = await supabaseAdmin
        .from('channel_prices')
        .delete()
        .eq('id', ref.id);

      if (!error) {
        console.log('Deleted channel price ref:', ref.id);
      }
    }
  }

  // Delete the product
  console.log('Deleting product 2013...');
  const error = await supabaseAdmin
    .from('products')
    .delete()
    .eq('id', 2013);

  if (!error) {
    console.log('Deleted product 2013');
  } else {
    console.log('Delete product error:', error);
    process.exit(1);
  }
}

checkAndDelete()
  .then(() => {
    console.log('Done');
    process.exit(0);
  });
