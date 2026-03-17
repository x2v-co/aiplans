#!/usr/bin/env tsx

import { supabaseAdmin, getArenaBenchmarkTaskId, getOrCreateEloMetricId, upsertBenchmarkScore, getModelBySlug } from './db/queries';

// Model name mappings from arena.ai to database slugs
// Arena uses hyphens (-), database uses dots (.) for version numbers
const MODEL_MAPPINGS: Record<string, string[]> = {
  // Anthropic Claude models
  'claude-opus-4-6': ['claude-opus-4.6', 'claude-opus-4-6', 'claude-opus-4.6-replicate'],
  'claude-opus-4-6-thinking': ['claude-opus-4.6', 'claude-opus-4.6-thinking'],
  'claude-sonnet-4-6': ['claude-sonnet-4.6', 'claude-sonnet-4-6', 'claude-sonnet-4.6-replicate'],
  'claude-opus-4-5-20251101-thinking-32k': ['claude-opus-4.5', 'claude-opus-4.5-thinking'],
  'claude-opus-4-5-20251101': ['claude-opus-4.5'],
  'claude-sonnet-4-5-20250929-thinking-32k': ['claude-sonnet-4.5', 'claude-sonnet-4.5-thinking'],

  // OpenAI GPT models
  'gpt-5.2-high': ['gpt-5.2', 'gpt-5.2-high'],
  'gpt-5.2': ['gpt-5.2'],
  'gpt-5-medium': ['gpt-4o-mini', 'gpt-4o-mini-latest', 'gpt-5-mini'],
  'gpt-5.2-chat-latest-20260210': ['gpt-5.2'],
  'gpt-5.1-high': ['gpt-5.1'],
  'gpt-5.1-search': ['gpt-5.1'],
  'gpt-5.2-search': ['gpt-5.2'],
  'gpt-5.2-search-non-reasoning': ['gpt-5.2'],

  // Google Gemini models
  'gemini-3.1-pro-preview': ['gemini-3.1-pro'],
  'gemini-3-pro': ['gemini-3-pro'],
  'gemini-3-flash': ['gemini-3-flash'],
  'gemini-3-flash-thinking-minimal': ['gemini-3-flash-thinking'],
  'gemini-3-pro-grounding': ['gemini-3-pro-grounding'],
  'gemini-3-flash-grounding': ['gemini-3-flash-grounding'],
  'gemini-3-pro-image-preview': ['gemini-3-pro-image'],
  'gemini-2.5-pro': ['gemini-2.5-pro'],
  'gemini-2.5-flash-preview': ['gemini-2.5-flash'],

  // Zhipu AI GLM models
  'glm-5': ['glm-5', 'glm-5-code', 'zhipu-glm-5'],
  'glm-4.7': ['glm-4.7', 'glm-4.7-code', 'zhipu-glm-4.7'],

  // Moonshot Kimi models
  'kimi-k2.5-thinking': ['kimi-k2.5-thinking', 'kimi-2.5-thinking', 'moonshot-k2.5', 'moonshot-k2.5-thinking'],
  'kimi-k2.5-instant': ['kimi-k2.5-instant', 'kimi-2.5-instant', 'moonshot-k2.5-instant'],

  // Minimax models
  'minimax-m2.5': ['minimax-m2.5', 'minimax-2.5', 'minimax-coding-2.5', 'minimax-m-2.5'],
  'minimax-m2.1-preview': ['minimax-m2.1', 'minimax-2.1', 'minimax-coding-2.1', 'minimax-m-2.1'],

  // Qwen models
  'qwen3.5-397b-a17b': ['qwen3.5-397b', 'qwen-3.5-max'],

  // Grok models
  'grok-4.20-beta1': ['grok-4.20-beta1', 'grok-4'],
  'grok-4-1-fast-search': ['grok-4-1-fast-search', 'grok-4-fast'],
  'grok-4-fast-search': ['grok-4-fast-search', 'grok-4-fast'],
  'grok-4.1-thinking': ['grok-4.1-thinking', 'grok-4-thinking'],
  'grok-imagine-video-720p': ['grok-2', 'grok-video', 'grok-4-video'],
  'grok-imagine-video-480p': ['grok-imagine-video-480p', 'grok-4-video'],

  // DeepSeek
  'deepseek-v3': ['deepseek-v3'],
  'deepseek-r1': ['deepseek-r1', 'deepseek-reasoner'],

  // ByteDance
  'bytedancedola-seed-2.0-preview': ['seed-2.0', 'volcengine-seed-2.0', 'byte-dance-seed', 'dola-seed-2.0'],
  'bytedanceseedream-4.5': ['seedream-4.5', 'seed-4.5', 'bytedance-seedream-4.5'],
};

interface ArenaModel {
  rank: number;
  modelName: string;
  rawModelName: string;
  arenaElo: number;
  votes: number;
  organization: string;
  license: string;
}

interface ArenaData {
  categories: Array<{
    categoryName: string;
    models: ArenaModel[];
  }>;
  updatedAt: string;
  source: string;
}

async function updateArenaScores() {
  console.log('🏆 Starting Arena ELO score update...');
  console.log('='.repeat(60));

  // Get benchmark task and metric IDs
  const taskId = await getArenaBenchmarkTaskId();
  const metricId = await getOrCreateEloMetricId();

  if (!taskId || !metricId) {
    console.log('❌ Could not get Arena benchmark task or metric.');
    return;
  }

  // Load arena data
  const arenaDataFile = '/Users/kl/workspace/x2v/planprice/ARENA_LEADERBOARD_2026_03.json';
  const fs = await import('fs');
  const arenaData = JSON.parse(fs.readFileSync(arenaDataFile, 'utf-8')) as ArenaData;

  let totalModels = 0;
  let updatedModels = 0;
  let notFoundModels = 0;
  const updates = new Map<number, { elo: number; source: string[] }>(); // modelId -> {elo, source}

  for (const category of arenaData.categories) {
    console.log(`\n📊 Processing category: ${category.categoryName}`);

    for (const model of category.models) {
      totalModels++;
      console.log(`   Processing: ${model.rawModelName} (ELO: ${model.arenaElo}, Rank: ${model.rank})`);

      const possibleSlugs = MODEL_MAPPINGS[model.modelName] || [model.modelName];
      let found = false;

      for (const slug of possibleSlugs) {
        // Try to find the model by slug
        const foundModel = await getModelBySlug(slug);

        if (foundModel) {
          const existing = updates.get(foundModel.id);
          if (existing) {
            // Use the higher ELO if multiple arena models map to same model
            if (model.arenaElo > existing.elo) {
              existing.elo = model.arenaElo;
              existing.source.push(model.modelName);
              console.log(`   ✅ Updated ${foundModel.name} with higher ELO: ${model.arenaElo} (was ${existing.elo})`);
            }
          } else {
            updates.set(foundModel.id, { elo: model.arenaElo, source: [model.modelName] });
            console.log(`   ✅ Found ${foundModel.name} (slug: ${slug}, id: ${foundModel.id})`);
          }
          found = true;
          break;
        }
      }

      if (!found) {
        console.log(`   ⚠️  Model not found for: ${model.rawModelName}`);
        console.log(`      Tried slugs: ${possibleSlugs.join(', ')}`);
        notFoundModels++;
      }
    }
  }

  // Now apply all updates
  console.log('\n' + '='.repeat(60));
  console.log('🔄 Applying updates to database...');
  console.log('='.repeat(60));

  for (const [modelId, updateData] of updates.entries()) {
    try {
      const result = await upsertBenchmarkScore({
        model_id: modelId,
        benchmark_task_id: taskId,
        metric_id: metricId,
        value: updateData.elo,
      });

      if (result.action !== 'skipped') {
        updatedModels++;
        if (updateData.source.length > 1) {
          console.log(`   ℹ️  Model ${modelId}: Combined from ${updateData.source.join(', ')}`);
        }
      }
    } catch (error: any) {
      console.log(`   ❌ Update error for model ${modelId}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 UPDATE SUMMARY');
  console.log('='.repeat(60));
  console.log(`📦 Total models processed: ${totalModels}`);
  console.log(`✅ Successfully updated: ${updatedModels}`);
  console.log(`⚠️  Models not found: ${notFoundModels}`);
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