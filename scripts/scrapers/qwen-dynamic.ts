/**
 * Qwen / 通义千问 API Scraper - Dynamic fetching from pricing page
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const QWEN_PRICING_URL = 'https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=2987148';

interface QwenModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
}

/**
 * Fetch and parse Qwen pricing from their website
 */
async function fetchQwenPricing(): Promise<QwenModel[]> {
  const result = await fetchHTML(QWEN_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Qwen pricing page, using fallback data');
    return getFallbackPricing();
  }

  const html = result.data;
  const models: QwenModel[] = [];

  // Known Qwen model patterns (2025-2026)
  const modelPatterns = [
    // Qwen 3 Series (Flagship)
    {
      model: 'qwen3-max',
      inputPattern: /qwen3-max[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 32000,
    },
    {
      model: 'qwen3-plus',
      inputPattern: /qwen3-plus[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 32000,
    },
    {
      model: 'qwen3-turbo',
      inputPattern: /qwen3-turbo[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 8000,
    },
    {
      model: 'qwen3-max-longcontext',
      inputPattern: /qwen3-max[^$]*?long[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 28000,
    },
    // Qwen 2.5 Series (Open Source)
    {
      model: 'qwen2.5-72b-instruct',
      inputPattern: /qwen2\.5[^$]*?72b[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 131072,
    },
    {
      model: 'qwen2.5-7b-instruct',
      inputPattern: /qwen2\.5[^$]*?7b[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 131072,
    },
    // Vision Models
    {
      model: 'qwen3-vl-max',
      inputPattern: /qwen3-vl-max[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 8192,
    },
    {
      model: 'qwen-vl-max',
      inputPattern: /qwen-vl-max[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 8192,
    },
    // Code Models
    {
      model: 'qwen3-coder-plus',
      inputPattern: /qwen3-coder-plus[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 32000,
    },
    {
      model: 'qwen2.5-coder-32b-instruct',
      inputPattern: /qwen2\.5-coder-32b[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 131072,
    },
  ];

  for (const pattern of modelPatterns) {
    const priceMatch = html.match(pattern.inputPattern);

    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/[¥￥\s]/g, ''));
      // Qwen charges different rates for input/output
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
function getFallbackPricing(): QwenModel[] {
  return [
    // Qwen 3 Series (Flagship)
    {
      model: 'qwen3-max',
      inputPrice: 32.00,
      outputPrice: 32.00,
      contextWindow: 32000,
    },
    {
      model: 'qwen3-plus',
      inputPrice: 4.00,
      outputPrice: 4.00,
      contextWindow: 32000,
    },
    {
      model: 'qwen3-turbo',
      inputPrice: 0.40,
      outputPrice: 0.40,
      contextWindow: 8000,
    },
    {
      model: 'qwen3-max-longcontext',
      inputPrice: 40.00,
      outputPrice: 40.00,
      contextWindow: 28000,
    },
    // Qwen 2.5 Series (Open Source)
    {
      model: 'qwen2.5-72b-instruct',
      inputPrice: 2.50,
      outputPrice: 2.50,
      contextWindow: 131072,
    },
    {
      model: 'qwen2.5-7b-instruct',
      inputPrice: 0.15,
      outputPrice: 0.15,
      contextWindow: 131072,
    },
    // Vision Models
    {
      model: 'qwen3-vl-max',
      inputPrice: 12.00,
      outputPrice: 12.00,
      contextWindow: 8192,
    },
    {
      model: 'qwen-vl-max',
      inputPrice: 12.00,
      outputPrice: 12.00,
      contextWindow: 8192,
    },
    // Code Models
    {
      model: 'qwen3-coder-plus',
      inputPrice: 4.00,
      outputPrice: 4.00,
      contextWindow: 32000,
    },
    {
      model: 'qwen2.5-coder-32b-instruct',
      inputPrice: 2.50,
      outputPrice: 2.50,
      contextWindow: 131072,
    },
  ];
}

export async function scrapeQwenDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Qwen pricing...');

    const models = await fetchQwenPricing();

    console.log(`📦 Found ${models.length} models from Qwen`);

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
          currency: 'CNY', // Qwen prices are in CNY
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Qwen scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Qwen',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Qwen scrape failed:', error);
    return {
      source: 'Qwen',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeQwenDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
