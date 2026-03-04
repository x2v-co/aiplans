/**
 * Fireworks AI API Scraper - Dynamic fetching from pricing page
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const FIREWORKS_PRICING_URL = 'https://fireworks.ai/pricing';

interface FireworksModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
}

/**
 * Fetch and parse Fireworks pricing from their website
 */
async function fetchFireworksPricing(): Promise<FireworksModel[]> {
  const result = await fetchHTML(FIREWORKS_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Fireworks pricing page, using fallback data');
    return getFallbackPricing();
  }

  const html = result.data;
  const models: FireworksModel[] = [];

  // Known Fireworks model patterns (2025-2026)
  const modelPatterns = [
    {
      model: 'llama-3.1-405b-instruct',
      inputPattern: /llama.*405b[^$]*?\$?([\d.]+)\s*per\s*1M/i,
      context: 131072,
    },
    {
      model: 'llama-3.1-70b-instruct',
      inputPattern: /llama.*70b[^$]*?\$?([\d.]+)\s*per\s*1M/i,
      context: 131072,
    },
    {
      model: 'llama-3-8b-instruct',
      inputPattern: /llama.*8b[^$]*?\$?([\d.]+)\s*per\s*1M/i,
      context: 131072,
    },
    {
      model: 'mixtral-8x22b',
      inputPattern: /mixtral[^$]*?\$?([\d.]+)\s*per\s*1M/i,
      context: 64000,
    },
  ];

  for (const pattern of modelPatterns) {
    const inputMatch = html.match(pattern.inputPattern);
    const outputPattern = new RegExp(pattern.model.replace(/\./g, '\\.') + '[^$]*?\\$?([\\d.]+)\\s*per\\s*1M\\s*output', 'i');
    const outputMatch = html.match(outputPattern);

    if (inputMatch) {
      const inputPrice = parseFloat(inputMatch[1]);
      const outputPrice = outputMatch ? parseFloat(outputMatch[1]) : inputPrice;

      if (!isNaN(inputPrice) && !isNaN(outputPrice)) {
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
 * Prices in USD per 1M tokens
 */
function getFallbackPricing(): FireworksModel[] {
  return [
    {
      model: 'llama-3.1-405b-instruct',
      inputPrice: 0.90,
      outputPrice: 0.90,
      contextWindow: 131072,
    },
    {
      model: 'llama-3.1-70b-instruct',
      inputPrice: 0.65,
      outputPrice: 0.65,
      contextWindow: 131072,
    },
    {
      model: 'llama-3-8b-instruct',
      inputPrice: 0.10,
      outputPrice: 0.10,
      contextWindow: 131072,
    },
    {
      model: 'llama-3-70b-instruct',
      inputPrice: 0.40,
      outputPrice: 0.40,
      contextWindow: 8192,
    },
    {
      model: 'mixtral-8x22b',
      inputPrice: 0.60,
      outputPrice: 0.60,
      contextWindow: 64000,
    },
  ];
}

export async function scrapeFireworksDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Fireworks pricing...');

    const models = await fetchFireworksPricing();

    console.log(`📦 Found ${models.length} models from Fireworks`);

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
          currency: 'USD', // Fireworks prices are in USD
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Fireworks scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Fireworks-AI',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Fireworks scrape failed:', error);
    return {
      source: 'Fireworks-AI',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeFireworksDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
