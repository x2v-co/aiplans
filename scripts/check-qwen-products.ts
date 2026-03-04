#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const slugsToCheck = ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-3.5-plus', 'qwen-35-plus', 'kimi-k2.5', 'glm-5'];

  console.log('📋 Checking Qwen products in database...\n');

  for (const slug of slugsToCheck) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, provider_id')
      .eq('slug', slug)
      .single();

    if (data) {
      console.log(`✅ ${slug}: ID=${data.id}, Name=${data.name}, ProviderID=${data.provider_id}`);
    } else {
      console.log(`❌ ${slug}: Not found`);
    }
  }

  console.log('\n🔍 Searching for similar Qwen products...');
  const { data: qwenProducts } = await supabase
    .from('products')
    .select('id, name, slug')
    .ilike('slug', '%qwen%')
    .order('name');

  if (qwenProducts) {
    console.log(`\nFound ${qwenProducts.length} Qwen products:`);
    qwenProducts.forEach(p => {
      console.log(`  - ${p.name} (${p.slug}) - ID: ${p.id}`);
    });
  }
}

main().catch(console.error);
