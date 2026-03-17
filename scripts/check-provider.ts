#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

async function checkModelProvider() {
  console.log('\n=== Checking Claude Opus 4.6 provider ===');

  const { data: models } = await supabaseAdmin
    .from('models')
    .select('id, name, slug, provider_ids')
    .ilike('slug', '%claude-opus-4.6%');

  console.log('\nModels with claude-opus-4.6 slug:');
  for (const m of models || []) {
    // Get providers from provider_ids
    let providerNames: string[] = [];
    if (m.provider_ids && m.provider_ids.length > 0) {
      const { data: providers } = await supabaseAdmin
        .from('providers')
        .select('id, name, slug, type')
        .in('id', m.provider_ids);
      providerNames = (providers || []).map(p => `${p.name}(${p.type})`);
    }

    // Get ELO from benchmark scores
    const { data: eloScore } = await supabaseAdmin
      .from('model_benchmark_scores')
      .select('value')
      .eq('model_id', m.id)
      .order('value', { ascending: false })
      .limit(1)
      .single();

    console.log(`  id=${m.id}: ${m.name} (${m.slug})`);
    console.log(`    provider_ids=${m.provider_ids?.join(',')}, providers=${providerNames.join(', ')}`);
    console.log(`    ELO=${eloScore?.value || 'N/A'}`);
  }
}

checkModelProvider()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });