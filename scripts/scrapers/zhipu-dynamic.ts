/**
 * Zhipu AI / ChatGLM API Scraper - Dynamic fetching from pricing page
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const ZHIPU_PRICING_URL = 'https://bigmodel.cn/pricing';

interface ZhipuModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
}

/**
 * Fetch and parse Zhipu pricing from their website
 */
async function fetchZhipuPricing(): Promise<ZhipuModel[]> {
  const result = await fetchHTML(ZHIPU_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Zhipu pricing page, using fallback data');
    return getFallbackPricing();
  }

  const html = result.data;
  const models: ZhipuModel[] = [];

  // Known Zhipu model patterns (2025-2026)
  const modelPatterns = [
    {
      model: 'glm-4-plus',
      inputPattern: /glm-4-plus[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
    {
      model: 'glm-4-air',
      inputPattern: /glm-4-air[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
    {
      model: 'glm-4-flash',
      inputPattern: /glm-4-flash[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
    {
      model: 'glm-3-turbo',
      inputPattern: /glm-3-turbo[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
    {
      model: 'glm-4-0520',
      inputPattern: /glm-4[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
    {
      model: 'glm-4-long',
      inputPattern: /glm-4-long[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 1000000,
    },
    {
      model: 'glm-4v-plus',
      inputPattern: /glm-4v-plus[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 8192,
    },
  ];

  for (const pattern of modelPatterns) {
    const priceMatch = html.match(pattern.inputPattern);

    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/[¥￥\s]/g, ''));
      // Zhipu charges different rates for input/output
      // Try to find both prices
      const inputPattern = new RegExp(`${pattern.model}[^0-9¥￥]*?输入[^0-9¥￥]*?([¥￥]\\s*[\\d.]+)`, 'i');
      const outputPattern = new RegExp(`${pattern.model}[^0-9¥￥]*?输出[^0-9¥￥]*?([¥￥]\\s*[\\d.]+)`, 'i');

      const inputMatch = html.match(inputPattern);
      const outputMatch = html.match(outputPattern);

      let inputPrice = price;
      let outputPrice = price;

      if (inputMatch && outputMatch) {
        inputPrice = parseFloat(inputMatch[1].replace(/[¥￥\s]/g, ''));
        outputPrice = parseFloat(outputMatch[1].replace(/[¥￥\s]/g, ''));
      }

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
 * Fallback pricing data (as of 2026)
 * Prices in CNY per 1M tokens
 */
function getFallbackPricing(): ZhipuModel[] {
  return [
    {
      model: 'glm-4-plus',
      inputPrice: 5.00,
      outputPrice: 5.00,
      contextWindow: 128000,
    },
    {
      model: 'glm-4-air',
      inputPrice: 1.00,
      outputPrice: 1.00,
      contextWindow: 128000,
    },
    {
      model: 'glm-4-flash',
      inputPrice: 0.15,
      outputPrice: 0.15,
      contextWindow: 128000,
    },
    {
      model: 'glm-3-turbo',
      inputPrice: 0.05,
      outputPrice: 0.05,
      contextWindow: 128000,
    },
    {
      model: 'glm-4-long',
      inputPrice: 2.00,
      outputPrice: 2.00,
      contextWindow: 1000000,
    },
    {
      model: 'glm-4v-plus',
      inputPrice: 7.00,
      outputPrice: 7.00,
      contextWindow: 8192,
    },
    {
      model: 'glm-4-0520',
      inputPrice: 2.50,
      outputPrice: 2.50,
      contextWindow: 128000,
    },
  ];
}

export async function scrapeZhipuDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Zhipu pricing...');

    const models = await fetchZhipuPricing();

    console.log(`📦 Found ${models.length} models from Zhipu`);

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
          currency: 'CNY', // Zhipu prices are in CNY
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Zhipu scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Zhipu-AI',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Zhipu scrape failed:', error);
    return {
      source: 'Zhipu-AI',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeZhipuDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
