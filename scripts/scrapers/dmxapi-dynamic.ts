/**
 * DMXAPI / 大模型API Scraper - Dynamic fetching from API endpoint
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import { normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData, ScraperResult } from './lib/playwright-scraper';

const DMXAPI_PRICING_URL = 'https://www.dmxapi.cn/rmb';
const DMXAPI_API_URL = 'https://www.dmxapi.cn/api/pricing';

/**
 * Base price per ratio unit in CNY
 * Based on analysis: gpt-4o has model_ratio=6.25 and official price ~¥15/1M input
 * So base ≈ ¥2.4 per ratio unit
 */
const BASE_PRICE_CNY = 2.4;

/**
 * Model name mappings for normalization
 */
const MODEL_MAPPINGS: Record<string, { name: string; context: number }> = {
  'gpt-4o': { name: 'gpt-4o', context: 128000 },
  'gpt-4o-mini': { name: 'gpt-4o-mini', context: 128000 },
  'gpt-4.1': { name: 'gpt-4.1', context: 128000 },
  'gpt-4.1-mini': { name: 'gpt-4.1-mini', context: 128000 },
  'gpt-4.1-nano': { name: 'gpt-4.1-nano', context: 128000 },
  'o3-mini': { name: 'o3-mini', context: 200000 },
  'o4-mini': { name: 'o4-mini', context: 128000 },
  'claude-3-5-sonnet-20241022': { name: 'claude-3.5-sonnet', context: 200000 },
  'claude-3-5-sonnet-20240620': { name: 'claude-3.5-sonnet', context: 200000 },
  'claude-3-5-haiku-20241022': { name: 'claude-3.5-haiku', context: 200000 },
  'claude-3-opus-20240229': { name: 'claude-3-opus', context: 200000 },
  'claude-3-7-sonnet-20250219': { name: 'claude-3.7-sonnet', context: 200000 },
  'deepseek-chat': { name: 'deepseek-chat', context: 128000 },
  'deepseek-reasoner': { name: 'deepseek-r1', context: 128000 },
  'gemini-2.5-pro-preview-05-06': { name: 'gemini-2.5-pro', context: 200000 },
  'gemini-2.5-flash-preview-04-17': { name: 'gemini-2.5-flash', context: 200000 },
  'qwen-max': { name: 'qwen-max', context: 128000 },
  'qwen-plus': { name: 'qwen-plus', context: 128000 },
};

class DMXAPIScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'DMXAPI';
  }

  getSourceUrl(): string {
    return DMXAPI_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const prices: PriceData[] = [];

    // Navigate to the main page first to establish context
    await this.navigate(DMXAPI_PRICING_URL);
    await this.page!.waitForTimeout(2000);

    // Use the API endpoint to get pricing data
    let response;
    try {
      const apiResponse = await this.page!.context().request.fetch(DMXAPI_API_URL);
      response = await apiResponse.json();
    } catch (error) {
      errors.push(`Failed to fetch pricing data from DMXAPI API endpoint: ${error}`);
      return {
        success: false,
        source: this.getSourceName(),
        prices: [],
        errors,
      };
    }

    if (!response?.data?.model_info) {
      errors.push('Failed to fetch pricing data from DMXAPI API endpoint');
      return {
        success: false,
        source: this.getSourceName(),
        prices: [],
        errors,
      };
    }

    const models = response.data.model_info as Array<{
      model_name: string;
      price_info: {
        default: {
          default: {
            quota_type: number;
            model_price: number;
            model_ratio: number;
            model_completion_ratio: number;
          };
        };
      };
    }>;

    console.log(`📊 Found ${models.length} models in API response`);

    for (const model of models) {
      const priceInfo = model.price_info?.default?.default;
      if (!priceInfo || priceInfo.quota_type !== 1) continue; // Skip non-token-based models

      const mapping = MODEL_MAPPINGS[model.model_name];
      if (!mapping) continue; // Skip unknown models

      const inputRatio = priceInfo.model_ratio || 0;
      const completionRatio = priceInfo.model_completion_ratio || 1;

      if (inputRatio <= 0) continue;

      // model_ratio is the input price ratio
      // model_completion_ratio is the output/input price ratio
      // So output = input_ratio * completion_ratio * base
      const inputPrice = Math.round(inputRatio * BASE_PRICE_CNY * 100) / 100;
      const outputPrice = Math.round(inputRatio * completionRatio * BASE_PRICE_CNY * 100) / 100;

      // Avoid duplicates (some models have multiple versions)
      if (!prices.some(p => p.modelName === normalizeModelName(mapping.name))) {
        prices.push({
          modelName: normalizeModelName(mapping.name),
          inputPricePer1M: inputPrice,
          outputPricePer1M: outputPrice,
          contextWindow: mapping.context,
          isAvailable: true,
          currency: 'CNY',
        });
        console.log(`  ✅ Found: ${model.model_name} -> ${mapping.name} - ¥${inputPrice}/¥${outputPrice} per 1M tokens`);
      }
    }

    if (prices.length === 0) {
      errors.push('No pricing data could be extracted from DMXAPI API endpoint');
    }

    return {
      success: errors.length === 0 && prices.length > 0,
      source: this.getSourceName(),
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

export async function scrapeDMXAPIDynamic(): Promise<ScraperResult> {
  const scraper = new DMXAPIScraper();
  return scraper.run();
}

// CLI test
if (require.main === module) {
  scrapeDMXAPIDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}