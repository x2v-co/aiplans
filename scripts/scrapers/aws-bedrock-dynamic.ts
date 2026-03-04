/**
 * AWS Bedrock API Scraper - Dynamic fetching from pricing page
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const AWS_PRICING_URL = 'https://aws.amazon.com/bedrock/pricing/';

interface AWSModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
}

/**
 * Fetch and parse AWS Bedrock pricing from their website
 */
async function fetchAWSPricing(): Promise<AWSModel[]> {
  const result = await fetchHTML(AWS_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch AWS pricing page, using fallback data');
    return getFallbackPricing();
  }

  const html = result.data;
  const models: AWSModel[] = [];

  // Known AWS Bedrock model patterns (2025)
  // AWS prices are per 1K tokens for some models, per 1M for others
  const modelPatterns = [
    {
      model: 'anthropic.claude-3-5-sonnet-v2:0',
      baseModel: 'claude-3-5-sonnet',
      inputPattern: /Claude\s*3\.5\s*Sonnet[^$]*?\$?([\d.]+)\s*per\s*1K\s*input/i,
      outputPattern: /Claude\s*3\.5\s*Sonnet[^$]*?\$?([\d.]+)\s*per\s*1K\s*output/i,
      contextWindow: 200000,
    },
    {
      model: 'anthropic.claude-3-5-haiku-v1:0',
      baseModel: 'claude-3-5-haiku',
      inputPattern: /Claude\s*3\.5\s*Haiku[^$]*?\$?([\d.]+)\s*per\s*1K\s*input/i,
      outputPattern: /Claude\s*3\.5\s*Haiku[^$]*?\$?([\d.]+)\s*per\s*1K\s*output/i,
      contextWindow: 200000,
    },
    {
      model: 'us.anthropic.claude-3-opus-v1:0',
      baseModel: 'claude-3-opus',
      inputPattern: /Claude\s*3\s*Opus[^$]*?\$?([\d.]+)\s*per\s*1K\s*input/i,
      outputPattern: /Claude\s*3\s*Opus[^$]*?\$?([\d.]+)\s*per\s*1K\s*output/i,
      contextWindow: 200000,
    },
    {
      model: 'us.anthropic.claude-3-sonnet-v2:0',
      baseModel: 'claude-3-sonnet',
      inputPattern: /Claude\s*3\s*Sonnet[^$]*?\$?([\d.]+)\s*per\s*1K\s*input/i,
      outputPattern: /Claude\s*3\s*Sonnet[^$]*?\$?([\d.]+)\s*per\s*1K\s*output/i,
      contextWindow: 200000,
    },
    {
      model: 'anthropic.claude-3-haiku-v1:0',
      baseModel: 'claude-3-haiku',
      inputPattern: /Claude\s*3\s*Haiku[^$]*?\$?([\d.]+)\s*per\s*1K\s*input/i,
      outputPattern: /Claude\s*3\s*Haiku[^$]*?\$?([\d.]+)\s*per\s*1K\s*output/i,
      contextWindow: 200000,
    },
    {
      model: 'meta.llama-3-1-405b-instruct-v1:0',
      baseModel: 'llama-3-1-405b-instruct',
      inputPattern: /Llama\s*3\.1\s*405B[^$]*?\$?([\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /Llama\s*3\.1\s*405B[^$]*?\$?([\d.]+)\s*per\s*1M\s*output/i,
      contextWindow: 131072,
    },
    {
      model: 'meta.llama-3-1-70b-instruct-v1:0',
      baseModel: 'llama-3-1-70b-instruct',
      inputPattern: /Llama\s*3\.1\s*70B[^$]*?\$?([\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /Llama\s*3\.1\s*70B[^$]*?\$?([\d.]+)\s*per\s*1M\s*output/i,
      contextWindow: 131072,
    },
    {
      model: 'us.meta.llama-3-8b-instruct-v1:0',
      baseModel: 'llama-3-8b-instruct',
      inputPattern: /Llama\s*3\s*8B[^$]*?\$?([\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /Llama\s*3\s*8B[^$]*?\$?([\d.]+)\s*per\s*1M\s*output/i,
      contextWindow: 131072,
    },
    {
      model: 'mistral.mistral-large-v2:0',
      baseModel: 'mistral-large',
      inputPattern: /Mistral\s*Large[^$]*?\$?([\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /Mistral\s*Large[^$]*?\$?([\d.]+)\s*per\s*1M\s*output/i,
      contextWindow: 128000,
    },
    {
      model: 'mistral.mixtral-8x7b-instruct-v0:1',
      baseModel: 'mixtral-8x7b-instruct',
      inputPattern: /Mixtral\s*8x7B[^$]*?\$?([\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /Mixtral\s*8x7B[^$]*?\$?([\d.]+)\s*per\s*1M\s*output/i,
      contextWindow: 32768,
    },
  ];

  for (const pattern of modelPatterns) {
    const inputMatch = html.match(pattern.inputPattern);
    const outputMatch = html.match(pattern.outputPattern);

    if (inputMatch && outputMatch) {
      // Check if price is per 1K (common for Claude models on AWS)
      const inputPriceStr = inputMatch[1];
      const outputPriceStr = outputMatch[1];
      const inputPrice = parseFloat(inputPriceStr);
      const outputPrice = parseFloat(outputPriceStr);

      // Convert from per 1K to per 1M if needed
      const isPer1K = inputPriceStr.includes('.') || outputPriceStr.includes('.');
      const finalInputPrice = isPer1K ? inputPrice * 1000 : inputPrice;
      const finalOutputPrice = isPer1K ? outputPrice * 1000 : outputPrice;

      if (!isNaN(finalInputPrice) && !isNaN(finalOutputPrice)) {
        models.push({
          model: pattern.baseModel,
          inputPrice: finalInputPrice,
          outputPrice: finalOutputPrice,
          contextWindow: pattern.contextWindow,
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
 */
function getFallbackPricing(): AWSModel[] {
  return [
    {
      model: 'claude-3-5-sonnet',
      inputPrice: 3.00,
      outputPrice: 15.00,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-5-sonnet-v2:0',
      inputPrice: 3.00,
      outputPrice: 15.00,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-5-haiku',
      inputPrice: 0.25,
      outputPrice: 1.25,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-opus',
      inputPrice: 15.00,
      outputPrice: 75.00,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-sonnet',
      inputPrice: 3.00,
      outputPrice: 15.00,
      contextWindow: 200000,
    },
    {
      model: 'claude-3-haiku',
      inputPrice: 0.25,
      outputPrice: 1.25,
      contextWindow: 200000,
    },
    {
      model: 'llama-3-1-405b-instruct-v2:0',
      inputPrice: 2.70,
      outputPrice: 2.70,
      contextWindow: 131072,
    },
    {
      model: 'llama-3-1-70b-instruct-v1:0',
      inputPrice: 0.70,
      outputPrice: 0.70,
      contextWindow: 131072,
    },
    {
      model: 'meta-llama-3-8b-instruct-v1:0',
      inputPrice: 0.15,
      outputPrice: 0.15,
      contextWindow: 131072,
    },
  ];
}

export async function scrapeAWSBedrockDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching AWS Bedrock pricing...');

    const models = await fetchAWSPricing();

    console.log(`📦 Found ${models.length} models from AWS Bedrock`);

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
          currency: 'USD', // AWS prices are in USD
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ AWS Bedrock scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'AWS-Bedrock',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ AWS Bedrock scrape failed:', error);
    return {
      source: 'AWS-Bedrock',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeAWSBedrockDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
