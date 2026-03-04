/**
 * Mistral AI API Scraper - Dynamic fetching from pricing page
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const MISTRAL_PRICING_URL = 'https://mistral.ai/pricing';

interface MistralModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
}

/**
 * Fetch and parse Mistral pricing from their website
 */
async function fetchMistralPricing(): Promise<MistralModel[]> {
  const result = await fetchHTML(MISTRAL_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Mistral pricing page, using fallback data');
    return getFallbackPricing();
  }

  const html = result.data;
  const models: MistralModel[] = [];

  // Known Mistral model patterns (2025-2026)
  const modelPatterns = [
    {
      model: 'codestral',
      inputPattern: /codestral[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /codestral[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*1M\s*output/i,
      context: 32000,
    },
    {
      model: 'mixtral-8x7b',
      inputPattern: /mixtral\s*8x7b[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /mixtral\s*8x7b[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*1M\s*output/i,
      context: 32000,
    },
    {
      model: 'mixtral-8x22b',
      inputPattern: /mixtral\s*8x22b[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /mixtral\s*8x22b[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*1M\s*output/i,
      context: 64000,
    },
    {
      model: 'mistral-large',
      inputPattern: /mistral-large[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /mistral-large[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*1M\s*output/i,
      context: 128000,
    },
    {
      model: 'mistral-medium',
      inputPattern: /mistral-medium[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /mistral-medium[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*1M\s*output/i,
      context: 32000,
    },
    {
      model: 'mistral-small',
      inputPattern: /mistral-small[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /mistral-small[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*1M\s*output/i,
      context: 32000,
    },
    {
      model: 'mistral-nemo',
      inputPattern: /mistral-nemo[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /mistral-nemo[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*1M\s*output/i,
      context: 128000,
    },
    {
      model: 'pixtral',
      inputPattern: /pixtral[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*image/i,
      outputPattern: /pixtral[^$]*?([\$¥€]?\s*[\d.]+)\s*per\s*image/i,
      context: 0,
    },
  ];

  for (const pattern of modelPatterns) {
    const inputMatch = html.match(pattern.inputPattern);
    const outputMatch = html.match(pattern.outputPattern);

    if (inputMatch && outputMatch) {
      const inputPrice = parseFloat(inputMatch[1].replace(/[^0-9.]/g, ''));
      const outputPrice = parseFloat(outputMatch[1].replace(/[^0-9.]/g, ''));

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
function getFallbackPricing(): MistralModel[] {
  return [
    {
      model: 'codestral',
      inputPrice: 0.06,
      outputPrice: 0.20,
      contextWindow: 32000,
    },
    {
      model: 'mixtral-8x7b',
      inputPrice: 0.27,
      outputPrice: 0.27,
      contextWindow: 32000,
    },
    {
      model: 'mixtral-8x22b',
      inputPrice: 0.65,
      outputPrice: 0.65,
      contextWindow: 64000,
    },
    {
      model: 'mistral-large',
      inputPrice: 4.00,
      outputPrice: 12.00,
      contextWindow: 128000,
    },
    {
      model: 'mistral-medium',
      inputPrice: 2.50,
      outputPrice: 2.50,
      contextWindow: 32000,
    },
    {
      model: 'mistral-small',
      inputPrice: 0.20,
      outputPrice: 0.20,
      contextWindow: 32000,
    },
    {
      model: 'mistral-nemo',
      inputPrice: 0.15,
      outputPrice: 0.15,
      contextWindow: 128000,
    },
    {
      model: 'pixtral-12b',
      inputPrice: 0.05,
      outputPrice: 0.05,
      contextWindow: 0,
    },
  ];
}

export async function scrapeMistralDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Mistral pricing...');

    const models = await fetchMistralPricing();

    console.log(`📦 Found ${models.length} models from Mistral`);

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
          contextWindow: model.contextWindow || undefined,
          isAvailable: true,
          currency: 'USD', // Mistral prices are in USD
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Mistral scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Mistral-AI',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Mistral scrape failed:', error);
    return {
      source: 'Mistral-AI',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeMistralDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
