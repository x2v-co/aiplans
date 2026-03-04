/**
 * DeepSeek API Scraper - Dynamic fetching from /v1/models
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchJSON } from './base-fetcher';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/models';

interface DeepSeekModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

/**
 * DeepSeek pricing (as of 2026-02)
 * Used as fallback when API is not accessible
 */
const DEEPSEEK_PRICING: Record<string, { input: number; output: number; context: number }> = {
  'deepseek-chat': { input: 0.20, output: 2.00, context: 128000 }, // 缓存命中: 0.2元/M
  'deepseek-coder': { input: 0.20, output: 2.00, context: 128000 },
  'deepseek-reasoner': { input: 0.55, output: 2.19, context: 128000 },
  'deepseek-v3': { input: 0.20, output: 2.00, context: 128000 },
  'deepseek-r1-lite': { input: 0.14, output: 0.28, context: 128000 }, // 新增
  'deepseek-v3-lite': { input: 0.14, output: 0.28, context: 128000 }, // 新增
};

/**
 * Get fallback pricing data
 */
function getFallbackPricing(): ScrapedPrice[] {
  return Object.entries(DEEPSEEK_PRICING).map(([modelId, pricing]) => ({
    modelName: normalizeModelName(modelId),
    modelSlug: slugify(modelId),
    inputPricePer1M: pricing.input,
    outputPricePer1M: pricing.output,
    contextWindow: pricing.context,
    isAvailable: true,
    currency: 'CNY',
  }));
}

export async function scrapeDeepSeekDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching DeepSeek models...');

    const result = await fetchJSON<{ data: DeepSeekModel[] }>(DEEPSEEK_API_URL);

    // Handle auth failure gracefully with fallback
    if (!result.success || !result.data) {
      if (result.status === 401 || result.status === 403) {
        console.warn('⚠️ DeepSeek API requires authentication, using fallback data');
        return {
          source: 'DeepSeek-API',
          success: true,
          prices: getFallbackPricing(),
        };
      }
      throw new Error(result.error || 'Failed to fetch DeepSeek models');
    }

    const models = result.data.data || [];
    console.log(`📦 Found ${models.length} models from DeepSeek`);

    for (const model of models) {
      try {
        // Get pricing from our mapping
        const pricing = DEEPSEEK_PRICING[model.id];

        if (!pricing) {
          console.log(`⚠️ No pricing found for ${model.id}, skipping`);
          continue;
        }

        const inputPrice = pricing.input;
        const outputPrice = pricing.output;

        // Validate prices
        if (!validatePrice(inputPrice) || !validatePrice(outputPrice)) {
          errors.push(`Invalid price for ${model.id}`);
          continue;
        }

        prices.push({
          modelName: normalizeModelName(model.id),
          modelSlug: slugify(model.id),
          inputPricePer1M: inputPrice,
          outputPricePer1M: outputPrice,
          contextWindow: pricing.context,
          isAvailable: true,
          currency: 'CNY', // DeepSeek uses CNY
        });
      } catch (error) {
        errors.push(`Error processing ${model.id}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ DeepSeek scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'DeepSeek-API',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ DeepSeek scrape failed:', error);
    // On any error, use fallback data
    console.warn('⚠️ Using fallback pricing data');
    return {
      source: 'DeepSeek-API',
      success: true,
      prices: getFallbackPricing(),
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeDeepSeekDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
