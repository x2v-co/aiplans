#!/usr/bin/env tsx

import { scrapeOpenAIPlans } from './scrapers/plan-openai-dynamic';
import { scrapeAnthropicPlans } from './scrapers/plan-anthropic-dynamic';
import { scrapeGoogleGeminiPlans } from './scrapers/plan-google-gemini-dynamic';
import { scrapeMistralPlans } from './scrapers/plan-mistral-dynamic';
import { scrapeMinimaxPlans } from './scrapers/plan-minimax-dynamic';
import { scrapeMinimaxGlobalPlans } from './scrapers/plan-minimax-global-dynamic';
import { scrapeZhipuPlans } from './scrapers/plan-zhipu-dynamic';
import { scrapeZhipuGlobalPlans } from './scrapers/plan-zhipu-global-dynamic';
import { scrapeMoonshotPlans } from './scrapers/plan-moonshot-dynamic';
import { scrapeBaiduPlans } from './scrapers/plan-baidu-dynamic';
import { scrapeVolcenginePlans } from './scrapers/plan-volcengine-dynamic';
import { scrapeQwenPlans } from './scrapers/plan-qwen-dynamic';
import {
  upsertPlan,
  upsertProvider,
  getProviderBySlug,
  cleanupOutdatedPlans,
  upsertModelPlanRelation,
  deleteModelsForPlan,
} from './db/queries';
import type { PlanScraperResult, ScrapedPlan } from './utils/plan-validator';

// Type definition for provider config
interface ProviderConfig {
  name: string;
  slug: string;
  website?: string;
  pricing_url?: string;
  invite_link?: string | null;
  type: string;
  region: string;
  access_from_china: boolean;
}

// Product slugs for each provider (from API scrapers)
// These are the models/products available in subscription plans
const PRODUCT_SLUGS: Record<string, Record<string, string[]>> = {
  openai: {
    'chatgpt-free': ['gpt-4o-mini'],
    'chatgpt-plus': ['gpt-4o', 'gpt-4o-mini'],
    'chatgpt-team': ['gpt-4o', 'gpt-4o-mini', 'o4', 'o4-mini-high', 'gpt-4-turbo', 'gpt-5.2-high'],
    'chatgpt-enterprise': ['gpt-4o', 'gpt-4o-mini', 'o4', 'o4-mini-high', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-5.2-high', 'gpt-5.2'],
    'chatgpt-pro': ['o4', 'o4-mini-high', 'gpt-4o', 'gpt-4o-mini', 'gpt-5.2-high', 'gpt-5.2', 'o3', 'o3-pro'],
  },
  anthropic: {
    'claude-free': ['claude-3-haiku-4-5'],
    'claude-pro': ['claude-3-7-sonnet', 'claude-sonnet-4.6', 'claude-opus-4.6', 'claude-3-5-sonnet', 'claude-3-5-haiku'],
    'claude-team': ['claude-3-7-sonnet', 'claude-sonnet-4.6', 'claude-opus-4.6'],
  },
  google: {
    'gemini-free': ['gemini-1.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-flash'],
    'gemini-advanced': ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-2.5-pro', 'gemini-3-pro', 'gemini-3.1-pro', 'gemini-3.1-pro-preview-custom-tools'],
  },
  mistral: {
    'mistral-free': ['mistral-small', 'mistral-7b'],
    'mistral-pro': ['mistral-large', 'mistral-small', 'mistral-7b'],
    'mistral-team': ['mistral-large', 'mistral-small', 'mistral-7b'],
  },
  minimax: {
    'minimax-free': ['minimax-m2.5'],
    'minimax-pro': ['minimax-m2.5'],
    'minimax-team': ['minimax-m2.5'],
  },
  'minimax-global': {
    'minimax-global-free': ['minimax-m2.5'],
    'minimax-global-pro': ['minimax-m2.5'],
    'minimax-global-team': ['minimax-m2.5'],
  },
  zhipu: {
    'glm-coding-team': ['glm-4-flash'],
    'glm-coding-lite': ['glm-4', 'glm-4-flash', 'glm-5'],
    'glm-coding-pro': ['glm-4', 'glm-4-flash', 'glm-4-air', 'glm-4.5-air', 'glm-5'],
    'glm-coding-max': ['glm-4', 'glm-4-flash', 'glm-4-air', 'glm-4.5-air', 'glm-4.7-flash', 'glm-5'],
  },
  'zhipu-global': {
    'glm-global-free': ['glm-4-flash', 'glm-4-flashx'],
    'glm-global-pro': ['glm-4', 'glm-4-plus', 'glm-5'],
    'glm-global-team': ['glm-4', 'glm-4-plus', 'glm-4-long', 'glm-5'],
  },
  moonshot: {
    'kimi-free': ['moonshot-v1-8k'],
    'kimi-pro': ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    'kimi-team': ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    'kimi-enterprise': ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    'kimi-coding-pro': ['moonshot-v1-8k', 'moonshot-v1-32k'],
  },
  baidu: {
    'ernie-free': ['ernie-speed-128k'],
    'ernie-pro': ['ernie-speed-128k', 'ernie-lite-8k', 'ernie-turbo-8k'],
    'ernie-team': ['ernie-speed-128k', 'ernie-lite-8k', 'ernie-turbo-8k'],
  },
  volcengine: {
    'seed-free-trial': ['doubao-seed-2.0-lite', 'doubao-seed-2.0'],
    'seed-lite': ['doubao-seed-2.0-code', 'doubao-seed-2.0', 'glm-4.7-flash', 'deepseek-v3.2', 'kimi-k2.5'],
    'seed-pro': ['doubao-seed-2.0-code', 'doubao-seed-2.0', 'glm-4.7-flash', 'deepseek-v3.2', 'kimi-k2.5'],
    'seed-enterprise': ['doubao-seed-2.0-code', 'doubao-seed-2.0', 'glm-4.7-flash', 'deepseek-v3.2', 'kimi-k2.5'],
  },
  qwen: {
    'qwen-free-trial': [],  // Free trial - no specific model restrictions
    'qwen-lite': ['qwen-plus', 'qwen-max'],  // ¥7.9/month
    'qwen-pro': ['qwen3.5-plus-2026-02-15', 'qwen-max', 'qwen-plus', 'kimi-k2.5', 'minimax-m2.5', 'glm-5'],  // ¥39.9/month - includes cross-provider models
    'qwen-token-pack': [],  // Token pack - no specific model restrictions
    'qwen-enterprise': ['qwen-turbo', 'qwen-plus', 'qwen-max'],  // Enterprise - all core models
  },
};

// Provider configuration with invite links and metadata
const PROVIDER_CONFIG: Record<string, ProviderConfig> = {

  openai: {
    name: 'OpenAI',
    slug: 'openai',
    website: 'https://openai.com',
    pricing_url: 'https://openai.com/chatgpt/pricing/',
    invite_link: undefined,
    type: 'official',
    region: 'global',
    access_from_china: false,
  },
  anthropic: {
    name: 'Anthropic',
    slug: 'anthropic',
    website: 'https://claude.com',
    pricing_url: 'https://claude.com/pricing',
    invite_link: undefined,
    type: 'official',
    region: 'global',
    access_from_china: false,
  },
  google: {
    name: 'Google',
    slug: 'google',
    website: 'https://gemini.google.com',
    pricing_url: 'https://gemini.google/subscriptions',
    invite_link: undefined,
    type: 'official',
    region: 'global',
    access_from_china: false,
  },
  mistral: {
    name: 'Mistral AI',
    slug: 'mistral',
    website: 'https://mistral.ai',
    pricing_url: 'https://mistral.ai/pricing',
    invite_link: undefined,
    type: 'official',
    region: 'global',
    access_from_china: false,
  },
  minimax: {
    name: 'Minimax China',
    slug: 'minimax',
    website: 'https://platform.minimaxi.com',
    pricing_url: 'https://platform.minimaxi.com/docs/guides/pricing-coding-plan',
    invite_link: 'https://platform.minimaxi.com/subscribe/coding-plan?code=GOCSHm96x2&source=link',
    type: 'official',
    region: 'china',
    access_from_china: true,
  },
  'minimax-global': {
    name: 'Minimax Global',
    slug: 'minimax-global',
    website: 'https://platform.minimax.io',
    pricing_url: 'https://platform.minimax.io/docs/guides/pricing-coding-plan',
    invite_link: undefined,
    type: 'official',
    region: 'global',
    access_from_china: true,
  },
  zhipu: {
    name: 'Zhipu AI',
    slug: 'zhipu-china',
    website: 'https://bigmodel.cn',
    pricing_url: 'https://bigmodel.cn/glm-coding',
    invite_link: 'https://www.bigmodel.cn/glm-coding?ic=U2SFC0L765',
    type: 'official',
    region: 'china',
    access_from_china: true,
  },
  'zhipu-global': {
    name: 'Zhipu AI Global (Z.AI)',
    slug: 'zhipu-global',
    website: 'https://z.ai',
    pricing_url: 'https://z.ai/subscribe',
    invite_link: 'https://z.ai/subscribe?ic=HFGTURQAPY',
    type: 'official',
    region: 'global',
    access_from_china: true,
  },
  moonshot: {
    name: 'Moonshot',
    slug: 'moonshot',
    website: 'https://kimi.moonshot.cn',
    pricing_url: 'https://platform.moonshot.cn/pricing/chat',
    invite_link: undefined,
    type: 'official',
    region: 'china',
    access_from_china: true,
  },
  baidu: {
    name: 'Baidu',
    slug: 'baidu',
    website: 'https://cloud.baidu.com',
    pricing_url: 'https://console.bce.baidu.com/qianfan/resource/subscribe',
    invite_link: undefined,
    type: 'official',
    region: 'china',
    access_from_china: true,
  },
  volcengine: {
    name: 'Volcengine (字节跳动)',
    slug: 'volcengine',
    website: 'https://www.volcengine.com',
    pricing_url: 'https://www.volcengine.com/docs/82379/1925114',
    invite_link: 'https://volcengine.com/L/_uDpCXoFKP0/',
    type: 'official',
    region: 'both',
    access_from_china: true,
  },
  qwen: {
    name: 'Alibaba Qwen',
    slug: 'qwen',
    website: 'https://bailian.console.aliyun.com',
    pricing_url: 'https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=3005961',
    invite_link: 'https://www.aliyun.com/benefit/ai/aistar?clubBiz=subTask..12401178..10263..',
    type: 'official',
    region: 'both',
    access_from_china: true,
  },
} as const;

type ProviderKey = keyof typeof PROVIDER_CONFIG;

// Scraper functions mapping
const SCRAPERS: Record<ProviderKey, () => Promise<PlanScraperResult>> = {
  openai: scrapeOpenAIPlans,
  anthropic: scrapeAnthropicPlans,
  google: scrapeGoogleGeminiPlans,
  mistral: scrapeMistralPlans,
  minimax: scrapeMinimaxPlans,
  'minimax-global': scrapeMinimaxGlobalPlans,
  zhipu: scrapeZhipuPlans,
  'zhipu-global': scrapeZhipuGlobalPlans,
  moonshot: scrapeMoonshotPlans,
  baidu: scrapeBaiduPlans,
  volcengine: scrapeVolcenginePlans,
  qwen: scrapeQwenPlans,
};

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const providerArg = args.find(arg => arg.startsWith('--provider='))?.split('=')[1] as ProviderKey | undefined;

// Determine which providers to scrape
const providersToScrape = providerArg
  ? [providerArg]
  : (Object.keys(PROVIDER_CONFIG) as ProviderKey[]);

/**
 * Save scraped plans to database
 */
async function savePlansToDatabase(
  providerKey: ProviderKey,
  scrapedPlans: ScrapedPlan[]
): Promise<void> {
  const config = PROVIDER_CONFIG[providerKey];

  // Get or create provider
  let provider;
  try {
    provider = await getProviderBySlug(config.slug);
  } catch (error) {
    // Provider doesn't exist, create it
    provider = await upsertProvider({
      name: config.name,
      slug: config.slug,
      website: config.website,
      pricing_url: config.pricing_url,
      invite_link: config.invite_link,
      type: config.type,
      region: config.region,
      access_from_china: config.access_from_china,
    });
  }

  // Collect current plan slugs for cleanup
  const currentSlugs: string[] = [];

  // Save each plan
  for (const plan of scrapedPlans) {
    try {
      // Calculate yearly pricing if not provided
      const priceYearly = plan.priceYearly || (plan.priceMonthly > 0 ? plan.priceMonthly * 12 : undefined);

      const savedPlan = await upsertPlan({
        provider_id: provider.id,
        name: plan.planName,
        slug: plan.planSlug,
        pricing_model: plan.pricingModel,
        tier: plan.tier,
        price_monthly: plan.priceMonthly,
        price_yearly: priceYearly,
        daily_message_limit: plan.dailyMessageLimit,
        requests_per_minute: plan.requestsPerMinute,
        qps: plan.qps,
        tokens_per_minute: plan.tokensPerMinute,
        features: plan.features,
        region: plan.region,
        access_from_china: plan.accessFromChina,
        payment_methods: plan.paymentMethods,
        is_official: plan.isOfficial,
        last_verified: new Date(),
        currency: plan.currency || 'USD',
        price_unit: 'per_month',
      });

      // Handle model-plan relations
      const productSlugs = plan.productSlugs || PRODUCT_SLUGS[providerKey]?.[plan.planSlug] || [];
      if (productSlugs.length > 0) {
        // First, delete existing model relations for this plan
        await deleteModelsForPlan(savedPlan.id);

        // Then create new model-plan relations
        for (let i = 0; i < productSlugs.length; i++) {
          const productSlug = productSlugs[i];
          try {
            // Get model by slug
            const { data: model } = await (await import('./db/queries')).supabaseAdmin
              .from('models')
              .select('id')
              .eq('slug', productSlug)
              .single();

            if (model) {
              await upsertModelPlanRelation({
                plan_id: savedPlan.id,
                model_id: model.id,
                provider_id: provider.id,
                is_available: true,
                is_default: i === 0, // First product is default
                display_order: i,
              });
            } else {
              console.warn(`⚠️  Product not found for slug: ${productSlug}`);
            }
          } catch (error) {
            console.warn(`⚠️  Failed to create model-plan relation for ${productSlug}:`, error);
          }
        }
      }

      currentSlugs.push(plan.planSlug);
    } catch (error) {
      console.error(`❌ Failed to save plan ${plan.planName}:`, error);
    }
  }

  // Clean up outdated plans
  if (currentSlugs.length > 0) {
    await cleanupOutdatedPlans(provider.id, currentSlugs);
  }
}

/**
 * Main execution function
 */
async function main() {
  const startTime = Date.now();
  const totalResults: Array<{
    provider: string;
    success: boolean;
    plansCount: number;
    errors?: string[];
  }> = [];

  console.log('🚀 Starting subscription plan scraping...\n');

  // Determine which providers to scrape
  const providersToScrape = providerArg
    ? [providerArg]
  : (Object.keys(PROVIDER_CONFIG) as ProviderKey[]);

  // Run scrapers sequentially to avoid rate limiting
  for (const providerKey of providersToScrape) {
    const config = PROVIDER_CONFIG[providerKey];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 Scraping: ${config.name}`);
    console.log(`🔗 URL: ${config.pricing_url}`);
    if (config.inviteLink) {
      console.log(`🎁 Invite Link: ${config.invite_link}`);
    }
    console.log('='.repeat(60));

    try {
      const result = await SCRAPERS[providerKey]();

      if (result.success) {
        console.log(`✅ ${config.name}: Found ${result.plans.length} plans`);

        if (!dryRun) {
          await savePlansToDatabase(providerKey, result.plans);
          console.log(`💾 Saved ${result.plans.length} plans to database`);
        }

        if (result.errors && result.errors.length > 0) {
          console.log(`⚠️  Errors: ${result.errors.join(', ')}`);
        }

        totalResults.push({
          provider: config.name,
          success: true,
          plansCount: result.plans.length,
          errors: result.errors,
        });
      } else {
        console.log(`❌ ${config.name}: Scraping failed`);
        console.log(`   Errors: ${result.errors?.join(', ') || 'Unknown error'}`);

        totalResults.push({
          provider: config.name,
          success: false,
          plansCount: 0,
          errors: result.errors,
        });
      }
    } catch (error) {
      console.error(`❌ ${config.name}: Exception occurred`, error);
      totalResults.push({
        provider: config.name,
        success: false,
        plansCount: 0,
        errors: [String(error)],
      });
    }

    // Small delay between scrapers
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SCRAPING SUMMARY');
  console.log('='.repeat(60));

  const successful = totalResults.filter(r => r.success);
  const failed = totalResults.filter(r => !r.success);
  const totalPlans = successful.reduce((sum, r) => sum + r.plansCount, 0);
  const totalErrors = failed.reduce((sum, r) => sum + (r.errors?.length || 0), 0);

  console.log(`📦 Providers scraped: ${totalResults.length}`);
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📋 Total plans: ${totalPlans}`);
  console.log(`⚠️  Total errors: ${totalErrors}`);

  if (failed.length > 0) {
    console.log('\n❌ Failed providers:');
    failed.forEach(f => {
      console.log(`   - ${f.provider}: ${f.errors?.join(', ')}`);
    });
  }

  if (dryRun) {
    console.log('\n🔒 Dry run mode - no data was saved to database');
  }

  const duration = Date.now() - startTime;
  console.log(`\n⏱️  Total duration: ${(duration / 1000).toFixed(2)}s`);
  console.log('='.repeat(60));
}

// Run main function
main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
