#!/usr/bin/env tsx

/**
 * ⚠️ DEPRECATED - DO NOT USE
 *
 * This scraper uses the old schema with `channels` table which no longer exists.
 * Use `tsx scripts/index-dynamic.ts` instead.
 *
 * The new schema uses `providers` table with `type` field to distinguish
 * between official providers, cloud providers, aggregators, and resellers.
 * All pricing data is stored in `api_channel_prices` with `provider_id` (not `channel_id`).
 */

import { scrapeOpenRouter } from './scrapers/openrouter';
import { scrapeOpenAIDynamic } from './scrapers/openai-dynamic';
import { scrapeAnthropicDynamic } from './scrapers/anthropic-dynamic';
import { scrapeDeepSeekDynamic } from './scrapers/deepseek-dynamic';
import { scrapeTogetherAIDynamic } from './scrapers/together-ai-dynamic';
import { scrapeSiliconFlowDynamic } from './scrapers/siliconflow-dynamic';
import { scrapeGoogleDynamic } from './scrapers/google-gemini-dynamic';
import { scrapeGrokDynamic } from './scrapers/grok-dynamic';
import { scrapeMistralDynamic } from './scrapers/mistral-dynamic';
import { scrapeArenaLeaderboard } from './scrapers/benchmark-arena';
import { scrapeMoonshotDynamic } from './scrapers/moonshot-dynamic';
import { scrapeMinimaxDynamic } from './scrapers/minimax-dynamic';
import { scrapeZhipuDynamic } from './scrapers/zhipu-dynamic';
import { scrapeStepFunDynamic } from './scrapers/stepfun-dynamic';
import { scrapeQwenDynamic } from './scrapers/qwen-dynamic';
import { scrapeSeedDynamic } from './scrapers/seed-dynamic';
import { scrapeHunyuanDynamic } from './scrapers/hunyuan-dynamic';
import { scrapeBaiduDynamic } from './scrapers/baidu-dynamic';
import { scrapeFireworksDynamic } from './scrapers/fireworks-dynamic';
import { scrapeReplicateDynamic } from './scrapers/replicate-dynamic';
import { scrapeAnyscaleDynamic } from './scrapers/anyscale-dynamic';
import { scrapeAWSBedrockDynamic } from './scrapers/aws-bedrock-dynamic';
import { scrapeAzureOpenAIDynamic } from './scrapers/azure-openai-dynamic';
import { scrapeVertexAIDynamic } from './scrapers/vertex-ai-dynamic';
import { scrapeDMXAPIDynamic } from './scrapers/dmxapi-dynamic';

import {
  upsertChannelPrice,
  upsertPlan,
  logPriceChange,
  logScrapeResult,
  getOrCreateModel,
  getOrCreateChannel,
  getOrCreateProvider,
  supabaseAdmin
} from './db/queries';
import { calculateChangePercent, isSignificantChange } from './utils/validator';
import type { ScraperResult } from './utils/validator';
import type { PlanScraperResult } from './utils/plan-validator';
import { normalizeModelName, normalizeSlug } from './utils/model-normalizer';

// Provider IDs (需要在数据库中先创建这些供应商)
const PROVIDER_IDS = {
  OPENAI: 1,
  ANTHROPIC: 2,
  DEEPSEEK: 3,
  GOOGLE: 4,
  META: 5,
  MISTRAL: 6,
  ALIBABA: 7,
  BYTEDANCE: 8,
  MOONSHOT_CHINA: 9,     // 月之暗面 国内版
  ZHIPU_CHINA: 10,       // 智谱AI 国内版
  MINIMAX_CHINA: 13,     // Minimax 国内版
  STEPFUN: 14,
  SEED: 15,
  HUNYUAN: 16,
  BAIDU: 17,
  // New providers
  XAI: 18,               // xAI (Grok)
  ZHIPU_GLOBAL: 19,      // 智谱AI 国际版 (z.ai)
  MOONSHOT_GLOBAL: 20,   // 月之暗面 国际版
  MINIMAX_GLOBAL: 21,   // Minimax 国际版
  COHERE: 22,           // Cohere
  NVIDIA: 23,            // Nvidia
  MICROSOFT: 24,        // Microsoft
  AMAZON: 25,           // Amazon
  // Cloud providers
  AWS_BEDROCK: 31,
  GOOGLE_VERTEX: 32,
  AZURE_OPENAI: 33,
  ALIYUN_BAILIAN: 34,
  VOLCENGINE: 35,
  BAIDU_QIANFAN: 36,
  // Aggregators
  FIREWORKS: 37,
  REPLICATE: 38,
  ANYSCALE: 39,
  TOGETHER_AI: 40,
  SILICONFLOW: 41,
  OPENROUTER: 42,
  // Reseller
  DMXAPI: 43,
};

async function processAPIScraper(result: ScraperResult, channelName: string) {
  console.log(`\n🔄 Processing ${result.source} API results...`);

  if (!result.success) {
    console.error(`❌ ${result.source} failed:`, result.errors);
    return { updated: 0, errors: result.errors?.length || 0 };
  }

  // Get or create channel
  const channel = await getOrCreateChannel({
    name: channelName,
    slug: result.source.toLowerCase().replace(/\s+/g, '-'),
    type: inferChannelType(result.source),
    website_url: getChannelWebsite(result.source),
    region: inferRegion(result.source),
    access_from_china: isAccessibleFromChina(result.source),
  });

  // Infer currency based on channel region
  const currency = channel.region === 'china' ? 'CNY' : 'USD';

  let updatedCount = 0;
  let errorCount = 0;

  for (const price of result.prices) {
    try {
      // Infer provider from model name AND channel name (to distinguish China vs Global)
      const providerId = inferProviderId(price.modelName, channelName);

      // Normalize the model name for consistent model identification
      const normalizedName = normalizeModelName(price.modelName);
      const normalizedSlug = normalizeSlug(price.modelName);

      // 官方提供商 ID 列表 - 只有这些才能创建模型
      // Official model providers (1-25)
      const OFFICIAL_PROVIDER_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];

      // 如果不是官方提供商，尝试找到已有的官方模型
      let model;
      // Unknown provider (returned -1)
      if (providerId === -1) {
        // 查找已有的官方模型
        const { data: existingModel } = await supabaseAdmin
          .from('models')
          .select('*')
          .eq('slug', normalizedSlug)
          .single();

        if (existingModel) {
          model = existingModel;
        } else {
          // 如果没有官方模型，跳过这个价格
          console.log(`⚠️ Skipping ${normalizedName} - unknown provider`);
          continue;
        }
      } else if (!OFFICIAL_PROVIDER_IDS.includes(providerId)) {
        // 查找已有的官方模型
        const { data: existingModel } = await supabaseAdmin
          .from('models')
          .select('*')
          .eq('slug', normalizedSlug)
          .single();

        if (existingModel) {
          model = existingModel;
        } else {
          // 如果没有官方模型，跳过这个价格
          console.log(`⚠️ Skipping ${normalizedName} - no official model found`);
          continue;
        }
      } else {
        // 官方提供商 - 正常获取或创建模型
        model = await getOrCreateModel({
          name: normalizedName,
          slug: normalizedSlug,
          provider_ids: [providerId],
          type: 'llm',
          context_window: price.contextWindow,
        });
      }

      // Get existing price for comparison (using api_channel_prices table)
      const { data: existingPrice } = await supabaseAdmin
        .from('api_channel_prices')
        .select('*')
        .eq('model_id', model.id)
        .eq('channel_id', channel.id)
        .single();

      // Use currency from scraper if specified, otherwise infer from channel region
      const priceCurrency = price.currency || currency;

      // Upsert channel price (using api_channel_prices table)
      const newPrice = await upsertChannelPrice({
        model_id: model.id,
        channel_id: channel.id,
        input_price_per_1m: price.inputPricePer1M,
        output_price_per_1m: price.outputPricePer1M,
        cached_input_price_per_1m: price.cachedInputPricePer1M,
        rate_limit: price.rateLimit,
        is_available: price.isAvailable,
        last_verified: new Date(),
        currency: priceCurrency,
        price_unit: 'per_1m_tokens',
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

async function processPlanScraper(result: PlanScraperResult, providerName: string) {
  console.log(`\n🔄 Processing ${result.source} Plan results...`);

  if (!result.success) {
    console.error(`❌ ${result.source} failed:`, result.errors);
    return { updated: 0, errors: result.errors?.length || 0 };
  }

  // Get or create provider
  const providerId = inferProviderIdFromName(providerName);

  let updatedCount = 0;
  let errorCount = 0;

  for (const plan of result.plans) {
    try {
      // Infer price unit based on pricing model
      let priceUnit = 'per_month';
      if (plan.pricingModel === 'subscription') {
        priceUnit = plan.priceYearly ? 'per_year' : 'per_month';
      } else if (plan.pricingModel === 'token_pack') {
        priceUnit = 'per_pack';
      } else if (plan.pricingModel === 'pay_as_you_go') {
        priceUnit = 'per_1m_tokens';
      }

      // Use currency from plan if specified, otherwise infer from region
      const planCurrency = plan.currency || (plan.region === 'china' ? 'CNY' : 'USD');

      await upsertPlan({
        provider_id: providerId,
        name: plan.planName,
        slug: plan.planSlug,
        pricing_model: plan.pricingModel,
        tier: plan.tier,
        price_monthly: plan.priceMonthly,
        price_yearly: plan.priceYearly,
        daily_message_limit: plan.dailyMessageLimit,
        requests_per_minute: plan.requestsPerMinute,
        features: plan.features,
        region: plan.region,
        access_from_china: plan.accessFromChina,
        payment_methods: plan.paymentMethods,
        is_official: plan.isOfficial,
        last_verified: new Date(),
        currency: planCurrency,
        price_unit: priceUnit,
      });

      updatedCount++;
    } catch (error) {
      console.error(`  ❌ Error processing ${plan.planName}:`, error);
      errorCount++;
    }
  }

  console.log(`✅ ${result.source} Plan: Updated ${updatedCount} plans, ${errorCount} errors`);
  return { updated: updatedCount, errors: errorCount };
}

function inferProviderId(modelName: string, channelName?: string): number {
  const name = modelName.toLowerCase();
  const channel = channelName?.toLowerCase() || '';

  // For third-party channels (AWS Bedrock, Vertex AI, Azure, Fireworks, Replicate, etc.),
  // the model provider should still be the ORIGINAL model provider (OpenAI, Anthropic, Meta, etc.)
  // NOT the channel provider. The channel is stored separately in api_channel_prices.

  // OpenAI models
  if (name.includes('gpt') || name.includes('openai') || name.startsWith('o1') || name.startsWith('o3') || name.startsWith('o4')) {
    return PROVIDER_IDS.OPENAI;
  }

  // Anthropic models
  if (name.includes('claude') || name.includes('anthropic')) return PROVIDER_IDS.ANTHROPIC;

  // DeepSeek models
  if (name.includes('deepseek')) return PROVIDER_IDS.DEEPSEEK;

  // Google models
  if (name.includes('gemini') || name.includes('palm') || name.includes('gemma')) return PROVIDER_IDS.GOOGLE;

  // Meta models
  if (name.includes('llama') || name.includes('meta') || name.includes('llamaguard')) return PROVIDER_IDS.META;

  // Mistral models
  if (name.includes('mistral') || name.includes('mixtral') || name.includes('codestral')) return PROVIDER_IDS.MISTRAL;

  // Alibaba Qwen models
  if (name.includes('qwen') || name.includes('tongyi') || name.includes('qwq')) return PROVIDER_IDS.ALIBABA;

  // xAI Grok models
  if (name.includes('grok')) return 18; // xAI

  // 月之暗面：优先根据渠道名称区分国内版和国际版
  if (name.includes('moonshot') || name.includes('kimi')) {
    if (channel.includes('global') || channel.includes('国际版')) {
      return PROVIDER_IDS.MOONSHOT_GLOBAL;
    }
    return PROVIDER_IDS.MOONSHOT_CHINA;
  }

  // 智谱AI：优先根据渠道名称区分国内版和国际版
  if (name.includes('glm') || name.includes('chatglm')) {
    if (channel.includes('global') || channel.includes('国际版')) {
      return PROVIDER_IDS.ZHIPU_GLOBAL;
    }
    return PROVIDER_IDS.ZHIPU_CHINA;
  }

  // Minimax：优先根据渠道名称区分国内版和国际版
  if (name.includes('minimax')) {
    if (channel.includes('global') || channel.includes('国际版')) {
      return PROVIDER_IDS.MINIMAX_GLOBAL;
    }
    return PROVIDER_IDS.MINIMAX_CHINA;
  }

  // Check 'seed' first to avoid matching 'bytedance'
  if (name.includes('seed') && name.includes('bytedance') === false) return PROVIDER_IDS.SEED;
  if (name.includes('bytedance') || name.includes('doubao')) return PROVIDER_IDS.BYTEDANCE;
  if (name.includes('step') || name.includes('stepfun')) return PROVIDER_IDS.STEPFUN;
  if (name.includes('hunyuan') || name.includes('tencent')) return PROVIDER_IDS.HUNYUAN;
  if (name.includes('ernie') || name.includes('baidu')) return PROVIDER_IDS.BAIDU;

  // Cohere models
  if (name.includes('command') || name.includes('cohere')) return 19; // Cohere

  // Nvidia models
  if (name.includes('nemotron')) return 20; // Nvidia

  // Microsoft models
  if (name.includes('phi-')) return 21; // Microsoft

  // Amazon models
  if (name.includes('amazon') || name.includes('titan')) return 22; // Amazon

  // Return -1 for unknown providers - these models should not be created
  return -1;
}

function inferProviderIdFromName(providerName: string): number {
  const name = providerName.toLowerCase();

  if (name.includes('openai')) return PROVIDER_IDS.OPENAI;
  if (name.includes('anthropic')) return PROVIDER_IDS.ANTHROPIC;
  if (name.includes('deepseek')) return PROVIDER_IDS.DEEPSEEK;
  if (name.includes('google')) return PROVIDER_IDS.GOOGLE;
  if (name.includes('meta')) return PROVIDER_IDS.META;
  if (name.includes('mistral')) return PROVIDER_IDS.MISTRAL;
  if (name.includes('alibaba') || name.includes('qwen') || name.includes('tongyi')) return PROVIDER_IDS.ALIBABA;
  if (name.includes('bytedance') || name.includes('seed')) return PROVIDER_IDS.BYTEDANCE;

  // 月之暗面
  if (name.includes('moonshot') || name.includes('kimi')) {
    if (name.includes('global') || name.includes('国际版')) {
      return PROVIDER_IDS.MOONSHOT_GLOBAL;
    }
    return PROVIDER_IDS.MOONSHOT_CHINA;
  }

  // 智谱AI
  if (name.includes('zhipu') || name.includes('glm')) {
    if (name.includes('global') || name.includes('国际版')) {
      return PROVIDER_IDS.ZHIPU_GLOBAL;
    }
    return PROVIDER_IDS.ZHIPU_CHINA;
  }

  // Minimax
  if (name.includes('minimax')) {
    if (name.includes('global') || name.includes('国际版')) {
      return PROVIDER_IDS.MINIMAX_GLOBAL;
    }
    return PROVIDER_IDS.MINIMAX_CHINA;
  }

  if (name.includes('step') || name.includes('stepfun')) return PROVIDER_IDS.STEPFUN;
  if (name.includes('hunyuan') || name.includes('tencent')) return PROVIDER_IDS.HUNYUAN;
  if (name.includes('baidu') || name.includes('ernie')) return PROVIDER_IDS.BAIDU;

  // Default to OpenAI if unknown
  return PROVIDER_IDS.OPENAI;
}

function inferChannelType(source: string): string {
  const aggregators = ['openrouter', 'together', 'siliconflow', 'fireworks', 'replicate', 'anyscale'];
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
  const chinaChannels = ['moonshot', 'minimax', 'zhipu', 'stepfun', 'qwen', 'seed', 'hunyuan', 'baidu', 'aliyun', 'bailian', 'volcengine', 'qianfan'];
  const globalChannels = ['global', '国际版'];
  const slug = source.toLowerCase();

  if (globalChannels.some(ch => slug.includes(ch))) return 'global';
  if (chinaChannels.some(ch => slug.includes(ch))) return 'china';

  return 'global';
}

function isAccessibleFromChina(source: string): boolean {
  const accessibleChannels = ['siliconflow', 'deepseek', 'moonshot', 'minimax', 'zhipu', 'stepfun', 'qwen', 'seed', 'hunyuan', 'baidu', 'aliyun', 'bailian', 'volcengine', 'qianfan'];
  const slug = source.toLowerCase();

  // Global versions may not be accessible from China
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
    'Fireworks': 'https://fireworks.ai',
    'Replicate': 'https://replicate.com',
    'Anyscale': 'https://anyscale.com',
    'AWS-Bedrock': 'https://aws.amazon.com/bedrock',
    'Vertex-AI': 'https://cloud.google.com/vertex-ai',
    'Azure-OpenAI': 'https://azure.microsoft.com/services/cognitive-services/openai',
    'Aliyun-Bailian': 'https://bailian.console.aliyun.com',
    'Volcengine': 'https://www.volcengine.com',
    'Baidu-Qianfan': 'https://qianfan.console.baidu.com',
    'OpenAI-API': 'https://openai.com',
    'Anthropic-API': 'https://anthropic.com',
    'DeepSeek-API': 'https://deepseek.com',
    'Google-Gemini-API': 'https://ai.google.dev',
    'Grok-API': 'https://docs.x.ai',
    'Mistral-API': 'https://mistral.ai',
    'Moonshot-China': 'https://platform.moonshot.cn',
    'Moonshot-Global': 'https://platform.moonshot.ai',
    'Minimax-China': 'https://platform.minimaxi.com',
    'Minimax-Global': 'https://platform.minimax.io',
    'Zhipu-China': 'https://bigmodel.cn',
    'Zhipu-Global': 'https://z.ai',
    'StepFun': 'https://platform.stepfun.com',
    'Qwen': 'https://bailian.console.aliyun.com',
    'Seed': 'https://www.volcengine.com',
    'Hunyuan': 'https://hunyuan.tencent.com',
    'Baidu': 'https://cloud.baidu.com',
    'DMXAPI': 'https://www.dmxapi.cn',
  };

  // Match by partial source name
  for (const [key, url] of Object.entries(websites)) {
    if (source.toLowerCase().includes(key.toLowerCase())) {
      return url;
    }
  }

  return '';
}

async function main() {
  console.log('🚀 Starting pricing data scraper...\n');
  const startTime = Date.now();

  // Benchmark Scrapers (run first to update model scores)
  console.log('📊 Running benchmark scrapers...');
  try {
    await scrapeArenaLeaderboard();
  } catch (error) {
    console.error('❌ Arena benchmark scraper failed:', error);
  }

  // API Scrapers
  const apiScrapers = [
    // Official
    { fn: scrapeOpenRouter, name: 'OpenRouter' },
    { fn: scrapeOpenAIDynamic, name: 'OpenAI' },
    { fn: scrapeAnthropicDynamic, name: 'Anthropic' },
    { fn: scrapeDeepSeekDynamic, name: 'DeepSeek' },
    { fn: scrapeGoogleDynamic, name: 'Google Gemini' },
    { fn: scrapeGrokDynamic, name: 'Grok/X.AI' },
    { fn: scrapeMistralDynamic, name: 'Mistral AI' },
    // Aggregators
    { fn: scrapeTogetherAIDynamic, name: 'Together AI' },
    { fn: scrapeSiliconFlowDynamic, name: 'SiliconFlow' },
    { fn: scrapeFireworksDynamic, name: 'Fireworks AI' },
    { fn: scrapeReplicateDynamic, name: 'Replicate' },
    { fn: scrapeAnyscaleDynamic, name: 'Anyscale' },
    // Cloud Providers
    { fn: scrapeAWSBedrockDynamic, name: 'AWS Bedrock' },
    { fn: scrapeVertexAIDynamic, name: 'Vertex AI' },
    { fn: scrapeAzureOpenAIDynamic, name: 'Azure OpenAI' },
    // China Cloud Channels (hosting models from other providers)
    { fn: scrapeBaiduDynamic, name: 'Aliyun-Bailian/Baidu' },
    { fn: scrapeSeedDynamic, name: 'Volcengine/Seed' },
    // China Official
    { fn: scrapeMoonshotDynamic, name: 'Moonshot' },
    { fn: scrapeMinimaxDynamic, name: 'Minimax' },
    { fn: scrapeZhipuDynamic, name: 'Zhipu' },
    { fn: scrapeStepFunDynamic, name: 'StepFun' },
    { fn: scrapeHunyuanDynamic, name: 'Hunyuan' },
    { fn: scrapeBaiduDynamic, name: 'Baidu' },
    { fn: scrapeQwenDynamic, name: 'Qwen' },
    // Reseller
    { fn: scrapeDMXAPIDynamic, name: 'DMXAPI' },
  ];

  // Plan Scrapers (archived - not currently in use)
  const planScrapers: Array<{ fn: () => any; name: string }> = [];

  // Run API scrapers
  const apiResults = await Promise.allSettled(
    apiScrapers.map(async ({ fn, name }) => {
      const result = await fn();
      return processAPIScraper(result, name);
    })
  );

  // Run Plan scrapers
  const planResults = await Promise.allSettled(
    planScrapers.map(async ({ fn, name }) => {
      const result = await fn();
      return processPlanScraper(result, name);
    })
  );

  let totalUpdated = 0;
  let totalErrors = 0;

  // Process API results
  apiResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      totalUpdated += result.value.updated;
      totalErrors += result.value.errors;
    } else {
      console.error(`❌ API Scraper ${apiScrapers[index].name} crashed:`, result.reason);
      totalErrors++;
    }
  });

  // Process Plan results
  planResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      totalUpdated += result.value.updated;
      totalErrors += result.value.errors;
    } else {
      console.error(`❌ Plan Scraper ${planScrapers[index].name} crashed:`, result.reason);
      totalErrors++;
    }
  });

  const duration = Math.round((Date.now() - startTime) / 1000);

  // Log overall result
  await logScrapeResult({
    source: 'all',
    status: totalErrors === 0 ? 'success' : totalErrors < apiResults.length + planResults.length ? 'partial' : 'failed',
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