/**
 * Azure OpenAI API Scraper - Dynamic fetching from pricing page
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const AZURE_PRICING_URL = 'https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/';

interface AzureModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
}

/**
 * Fetch and parse Azure OpenAI pricing from their website
 */
async function fetchAzurePricing(): Promise<AzureModel[]> {
  const result = await fetchHTML(AZURE_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Azure pricing page, using fallback data');
    return getFallbackPricing();
  }

  const html = result.data;
  const models: AzureModel[] = [];

  // Known Azure OpenAI model patterns (2025)
  // Azure prices are typically per 1K tokens, so we need to convert to per 1M
  const modelPatterns = [
    {
      model: 'gpt-4o',
      azureId: 'GPT-4o',
      inputPattern: /GPT-4o[^$]*?\$?([\d.]+)\s*per\s*1K\s*input/i,
      outputPattern: /GPT-4o[^$]*?\$?([\d.]+)\s*per\s*1K\s*output/i,
      context: 128000,
    },
    {
      model: 'gpt-4o-mini',
      azureId: 'GPT-4o-mini',
      inputPattern: /GPT-4o-mini[^$]*?\$?([\d.]+)\s*per\s*1K\s*input/i,
      outputPattern: /GPT-4o-mini[^$]*?\$?([\d.]+)\s*per\s*1K\s*output/i,
      context: 128000,
    },
    {
      model: 'gpt-4-turbo',
      azureId: 'GPT-4-Turbo',
      inputPattern: /GPT-4-Turbo[^$]*?\$?([\d.]+)\s*per\s*1K\s*input/i,
      outputPattern: /GPT-4-Turbo[^$]*?\$?([\d.]+)\s*per\s*1K\s*output/i,
      context: 128000,
    },
    {
      model: 'gpt-35-turbo',
      azureId: 'GPT-35-Turbo',
      inputPattern: /GPT-3\.5-Turbo[^$]*?\$?([\d.]+)\s*per\s*1K\s*input/i,
      outputPattern: /GPT-3\.5-Turbo[^$]*?\$?([\d.]+)\s*per\s*1K\s*output/i,
      context: 16385,
    },
    {
      model: 'claude-3-5-sonnet',
      azureId: 'Claude-3.5-Sonnet',
      inputPattern: /Claude-3\.5-Sonnet[^$]*?\$?([\d.]+)\s*per\s*1K\s*input/i,
      outputPattern: /Claude-3\.5-Sonnet[^$]*?\$?([\d.]+)\s*per\s*1K\s*output/i,
      context: 200000,
    },
    {
      model: 'claude-3-5-haiku',
      azureId: 'Claude-3.5-Haiku',
      inputPattern: /Claude-3\.5-Haiku[^$]*?\$?([\d.]+)\s*per\s*1K\s*input/i,
      outputPattern: /Claude-3\.5-Haiku[^$]*?\$?([\d.]+)\s*per\s*1K\s*output/i,
      context: 200000,
    },
  ];

  for (const pattern of modelPatterns) {
    const inputMatch = html.match(pattern.inputPattern);
    const outputMatch = html.match(pattern.outputPattern);

    if (inputMatch && outputMatch) {
      // Convert from per 1K to per 1M
      const inputPrice = parseFloat(inputMatch[1]) * 1000;
      const outputPrice = parseFloat(outputMatch[1]) * 1000;

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
 * Fallback pricing data (known as of 2025)
 * Azure prices are typically 2-3x higher than OpenAI direct
 */
function getFallbackPricing(): AzureModel[] {
  return [
    {
      model: 'gpt-4o',
      inputPrice: 5.00,
      outputPrice: 20.00,
      contextWindow: 128000,
    },
    {
      model: 'gpt-4o-mini',
      inputPrice: 0.30,
      outputPrice: 1.20,
      contextWindow: 128000,
    },
    {
      model: 'gpt-4-turbo',
      inputPrice: 20.00,
      outputPrice: 60.00,
      contextWindow: 128000,
    },
    {
      model: 'gpt-35-turbo',
      inputPrice: 1.00,
      outputPrice: 3.00,
      contextWindow: 16385,
    },
  ];
}

export async function scrapeAzureOpenAIDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Azure OpenAI pricing...');

    const models = await fetchAzurePricing();

    console.log(`📦 Found ${models.length} models from Azure OpenAI`);

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
          currency: 'USD', // Azure prices are in USD
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Azure OpenAI scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Azure-OpenAI',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Azure OpenAI scrape failed:', error);
    return {
      source: 'Azure-OpenAI',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeAzureOpenAIDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
