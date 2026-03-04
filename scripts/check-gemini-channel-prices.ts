#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Get main Gemini products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug')
    .eq('provider_id', 35)
    .in('slug', ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'])
    .order('name');

  console.log('Checking channel prices for main Gemini models:\n');

  for (const product of products || []) {
    const { data: channelPrices } = await supabase
      .from('channel_prices')
      .select(`
        input_price_per_1m,
        output_price_per_1m,
        channels (name, slug)
      `)
      .eq('product_id', product.id);

    console.log(`${product.name}:`);
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
