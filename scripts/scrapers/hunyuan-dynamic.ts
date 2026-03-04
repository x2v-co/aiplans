/**
 * Hunyuan / 腾讯混元 API Scraper - Dynamic fetching from pricing page
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const HUNYUAN_PRICING_URL = 'https://cloud.tencent.com/document/product/1729/97731';

interface HunyuanModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
}

/**
 * Fetch and parse Hunyuan pricing from their website
 */
async function fetchHunyuanPricing(): Promise<HunyuanModel[]> {
  const result = await fetchHTML(HUNYUAN_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Hunyuan pricing page, using fallback data');
    return getFallbackPricing();
  }

  const html = result.data;
  const models: HunyuanModel[] = [];

  // Known Hunyuan model patterns (2025-2026)
  const modelPatterns = [
    {
      model: 'hunyuan-pro',
      inputPattern: /hunyuan-pro[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
    {
      model: 'hunyuan-lite',
      inputPattern: /hunyuan-lite[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
    {
      model: 'hunyuan-standard',
      inputPattern: /hunyuan-standard[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
    {
      model: 'hunyuan-turbo',
      inputPattern: /hunyuan-turbo[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
  ];

  for (const pattern of modelPatterns) {
    const priceMatch = html.match(pattern.inputPattern);

    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/[¥￥\s]/g, ''));
      // Hunyuan charges same rate for input/output
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
 * Fallback pricing data (as of 2026)
 * Prices in CNY per 1M tokens
 */
function getFallbackPricing(): HunyuanModel[] {
  return [
    {
      model: 'hunyuan-pro',
      inputPrice: 15.00,
      outputPrice: 15.00,
      contextWindow: 128000,
    },
    {
      model: 'hunyuan-lite',
      inputPrice: 3.00,
      outputPrice: 3.00,
      contextWindow: 128000,
    },
    {
      model: 'hunyuan-standard',
      inputPrice: 6.00,
      outputPrice: 6.00,
      contextWindow: 128000,
    },
    {
      model: 'hunyuan-turbo',
      inputPrice: 1.50,
      outputPrice: 1.50,
      contextWindow: 128000,
    },
    {
      model: 'hunyuan-vision',
      inputPrice: 15.00,
      outputPrice: 15.00,
      contextWindow: 8192,
    },
  ];
}

export async function scrapeHunyuanDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Hunyuan pricing...');

    const models = await fetchHunyuanPricing();

    console.log(`📦 Found ${models.length} models from Hunyuan`);

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
          currency: 'CNY', // Hunyuan prices are in CNY
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Hunyuan scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Hunyuan-Tencent',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Hunyuan scrape failed:', error);
    return {
      source: 'Hunyuan-Tencent',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeHunyuanDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
