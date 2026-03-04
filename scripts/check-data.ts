#!/usr/bin/env tsx

/**
 * Quick database state check
 */

import { supabaseAdmin } from './db/queries';

async function main() {
  console.log('📊 Checking database state...\n');

  // Get counts
  const [productsResult, plansResult, modelsResult, channelPricesResult] = await Promise.all([
    supabaseAdmin.from('products').select('*', { count: 'exact', head: false }).single(),
    supabaseAdmin.from('plans').select('*', { count: 'exact', head: false }).single(),
    supabaseAdmin.from('models').select('*', { count: 'exact', head: false }).single(),
    supabaseAdmin.from('channel_prices').select('*', { count: 'exact', head: false }).single(),
  ]);

  const productsCount = productsResult.data ? productsResult.data.count : 0;
  const plansCount = plansResult.data ? plansResult.data.count : 0;
  const modelsCount = modelsResult.data ? modelsResult.data.count : 0;
  const channelPricesCount = channelPricesResult.data ? channelPricesResult.data.count : 0;

  console.log(`📦 Products: ${productsCount}`);
  console.log(`📋 Plans: ${plansCount}`);
  console.log(`🔗 Models (plan-product relations): ${modelsCount}`);
  console.log(`💰 Channel Prices: ${channelPricesCount}`);
  console.log();
}

main().catch(console.error);
