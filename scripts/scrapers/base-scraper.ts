/**
 * Base scraper template with provider metadata
 * Use this as a reference for creating new scrapers
 */

import type {
  ScrapedProvider,
  ScrapedModel,
  ScrapedPlan,
  ScraperResultWithProvider,
} from '../utils/provider-validator';
import { slugifyProvider } from '../utils/provider-validator';
import type { ScrapedPrice } from '../utils/validator';
import { slugify, normalizeModelName } from '../utils/validator';

/**
 * Example: OpenAI API Scraper with Provider Metadata
 *
 * Based on SCRAPER_TABLE.md entry:
 * | 供应商名称 | 定价类型 | 定价页面 URL | API 文档 URL | 类型 | 地区 | 国内可访问 | 支付方式 | 邀请链接 | 优先级 | 备注 |
 * | OpenAI | 🔶 Both | API: https://openai.com/api/pricing/<br>Plan: https://openai.com/chatgpt/pricing/ | - | official | global | No | 信用卡 | | ⭐⭐⭐ | API + ChatGPT Plus |
 */

// Provider metadata from SCRAPER_TABLE.md
export const OPENAI_PROVIDER: ScrapedProvider = {
  name: 'OpenAI',
  slug: 'openai',
  pricingUrl: 'https://openai.com/api/pricing/',
  apiDocsUrl: 'https://platform.openai.com/docs',
  website: 'https://openai.com',
  type: 'official',
  region: 'global',
  accessFromChina: false,
  paymentMethods: ['Credit Card'],
  priority: 1, // ⭐⭐⭐
  notes: 'API + ChatGPT Plus',
};

// Model pricing data (from OpenAI API docs)
const OPENAI_MODELS: ScrapedModel[] = [
  {
    modelName: 'GPT-4o',
    modelSlug: 'gpt-4o',
    inputPricePer1M: 2.50,
    outputPricePer1M: 10.00,
    cachedInputPricePer1M: 1.25,
    contextWindow: 128000,
    isAvailable: true,
    currency: 'USD',
    productType: 'llm',
  },
  {
    modelName: 'GPT-4o Mini',
    modelSlug: 'gpt-4o-mini',
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.60,
    cachedInputPricePer1M: 0.075,
    contextWindow: 128000,
    isAvailable: true,
    currency: 'USD',
    productType: 'llm',
  },
  {
    modelName: 'GPT-4 Turbo',
    modelSlug: 'gpt-4-turbo',
    inputPricePer1M: 10.00,
    outputPricePer1M: 30.00,
    contextWindow: 128000,
    isAvailable: true,
    currency: 'USD',
    productType: 'llm',
  },
  {
    modelName: 'GPT-4',
    modelSlug: 'gpt-4',
    inputPricePer1M: 30.00,
    outputPricePer1M: 60.00,
    contextWindow: 8192,
    isAvailable: true,
    currency: 'USD',
    productType: 'llm',
  },
  {
    modelName: 'GPT-3.5 Turbo',
    modelSlug: 'gpt-3.5-turbo',
    inputPricePer1M: 0.50,
    outputPricePer1M: 1.50,
    contextWindow: 16385,
    isAvailable: true,
    currency: 'USD',
    productType: 'llm',
  },
  {
    modelName: 'o1-preview',
    modelSlug: 'o1-preview',
    inputPricePer1M: 15.00,
    outputPricePer1M: 60.00,
    contextWindow: 128000,
    isAvailable: true,
    currency: 'USD',
    productType: 'llm',
  },
  {
    modelName: 'o1-mini',
    modelSlug: 'o1-mini',
    inputPricePer1M: 3.00,
    outputPricePer1M: 12.00,
    contextWindow: 128000,
    isAvailable: true,
    currency: 'USD',
    productType: 'llm',
  },
  {
    modelName: 'o3-mini',
    modelSlug: 'o3-mini',
    inputPricePer1M: 1.10,
    outputPricePer1M: 4.40,
    contextWindow: 200000,
    isAvailable: true,
    currency: 'USD',
    productType: 'llm',
  },
];

// Plan data (from ChatGPT pricing page)
const OPENAI_PLANS: ScrapedPlan[] = [
  {
    planName: 'ChatGPT Free',
    planSlug: 'chatgpt-free',
    priceMonthly: 0,
    pricingModel: 'subscription',
    tier: 'free',
    dailyMessageLimit: undefined,
    features: [
      'Access to GPT-4o mini',
      'Limited access to GPT-4o',
      'Limited access to advanced data analysis, file uploads, vision, web browsing',
      'Use custom GPTs',
    ],
    models: ['gpt-4o-mini', 'gpt-4o'],
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    isOfficial: true,
    currency: 'USD',
  },
  {
    planName: 'ChatGPT Plus',
    planSlug: 'chatgpt-plus',
    priceMonthly: 20,
    priceYearly: 200,
    pricingModel: 'subscription',
    tier: 'pro',
    dailyMessageLimit: undefined,
    features: [
      'Early access to new features',
      'Access to GPT-4o, GPT-4o mini',
      'Access to o1, o1-mini',
      'Up to 5x more messages for GPT-4o',
      'Access to advanced data analysis, file uploads, vision, and web browsing',
      'Create and use custom GPTs',
      'DALL-E image generation',
    ],
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini'],
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    isOfficial: true,
    currency: 'USD',
  },
  {
    planName: 'ChatGPT Team',
    planSlug: 'chatgpt-team',
    priceMonthly: 25,
    priceYearly: 300,
    pricingModel: 'subscription',
    tier: 'team',
    features: [
      'Everything in Plus',
      'Higher message caps on GPT-4o and tools',
      'Create and share custom GPTs with workspace',
      'Admin console for workspace management',
      'Team data excluded from training by default',
    ],
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini'],
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    isOfficial: true,
    currency: 'USD',
  },
  {
    planName: 'ChatGPT Pro',
    planSlug: 'chatgpt-pro',
    priceMonthly: 200,
    pricingModel: 'subscription',
    tier: 'enterprise',
    features: [
      'Unlimited access to OpenAI o1, GPT-4o, Advanced Voice',
      'o1 pro mode for most complex queries',
      'Access to o1-mini, GPT-4, GPT-4o mini',
      'Advanced data analysis, file uploads, vision, and web browsing',
      'Create and use custom GPTs',
    ],
    models: ['o1', 'o1-pro', 'o1-mini', 'o3-mini', 'gpt-4o', 'gpt-4o-mini', 'gpt-4'],
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    isOfficial: true,
    currency: 'USD',
  },
];

/**
 * Full scraper with provider, models, and plans
 */
export async function scrapeOpenAIWithProvider(): Promise<ScraperResultWithProvider> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    console.log('🔄 Processing OpenAI (Provider + Models + Plans)...');

    // Validate provider
    if (!OPENAI_PROVIDER.name || !OPENAI_PROVIDER.slug) {
      errors.push('Invalid provider data');
      throw new Error('Invalid provider data');
    }

    const duration = Date.now() - startTime;
    console.log(`✅ OpenAI scrape completed in ${duration}ms`);
    console.log(`   - Provider: ${OPENAI_PROVIDER.name}`);
    console.log(`   - Models: ${OPENAI_MODELS.length}`);
    console.log(`   - Plans: ${OPENAI_PLANS.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'OpenAI-Full',
      success: true,
      provider: OPENAI_PROVIDER,
      models: OPENAI_MODELS,
      plans: OPENAI_PLANS,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ OpenAI scrape failed:', error);
    return {
      source: 'OpenAI-Full',
      success: false,
      errors: [String(error)],
    };
  }
}

// Convert ScrapedModel to legacy ScrapedPrice for backward compatibility
export function toLegacyPrice(model: ScrapedModel): ScrapedPrice {
  return {
    modelName: normalizeModelName(model.modelName),
    modelSlug: model.modelSlug,
    inputPricePer1M: model.inputPricePer1M,
    outputPricePer1M: model.outputPricePer1M,
    cachedInputPricePer1M: model.cachedInputPricePer1M,
    contextWindow: model.contextWindow,
    rateLimit: model.rateLimit,
    isAvailable: model.isAvailable,
    currency: model.currency,
  };
}

// CLI test
if (require.main === module) {
  scrapeOpenAIWithProvider().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
