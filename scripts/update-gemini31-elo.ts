#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const GEMINI_ELO_SCORES: Record<string, number> = {
  'gemini-3.1-pro-preview-custom-tools': 1461,
  'gemini-3.1-pro': 1461,
  'gemini-3-pro': 1443,
  'gemini-3-flash': 1441,
};

async function main() {
  console.log('🏆 Updating Gemini 3.1 ELO scores...\n');

  let updatedCount = 0;
  let errorCount = 0;

  for (const [slug, elo] of Object.entries(GEMINI_ELO_SCORES)) {
    try {
      const { data: product } = await supabase
        .from('products')
        .select('id, name, slug, benchmark_arena_elo')
        .eq('slug', slug)
        .single();

      if (!product) {
        console.log(`⚠️  Product not found: ${slug}`);
        continue;
      }

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
