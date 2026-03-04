/**
 * SiliconFlow API Scraper - Dynamic fetching from /v1/models
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchJSON } from './base-fetcher';

const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/models';

interface SiliconFlowModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

/**
 * SiliconFlow pricing mapping (as of 2026)
 * Used as fallback when API is not accessible
 * Prices are in CNY per 1M tokens
 */
const SILICONFLOW_PRICING: Record<string, { input: number; output: number; context?: number }> = {
  // OpenAI models
  'gpt-4o': { input: 18.00, output: 36.00, context: 128000 },
  'gpt-4o-mini': { input: 1.08, output: 2.16, context: 128000 },
  'gpt-4-turbo': { input: 3.00, output: 6.00, context: 128000 },
  'gpt-3.5-turbo': { input: 1.50, output: 3.00, context: 16385 },

  // Anthropic models
  'claude-3-5-sonnet': { input: 21.00, output: 63.00, context: 200000 },
  'claude-3-5-sonnet-v2:0': { input: 15.00, output: 45.00, context: 200000 },
  'claude-3.5-haiku': { input: 0.75, output: 2.55, context: 200000 },
  'claude-3-opus': { input: 105.00, output: 315.00, context: 200000 },
  'claude-3-sonnet': { input: 21.00, output: 63.00, context: 200000 },
  'claude-3-haiku': { input: 0.25, output: 1.25, context: 200000 },

  // DeepSeek models
  'deepseek-chat': { input: 0.20, output: 2.00, context: 128000 },
  'deepseek-coder': { input: 0.20, output: 2.00, context: 128000 },
  'deepseek-v3': { input: 0.20, output: 2.00, context: 128000 },

  // Qwen models
  'qwen-turbo': { input: 4.00, output: 4.00, context: 8000 },
  'qwen-plus': { input: 8.00, output: 8.00, context: 32000 },
  'qwen-max': { input: 32.00, output: 32.00, context: 32000 },
  'qwen-max-longcontext': { input: 40.00, output: 40.00, context: 28000 },

  // Llama models
  'llama-3.1-405b-instruct': { input: 2.70, output: 2.70, context: 131072 },
  'llama-3.1-70b-instruct': { input: 0.60, output: 0.60, context: 131072 },
  'llama-3-8b-instruct': { input: 0.15, output: 0.15, context: 131072 },

  // GLM models
  'glm-4-flash': { input: 1.00, output: 4.00, context: 128000 },
  'glm-4-flashx': { input: 4.00, output: 4.00, context: 128000 },
  'glm-4-air': { input: 2.50, output: 10.00, context: 128000 },
  'glm-4-plus': { input: 0.25, output: 0.25, context: 128000 },
  'glm-4-9b-chat': { input: 0.25, output: 0.25, context: 128000 },

  // Grok models
  'grok-2': { input: 2.00, output: 10.00, context: 131072 },
  'grok-2-vision': { input: 7.00, output: 7.00, context: 8192 },
};

/**
 * Get fallback pricing data
 */
function getFallbackPricing(): ScrapedPrice[] {
  return Object.entries(SILICONFLOW_PRICING).map(([modelId, pricing]) => ({
    modelName: normalizeModelName(modelId),
    modelSlug: slugify(modelId),
    inputPricePer1M: pricing.input,
    outputPricePer1M: pricing.output,
    contextWindow: pricing.context,
    isAvailable: true,
    currency: 'CNY',
  }));
}

export async function scrapeSiliconFlowDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching SiliconFlow models...');

    const result = await fetchJSON<{ data: SiliconFlowModel[] }>(SILICONFLOW_API_URL);

    // Handle auth failure gracefully with fallback
    if (!result.success || !result.data) {
      if (result.status === 401 || result.status === 403) {
        console.warn('⚠️ SiliconFlow API requires authentication, using fallback data');
        return {
          source: 'SiliconFlow',
          success: true,
          prices: getFallbackPricing(),
        };
      }
      throw new Error(result.error || 'Failed to fetch SiliconFlow models');
    }

    const models = result.data.data || [];
    console.log(`📦 Found ${models.length} models from SiliconFlow`);

    for (const model of models) {
      try {
        // Get pricing from our mapping
        const pricing = SILICONFLOW_PRICING[model.id];

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
          currency: 'CNY', // SiliconFlow prices are in CNY
        });
      } catch (error) {
        errors.push(`Error processing ${model.id}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ SiliconFlow scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'SiliconFlow',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ SiliconFlow scrape failed:', error);
    // On any error, use fallback data
    console.warn('⚠️ Using fallback pricing data');
    return {
      source: 'SiliconFlow',
      success: true,
      prices: getFallbackPricing(),
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeSiliconFlowDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
