#!/usr/bin/env tsx

import { supabaseAdmin, getModelBySlug } from './db/queries';

async function main() {
  const slugsToCheck = ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-3.5-plus', 'qwen-35-plus', 'kimi-k2.5', 'glm-5'];

  console.log('📋 Checking Qwen models in database...\n');

  for (const slug of slugsToCheck) {
    const model = await getModelBySlug(slug);

    if (model) {
      console.log(`✅ ${slug}: ID=${model.id}, Name=${model.name}, Providers=${model.provider_ids?.join(',')}`);
    } else {
      console.log(`❌ ${slug}: Not found`);
    }
  }

  console.log('\n🔍 Searching for similar Qwen models...');
  const { data: qwenModels } = await supabaseAdmin
    .from('models')
    .select('id, name, slug')
    .ilike('slug', '%qwen%')
    .order('name');

  if (qwenModels) {
    console.log(`\nFound ${qwenModels.length} Qwen models:`);
    qwenModels.forEach(m => {
      console.log(`  - ${m.name} (${m.slug}) - ID: ${m.id}`);
    });
  }
}

main().catch(console.error);