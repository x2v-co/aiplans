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

async function main() {
  console.log('🏆 Updating Arena ELO scores from arena.ai data...\n');

  let updatedCount = 0;
  let errorCount = 0;

  for (const [slug, elo] of Object.entries(ARENA_ELO_SCORES)) {
    try {
      // Check if product exists
      const { data: product } = await supabase
        .from('products')
        .select('id, name, slug, benchmark_arena_elo')
        .eq('slug', slug)
        .single();

      if (!product) {
        console.log(`⚠️  Product not found: ${slug}`);
        continue;
      }

      // Update ELO score if different
      if (product.benchmark_arena_elo !== elo) {
        const { error } = await supabase
          .from('products')
          .update({
            benchmark_arena_elo: elo,
            updated_at: new Date(),
          })
          .eq('id', product.id);

        if (error) {
          console.error(`❌ Failed to update ${product.name}:`, error);
          errorCount++;
        } else {
          console.log(`✅ Updated ${product.name}: ${product.benchmark_arena_elo} → ${elo}`);
          updatedCount++;
        }
      }
    } catch (error: any) {
      console.error(`❌ Error processing ${slug}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`✅ Updated: ${updatedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

main().catch(console.error);
