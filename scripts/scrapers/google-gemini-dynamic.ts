/**
 * Google Gemini API Scraper - Dynamic fetching from pricing page
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const GOOGLE_PRICING_URL = 'https://ai.google.dev/pricing';

interface GoogleModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
}

/**
 * Fetch and parse Google pricing from their website
 */
async function fetchGooglePricing(): Promise<GoogleModel[]> {
  const result = await fetchHTML(GOOGLE_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Google pricing page, using fallback data');
    return getFallbackPricing();
  }

  const html = result.data;
  const models: GoogleModel[] = [];

  // Known Google model patterns (2025)
  const modelPatterns = [
    {
      model: 'gemini-2.0-flash-exp',
      namePattern: /Gemini\s*2\.0\s*Flash/i,
      inputPattern: /Gemini\s*2\.0\s*Flash[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /Gemini\s*2\.0\s*Flash[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      context: 1000000,
    },
    {
      model: 'gemini-1.5-pro',
      namePattern: /Gemini\s*1\.5\s*Pro/i,
      inputPattern: /Gemini\s*1\.5\s*Pro[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /Gemini\s*1\.5\s*Pro[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      context: 2000000,
    },
    {
      model: 'gemini-1.5-flash',
      namePattern: /Gemini\s*1\.5\s*Flash/i,
      inputPattern: /Gemini\s*1\.5\s*Flash[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /Gemini\s*1\.5\s*Flash[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      context: 1000000,
    },
    {
      model: 'gemini-1.0-pro',
      namePattern: /Gemini\s*1\.0\s*Pro/i,
      inputPattern: /Gemini\s*1\.0\s*Pro[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /Gemini\s*1\.0\s*Pro[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      context: 2800000,
    },
  ];

  for (const pattern of modelPatterns) {
    const inputMatch = html.match(pattern.inputPattern);
    const outputMatch = html.match(pattern.outputPattern);

    if (inputMatch && outputMatch) {
      const inputPrice = parseFloat(inputMatch[1]);
      const outputPrice = parseFloat(outputMatch[1]);

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
 * Fallback pricing data (known as of 2025-2026)
 */
function getFallbackPricing(): GoogleModel[] {
  return [
    {
      model: 'gemini-2.0-flash-exp',
      inputPrice: 0.075,
      outputPrice: 0.30,
      contextWindow: 1000000,
    },
    {
      model: 'gemini-2.0-flash-thinking-exp',
      inputPrice: 0.075,
      outputPrice: 0.30,
      contextWindow: 1000000,
    },
    {
      model: 'gemini-1.5-pro',
      inputPrice: 1.25,
      outputPrice: 5.00,
      contextWindow: 2000000,
    },
    {
      model: 'gemini-1.5-flash',
      inputPrice: 0.075,
      outputPrice: 0.30,
      contextWindow: 1000000,
    },
    {
      model: 'gemini-1.5-flash-002',
      inputPrice: 0.075,
      outputPrice: 0.30,
      contextWindow: 28000000,
    },
    {
      model: 'gemini-1.5-pro-001',
      inputPrice: 1.25,
      outputPrice: 5.00,
      contextWindow: 2000000,
    },
    {
      model: 'gemini-1.0-pro',
      inputPrice: 0.50,
      outputPrice: 1.50,
      contextWindow: 2800000,
    },
    {
      model: 'gemini-exp-1206',
      inputPrice: 0.125,
      outputPrice: 0.375,
      contextWindow: 2000000,
    },
  ];
}

export async function scrapeGoogleDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Google Gemini pricing...');

    const models = await fetchGooglePricing();

    console.log(`📦 Found ${models.length} models from Google`);

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
          currency: 'USD', // Google prices are in USD
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Google scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Google-Gemini-API',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Google scrape failed:', error);
    return {
      source: 'Google-Gemini-API',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeGoogleDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
