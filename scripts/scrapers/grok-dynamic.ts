/**
 * Grok / X.AI API Scraper - Dynamic fetching from /v1/models
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchJSON } from './base-fetcher';

const GROK_API_URL = 'https://api.x.ai/v1/models';

interface GrokModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

/**
 * Grok pricing (as of March 2026)
 * Used as fallback when API is not accessible
 * Source: https://docs.x.ai/developers/models
 */
const GROK_PRICING: Record<string, { input: number; output: number; context: number }> = {
  // Grok 4 Series (Latest)
  'grok-4-1-fast-reasoning': { input: 0.20, output: 0.50, context: 2000000 },
  'grok-4-1-fast-non-reasoning': { input: 0.20, output: 0.50, context: 2000000 },
  'grok-4-fast-reasoning': { input: 0.20, output: 0.50, context: 2000000 },
  'grok-4-fast-non-reasoning': { input: 0.20, output: 0.50, context: 2000000 },
  'grok-4-0709': { input: 3.00, output: 15.00, context: 256000 },
  'grok-code-fast-1': { input: 0.20, output: 1.50, context: 256000 },

  // Grok 3 Series
  'grok-3': { input: 3.00, output: 15.00, context: 131072 },
  'grok-3-mini': { input: 0.30, output: 0.50, context: 131072 },

  // Grok 2 Vision Series
  'grok-2-vision-1212': { input: 2.00, output: 10.00, context: 32768 },

  // Image Generation Models
  'grok-imagine-image-pro': { input: 0.07, output: 0, context: 0 }, // Per image output
  'grok-imagine-image': { input: 0.02, output: 0, context: 0 }, // Per image output
  'grok-2-image-1212': { input: 0.07, output: 0, context: 0 }, // Per image output

  // Video Generation
  'grok-imagine-video': { input: 0.05, output: 0, context: 0 }, // Per second

  // Legacy Models (for reference)
  'grok-2': { input: 2.00, output: 10.00, context: 131072 },
  'grok-2-vision': { input: 7.00, output: 7.00, context: 8192 },
  'grok-beta': { input: 5.00, output: 15.00, context: 131072 },
  'grok-vision-beta': { input: 5.00, output: 15.00, context: 8192 },
};

/**
 * Get fallback pricing data
 */
function getFallbackPricing(): ScrapedPrice[] {
  return Object.entries(GROK_PRICING).map(([modelId, pricing]) => ({
    modelName: normalizeModelName(modelId),
    modelSlug: slugify(modelId),
    inputPricePer1M: pricing.input,
    outputPricePer1M: pricing.output,
    contextWindow: pricing.context,
    isAvailable: true,
    currency: 'USD',
  }));
}

export async function scrapeGrokDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Grok models...');

    const result = await fetchJSON<{ data: GrokModel[] }>(GROK_API_URL);

    // Handle auth failure gracefully with fallback
    if (!result.success || !result.data) {
      if (result.status === 401 || result.status === 403) {
        console.warn('⚠️ Grok API requires authentication, using fallback data');
        return {
          source: 'Grok-API',
          success: true,
          prices: getFallbackPricing(),
        };
      }
      throw new Error(result.error || 'Failed to fetch Grok models');
    }

    const models = result.data.data || [];
    console.log(`📦 Found ${models.length} models from Grok`);

    for (const model of models) {
      try {
        // Get pricing from our mapping
        const pricing = GROK_PRICING[model.id];

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
          currency: 'USD', // Grok prices are in USD
        });
      } catch (error) {
        errors.push(`Error processing ${model.id}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Grok scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Grok-API',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Grok scrape failed:', error);
    // On any error, use fallback data
    console.warn('⚠️ Using fallback pricing data');
    return {
      source: 'Grok-API',
      success: true,
      prices: getFallbackPricing(),
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeGrokDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
