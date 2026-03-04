#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

// Missing models from arena.ai leaderboard
const MISSING_MODELS = [
  {
    name: 'Claude Opus 4.5 Thinking',
    slug: 'claude-opus-4.5-thinking',
    providerId: 34, // Anthropic
    type: 'llm',
    description: 'Claude Opus 4.5 with thinking mode (32k context)',
    contextWindow: 200000,
    benchmarkArenaElo: 1499,
  },
  {
    name: 'Claude Opus 4.5',
    slug: 'claude-opus-4.5',
    providerId: 34, // Anthropic
    type: 'llm',
    description: 'Claude Opus 4.5',
    contextWindow: 200000,
    benchmarkArenaElo: 1471,
  },
  {
    name: 'Claude Sonnet 4.5 Thinking',
    slug: 'claude-sonnet-4.5-thinking',
    providerId: 34, // Anthropic
    type: 'llm',
    description: 'Claude Sonnet 4.5 with thinking mode (32k context)',
    contextWindow: 200000,
    benchmarkArenaElo: 1388,
  },
  {
    name: 'Gemini 3 Flash Thinking',
    slug: 'gemini-3-flash-thinking',
    providerId: 35, // Google Gemini
    type: 'llm',
    description: 'Gemini 3 Flash with thinking mode',
    contextWindow: 1000000,
    benchmarkArenaElo: 1399,
  },
  {
    name: 'Qwen 3.5 397B',
    slug: 'qwen3.5-397b',
    providerId: 46, // 阿里 Qwen
    type: 'llm',
    description: 'Qwen 3.5 397B model',
    contextWindow: 32768,
    benchmarkArenaElo: 1396,
  },
  {
    name: 'Kimi K2.5 Thinking',
    slug: 'kimi-k2.5-thinking',
    providerId: 40, // 月之暗面 国际 (Moonshot Global)
    type: 'llm',
    description: 'Moonshot Kimi K2.5 with thinking mode',
    contextWindow: 128000,
    benchmarkArenaElo: 1436,
  },
  {
    name: 'Kimi K2.5 Instant',
    slug: 'kimi-k2.5-instant',
    providerId: 40, // 月之暗面 国际 (Moonshot Global)
    type: 'llm',
    description: 'Moonshot Kimi K2.5 Instant',
    contextWindow: 128000,
    benchmarkArenaElo: 1419,
  },
];

async function addMissingModels() {
  console.log('🏆 Adding missing Arena models to database...');
  console.log('='.repeat(60));

  let addedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const model of MISSING_MODELS) {
    console.log(`\n📝 Processing: ${model.name}`);

    // Check if model already exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('products')
      .select('id, name, slug, benchmark_arena_elo')
      .eq('slug', model.slug)
      .limit(1);

    if (checkError) {
      console.log(`   ❌ Check error: ${checkError.message}`);
      errorCount++;
      continue;
    }

    if (existing && existing.length > 0) {
      const existingModel = existing[0];
      console.log(`   ⏭️  Already exists: ${existingModel.name} (ELO: ${existingModel.benchmark_arena_elo})`);

      // Update if ELO is different
      if (existingModel.benchmark_arena_elo !== model.benchmarkArenaElo) {
        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({
            benchmark_arena_elo: model.benchmarkArenaElo,
            updated_at: new Date(),
          })
          .eq('id', existingModel.id);

        if (!updateError) {
          console.log(`   ✅ Updated ELO: ${existingModel.benchmark_arena_elo} → ${model.benchmarkArenaElo}`);
          addedCount++;
        } else {
          console.log(`   ❌ Update error: ${updateError.message}`);
          errorCount++;
        }
      } else {
        skippedCount++;
      }
      continue;
    }

    // Insert new model
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('products')
      .insert({
        name: model.name,
        slug: model.slug,
        provider_id: model.providerId,
        type: model.type,
        description: model.description,
        context_window: model.contextWindow,
        benchmark_arena_elo: model.benchmarkArenaElo,
        benchmark_mmlu: null,
        benchmark_human_eval: null,
        released_at: new Date(),
      })
      .select('id, name, slug')
      .single();

    if (insertError) {
      console.log(`   ❌ Insert error: ${insertError.message}`);
      errorCount++;
    } else if (inserted) {
      console.log(`   ✅ Added: ${inserted.name} (id: ${inserted.id})`);
      addedCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Added/Updated: ${addedCount}`);
  console.log(`⏭️  Skipped (already exists): ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('='.repeat(60));
}

addMissingModels()
  .then(() => {
    console.log('\n✅ Missing models processing completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
