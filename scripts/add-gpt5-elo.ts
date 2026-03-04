#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Estimated Arena ELO scores for GPT-5 models (placeholder until official scores are available)
const GPT5_ELO_SCORES: Record<string, number> = {
  'gpt-5': 1580,          // Slightly higher than Claude Opus 4.6 (1553)
  'gpt-5-pro': 1600,       // Highest tier
  'gpt-5-nano': 1450,      // Slightly higher than GPT-4o-mini (1438)
  'gpt-5-codex': 1490,    // Coding variant
  'gpt-5-image': 1440,     // Image generation variant
  'gpt-5.1': 1590,
  'gpt-5.1-codex': 1500,
  'gpt-5.1-codex-max': 1520,
  'gpt-5.2': 1595,
  'gpt-5.2-codex': 1510,
  'gpt-5.2-pro': 1610,
  'gpt-5.3-codex': 1530,
};

async function main() {
  console.log('🏆 Adding Arena ELO scores for GPT-5 models...\n');

  let updatedCount = 0;
  let errorCount = 0;

  for (const [slug, elo] of Object.entries(GPT5_ELO_SCORES)) {
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

      // Update ELO score if different or null
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
      } else {
        console.log(`⏭️  Skipped ${product.name}: already ${elo}`);
      }
    } catch (error: any) {
      console.error(`❌ Error processing ${slug}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`✅ Updated: ${updatedCount}`);
  console.log(`⏭️  Skipped: ${Object.entries(GPT5_ELO_SCORES).length - updatedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

main().catch(console.error);
