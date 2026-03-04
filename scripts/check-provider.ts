#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

async function checkModelProvider() {
  console.log('\n=== Checking Claude Opus 4.6 provider ===');

  const { data: models } = await supabaseAdmin
    .from('products')
    .select('id, name, slug, provider_id, benchmark_arena_elo')
    .ilike('slug', '%claude-opus-4.6%');

  console.log('\nModels with claude-opus-4.6 slug:');
  for (const m of models || []) {
    const { data: provider } = await supabaseAdmin
      .from('providers')
      .select('id, name, slug, type')
      .eq('id', m.provider_id!)
      .single();

    console.log(`  id=${m.id}: ${m.name} (${m.slug})`);
    console.log(`    provider_id=${m.provider_id}, name=${provider?.name}, type=${provider?.type}`);
    console.log(`    ELO=${m.benchmark_arena_elo}`);
  }
}

checkModelProvider()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
