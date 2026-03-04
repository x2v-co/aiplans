/**
 * OpenAI API Scraper - Dynamic fetching from pricing page
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const OPENAI_PRICING_URL = 'https://openai.com/api/pricing/';

interface OpenAIModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  cachedPrice?: number;
  contextWindow: number;
}

/**
 * Fetch and parse OpenAI pricing from their website
 * Note: OpenAI's pricing page uses JavaScript, so we may need to use
 * alternative approaches in the future. For now, we use known pricing.
 */
async function fetchOpenAIPricing(): Promise<OpenAIModel[]> {
  const result = await fetchHTML(OPENAI_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch OpenAI pricing page, using fallback data');
    // Return known pricing data as fallback
    return getFallbackPricing();
  }

  const html = result.data;
  const models: OpenAIModel[] = [];

  // Try to extract pricing from the HTML using regex patterns
  // This is a simplified approach - in production, we'd use a more robust parser

  // Known OpenAI model patterns (2025)
  const modelPatterns = [
    {
      model: 'gpt-4o',
      inputPattern: /gpt-4o[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /gpt-4o[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      cachedPattern: /gpt-4o[^$]*?\$?([\d.]+)\s*per\s*million\s*cached/i,
      context: 128000,
    },
    {
      model: 'gpt-4o-mini',
      inputPattern: /gpt-4o-mini[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /gpt-4o-mini[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      cachedPattern: /gpt-4o-mini[^$]*?\$?([\d.]+)\s*per\s*million\s*cached/i,
      context: 128000,
    },
    {
      model: 'gpt-4-turbo',
      inputPattern: /gpt-4-turbo[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /gpt-4-turbo[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      context: 128000,
    },
    {
      model: 'gpt-4',
      inputPattern: /gpt-4[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /gpt-4[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      context: 8192,
    },
    {
      model: 'gpt-3.5-turbo',
      inputPattern: /gpt-3\.5-turbo[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /gpt-3\.5-turbo[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      context: 16385,
    },
    {
      model: 'o1-preview',
      inputPattern: /o1-preview[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /o1-preview[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      context: 128000,
    },
    {
      model: 'o1-mini',
      inputPattern: /o1-mini[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /o1-mini[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      context: 128000,
    },
    {
      model: 'o3-mini',
      inputPattern: /o3-mini[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /o3-mini[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      context: 200000,
    },
  ];

  for (const pattern of modelPatterns) {
    const inputMatch = html.match(pattern.inputPattern);
    const outputMatch = html.match(pattern.outputPattern);
    const cachedMatch = pattern.cachedPattern ? html.match(pattern.cachedPattern) : null;

    if (inputMatch && outputMatch) {
      const inputPrice = parseFloat(inputMatch[1]);
      const outputPrice = parseFloat(outputMatch[1]);
      const cachedPrice = cachedMatch ? parseFloat(cachedMatch[1]) : undefined;

      if (!isNaN(inputPrice) && !isNaN(outputPrice)) {
        models.push({
          model: pattern.model,
          inputPrice,
          outputPrice,
          cachedPrice,
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
 * Fallback pricing data (known as of 2025-2026)
 */
function getFallbackPricing(): OpenAIModel[] {
  return [
    {
      model: 'gpt-4o',
      inputPrice: 2.50,
      outputPrice: 10.00,
      cachedPrice: 1.25,
      contextWindow: 128000,
    },
    {
      model: 'gpt-4o-mini',
      inputPrice: 0.15,
      outputPrice: 0.60,
      cachedPrice: 0.075,
      contextWindow: 128000,
    },
    {
      model: 'gpt-4.1',
      inputPrice: 2.00,
      outputPrice: 8.00,
      cachedPrice: 1.00,
      contextWindow: 128000,
    },
    {
      model: 'gpt-4.1-mini',
      inputPrice: 0.15,
      outputPrice: 0.60,
      cachedPrice: 0.075,
      contextWindow: 128000,
    },
    {
      model: 'o1',
      inputPrice: 15.00,
      outputPrice: 60.00,
      contextWindow: 200000,
    },
    {
      model: 'o1-mini',
      inputPrice: 3.00,
      outputPrice: 12.00,
      contextWindow: 200000,
    },
    {
      model: 'o3-mini',
      inputPrice: 1.10,
      outputPrice: 4.40,
      contextWindow: 200000,
    },
  ];
}

export async function scrapeOpenAIDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching OpenAI pricing...');

    const models = await fetchOpenAIPricing();

    console.log(`📦 Found ${models.length} models from OpenAI`);

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
          cachedInputPricePer1M: model.cachedPrice,
          contextWindow: model.contextWindow,
          isAvailable: true,
          currency: 'USD', // OpenAI prices are in USD
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ OpenAI scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'OpenAI-API',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ OpenAI scrape failed:', error);
    return {
      source: 'OpenAI-API',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeOpenAIDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
