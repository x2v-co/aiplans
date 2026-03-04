#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

const DEEPSEEK_PROVIDER_ID = 36;

async function updateDeepSeekModels() {
  console.log('\n📊 UPDATING DEEPSEEK MODELS WITH ARENA ELO SCORES');
  console.log('='.repeat(70));

  // Models to add/update from arena
  const arenaModels = [
    { name: 'DeepSeek V3.2 Thinking', slug: 'deepseek-v3.2-thinking', elo: 1370 },
    { name: 'DeepSeek V3.2', slug: 'deepseek-v3.2', elo: 1319 },
    { name: 'DeepSeek V3.2 Exp', slug: 'deepseek-v3.2-exp', elo: 1286 },
  ];

  for (const model of arenaModels) {
    console.log(`\nChecking: ${model.name} (${model.slug})`);

    // Check if model exists
    const { data: existing } = await supabaseAdmin
      .from('products')
      .select('id, name, slug, benchmark_arena_elo, provider_id')
      .eq('slug', model.slug)
      .single();

    if (existing && existing.provider_id === DEEPSEEK_PROVIDER_ID) {
      // Update existing model
      console.log(`  ✅ Found: id=${existing.id}, current ELO=${existing.benchmark_arena_elo}`);

      const { error } = await supabaseAdmin
        .from('products')
        .update({ benchmark_arena_elo: model.elo })
        .eq('id', existing.id);

      if (!error) {
        console.log(`  ✅ Updated ELO: ${existing.benchmark_arena_elo} → ${model.elo}`);
      } else {
        console.log(`  ❌ Update failed:`, error);
      }
    } else if (existing && existing.provider_id !== DEEPSEEK_PROVIDER_ID) {
      console.log(`  ⚠️  Found similar model with different provider: id=${existing.id}, provider_id=${existing.provider_id}`);
      console.log(`  ➕ Adding official DeepSeek version with ELO ${model.elo}`);

      // Add official version
      const { data: newModel, error } = await supabaseAdmin
        .from('products')
        .insert({
          name: model.name,
          slug: model.slug,
          provider_id: DEEPSEEK_PROVIDER_ID,
          type: 'llm',
          benchmark_arena_elo: model.elo,
        })
        .select()
        .single();

      if (!error && newModel) {
        console.log(`  ✅ Added official: id=${newModel.id}, ${model.name}`);
      } else {
        console.log(`  ❌ Insert failed:`, error);
      }
    } else {
      // Add new model
      console.log(`  ➕ Adding new model with ELO ${model.elo}`);

      const { data: newModel, error } = await supabaseAdmin
        .from('products')
        .insert({
          name: model.name,
          slug: model.slug,
          provider_id: DEEPSEEK_PROVIDER_ID,
          type: 'llm',
          benchmark_arena_elo: model.elo,
        })
        .select()
        .single();

      if (!error && newModel) {
        console.log(`  ✅ Added: id=${newModel.id}, ${model.name}`);
      } else {
        console.log(`  ❌ Insert failed:`, error);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Done!');
}

updateDeepSeekModels()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
