#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

// Models to add with their arena data
const MISSING_MODELS = [
  {
    name: 'Claude Opus 4.6 Thinking',
    slug: 'claude-opus-4.6-thinking',
    providerId: 34, // Anthropic
    type: 'llm',
    elo: 1553,
  },
  {
    name: 'Claude Opus 4.5',
    slug: 'claude-opus-4.5',
    providerId: 34, // Anthropic
    type: 'llm',
    elo: 1471,
  },
  {
    name: 'Gemini 3 Flash Thinking',
    slug: 'gemini-3-flash-thinking',
    providerId: 35, // Google Gemini
    type: 'llm',
    elo: 1399,
  },
  {
    name: 'Claude Opus 4.1',
    slug: 'claude-opus-4.1',
    providerId: 34, // Anthropic
    type: 'llm',
    elo: 1388,
  },
  {
    name: 'GPT-5.1 Medium',
    slug: 'gpt-5.1-medium',
    providerId: 33, // OpenAI
    type: 'llm',
    elo: 1387,
  },
  {
    name: 'GLM-4.6',
    slug: 'glm-4.6',
    providerId: 43, // Zhipu AI (智谱)
    type: 'llm',
    elo: 1355,
  },
  {
    name: 'MIMO V2 Flash',
    slug: 'mimo-v2-flash',
    providerId: 48, // Xiaomi
    type: 'llm',
    elo: 1341,
  },
];

async function addMissingModels() {
  console.log('\n📊 ADDING MISSING ARENA MODELS');
  console.log('='.repeat(70));

  let added = 0;
  let skipped = 0;

  for (const model of MISSING_MODELS) {
    console.log(`\nChecking: ${model.name} (${model.slug})`);

    // Check if already exists
    const result = await supabaseAdmin
      .from('products')
      .select('id, name, slug, benchmark_arena_elo')
      .eq('slug', model.slug)
      .single();

    if (result.data && !result.error) {
      const existing = result.data;
      console.log(`  ⚠️  Already exists: id=${existing.id}, current ELO=${existing.benchmark_arena_elo}`);
      skipped++;
    } else {
      // Add new model
      const insertResult = await supabaseAdmin
        .from('products')
        .insert({
          name: model.name,
          slug: model.slug,
          provider_id: model.providerId,
          type: model.type,
          benchmark_arena_elo: model.elo,
        })
        .select()
        .single();

      const { data: newModel, error } = insertResult;

      if (!error && newModel) {
        console.log(`  ✅ Added: id=${newModel.id}, ${model.name} (ELO: ${model.elo})`);
        added++;
      } else {
        console.log(`  ❌ Insert failed:`, error);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Successfully added: ${added}`);
  console.log(`⚠️  Already existed (skipped): ${skipped}`);
  console.log('='.repeat(70));
}

addMissingModels()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
