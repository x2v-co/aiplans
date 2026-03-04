#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

async function main() {
  console.log('Fixing data issues...');

  // Issue 1: Move minimax models from Moonshot to Minimax provider
  const { data: minimaxModels } = await supabaseAdmin
    .from('products')
    .select('id, name, slug')
    .ilike('slug', 'minimax-%');

  console.log(`\nFound ${minimaxModels?.length || 0} minimax models under wrong provider`);

  let fixed = 0;
  for (const m of minimaxModels || []) {
    const { error } = await supabaseAdmin
      .from('products')
      .update({ provider_id: 48 }) // Minimax company id
      .eq('id', m.id);

    if (!error) {
      fixed++;
      console.log(`  ✅ Fixed ${m.name} (id=${m.id}): Moonshot -> Minimax`);
    } else {
      console.log(`  ❌ Failed to fix ${m.name}: `, error);
    }
  }

  console.log(`\n📦 Fixed ${fixed} minimax models`);

  // Issue 2: Add Qwen 3.5 model (latest)
  console.log('\n--- Issue 2: Adding Qwen 3.5 model ---');

  const result = await supabaseAdmin
    .from('products')
    .select('id, name, slug, provider_id')
    .eq('slug', 'qwen3.5');

  const existing = result.data;

  if (existing && !result.error) {
    const name = (existing as unknown as { name: string }).name;
    const id = (existing as unknown as { id: number }).id;
    console.log(`  ⚠️  qwen3.5 already exists: ${name} (id=${id})`);
  } else {
    const providersResult = await supabaseAdmin
      .from('providers')
      .select('id, name, slug')
      .eq('slug', 'qwen');

    const qwenProvider = providersResult.data?.[0];

    if (!qwenProvider) {
      console.log('  ❌ Qwen provider not found');
    } else {
      const { data: newModel, error } = await supabaseAdmin
        .from('products')
        .insert({
          name: 'Qwen 3.5',
          slug: 'qwen3.5',
          provider_id: qwenProvider.id,
          type: 'llm',
          benchmark_arena_elo: 1443,
        })
        .select()
        .single();

      if (!error && newModel) {
        console.log(`  ✅ Added Qwen 3.5 (id=${newModel.id}): ELO 1443`);
      } else {
        console.log(`  ❌ Failed to add Qwen 3.5: `, error);
      }
    }
  }

main()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
}
