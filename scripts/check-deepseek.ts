#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

async function checkDeepSeek() {
  console.log('\n📊 DEEPSEEK MODELS IN DATABASE');
  console.log('='.repeat(70));

  const { data: models } = await supabaseAdmin
    .from('models')
    .select(`
      id,
      name,
      slug,
      provider_ids
    `)
    .ilike('slug', '%deepseek%')
    .order('name');

  if (!models || models.length === 0) {
    console.log('No DeepSeek models found in database.');
    return;
  }

  // Get ELO scores for these models
  const modelIds = models.map(m => m.id);
  const { data: eloScores } = await supabaseAdmin
    .from('model_benchmark_scores')
    .select('model_id, value')
    .in('model_id', modelIds);

  const eloMap = new Map<number, number>();
  (eloScores || []).forEach((score: any) => {
    const current = eloMap.get(score.model_id);
    if (!current || score.value > current) {
      eloMap.set(score.model_id, score.value);
    }
  });

  console.log(`ID   | ELO     | Name                            | Slug                    | Providers`);
  console.log('-'.repeat(100));
  for (const m of models) {
    const elo = eloMap.has(m.id) ? eloMap.get(m.id)!.toFixed(1) : 'N/A';
    const name = m.name.substring(0, 30).padEnd(30);
    const slug = m.slug.substring(0, 22).padEnd(22);
    const providers = m.provider_ids?.join(',') || '-';
    console.log(`${m.id.toString().padEnd(4)} | ${elo.padEnd(7)} | ${name} | ${slug} | ${providers}`);
  }
  console.log('='.repeat(70));
}

checkDeepSeek()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });