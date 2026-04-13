/**
 * Baidu ERNIE / 千帆 API Scraper - Dynamic fetching from pricing page
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const BAIDU_PRICING_URL = 'https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya';

interface BaiduModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
}

/**
 * Fetch and parse Baidu pricing from their website
 */
async function fetchBaiduPricing(): Promise<{ models: BaiduModel[], errors: string[] }> {
  const result = await fetchHTML(BAIDU_PRICING_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { models: [], errors: ['Failed to fetch Baidu pricing page'] };
  }

  const html = result.data;
  const models: BaiduModel[] = [];

  // Known Baidu ERNIE model patterns (2025-2026)
  const modelPatterns = [
    {
      model: 'ernie-4.0',
      inputPattern: /ernie-4\.0[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
    {
      model: 'ernie-3.5',
      inputPattern: /ernie-3\.5[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
    {
      model: 'ernie-speed',
      inputPattern: /ernie-speed[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
    {
      model: 'ernie-turbo',
      inputPattern: /ernie-turbo[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
    {
      model: 'ernie-lite',
      inputPattern: /ernie-lite[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
  ];

  for (const pattern of modelPatterns) {
    const priceMatch = html.match(pattern.inputPattern);

    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/[¥￥\s]/g, ''));
      // Baidu charges same rate for input/output
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

  if (models.length === 0) {
    errors.push('No models could be parsed from Baidu pricing page. The page structure may have changed.');
  }

  return { models, errors };
}

export async function scrapeBaiduDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Baidu pricing...');

    const { models, errors: fetchErrors } = await fetchBaiduPricing();
    errors.push(...fetchErrors);

    console.log(`📦 Found ${models.length} models from Baidu`);

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
          currency: 'CNY',
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Baidu scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Baidu-ERNIE',
      success: errors.length === 0 && prices.length > 0,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Baidu scrape failed:', error);
    return {
      source: 'Baidu-ERNIE',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeBaiduDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}