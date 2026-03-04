#!/usr/bin/env tsx

import { supabaseAdmin } from './db/queries';

// Model name mappings from arena.ai to database slugs
// Arena uses hyphens (-), database uses dots (.) for version numbers
const MODEL_MAPPINGS: Record<string, string[]> = {
  // Anthropic Claude models
  'claude-opus-4-6': ['claude-opus-4.6', 'claude-opus-4.6-replicate'],
  'claude-opus-4-6-thinking': ['claude-opus-4.6', 'claude-opus-4.6-thinking'],
  'claude-sonnet-4-6': ['claude-sonnet-4.6', 'claude-sonnet-4.6-replicate'],
  'claude-opus-4-5-20251101-thinking-32k': ['claude-opus-4.5', 'claude-opus-4.5-thinking'],
  'claude-opus-4-5-20251101': ['claude-opus-4.5'],
  'claude-sonnet-4-5-20250929-thinking-32k': ['claude-sonnet-4.5', 'claude-sonnet-4.5-thinking'],
  'claude-opus-4-1-20250805': ['claude-opus-4.1'],
  'claude-sonnet-4-5-20250929': ['claude-sonnet-4.5'],

  // OpenAI GPT models
  'gpt-5.2-high': ['gpt-5.2', 'gpt-5.2-high'],
  'gpt-5.2': ['gpt-5.2'],
  'gpt-5-medium': ['gpt-4o-mini', 'gpt-4o-mini-latest', 'gpt-5-mini'],
  'gpt-5.2-chat-latest-20260210': ['gpt-5.2'],
  'gpt-5.1-high': ['gpt-5.1'],
  'gpt-5.1-search': ['gpt-5.1'],
  'gpt-5.2-search': ['gpt-5.2'],
  'gpt-5.2-search-non-reasoning': ['gpt-5.2'],
  'gpt-5.1-medium': ['gpt-5.1-medium'],
  'gpt-5.2-codex': ['gpt-5.2-codex'],
  'gpt-5.1-codex': ['gpt-5.1-codex'],

  // Google Gemini models
  'gemini-3.1-pro-preview': ['gemini-3.1-pro'],
  'gemini-3-pro': ['gemini-3-pro'],
  'gemini-3-flash': ['gemini-3-flash'],
  'gemini-3-flash-thinking-minimal': ['gemini-3-flash-thinking'],
  'gemini-1.5-pro': ['gemini-1.5-pro'],
  'gemini-1.5-flash': ['gemini-1.5-flash'],

  // Zhipu AI GLM models
  'glm-5': ['glm-5', 'glm-5-code', 'zhipu-glm-5'],
  'glm-4.7': ['glm-4.7', 'glm-4.7-code', 'zhipu-glm-4.7'],
  'glm-4.6': ['glm-4.6', 'glm-4.6-code', 'zhipu-glm-4.6'],

  // Moonshot Kimi models
  'kimi-k2.5-thinking': ['kimi-k2.5-thinking', 'kimi-2.5-thinking', 'moonshot-k2.5', 'moonshot-k2.5-thinking'],
  'kimi-k2.5-instant': ['kimi-k2.5-instant', 'kimi-2.5-instant', 'moonshot-k2.5-instant'],
  'kimi-k2-thinking-turbo': ['kimi-k2-thinking-turbo', 'kimi-k2-turbo'],

  // Minimax models
  'minimax-m2.5': ['minimax-m2.5', 'minimax-2.5', 'minimax-coding-2.5', 'minimax-m-2.5'],
  'minimax-m2.1-preview': ['minimax-m2.1', 'minimax-2.1', 'minimax-coding-2.1', 'minimax-m-2.1'],

  // Qwen models
  'qwen3.5-397b-a17b': ['qwen3.5-397b', 'qwen-3.5-max'],

  // DeepSeek models
  'deepseek-v3': ['deepseek-v3'],
  'deepseek-v3.2-thinking': ['deepseek-v3.2-thinking'],
  'deepseek-v3.2': ['deepseek-v3.2'],
  'deepseek-v3.2-exp': ['deepseek-v3.2-exp'],
  'deepseek-r1': ['deepseek-r1', 'deepseek-reasoner'],

  // Xiaomi
  'mimo-v2-flash-(non-thinking)': ['mimo-v2-flash', 'mimo-2-flash'],

  // ByteDance
  'bytedancedola-seed-2.0-preview': ['seed-2.0', 'volcengine-seed-2.0', 'byte-dance-seed', 'dola-seed-2.0'],
  'bytedanceseedream-4.5': ['seedream-4.5', 'seed-4.5', 'bytedance-seedream-4.5'],
};

interface ArenaModel {
  rank: number;
  name: string;
  provider: string;
  license: string;
  score: number;
  confidence: string;
  votes: number;
}

interface ArenaData {
  source: string;
  date: string;
  category: string;
  top30: ArenaModel[];
  deepSeekModels?: ArenaModel[];
}

async function updateArenaScores() {
  console.log('🏆 Starting Arena ELO score update...');
  console.log('='.repeat(60));

  // Load arena data from NEW file
  const arenaDataFile = '/Users/kl/workspace/x2v/planprice/ARENA_CODE_LEADERBOARD_TOP30.json';
  const fs = await import('fs');
  const arenaData = JSON.parse(fs.readFileSync(arenaDataFile, 'utf-8')) as ArenaData;

  let totalModels = 0;
  let updatedModels = 0;
  let notFoundModels = 0;
  const updates = new Map<number, { elo: number; source: string[] }>(); // productId -> {elo, source}

  console.log(`\n📊 Source: ${arenaData.source}`);
  console.log(`📅 Date: ${arenaData.date}`);

  for (const model of arenaData.top30) {
    totalModels++;
    console.log(`\n   Processing: ${model.name} (ELO: ${model.score}, Rank: ${model.rank})`);

    const possibleSlugs = MODEL_MAPPINGS[model.name] || [model.name];
    let found = false;

    for (const slug of possibleSlugs) {
      // Try to find product by slug (exact match first)
      const { data: products, error } = await supabaseAdmin
        .from('products')
        .select('id, name, slug, benchmark_arena_elo')
        .eq('slug', slug)
        .limit(1);

      if (!error && products && products.length > 0) {
        const product = products[0];
        const existing = updates.get(product.id);
        if (existing) {
          // Use the higher ELO if multiple arena models map to same product
          if (model.score > existing.elo) {
            existing.elo = model.score;
            existing.source.push(model.name);
            console.log(`   ✅ Updated ${product.name} with higher ELO: ${model.score} (was ${existing.elo})`);
          }
        } else {
          updates.set(product.id, { elo: model.score, source: [model.name] });
          console.log(`   ✅ Found ${product.name} (slug: ${slug}, id: ${product.id})`);
        }
        found = true;
        break;
      }
    }

    if (!found) {
      console.log(`   ⚠️  Product not found for: ${model.name}`);
      console.log(`      Tried slugs: ${possibleSlugs.join(', ')}`);
      notFoundModels++;
    }
  }

  // Now apply all updates
  console.log('\n' + '='.repeat(60));
  console.log('🔄 Applying updates to database...');
  console.log('='.repeat(60));

  for (const [productId, updateData] of updates.entries()) {
    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        benchmark_arena_elo: updateData.elo,
        updated_at: new Date(),
      })
      .eq('id', productId);

    if (!updateError) {
      updatedModels++;
      if (updateData.source.length > 1) {
        console.log(`   ℹ️  Product ${productId}: Combined from ${updateData.source.join(', ')}`);
      }
    } else {
      console.log(`   ❌ Update error for product ${productId}:`, updateError);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 UPDATE SUMMARY');
  console.log('='.repeat(60));
  console.log(`📦 Total models processed: ${totalModels}`);
  console.log(`✅ Successfully updated: ${updatedModels}`);
  console.log(`⚠️  Products not found: ${notFoundModels}`);
  console.log('='.repeat(60));
}

updateArenaScores()
  .then(() => {
    console.log('\n✅ Arena ELO score update completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
