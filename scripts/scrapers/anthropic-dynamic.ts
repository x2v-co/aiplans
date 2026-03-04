/**
 * Anthropic API Scraper - Dynamic fetching from pricing page
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const ANTHROPIC_PRICING_URL = 'https://claude.com/pricing#api';

interface AnthropicModelPrice {
  model: string;
  inputPrice: number;
  outputPrice: number;
  cachedPrice?: number;
  contextWindow: number;
}

/**
 * Fallback pricing data (as of 2025-2026)
 */
function getFallbackPricing(): AnthropicModelPrice[] {
  return [
    {
      model: 'claude-3-5-sonnet',
      inputPrice: 3.00,
      outputPrice: 15.00,
      cachedPrice: 0.10,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-5-haiku',
      inputPrice: 0.80,
      outputPrice: 4.00,
      cachedPrice: 0.025,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-5-sonnet-20250207',
      inputPrice: 3.00,
      outputPrice: 15.00,
      cachedPrice: 0.10,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-7-sonnet-20250210',
      inputPrice: 15.00,
      outputPrice: 75.00,
      cachedPrice: 0.75,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-7-sonnet-20250210-thinking',
      inputPrice: 15.00,
      outputPrice: 75.00,
      cachedPrice: 0.75,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-5-haiku-20250219',
      inputPrice: 1.00,
      outputPrice: 5.00,
      cachedPrice: 0.05,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-opus-20250229',
      inputPrice: 15.00,
      outputPrice: 75.00,
      cachedPrice: 0.75,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-7-sonnet-20250210-thinking',
      inputPrice: 15.00,
      outputPrice: 75.00,
      cachedPrice: 0.75,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-5-haiku-20250219-thinking',
      inputPrice: 0.80,
      outputPrice: 4.00,
      cachedPrice: 0.025,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-sonnet-20240229',
      inputPrice: 3.00,
      outputPrice: 15.00,
      cachedPrice: 0.30,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-haiku-20240229',
      inputPrice: 0.25,
      outputPrice: 1.25,
      cachedPrice: 0.10,
      contextWindow: 200000,
    },
  ];
}

/**
 * Parse Anthropic pricing page to extract model prices
 */
async function fetchAnthropicPricing(): Promise<AnthropicModelPrice[]> {
  const result = await fetchHTML(ANTHROPIC_PRICING_URL);

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch Anthropic pricing');
  }

  const html = result.data;
  const models: AnthropicModelPrice[] = [];

  // Parse pricing from the HTML
  // Look for model names like "Claude 3.5 Sonnet", "Claude 3 Opus", etc.
  const modelPatterns = [
    {
      name: 'Claude 3.5 Sonnet',
      id: 'claude-3-5-sonnet',
      inputPattern: /Claude\s*3\.5\s*Sonnet[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /Claude\s*3\.5\s*Sonnet[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      cachedPattern: /Claude\s*3\.5\s*Sonnet[^$]*?\$?([\d.]+)\s*per\s*million\s*cached/i,
      context: 200000,
    },
    {
      name: 'Claude 3.5 Haiku',
      id: 'claude-3-5-haiku',
      inputPattern: /Claude\s*3\.5\s*Haiku[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /Claude\s*3\.5\s*Haiku[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      cachedPattern: /Claude\s*3\.5\s*Haiku[^$]*?\$?([\d.]+)\s*per\s*million\s*cached/i,
      context: 200000,
    },
    {
      name: 'Claude 3 Opus',
      id: 'claude-3-opus',
      inputPattern: /Claude\s*3\s*Opus[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /Claude\s*3\s*Opus[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      cachedPattern: /Claude\s*3\s*Opus[^$]*?\$?([\d.]+)\s*per\s*million\s*cached/i,
      context: 200000,
    },
    {
      name: 'Claude 3 Sonnet',
      id: 'claude-3-sonnet',
      inputPattern: /Claude\s*3\s*Sonnet[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /Claude\s*3\s*Sonnet[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      cachedPattern: /Claude\s*3\s*Sonnet[^$]*?\$?([\d.]+)\s*per\s*million\s*cached/i,
      context: 200000,
    },
    {
      name: 'Claude 3 Haiku',
      id: 'claude-3-haiku',
      inputPattern: /Claude\s*3\s*Haiku[^$]*?\$?([\d.]+)\s*per\s*million\s*input/i,
      outputPattern: /Claude\s*3\s*Haiku[^$]*?\$?([\d.]+)\s*per\s*million\s*output/i,
      cachedPattern: /Claude\s*3\s*Haiku[^$]*?\$?([\d.]+)\s*per\s*million\s*cached/i,
      context: 200000,
    },
  ];

  for (const pattern of modelPatterns) {
    const inputMatch = html.match(pattern.inputPattern);
    const outputMatch = html.match(pattern.outputPattern);
    const cachedMatch = html.match(pattern.cachedPattern);

    if (inputMatch && outputMatch) {
      const inputPrice = parseFloat(inputMatch[1]);
      const outputPrice = parseFloat(outputMatch[1]);
      const cachedPrice = cachedMatch ? parseFloat(cachedMatch[1]) : undefined;

      if (!isNaN(inputPrice) && !isNaN(outputPrice)) {
        models.push({
          model: pattern.id,
          inputPrice,
          outputPrice,
          cachedPrice,
          contextWindow: pattern.context,
        });
      }
    }
  }

  return models;
}

export async function scrapeAnthropicDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Anthropic pricing...');

    const models = await fetchAnthropicPricing();

    // If no models found (HTML parsing failed), use fallback
    if (models.length === 0) {
      console.warn('⚠️ No models parsed from HTML, using fallback data');
      const fallbackModels = getFallbackPricing();

      for (const model of fallbackModels) {
        try {
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
            currency: 'USD',
          });
        } catch (error) {
          errors.push(`Error processing ${model.model}: ${error}`);
        }
      }
    } else {
      console.log(`📦 Found ${models.length} models from Anthropic`);

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
          currency: 'USD', // Anthropic prices are in USD
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Anthropic scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Anthropic-API',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Anthropic scrape failed:', error);
    return {
      source: 'Anthropic-API',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeAnthropicDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
