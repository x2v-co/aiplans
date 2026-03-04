#!/usr/bin/env tsx

/**
 * Clear all existing data and re-scrape fresh data
 */

import { supabaseAdmin } from './db/queries';

async function clearData() {
  console.log('🗑️  Clearing existing data...\n');

  // Clear in order to respect foreign key constraints
  // Start with child tables, then parent tables

  // Clear models table (plan-model relationships)
  const { error: modelsError } = await supabaseAdmin.from('models').delete().neq('id', 0);
  if (modelsError) {
    console.error('❌ Error clearing models:', modelsError);
  } else {
    console.log('✅ Cleared models table');
  }

  // Clear channel_prices table
  const { error: pricesError } = await supabaseAdmin.from('channel_prices').delete().neq('id', 0);
  if (pricesError) {
    console.error('❌ Error clearing channel_prices:', pricesError);
  } else {
    console.log('✅ Cleared channel_prices table');
  }

  // Clear price_history table
  const { error: historyError } = await supabaseAdmin.from('price_history').delete().neq('id', 0);
  if (historyError) {
    console.error('❌ Error clearing price_history:', historyError);
  } else {
    console.log('✅ Cleared price_history table');
  }

  // Clear old_model_plan_mapping table (backup)
  const { error: mappingError } = await supabaseAdmin.from('old_model_plan_mapping').delete().neq('id', 0);
  if (mappingError) {
    console.error('❌ Error clearing old_model_plan_mapping:', mappingError);
  } else {
    console.log('✅ Cleared old_model_plan_mapping table');
  }

  // Clear plans table (after model tables are cleared)
  const { error: plansError } = await supabaseAdmin.from('plans').delete().neq('id', 0);
  if (plansError) {
    console.error('❌ Error clearing plans:', plansError);
  } else {
    console.log('✅ Cleared plans table');
  }

  // Clear products table (after dependent tables are cleared)
  const { error: productsError } = await supabaseAdmin.from('products').delete().neq('id', 0);
  if (productsError) {
    console.error('❌ Error clearing products:', productsError);
  } else {
    console.log('✅ Cleared products table');
  }

  // Clear channels table
  const { error: channelsError } = await supabaseAdmin.from('channels').delete().neq('id', 0);
  if (channelsError) {
    console.error('❌ Error clearing channels:', channelsError);
  } else {
    console.log('✅ Cleared channels table');
  }

  console.log('\n✅ All data cleared successfully!\n');
}

async function main() {
  try {
    await clearData();
    console.log('\n🚀 Please run: npm run scrape-all to re-scrape data');
    console.log('   Or: tsx scripts/index-dynamic.ts');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}
