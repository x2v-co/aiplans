#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function queryTopModels() {
  console.log('\n📈 TOP MODELS BY ARENA ELO SCORE');
  console.log('='.repeat(70));

  // Get all models with arena scores
  const { data: benchmarkScores } = await supabase
    .from('model_benchmark_scores')
    .select(`
      value,
      models (
        id,
        name,
        slug,
        provider_ids
      )
    `)
    .order('value', { ascending: false })
    .limit(50);

  if (!benchmarkScores || benchmarkScores.length === 0) {
    console.log('No models with arena scores found in database.');
    return;
  }

  // Get all providers
  const allProviderIds = [...new Set(
    benchmarkScores
      .filter((bs: any) => bs.models?.provider_ids?.length > 0)
      .flatMap((bs: any) => bs.models.provider_ids)
  )];

  const { data: providers } = await supabase
    .from('providers')
    .select('id, name, slug, type')
    .in('id', allProviderIds);

  const providerMap = new Map((providers || []).map((p: any) => [p.id, p]));

  // Process and display
  const models = benchmarkScores.map((bs: any) => {
    const model = bs.models;
    const provider = model?.provider_ids?.[0] ? providerMap.get(model.provider_ids[0]) : null;
    return {
      id: model?.id,
      name: model?.name || 'Unknown',
      slug: model?.slug || 'unknown',
      elo: bs.value,
      provider: provider?.name || '-',
      providerType: provider?.type || '-',
    };
  });

  console.log(`Rank | ELO   | Model Name                    | Provider`);
  console.log('-'.repeat(70));

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const rank = i + 1;
    const elo = model.elo ? model.elo.toFixed(0) : 'N/A';
    const displayName = model.name.substring(0, 35);
    const providerName = model.provider.substring(0, 18);

    console.log(`${rank.toString().padStart(4)} | ${elo.padStart(6)} | ${displayName.padEnd(35)} | ${providerName}`);
  }

  console.log('='.repeat(70));
}

queryTopModels()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });