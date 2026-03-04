#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

async function deleteModel(productId: number, modelName: string) {
  console.log(`\n=== Deleting ${modelName} (id=${productId}) ===`);

  // Check channel price references
  const { data: channelPrices } = await supabaseAdmin
    .from('channel_prices')
    .select('id, product_id')
    .eq('product_id', productId);

  console.log(`Channel price references: ${channelPrices?.length || 0}`);

  // Delete channel price references
  if (channelPrices && channelPrices.length > 0) {
    for (const ref of channelPrices) {
      const { error } = await supabaseAdmin
        .from('channel_prices')
        .delete()
        .eq('id', ref.id);

      if (!error) {
        console.log(`  Deleted channel price ref: ${ref.id}`);
      } else {
        console.log(`  Failed to delete channel price ref: ${ref.id}`, error);
      }
    }
  }

  // Delete the product
  console.log(`Deleting product ${productId}...`);
  const { error } = await supabaseAdmin
    .from('products')
    .delete()
    .eq('id', productId);

  if (!error) {
    console.log(`✅ Deleted product ${productId}`);
    return true;
  } else {
    console.log(`❌ Delete product error:`, error);
    return false;
  }
}

async function main() {
  console.log('Deleting old models: GPT-4o and gemini-1.5-pro\n');

  const gpt4o = await deleteModel(2007, 'GPT-4o');
  const gemini = await deleteModel(2570, 'gemini-1.5-pro');

  if (gpt4o && gemini) {
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
