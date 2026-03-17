/**
 * Base scraper template with provider metadata
 * Use this as a reference for creating new scrapers
 *
 * IMPORTANT: This is a TEMPLATE only. Do NOT hardcode pricing data.
 * All scrapers must fetch real data from APIs or HTML pages.
 * If scraping fails, return empty arrays with errors - NO FALLBACK DATA.
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
// This is STATIC metadata about the provider, NOT pricing data
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

/**
 * Full scraper with provider, models, and plans
 *
 * IMPLEMENTATION PATTERN:
 * 1. Fetch pricing data from API or HTML page using Playwright
 * 2. Parse the data into ScrapedModel[] and ScrapedPlan[]
 * 3. Return errors array if scraping fails
 * 4. NEVER return hardcoded fallback data
 */
export async function scrapeOpenAIWithProvider(): Promise<ScraperResultWithProvider> {
  const startTime = Date.now();
  const errors: string[] = [];
  const models: ScrapedModel[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Processing OpenAI (Provider + Models + Plans)...');

    // TODO: Implement actual scraping logic here
    // Example:
    // const browser = await chromium.launch();
    // const page = await browser.newPage();
    // await page.goto('https://openai.com/api/pricing/');
    // ... parse pricing data ...
    // await browser.close();

    // For now, this is a template - not implemented
    errors.push('Scraper not implemented - this is a template file');

    const duration = Date.now() - startTime;
    console.log(`⚠️ OpenAI template scrape completed in ${duration}ms`);
    console.log(`   - Provider: ${OPENAI_PROVIDER.name}`);
    console.log(`   - Models: ${models.length}`);
    console.log(`   - Plans: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'OpenAI-Full',
      success: false,
      provider: OPENAI_PROVIDER,
      models, // Empty array
      plans,  // Empty array
      errors,
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