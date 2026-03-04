/**
 * Minimax API Scraper - Dynamic fetching from pricing page
 */
import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const MINIMAX_PRICING_URL = 'https://platform.minimaxi.com/docs/guides/pricing-paygo';

interface MinimaxModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
  cachedReadPrice?: number;
  cachedWritePrice?: number;
  description?: string;
}

/**
 * Fetch and parse Minimax pricing from their website
 */
async function fetchMinimaxPricing(): Promise<MinimaxModel[]> {
  const result = await fetchHTML(MINIMAX_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Minimax pricing page, using fallback data');
    return getFallbackPricing();
  }

  const html = result.data;
  const models: MinimaxModel[] = [];

  // MiniMax new naming convention (2026) - using MiniMax-M* format
  const modelPatterns = [
    {
      // MiniMax-M2.5 - Flagship
      model: 'MiniMax-M2.5',
      inputPattern: /MiniMax-M2\.5[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 204800,
      description: 'Flagship performance model, complex tasks',
    },
    {
      // MiniMax-M2.5-highspeed
      model: 'MiniMax-M2.5-highspeed',
      inputPattern: /MiniMax-M2\.5[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 204800,
      description: 'M2.5 high-speed version, same quality, faster',
    },
    {
      // MiniMax-M2.1 - Strong coding
      model: 'MiniMax-M2.1',
      inputPattern: /MiniMax-M2\.1[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 204800,
      description: 'Strong multi-language coding capabilities',
    },
    {
      // MiniMax-M2.1-highspeed
      model: 'MiniMax-M2.1-highspeed',
      inputPattern: /MiniMax-M2\.1[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 204800,
      description: 'M2.1 high-speed version, same quality, faster',
    },
    {
      // MiniMax-M2 - For efficient coding and Agent workflows
      model: 'MiniMax-M2',
      inputPattern: /MiniMax-M2[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 204800,
      description: 'For efficient coding and Agent workflows',
    },
  ];

  // Parse prices from HTML (context cache support available for some models)
  for (const pattern of modelPatterns) {
    const inputMatch = html.match(pattern.inputPattern);
    const outputMatch = html.match(/output[：:]\s*¥￥?(\s*[\d.]+)\s*\/\s*¥￥?(\s*[\d.]+)/i);
    const cachedReadMatch = html.match(/cached[：:]\s*¥￥?(\s*[\d.]+)\s*\/\s*¥￥?(\s*[\d.]+)/i);
    const cachedWriteMatch = html.match(/cached[：:]\s*¥￥?(\s*[\d.]+)\s*\/\s*¥￥?(\s*[\d.]+)/i);

    if (inputMatch && outputMatch) {
      const inputPrice = parseFloat(inputMatch[1].replace(/[¥￥\s]/g, ''));
      const outputPrice = parseFloat(outputMatch[1].replace(/[¥￥\s]/g, ''));
      const cachedReadPrice = cachedReadMatch ? parseFloat(cachedReadMatch[1].replace(/[¥￥\s]/g, '')) : undefined;
      const cachedWritePrice = cachedWriteMatch ? parseFloat(cachedWriteMatch[1].replace(/[¥￥\s]/g, '')) : undefined;

      models.push({
        model: pattern.model,
        inputPrice,
        outputPrice,
        contextWindow: pattern.context,
        cachedReadPrice,
        cachedWritePrice,
        description: pattern.description,
      });
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
 * Fallback pricing data (for when HTML parsing fails)
 * Prices in CNY per 1M tokens
 */
function getFallbackPricing(): MinimaxModel[] {
  return [
    // Text models (LLM)
    {
      model: 'MiniMax-M2.5',
      inputPrice: 2.1,
      outputPrice: 8.4,
      contextWindow: 204800,
      description: 'Flagship performance model, complex tasks',
    },
    {
      model: 'MiniMax-M2.5-highspeed',
      inputPrice: 4.2,
      outputPrice: 16.8,
      contextWindow: 204800,
      description: 'M2.5 high-speed version, same quality, faster',
    },
    {
      model: 'MiniMax-M2.1',
      inputPrice: 2.1,
      outputPrice: 8.4,
      contextWindow: 204800,
      description: 'Strong multi-language coding capabilities',
    },
    {
      model: 'MiniMax-M2.1-highspeed',
      inputPrice: 4.2,
      outputPrice: 16.8,
      contextWindow: 204800,
      description: 'M2.1 high-speed version, same quality, faster',
    },
    {
      model: 'MiniMax-M2',
      inputPrice: 2.1,
      outputPrice: 8.4,
      contextWindow: 204800,
      description: 'For efficient coding and Agent workflows',
    },
  ];
}

export async function scrapeMinimaxDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Minimax pricing...');

    const models = await fetchMinimaxPricing();

    console.log(`📦 Found ${models.length} models from Minimax`);
    console.log(`✅ Minimax scrape completed in ${Date.now() - startTime}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

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
          currency: 'CNY', // Minimax prices are in CNY
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;

    return {
      source: 'Minimax',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Minimax scrape failed:', error);
    return {
      source: 'Minimax',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeMinimaxDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
