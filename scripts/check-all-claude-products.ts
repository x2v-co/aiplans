#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

async function main() {
  const { data: claudeModels } = await supabaseAdmin
    .from('models')
    .select('id, name, slug')
    .ilike('slug', '%claude%')
    .order('name');

  console.log('📋 All Claude models in database:\n');

  for (const m of claudeModels || []) {
    // Get ELO from benchmark scores
    const { data: eloScore } = await supabaseAdmin
      .from('model_benchmark_scores')
      .select('value')
      .eq('model_id', m.id)
      .order('value', { ascending: false })
      .limit(1)
      .single();

    console.log(`- ${m.name} (${m.slug}) - ELO: ${eloScore?.value || 'N/A'}`);
  }

  console.log(`\nTotal: ${claudeModels?.length || 0} Claude models`);
}

main().catch(console.error);