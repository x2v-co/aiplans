#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔧 Creating GPT-5.2-High product...\n');

  // Get OpenAI provider ID
  const { data: provider } = await supabase
    .from('providers')
    .select('id')
    .eq('slug', 'openai')
    .single();

  if (!provider) {
    console.error('❌ OpenAI provider not found');
    return;
  }

  console.log(`OpenAI Provider ID: ${provider.id}`);

  // Create gpt-5.2-high product
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('slug', 'gpt-5.2-high')
    .single();

  if (existing) {
    console.log('⚠️  gpt-5.2-high already exists, updating ELO score...');
    const { error } = await supabase
      .from('products')
      .update({ benchmark_arena_elo: 1696 })
      .eq('slug', 'gpt-5.2-high');
    console.log(error ? `❌ Error: ${error}` : '✅ Updated');
  } else {
    console.log('Creating gpt-5.2-high...');
    const { data, error } = await supabase
      .from('products')
      .insert({
        provider_id: provider.id,
        name: 'GPT-5.2-High',
        slug: 'gpt-5.2-high',
        type: 'llm',
        benchmark_arena_elo: 1696,
        context_window: 200000,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating product:', error);
    } else {
      console.log(`✅ Created product: ${data.name} (ID: ${data.id})`);
    }
  }

  // Update gpt-5.2 ELO to 1395
  console.log('\nUpdating gpt-5.2 ELO to 1395...');
  const { error: updateError } = await supabase
    .from('products')
    .update({ benchmark_arena_elo: 1395 })
    .eq('slug', 'gpt-5.2');

  if (updateError) {
    console.error('❌ Error updating gpt-5.2:', updateError);
  } else {
    console.log('✅ Updated gpt-5.2 ELO to 1395');
  }
}

main().catch(console.error);
