#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Arena ELO scores from arena.ai (March 2026)
const ARENA_ELO_SCORES: Record<string, number> = {
  // Claude
  'claude-opus-4.6': 1553,
  'claude-sonnet-4.6': 1531,
  'claude-3-opus': 1499,
  'claude-3-5-sonnet': 1436,
  'claude-3-7-sonnet': 1408,

  // Grok
  'grok-2-mini': 1460,
  'grok-2': 1473,

  // Gemini
  'gemini-2.5-pro-exp': 1450,
  'gpt-4o-mini': 1438,

  // DeepSeek
  'deepseek-v3-r1': 1403,
  'deepseek-v3': 1470,

  // GPT
  'gpt-4o': 1471,

  // Qwen
  'qwen-2.5-coder-32b': 1394,

  // Qwen (legacy naming in our DB)
  'qwen-max': 1300,
  'qwen-plus': 1280,
  'qwen-turbo': 1250,

  // MiniMax
  'minimax-m2.5': 1280,
  'kimi-k2.5': 1270,

  // Moonshot
  'moonshot-v1-128k': 1260,
  'moonshot-v1-32k': 1250,
  'moonshot-v1-8k': 1240,
};

async function getArenaBenchmarkTaskId(): Promise<number | null> {
  // Get the Arena benchmark task ID
  // First get the benchmark ID for Arena
  const { data: benchmark } = await supabase
    .from('benchmarks')
    .select('id')
    .eq('slug', 'arena')
    .single();

  if (!benchmark) {
    console.log('⚠️  Arena benchmark not found. Creating...');
    return null;
  }

  // Get the benchmark version
  const { data: version } = await supabase
    .from('benchmark_versions')
    .select('id')
    .eq('benchmark_id', benchmark.id)
    .eq('is_current', true)
    .single();

  if (!version) {
    console.log('⚠️  Arena benchmark version not found.');
    return null;
  }

  // Get the task
  const { data: task } = await supabase
    .from('benchmark_tasks')
    .select('id')
    .eq('benchmark_version_id', version.id)
    .single();

  return task?.id || null;
}

async function getOrCreateArenaMetricId(): Promise<number | null> {
  const { data: existingMetric } = await supabase
    .from('benchmark_metrics')
    .select('id')
    .eq('name', 'ELO')
    .single();

  if (existingMetric) {
    return existingMetric.id;
  }

  // Create the metric
  const { data: newMetric, error } = await supabase
    .from('benchmark_metrics')
    .insert({
      name: 'ELO',
      unit: 'score',
      description: 'Chatbot Arena ELO score',
      higher_better: true,
    })
    .select('id')
    .single();

  if (error) {
    console.log('⚠️  Failed to create ELO metric:', error.message);
    return null;
  }

  return newMetric?.id || null;
}

async function main() {
  console.log('🏆 Updating Arena ELO scores...\n');

  // Get or create Arena benchmark task
  const taskId = await getArenaBenchmarkTaskId();
  const metricId = await getOrCreateArenaMetricId();

  if (!taskId || !metricId) {
    console.log('❌ Could not get Arena benchmark task or metric. Please set up benchmark tables first.');
    console.log('   Run setup-benchmark-tables.ts to create the required entries.');
    return;
  }

  let updatedCount = 0;
  let errorCount = 0;
  let insertedCount = 0;

  for (const [slug, elo] of Object.entries(ARENA_ELO_SCORES)) {
    try {
      // Check if model exists
      const { data: model } = await supabase
        .from('models')
        .select('id, name, slug')
        .eq('slug', slug)
        .single();

      if (!model) {
        console.log(`⚠️  Model not found: ${slug}`);
        continue;
      }

      // Check if benchmark score already exists
      const { data: existingScore } = await supabase
        .from('model_benchmark_scores')
        .select('id, value')
        .eq('model_id', model.id)
        .eq('benchmark_task_id', taskId)
        .single();

      if (existingScore) {
        // Update if different
        if (existingScore.value !== elo) {
          const { error } = await supabase
            .from('model_benchmark_scores')
            .update({
              value: elo,
              release_date: new Date().toISOString().split('T')[0],
            })
            .eq('id', existingScore.id);

          if (error) {
            console.error(`❌ Failed to update ${model.name}:`, error);
            errorCount++;
          } else {
            console.log(`✅ Updated ${model.name}: ${existingScore.value} → ${elo}`);
            updatedCount++;
          }
        }
      } else {
        // Insert new score
        const { error } = await supabase
          .from('model_benchmark_scores')
          .insert({
            model_id: model.id,
            benchmark_task_id: taskId,
            metric_id: metricId,
            value: elo,
            release_date: new Date().toISOString().split('T')[0],
          });

        if (error) {
          console.error(`❌ Failed to insert ${model.name}:`, error);
          errorCount++;
        } else {
          console.log(`✅ Inserted ${model.name}: ELO ${elo}`);
          insertedCount++;
        }
      }
    } catch (error: any) {
      console.error(`❌ Error processing ${slug}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`✅ Inserted: ${insertedCount}`);
  console.log(`✅ Updated: ${updatedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

main().catch(console.error);