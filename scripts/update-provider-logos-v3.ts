#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Provider logo mapping
const PROVIDER_LOGOS: Record<string, string> = {
  openai: '/providers/openai.png',
  anthropic: '/providers/anthropic.ico',
  'google-gemini': '/providers/google.png',
  deepseek: '/providers/deepseek.ico',
  grok: '/providers/meta.png',
  mistral: '/providers/mistral.ico',
  'moonshot-china': '/providers/moonshot.png',
  'moonshot-global': '/providers/moonshot.png',
  'minimax-china': '/providers/minimax.ico',
  'minimax-global': '/providers/minimax.ico',
  'zhipu-china': '/providers/zhipu.ico',
  'zhipu-global': '/providers/zhipu.ico',
  stepfun: '/providers/stepfun.ico',
  qwen: '/providers/alibaba.ico',
  volcengine: '/providers/seed.ico',
  hunyuan: '/providers/xai.ico',
  baidu: '/providers/baidu.png',
  'aws-bedrock': '/providers/aws-bedrock.ico',
  'vertex-ai': '/providers/google-vertex-ai.ico',
  'azure-openai': '/providers/azure-openai.ico',
  'together-ai': '/providers/mistral.ico',
  siliconflow: '/providers/baidu-qianfan.png',
  fireworks: '/providers/fireworks-ai.ico',
  replicate: '/providers/replicate.jpg',
  anyscale: '/providers/anthropic.ico',
  dmxapi: '/providers/dmxapi.ico',
  openrouter: '/providers/openai.png',
};

async function main() {
  console.log('🖼️  Updating provider logos...\n');

  let updatedCount = 0;
  let skippedCount = 0;

  for (const [slug, logoUrl] of Object.entries(PROVIDER_LOGOS)) {
    try {
      // Check if provider exists
      const { data: provider } = await supabase
        .from('providers')
        .select('id, name, slug, logo_url')
        .eq('slug', slug)
        .single();

      if (!provider) {
        console.log(`⚠️  Provider not found: ${slug}`);
        continue;
      }

      // Update if logo is null or different
      if (provider.logo_url === null || provider.logo_url !== logoUrl) {
        const { error } = await supabase
          .from('providers')
          .update({ logo_url, updated_at: new Date() })
          .eq('id', provider.id);

        if (error) {
          console.error(`❌ Failed to update ${provider.name}:`, error);
        } else {
          console.log(`✅ Updated ${provider.name}: null → ${logoUrl}`);
          updatedCount++;
        }
      } else {
        skippedCount++;
      }
    } catch (error: any) {
      console.error(`❌ Error processing ${slug}:`, error.message);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`✅ Updated: ${updatedCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
}

main().catch(console.error);
