#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

async function main() {
  // Get main Gemini models (provider_ids contains 35 for Google)
  const { data: models } = await supabaseAdmin
    .from('models')
    .select('id, name, slug')
    .contains('provider_ids', [35])
    .in('slug', ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'])
    .order('name');

  console.log('Checking channel prices for main Gemini models:\n');

  for (const model of models || []) {
    const { data: channelPrices } = await supabaseAdmin
      .from('api_channel_prices')
      .select(`
        input_price_per_1m,
        output_price_per_1m,
        channels (name, slug)
      `)
      .eq('model_id', model.id);

    console.log(`${model.name}:`);
    if (channelPrices && channelPrices.length > 0) {
      channelPrices.forEach(cp => {
        console.log(`  - ${cp.channels?.name}: $${cp.input_price_per_1m}/$${cp.output_price_per_1m}`);
      });
    } else {
      console.log('  No channel prices found');
    }
  }
}

main().catch(console.error);