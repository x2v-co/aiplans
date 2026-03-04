/**
 * Together AI API Scraper - Dynamic fetching from /v1/models
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchJSON } from './base-fetcher';

const TOGETHER_AI_API_URL = 'https://api.together.xyz/v1/models';

interface TogetherModel {
  id: string;
  name: string;
  display_name?: string;
  pricing: {
    input: string;  // Price per token
    output: string;
  };
  context_length?: number;
  description?: string;
}

/**
 * Get fallback pricing data (Together AI has many models, so we return empty)
 */
function getFallbackPricing(): ScrapedPrice[] {
  // Together AI has hundreds of models, fallback is not practical
  // Users would need to use an API key to fetch all models
  return [];
}

export async function scrapeTogetherAIDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Together AI models...');

    const result = await fetchJSON<{ data?: TogetherModel[] }>(TOGETHER_AI_API_URL);

    // Handle auth failure gracefully with fallback
    if (!result.success || !result.data) {
      if (result.status === 401 || result.status === 403) {
        console.warn('⚠️ Together AI API requires authentication, using fallback data');
        return {
          source: 'Together-AI',
          success: true,
          prices: getFallbackPricing(),
          errors: ['API key required - set TOGETHER_AI_API_KEY env var'],
        };
      }
      throw new Error(result.error || 'Failed to fetch Together AI models');
    }

    const models = result.data.data || [];
    console.log(`📦 Found ${models.length} models from Together AI`);

    for (const model of models) {
      try {
        // Convert price per token to price per 1M tokens
        const inputPrice = parseFloat(model.pricing.input) * 1_000_000;
        const outputPrice = parseFloat(model.pricing.output) * 1_000_000;

        // Skip if prices are invalid
        if (!validatePrice(inputPrice) || !validatePrice(outputPrice)) {
          errors.push(`Invalid price for ${model.id}`);
          continue;
        }

        prices.push({
          modelName: normalizeModelName(model.display_name || model.name || model.id),
          modelSlug: slugify(model.id),
          inputPricePer1M: inputPrice,
          outputPricePer1M: outputPrice,
          contextWindow: model.context_length,
          isAvailable: true,
          currency: 'USD', // Together AI prices are in USD
        });
      } catch (error) {
        errors.push(`Error processing ${model.id}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Together AI scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Together-AI',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Together AI scrape failed:', error);
    // On any error, use fallback data
    console.warn('⚠️ Using fallback pricing data');
    return {
      source: 'Together-AI',
      success: true,
      prices: getFallbackPricing(),
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeTogetherAIDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
