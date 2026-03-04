#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

async function queryTopModels() {
  console.log('\n📈 TOP MODELS BY ARENA ELO SCORE');
  console.log('='.repeat(70));

  // Get all products with arena scores and their providers
  const { data: allModels } = await supabaseAdmin
    .from('products')
    .select(`
      id,
      name,
      slug,
      benchmark_arena_elo,
      benchmark_mmlu,
      provider_id,
      providers (
        id,
        name,
        slug,
        type
      )
    `)
    .not('benchmark_arena_elo', 'is', null)
    .order('benchmark_arena_elo', { ascending: false, nullsFirst: false })
    .limit(50);

  if (!allModels || allModels.length === 0) {
    console.log('No models with arena scores found in database.');
    return;
  }

  // Group models by base name (remove version suffixes)
  const modelGroups = new Map<string, {
    maxElo: number;
    officialProviderId: number | null;
    officialProviderName: string;
    officialProviderType: string;
    bestProviderId: number;
    bestProviderName: string;
    officialSlug: string;
    bestSlug: string;
    bestId: number;
    bestModelName: string;
    officialModelName: string;
  }>();

  for (const model of allModels) {
    const provider = model.providers as any;
    const baseSlug = model.slug.replace(/-thinking|-instant|-preview|-v2|-v3|-min|-high| \-?\d+$/gi, '');
    const baseName = model.name.replace(/ Thinking| Instant| Preview| v2| v3| \d+\.\d+$/gi, '');

    const existing = modelGroups.get(baseSlug);

    if (existing) {
      // Found another version of the same model
      if (model.benchmark_arena_elo! > existing.maxElo) {
        existing.maxElo = model.benchmark_arena_elo!;
        existing.bestProviderId = provider.id;
        existing.bestProviderName = provider.name;
        existing.bestSlug = model.slug;
        existing.bestId = model.id;
        existing.bestModelName = model.name;
      }
      // Track official provider
      if (provider.type === 'official') {
        existing.officialProviderId = provider.id;
        existing.officialProviderName = provider.name;
        existing.officialProviderType = provider.type;
        existing.officialSlug = model.slug;
        existing.officialModelName = model.name;
      }
    } else {
      modelGroups.set(baseSlug, {
        maxElo: model.benchmark_arena_elo!,
        officialProviderId: provider.type === 'official' ? provider.id : null,
        officialProviderName: provider.type === 'official' ? provider.name : '',
        officialProviderType: provider.type || '',
        officialSlug: model.slug,
        officialModelName: model.name,
        bestProviderId: provider.id,
        bestProviderName: provider.name,
        bestSlug: model.slug,
        bestId: model.id,
        bestModelName: model.name,
      });
    }
  }

  // Convert to array and sort by ELO
  const sortedModels = Array.from(modelGroups.values())
    .sort((a, b) => b.maxElo - a.maxElo)
    .slice(0, 20);

  console.log(`Rank | ELO   | MMLU  | Model Name                    | Official Provider`);
  console.log('-'.repeat(70));

  for (let i = 0; i < sortedModels.length; i++) {
    const model = sortedModels[i];
    const elo = model.maxElo ? model.maxElo.toFixed(1) : 'N/A';
    const mmlu = 'N/A';
    const rank = i + 1;
    // Use bestModelName (highest ELO) for display, but show if it differs from official
    const displayName = model.bestModelName ? model.bestModelName.substring(0, 35) : '-';
    const officialProvider = model.officialProviderName?.substring(0, 18) || '-';

    console.log(`${rank.toString().padStart(4)} | ${elo.padStart(6)} | ${mmlu.padStart(5)} | ${displayName.padEnd(35)} | ${officialProvider}`);
  }

  console.log('='.repeat(70));
}

queryTopModels()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
