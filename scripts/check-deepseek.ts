#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

async function checkDeepSeek() {
  console.log('\n📊 DEEPSEEK MODELS IN DATABASE');
  console.log('='.repeat(70));

  const { data: models } = await supabaseAdmin
    .from('products')
    .select(`
      id,
      name,
      slug,
      benchmark_arena_elo,
      provider_id,
      providers (
        id,
        name,
        slug,
        type
      )
    `)
    .ilike('slug', '%deepseek%')
    .order('benchmark_arena_elo', { ascending: false, nullsFirst: false });

  if (!models || models.length === 0) {
    console.log('No DeepSeek models found in database.');
    return;
  }

  console.log(`ID   | ELO     | Name                            | Slug                    | Provider`);
  console.log('-'.repeat(100));
  for (const m of models) {
    const provider = m.providers as any;
    const elo = m.benchmark_arena_elo ? m.benchmark_arena_elo.toFixed(1) : 'N/A';
    const name = m.name.substring(0, 30).padEnd(30);
    const slug = m.slug.substring(0, 22).padEnd(22);
    const provName = provider?.name || '-';
    console.log(`${m.id.toString().padEnd(4)} | ${elo.padEnd(7)} | ${name} | ${slug} | ${provName}`);
  }
  console.log('='.repeat(70));
}

checkDeepSeek()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
