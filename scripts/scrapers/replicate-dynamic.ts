/**
 * Replicate API Scraper - Dynamic fetching from pricing page
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const REPLICATE_PRICING_URL = 'https://replicate.com/pricing';

interface ReplicateModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
}

/**
 * Fetch and parse Replicate pricing from their website
 */
async function fetchReplicatePricing(): Promise<ReplicateModel[]> {
  const result = await fetchHTML(REPLICATE_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Replicate pricing page, using fallback data');
    return getFallbackPricing();
  }

  const html = result.data;
  const models: ReplicateModel[] = [];

  // Known Replicate model patterns (2025-2026)
  const modelPatterns = [
    {
      model: 'meta-llama-3.1-405b-instruct',
      inputPattern: /llama.*405b[^$]*?\$?([\d.]+)\s*per/i,
      context: 131072,
    },
    {
      model: 'meta-llama-3.1-70b-instruct',
      inputPattern: /llama.*70b[^$]*?\$?([\d.]+)\s*per/i,
      context: 131072,
    },
    {
      model: 'meta-llama-3-8b-instruct',
      inputPattern: /llama.*8b[^$]*?\$?([\d.]+)\s*per/i,
      context: 131072,
    },
  ];

  for (const pattern of modelPatterns) {
    const priceMatch = html.match(pattern.inputPattern);

    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      // Replicate charges per second or per token
      const inputPrice = price;
      const outputPrice = price;

      if (!isNaN(inputPrice)) {
        models.push({
          model: pattern.model,
          inputPrice,
          outputPrice,
          contextWindow: pattern.context,
        });
      }
    }
  }

  // If no models found, use fallback
  if (models.length === 0) {
    console.warn('No models parsed from HTML, using fallback data');
    return getFallbackPricing();
  }

  return models;
}

/**
 * Fallback pricing data (as of 2025-2026)
 * Prices in USD per 1M tokens (estimated)
 */
function getFallbackPricing(): ReplicateModel[] {
  return [
    {
      model: 'meta-llama-3.1-405b-instruct',
      inputPrice: 1.20,
      outputPrice: 1.20,
      contextWindow: 131072,
    },
    {
      model: 'meta-llama-3.1-70b-instruct',
      inputPrice: 0.85,
      outputPrice: 0.85,
      contextWindow: 131072,
    },
    {
      model: 'meta-llama-3-8b-instruct',
      inputPrice: 0.15,
      outputPrice: 0.15,
      contextWindow: 131072,
    },
    {
      model: 'meta-llama-3.1-8b-instruct',
      inputPrice: 0.15,
      outputPrice: 0.15,
      contextWindow: 131072,
    },
  ];
}

export async function scrapeReplicateDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Replicate pricing...');

    const models = await fetchReplicatePricing();

    console.log(`📦 Found ${models.length} models from Replicate`);

    for (const model of models) {
      try {
        // Validate prices
        if (!validatePrice(model.inputPrice) || !validatePrice(model.outputPrice)) {
          errors.push(`Invalid price for ${model.model}`);
          continue;
        }

        prices.push({
          modelName: normalizeModelName(model.model),
          modelSlug: slugify(model.model),
          inputPricePer1M: model.inputPrice,
          outputPricePer1M: model.outputPrice,
          contextWindow: model.contextWindow,
          isAvailable: true,
          currency: 'USD', // Replicate prices are in USD
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Replicate scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Replicate',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Replicate scrape failed:', error);
    return {
      source: 'Replicate',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeReplicateDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
