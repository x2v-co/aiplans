#!/usr/bin/env tsx

/**
 * Main scraper runner with dynamic scrapers
 * Uses provider-config.ts for metadata and prioritized execution
 */

import { scrapeOpenRouter } from './scrapers/openrouter';

// Dynamic scrapers (Phase 1 - API-based, high priority ⭐⭐⭐)
import { scrapeDeepSeekDynamic } from './scrapers/deepseek-dynamic';
import { scrapeAnthropicDynamic } from './scrapers/anthropic-dynamic';
import { scrapeTogetherAIDynamic } from './scrapers/together-ai-dynamic';
import { scrapeSiliconFlowDynamic } from './scrapers/siliconflow-dynamic';

// Dynamic scrapers (Phase 2 - HTML-based, high priority ⭐⭐⭐)
import { scrapeOpenAIDynamic } from './scrapers/openai-dynamic';
import { scrapeGoogleDynamic } from './scrapers/google-gemini-dynamic';
import { scrapeAzureOpenAIDynamic } from './scrapers/azure-openai-dynamic';
import { scrapeAWSBedrockDynamic } from './scrapers/aws-bedrock-dynamic';
import { scrapeVertexAIDynamic } from './scrapers/vertex-ai-dynamic';

// Additional dynamic scrapers - Official providers
import { scrapeMistralDynamic } from './scrapers/mistral-dynamic';
import { scrapeQwenDynamic } from './scrapers/qwen-dynamic';
import { scrapeSeedDynamic } from './scrapers/seed-dynamic';
import { scrapeHunyuanDynamic } from './scrapers/hunyuan-dynamic';
import { scrapeBaiduDynamic } from './scrapers/baidu-dynamic';

// Additional dynamic scrapers - Priority 2 (medium)
import { scrapeFireworksDynamic } from './scrapers/fireworks-dynamic';
import { scrapeReplicateDynamic } from './scrapers/replicate-dynamic';
import { scrapeAnyscaleDynamic } from './scrapers/anyscale-dynamic';
import { scrapeStepFunDynamic } from './scrapers/stepfun-dynamic';
import { scrapeDMXAPIDynamic } from './scrapers/dmxapi-dynamic';

import {
  upsertChannelPrice,
  upsertPlan,
  logPriceChange,
  logScrapeResult,
  getOrCreateProduct,
  getOrCreateProvider,
  supabaseAdmin
} from './db/queries';
import { calculateChangePercent, isSignificantChange } from './utils/validator';
import type { ScraperResult } from './utils/validator';
import type { PlanScraperResult } from './utils/plan-validator';
import { normalizeModelName, normalizeSlug } from './utils/model-normalizer';

/**
 * Dynamic scraper configuration
 * Includes priority-based execution order
 */
interface ScraperConfig {
  name: string;
  fn: () => Promise<ScraperResult>;
  priority: number; // 1=high, 2=medium, 3=low
}

/**
 * Priority-based scraper execution queue
 * Priority 1 scrapers run first, then priority 2, etc.
 */
const API_SCRAPERS: ScraperConfig[] = [
  // Priority 1 (⭐⭐⭐) - API-based
  { name: 'OpenRouter', fn: scrapeOpenRouter, priority: 1 },
  { name: 'OpenAI', fn: scrapeOpenAIDynamic, priority: 1 },
  { name: 'Anthropic', fn: scrapeAnthropicDynamic, priority: 1 },
  { name: 'DeepSeek', fn: scrapeDeepSeekDynamic, priority: 1 },
  { name: 'Google Gemini', fn: scrapeGoogleDynamic, priority: 1 },
  { name: 'Together AI', fn: scrapeTogetherAIDynamic, priority: 1 },
  { name: 'SiliconFlow', fn: scrapeSiliconFlowDynamic, priority: 1 },
  { name: 'Mistral AI', fn: scrapeMistralDynamic, priority: 1 },
  { name: 'Qwen', fn: scrapeQwenDynamic, priority: 1 },
  { name: 'Seed', fn: scrapeSeedDynamic, priority: 1 },

  // Priority 1 (⭐⭐⭐) - Cloud/HTML-based
  { name: 'AWS Bedrock', fn: scrapeAWSBedrockDynamic, priority: 1 },
  { name: 'Vertex AI', fn: scrapeVertexAIDynamic, priority: 1 },
  { name: 'Azure OpenAI', fn: scrapeAzureOpenAIDynamic, priority: 1 },

  // Priority 2 (⭐⭐) - Medium priority
  { name: 'Hunyuan', fn: scrapeHunyuanDynamic, priority: 2 },
  { name: 'Baidu', fn: scrapeBaiduDynamic, priority: 2 },
  { name: 'Fireworks AI', fn: scrapeFireworksDynamic, priority: 2 },
  { name: 'Replicate', fn: scrapeReplicateDynamic, priority: 2 },
  { name: 'Anyscale', fn: scrapeAnyscaleDynamic, priority: 2 },
  { name: 'StepFun', fn: scrapeStepFunDynamic, priority: 2 },
  { name: 'DMXAPI', fn: scrapeDMXAPIDynamic, priority: 2 },
];

// Provider IDs (synced with database - needs to be updated if providers are reset)
const PROVIDER_IDS: Record<string, number> = {
  'OPENAI': 33,
  'ANTHROPIC': 34,
  'DEEPSEEK': 36,
  'GOOGLE': 35,
  'META': 55,
  'MISTRAL': 38,
  'ALIBABA': 46,
  'BYTEDANCE': 47,
  'MOONSHOT_CHINA': 39,
  'ZHIPU_CHINA': 43,
  'MINIMAX_CHINA': 41,
  'STEPFUN': 45,
  'SEED': 47,
  'HUNYUAN': 48,
  'BAIDU': 49,
  'XAI': 37,
  'ZHIPU_GLOBAL': 44,
  'MOONSHOT_GLOBAL': 40,
  'MINIMAX_GLOBAL': 42,
  'COHERE': 0,
  'NVIDIA': 0,
  'MICROSOFT': 0,
  'AMAZON': 50,
  'AWS_BEDROCK': 50,
  'GOOGLE_VERTEX': 51,
  'AZURE_OPENAI': 52,
  'TOGETHER_AI': 53,
  'SILICONFLOW': 54,
  'OPENROUTER': 56,
  'FIREWORKS': 55,
  'REPLICATE': 56,
  'ANYSCALE': 57,
  'DMXAPI': 58,
};

async function processAPIScraper(result: ScraperResult, channelName: string) {
  console.log(`\n🔄 Processing ${result.source} API results...`);

  if (!result.success) {
    console.error(`❌ ${result.source} failed:`, result.errors);
    return { updated: 0, errors: result.errors?.length || 0 };
  }

  // Get the channel's provider ID from the mapping
  const channelProviderKey = getChannelProviderKey(result.source);
  const channelProviderId = PROVIDER_IDS[channelProviderKey];

  if (!channelProviderId) {
    console.error(`❌ No provider ID found for channel: ${result.source}`);
    return { updated: 0, errors: 1 };
  }

  // Infer currency based on channel region
  const currency = inferRegion(result.source) === 'china' ? 'CNY' : 'USD';

  let updatedCount = 0;
  let errorCount = 0;

  for (const price of result.prices) {
    try {
      // Infer provider from model name AND channel name
      const providerId = inferProviderId(price.modelName, channelName);

      // Normalize model name for consistent product identification
      const normalizedName = normalizeModelName(price.modelName);
      const normalizedSlug = normalizeSlug(price.modelName);

      // Official provider ID list - only these can create products
      const OFFICIAL_PROVIDER_IDS = [33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50];

      // If not an official provider, try to find existing official product
      let product;
      if (providerId === -1 || !OFFICIAL_PROVIDER_IDS.includes(providerId)) {
        const { data: existingProduct } = await supabaseAdmin
          .from('models')
          .select('*')
          .eq('slug', normalizedSlug)
          .single();

        if (existingProduct) {
          product = existingProduct;
        } else {
          console.log(`⚠️ Skipping ${normalizedName} - unknown provider`);
          continue;
        }
      } else {
        // Official provider - get or create product
        product = await getOrCreateProduct({
          name: normalizedName,
          slug: normalizedSlug,
          provider_id: providerId,
          type: 'llm',
          context_window: price.contextWindow,
        });
      }

      // Get existing price for comparison
      const { data: existingPrice } = await supabaseAdmin
        .from('api_channel_prices')
        .select('*')
        .eq('model_id', product.id)
        .eq('provider_id', channelProviderId)
        .single();

      // Use currency from scraper if specified, otherwise infer from channel region
      const priceCurrency = price.currency || currency;

      // Upsert channel price - using channel's provider_id
      const newPrice = await upsertChannelPrice({
        model_id: product.id,
        provider_id: channelProviderId, // Channel is now a provider
        input_price_per_1m: price.inputPricePer1M,
        output_price_per_1m: price.outputPricePer1M,
        cached_input_price_per_1m: price.cachedInputPricePer1M,
        rate_limit: price.rateLimit,
        is_available: price.isAvailable,
        last_verified: new Date(),
      });

      // Log price change if significant
      if (existingPrice) {
        const changePercent = calculateChangePercent(
          existingPrice.input_price_per_1m,
          price.inputPricePer1M
        );

        if (isSignificantChange(changePercent)) {
          await logPriceChange({
            channel_price_id: newPrice.id,
            old_input_price: existingPrice.input_price_per_1m,
            new_input_price: price.inputPricePer1M,
            old_output_price: existingPrice.output_price_per_1m,
            new_output_price: price.outputPricePer1M,
            change_percent: changePercent,
          });

          console.log(`  💰 Price change detected for ${price.modelName}: ${changePercent.toFixed(1)}%`);
        }
      }

      updatedCount++;
    } catch (error) {
      console.error(`  ❌ Error processing ${price.modelName}:`, error);
      errorCount++;
    }
  }

  console.log(`✅ ${result.source} API: Updated ${updatedCount} prices, ${errorCount} errors`);
  return { updated: updatedCount, errors: errorCount };
}

// Map scraper source names to provider keys
function getChannelProviderKey(source: string): string {
  const mapping: Record<string, string> = {
    'OpenRouter': 'OPENROUTER',
    'OpenAI': 'OPENAI',
    'OpenAI-API': 'OPENAI',
    'Anthropic': 'ANTHROPIC',
    'Anthropic-API': 'ANTHROPIC',
    'DeepSeek': 'DEEPSEEK',
    'DeepSeek-API': 'DEEPSEEK',
    'Google Gemini': 'GOOGLE',
    'Google-Gemini-API': 'GOOGLE',
    'Together AI': 'TOGETHER_AI',
    'Together-AI': 'TOGETHER_AI',
    'SiliconFlow': 'SILICONFLOW',
    'Mistral AI': 'MISTRAL',
    'Mistral-AI': 'MISTRAL',
    'Qwen': 'ALIBABA',
    'Seed': 'BYTEDANCE',
    'AWS Bedrock': 'AWS_BEDROCK',
    'AWS-Bedrock': 'AWS_BEDROCK',
    'Vertex AI': 'GOOGLE_VERTEX',
    'Vertex-AI': 'GOOGLE_VERTEX',
    'Azure OpenAI': 'AZURE_OPENAI',
    'Azure-OpenAI': 'AZURE_OPENAI',
    'Hunyuan': 'HUNYUAN',
    'Baidu': 'BAIDU',
    'Fireworks AI': 'FIREWORKS',
    'Fireworks-AI': 'FIREWORKS',
    'Replicate': 'REPLICATE',
    'Anyscale': 'ANYSCALE',
    'StepFun': 'STEPFUN',
    'DMXAPI': 'DMXAPI',
    'Grok': 'XAI',
    'Grok-API': 'XAI',
    'Moonshot': 'MOONSHOT_CHINA',
    'Minimax': 'MINIMAX_CHINA',
    'Zhipu-AI': 'ZHIPU_CHINA',
  };
  return mapping[source] || '';
}

function inferProviderId(modelName: string, channelName?: string): number {
  const name = modelName.toLowerCase();
  const channel = channelName?.toLowerCase() || '';

  // OpenAI models
  if (name.includes('gpt') || name.includes('openai') || name.startsWith('o1') || name.startsWith('o3') || name.startsWith('o4')) {
    return PROVIDER_IDS['OPENAI'];
  }

  // Anthropic models
  if (name.includes('claude') || name.includes('anthropic')) return PROVIDER_IDS['ANTHROPIC'];

  // DeepSeek models
  if (name.includes('deepseek')) return PROVIDER_IDS['DEEPSEEK'];

  // Google models
  if (name.includes('gemini') || name.includes('palm') || name.includes('gemma')) return PROVIDER_IDS['GOOGLE'];

  // Meta models
  if (name.includes('llama') || name.includes('meta') || name.includes('llamaguard')) return PROVIDER_IDS['META'];

  // Mistral models
  if (name.includes('mistral') || name.includes('mixtral') || name.includes('codestral')) return PROVIDER_IDS['MISTRAL'];

  // Alibaba Qwen models
  if (name.includes('qwen') || name.includes('tongyi') || name.includes('qwq')) return PROVIDER_IDS['ALIBABA'];

  // xAI Grok models
  if (name.includes('grok')) return PROVIDER_IDS['XAI'];

  // 月之暗面
  if (name.includes('moonshot') || name.includes('kimi')) {
    if (channel.includes('global') || channel.includes('国际版')) {
      return PROVIDER_IDS['MOONSHOT_GLOBAL'];
    }
    return PROVIDER_IDS['MOONSHOT_CHINA'];
  }

  // 智谱AI
  if (name.includes('glm') || name.includes('chatglm')) {
    if (channel.includes('global') || channel.includes('国际版')) {
      return PROVIDER_IDS['ZHIPU_GLOBAL'];
    }
    return PROVIDER_IDS['ZHIPU_CHINA'];
  }

  // Minimax
  if (name.includes('minimax')) {
    if (channel.includes('global') || channel.includes('国际版')) {
      return PROVIDER_IDS['MINIMAX_GLOBAL'];
    }
    return PROVIDER_IDS['MINIMAX_CHINA'];
  }

  if (name.includes('seed') && name.includes('bytedance') === false) return PROVIDER_IDS['SEED'];
  if (name.includes('bytedance') || name.includes('doubao')) return PROVIDER_IDS['BYTEDANCE'];
  if (name.includes('step') || name.includes('stepfun')) return PROVIDER_IDS['STEPFUN'];
  if (name.includes('hunyuan') || name.includes('tencent')) return PROVIDER_IDS['HUNYUAN'];
  if (name.includes('ernie') || name.includes('baidu')) return PROVIDER_IDS['BAIDU'];

  return -1;
}

function inferChannelType(source: string): string {
  const aggregators = ['openrouter', 'together', 'siliconflow', 'fireworks', 'replicate', 'anyscale', 'dmxapi'];
  const cloud = ['aws', 'bedrock', 'vertex', 'azure', 'aliyun', 'bailian', 'volcengine', 'qianfan'];
  const official = ['openai-api', 'anthropic-api', 'deepseek-api'];
  const china = ['moonshot', 'minimax', 'zhipu', 'stepfun', 'qwen', 'seed', 'hunyuan', 'baidu'];

  const slug = source.toLowerCase();

  if (aggregators.some(agg => slug.includes(agg))) return 'aggregator';
  if (cloud.some(c => slug.includes(c))) return 'cloud';
  if (china.some(ch => slug.includes(ch))) return 'official';
  if (official.some(off => slug.includes(off))) return 'official';

  return 'aggregator';
}

function inferRegion(source: string): string {
  const chinaChannels = ['moonshot', 'minimax', 'zhipu', 'stepfun', 'qwen', 'seed', 'hunyuan', 'baidu', 'aliyun', 'bailian', 'volcengine', 'qianfan', 'siliconflow', 'dmxapi'];
  const globalChannels = ['global', '国际版'];
  const slug = source.toLowerCase();

  if (globalChannels.some(ch => slug.includes(ch))) return 'global';
  if (chinaChannels.some(ch => slug.includes(ch))) return 'china';

  return 'global';
}

function isAccessibleFromChina(source: string): boolean {
  const accessibleChannels = ['siliconflow', 'dmxapi', 'deepseek', 'moonshot', 'minimax', 'zhipu', 'stepfun', 'qwen', 'seed', 'hunyuan', 'baidu', 'aliyun', 'bailian', 'volcengine', 'qianfan'];
  const slug = source.toLowerCase();

  if (slug.includes('global') || slug.includes('国际版')) {
    return false;
  }

  return accessibleChannels.some(ch => slug.includes(ch));
}

function getChannelWebsite(source: string): string {
  const websites: Record<string, string> = {
    'OpenRouter': 'https://openrouter.ai',
    'SiliconFlow': 'https://siliconflow.cn',
    'Together-AI': 'https://together.ai',
    'Fireworks-AI': 'https://fireworks.ai',
    'Replicate': 'https://replicate.com',
    'Anyscale': 'https://anyscale.com',
    'DMXAPI': 'https://www.dmxapi.cn',
    'AWS-Bedrock': 'https://aws.amazon.com/bedrock',
    'Vertex-AI': 'https://cloud.google.com/vertex-ai',
    'Azure-OpenAI': 'https://azure.microsoft.com/services/cognitive-services/openai',
    'OpenAI-API': 'https://openai.com',
    'Anthropic-API': 'https://anthropic.com',
    'DeepSeek-API': 'https://deepseek.com',
    'Google-Gemini-API': 'https://ai.google.dev',
    'Grok-API': 'https://docs.x.ai',
    'Mistral-AI': 'https://mistral.ai',
    'Moonshot': 'https://platform.moonshot.cn',
    'Minimax': 'https://platform.minimaxi.com',
    'Zhipu-AI': 'https://bigmodel.cn',
    'Qwen': 'https://bailian.console.aliyun.com',
    'Seed': 'https://www.volcengine.com',
    'Hunyuan': 'https://hunyuan.tencent.com',
    'Baidu': 'https://cloud.baidu.com',
    'StepFun': 'https://platform.stepfun.com',
  };

  for (const [key, url] of Object.entries(websites)) {
    if (source.toLowerCase().includes(key.toLowerCase())) {
      return url;
    }
  }

  return '';
}

async function main() {
  console.log('🚀 Starting pricing data scraper (Dynamic Mode)...\n');
  const startTime = Date.now();

  // Run API scrapers by priority order
  const priority1Scrapers = API_SCRAPERS.filter(s => s.priority === 1);
  const priority2Scrapers = API_SCRAPERS.filter(s => s.priority === 2);

  console.log(`\n🔄 Running ${priority1Scrapers.length} priority 1 scrapers...`);

  const apiResults = await Promise.allSettled(
    priority1Scrapers.map(async ({ fn, name }) => {
      const result = await fn();
      return processAPIScraper(result, name);
    })
  );

  let totalUpdated = 0;
  let totalErrors = 0;

  // Process priority 1 results
  apiResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      totalUpdated += result.value.updated;
      totalErrors += result.value.errors;
    } else {
      console.error(`❌ Scraper ${priority1Scrapers[index].name} crashed:`, result.reason);
      totalErrors++;
    }
  });

  // Run priority 2 scrapers
  if (priority2Scrapers.length > 0) {
    console.log(`\n🔄 Running ${priority2Scrapers.length} priority 2 scrapers...`);

    const priority2Results = await Promise.allSettled(
      priority2Scrapers.map(async ({ fn, name }) => {
        const result = await fn();
        return processAPIScraper(result, name);
      })
    );

    priority2Results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        totalUpdated += result.value.updated;
        totalErrors += result.value.errors;
      } else {
        console.error(`❌ Scraper ${priority2Scrapers[index].name} crashed:`, result.reason);
        totalErrors++;
      }
    });
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  // Log overall result
  await logScrapeResult({
    source: 'all-dynamic',
    status: totalErrors === 0 ? 'success' : totalErrors < API_SCRAPERS.length ? 'partial' : 'failed',
    models_found: totalUpdated,
    prices_updated: totalUpdated,
    errors: totalErrors > 0 ? `${totalErrors} errors encountered` : undefined,
    started_at: new Date(startTime),
    completed_at: new Date(),
  });

  console.log(`\n✅ Scraping completed in ${duration}s`);
  console.log(`   - Total items updated: ${totalUpdated}`);
  console.log(`   - Total errors: ${totalErrors}`);
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { main as runScraper };
