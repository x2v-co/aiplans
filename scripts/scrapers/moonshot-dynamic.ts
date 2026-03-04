/**
 * Moonshot / Kimi API Scraper - Dynamic fetching from pricing page
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const MOONSHOT_PRICING_URL = 'https://platform.moonshot.cn/docs/pricing/chat';

interface MoonshotModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
}

/**
 * Fetch and parse Moonshot pricing from their website
 */
async function fetchMoonshotPricing(): Promise<MoonshotModel[]> {
  const result = await fetchHTML(MOONSHOT_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Moonshot pricing page, using fallback data');
    return getFallbackPricing();
  }

  const html = result.data;
  const models: MoonshotModel[] = [];

  // Known Moonshot model patterns (2025-2026)
  const modelPatterns = [
    {
      model: 'moonshot-v1-8k',
      inputPattern: /moonshot-v1-8k[^$]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /moonshot-v1-8k[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 8000,
    },
    {
      model: 'moonshot-v1-32k',
      inputPattern: /moonshot-v1-32k[^$]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /moonshot-v1-32k[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 32000,
    },
    {
      model: 'moonshot-v1-128k',
      inputPattern: /moonshot-v1-128k[^$]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /moonshot-v1-128k[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
  ];

  for (const pattern of modelPatterns) {
    const priceMatches = html.match(new RegExp(pattern.model, 'gi'));

    if (priceMatches) {
      // Moonshot prices are typically in a table or card format
      // Try to extract the price
      const pricePattern = new RegExp(`${pattern.model}[^0-9¥￥]*?([¥￥]\\s*[\\d.]+)`, 'gi');
      const prices = [...html.matchAll(pricePattern)];

      if (prices.length >= 2) {
        const inputPrice = parseFloat(prices[0][1].replace(/[¥￥\s]/g, ''));
        const outputPrice = parseFloat(prices[1][1].replace(/[¥￥\s]/g, ''));

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
  }

  // If no models found, use fallback
  if (models.length === 0) {
    console.warn('No models parsed from HTML, using fallback data');
    return getFallbackPricing();
  }

  return models;
}

/**
 * Fallback pricing data (as of 2026)
 * Prices in CNY per 1M tokens
 */
function getFallbackPricing(): MoonshotModel[] {
  return [
    {
      model: 'moonshot-v1-8k',
      inputPrice: 0.012,
      outputPrice: 0.012,
      contextWindow: 8000,
    },
    {
      model: 'moonshot-v1-32k',
      inputPrice: 0.024,
      outputPrice: 0.024,
      contextWindow: 32000,
    },
    {
      model: 'moonshot-v1-128k',
      inputPrice: 0.06,
      outputPrice: 0.06,
      contextWindow: 128000,
    },
  ];
}

export async function scrapeMoonshotDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Moonshot pricing...');

    const models = await fetchMoonshotPricing();

    console.log(`📦 Found ${models.length} models from Moonshot`);

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
          currency: 'CNY', // Moonshot prices are in CNY
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Moonshot scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Moonshot-Kimi',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Moonshot scrape failed:', error);
    return {
      source: 'Moonshot-Kimi',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeMoonshotDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
