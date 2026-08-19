#!/usr/bin/env tsx

import { scrapeOpenAIPlans } from './scrapers/plan-openai-dynamic';
import {
  scrapeAnthropicPlans,
  closeBrowser as closeAnthropicBrowser,
} from './scrapers/plan-anthropic-dynamic';
import { closeBrowser as closeSharedBrowser } from './scrapers/base-fetcher';
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
    slug: 'minimax-china',
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
const allowedArgs = new Set(['--dry-run', '--help']);
const unknownArgs = args.filter(arg => !allowedArgs.has(arg) && !arg.startsWith('--provider='));
if (unknownArgs.length > 0) {
  throw new Error(`Unknown argument${unknownArgs.length > 1 ? 's' : ''}: ${unknownArgs.join(', ')}`);
}

if (args.includes('--help')) {
  console.log(`Usage: npm run scrape:plans -- [options]

Options:
  --dry-run          Scrape without writing to the database
  --provider=<slug>  Run one provider scraper
  --help             Show this help message

Available providers:
  ${Object.keys(PROVIDER_CONFIG).join(', ')}`);
  process.exit(0);
}

const providerArgs = args.filter(arg => arg.startsWith('--provider='));
if (providerArgs.length > 1) {
  throw new Error('Pass --provider only once');
}
const dryRun = args.includes('--dry-run');
const providerArg = args.find(arg => arg.startsWith('--provider='))?.split('=')[1] as ProviderKey | undefined;
if (providerArgs.length === 1 && (!providerArg || !(providerArg in PROVIDER_CONFIG))) {
  throw new Error(
    `Unknown provider "${providerArg || ''}". Available providers: ${Object.keys(PROVIDER_CONFIG).join(', ')}`
  );
}

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
  } catch {
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
      await upsertPlan({
        provider_id: provider.id,
        name: plan.planName,
        slug: plan.planSlug,
        pricing_model: plan.pricingModel,
        tier: plan.tier,
        price_monthly: plan.priceMonthly,
        price_yearly: plan.priceYearly,
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

      // Model↔plan links are not written here. They are derived from each
      // plan's `model_selector` by scripts/materialize-model-plan-mappings.ts,
      // which runs right after this scraper. The old code path called
      // deleteModelsForPlan() — an unconditional delete of every mapping for
      // the plan — and then re-inserted from a hand-maintained slug list that
      // had drifted out of date. No plan scraper ever reported model slugs of
      // its own, so the list was the only input, and stale entries silently
      // wiped good links.

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

  if (failed.length > 0) {
    throw new Error(`${failed.length} plan scraper${failed.length === 1 ? '' : 's'} failed`);
  }
}

async function closePlanBrowsers(): Promise<void> {
  await Promise.allSettled([
    closeAnthropicBrowser(),
    closeSharedBrowser(),
  ]);
}

// Run main function
main()
  .then(closePlanBrowsers)
  .catch(async (error) => {
    await closePlanBrowsers();
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
