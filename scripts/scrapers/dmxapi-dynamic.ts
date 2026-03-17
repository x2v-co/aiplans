/**
 * DMXAPI / 大模型API Scraper - Dynamic fetching from pricing page
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const DMXAPI_PRICING_URL = 'https://www.dmxapi.cn/rmb';

interface DMXAPIModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
}

/**
 * Fetch and parse DMXAPI pricing from their website
 */
async function fetchDMXAPIPricing(): Promise<{ models: DMXAPIModel[], errors: string[] }> {
  const result = await fetchHTML(DMXAPI_PRICING_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { models: [], errors: ['Failed to fetch DMXAPI pricing page'] };
  }

  const html = result.data;
  const models: DMXAPIModel[] = [];

  // DMXAPI is a reseller, pricing varies by model
  // Common models they offer with competitive pricing
  const modelPatterns = [
    {
      model: 'gpt-4o',
      inputPattern: /gpt-4o[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
    {
      model: 'claude-3.5-sonnet',
      inputPattern: /claude.*3.5[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 200000,
    },
    {
      model: 'deepseek-chat',
      inputPattern: /deepseek[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
  ];

  for (const pattern of modelPatterns) {
    const priceMatch = html.match(pattern.inputPattern);

    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/[¥￥\s]/g, ''));
      // DMXAPI charges different rates for input/output
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

  if (models.length === 0) {
    errors.push('No models could be parsed from DMXAPI pricing page. The page structure may have changed.');
  }

  return { models, errors };
}

export async function scrapeDMXAPIDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching DMXAPI pricing...');

    const { models, errors: fetchErrors } = await fetchDMXAPIPricing();
    errors.push(...fetchErrors);

    console.log(`📦 Found ${models.length} models from DMXAPI`);

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
    console.log(`✅ DMXAPI scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'DMXAPI',
      success: prices.length > 0,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ DMXAPI scrape failed:', error);
    return {
      source: 'DMXAPI',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeDMXAPIDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}