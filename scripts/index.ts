#!/usr/bin/env tsx

import { scrapeOpenRouter } from './scrapers/openrouter';
import { scrapeOpenAIAPI } from './scrapers/api-openai';
import { scrapeOpenAIPlan } from './scrapers/plan-openai';
import { scrapeAnthropicAPI } from './scrapers/api-anthropic';
import { scrapeAnthropicPlan } from './scrapers/plan-anthropic';
import { scrapeDeepSeekAPI } from './scrapers/api-deepseek';
import { scrapeTogetherAI } from './scrapers/api-together-ai';
import { scrapeSiliconFlow } from './scrapers/api-siliconflow';
import { scrapeGoogleGeminiAPI } from './scrapers/api-google-gemini';
import { scrapeGoogleGeminiPlan } from './scrapers/plan-google-gemini';
import { scrapeGrokAPI } from './scrapers/api-grok';
import { scrapeMistralAPI } from './scrapers/api-mistral';
import { scrapeArenaLeaderboard } from './scrapers/benchmark-arena';

import {
  upsertChannelPrice,
  upsertPlan,
  logPriceChange,
  logScrapeResult,
  getOrCreateProduct,
  getOrCreateChannel,
  getOrCreateProvider,
  supabaseAdmin
} from './db/queries';
import { calculateChangePercent, isSignificantChange } from './utils/validator';
import type { ScraperResult } from './utils/validator';
import type { PlanScraperResult } from './utils/plan-validator';

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
  MOONSHOT: 9,
  ZHIPU: 10,
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

  let updatedCount = 0;
  let errorCount = 0;

  for (const price of result.prices) {
    try {
      // Infer provider from model name
      const providerId = inferProviderId(price.modelName);

      // Get or create product
      const product = await getOrCreateProduct({
        name: price.modelName,
        slug: price.modelSlug,
        provider_id: providerId,
        type: 'llm',
        context_window: price.contextWindow,
      });

      // Get existing price for comparison
      const { data: existingPrice } = await supabaseAdmin
        .from('channel_prices')
        .select('*')
        .eq('product_id', product.id)
        .eq('channel_id', channel.id)
        .single();

      // Upsert channel price
      const newPrice = await upsertChannelPrice({
        product_id: product.id,
        channel_id: channel.id,
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

function inferProviderId(modelName: string): number {
  const name = modelName.toLowerCase();

  if (name.includes('gpt') || name.includes('openai')) return PROVIDER_IDS.OPENAI;
  if (name.includes('claude') || name.includes('anthropic')) return PROVIDER_IDS.ANTHROPIC;
  if (name.includes('deepseek')) return PROVIDER_IDS.DEEPSEEK;
  if (name.includes('gemini') || name.includes('palm')) return PROVIDER_IDS.GOOGLE;
  if (name.includes('llama') || name.includes('meta')) return PROVIDER_IDS.META;
  if (name.includes('mistral')) return PROVIDER_IDS.MISTRAL;
  if (name.includes('qwen') || name.includes('tongyi')) return PROVIDER_IDS.ALIBABA;
  if (name.includes('moonshot') || name.includes('kimi')) return PROVIDER_IDS.MOONSHOT;
  if (name.includes('glm') || name.includes('chatglm')) return PROVIDER_IDS.ZHIPU;

  // Default to OpenAI if unknown
  return PROVIDER_IDS.OPENAI;
}

function inferProviderIdFromName(providerName: string): number {
  const name = providerName.toLowerCase();

  if (name.includes('openai')) return PROVIDER_IDS.OPENAI;
  if (name.includes('anthropic')) return PROVIDER_IDS.ANTHROPIC;
  if (name.includes('deepseek')) return PROVIDER_IDS.DEEPSEEK;
  if (name.includes('google')) return PROVIDER_IDS.GOOGLE;
  if (name.includes('meta')) return PROVIDER_IDS.META;
  if (name.includes('mistral')) return PROVIDER_IDS.MISTRAL;

  return PROVIDER_IDS.OPENAI;
}

function inferChannelType(source: string): string {
  const aggregators = ['openrouter', 'together', 'siliconflow', 'fireworks'];
  const official = ['openai-api', 'anthropic-api', 'deepseek-api'];

  const slug = source.toLowerCase();

  if (aggregators.some(agg => slug.includes(agg))) return 'aggregator';
  if (official.some(off => slug.includes(off))) return 'official';

  return 'aggregator';
}

function inferRegion(source: string): string {
  const chinaChannels = ['siliconflow', 'bailian', 'huoshan'];
  const slug = source.toLowerCase();

  if (chinaChannels.some(ch => slug.includes(ch))) return 'china';

  return 'global';
}

function isAccessibleFromChina(source: string): boolean {
  const accessibleChannels = ['siliconflow', 'deepseek', 'bailian', 'huoshan'];
  const slug = source.toLowerCase();

  return accessibleChannels.some(ch => slug.includes(ch));
}

function getChannelWebsite(source: string): string {
  const websites: Record<string, string> = {
    'OpenRouter': 'https://openrouter.ai',
    'SiliconFlow': 'https://siliconflow.cn',
    'Together-AI': 'https://together.ai',
    'Fireworks': 'https://fireworks.ai',
    'OpenAI-API': 'https://openai.com',
    'Anthropic-API': 'https://anthropic.com',
    'DeepSeek-API': 'https://deepseek.com',
  };
  return websites[source] || '';
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
    { fn: scrapeOpenRouter, name: 'OpenRouter' },
    { fn: scrapeOpenAIAPI, name: 'OpenAI' },
    { fn: scrapeAnthropicAPI, name: 'Anthropic' },
    { fn: scrapeDeepSeekAPI, name: 'DeepSeek' },
    { fn: scrapeTogetherAI, name: 'Together AI' },
    { fn: scrapeSiliconFlow, name: 'SiliconFlow' },
    { fn: scrapeGoogleGeminiAPI, name: 'Google Gemini' },
    { fn: scrapeGrokAPI, name: 'Grok/X.AI' },
    { fn: scrapeMistralAPI, name: 'Mistral AI' },
  ];

  // Plan Scrapers
  const planScrapers = [
    { fn: scrapeOpenAIPlan, name: 'OpenAI' },
    { fn: scrapeAnthropicPlan, name: 'Anthropic' },
    { fn: scrapeGoogleGeminiPlan, name: 'Google' },
  ];

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
