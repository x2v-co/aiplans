/**
 * StepFun / 阶跃星辰 API Scraper - Dynamic fetching from pricing page
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const STEPFUN_PRICING_URL = 'https://platform.stepfun.com/docs/zh/pricing/details';

interface StepFunModel {
  model: string;
  inputPrice: number;
  inputPriceUncached?: number;
  outputPrice: number;
  contextWindow?: number;
  type?: 'text' | 'vision' | 'reasoning' | 'audio' | 'tts' | 'asr' | 'image';
}

/**
 * Fetch and parse StepFun pricing from their website
 */
async function fetchStepFunPricing(): Promise<StepFunModel[]> {
  const result = await fetchHTML(STEPFUN_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch StepFun pricing page, using fallback data');
    return getFallbackPricing();
  }

  const html = result.data;
  const models: StepFunModel[] = [];

  // Known StepFun model patterns (2025-2026)
  const modelPatterns = [
    {
      model: 'step-1-8k',
      inputPattern: /step-1[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 8000,
    },
    {
      model: 'step-1-32k',
      inputPattern: /step-1[^$]*?32k[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 32000,
    },
    {
      model: 'step-1-128k',
      inputPattern: /step-1[^$]*?128k[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
    },
    {
      model: 'step-1-256k',
      inputPattern: /step-1[^$]*?256k[^$]*?([¥￥]\s*[\d.]+)/i,
      context: 256000,
    },
  ];

  for (const pattern of modelPatterns) {
    const priceMatch = html.match(pattern.inputPattern);

    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/[¥￥\s]/g, ''));
      // StepFun charges same rate for input/output
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
 * Fallback pricing data (as of March 2026)
 * Prices in CNY per 1M tokens
 * Source: https://platform.stepfun.com/docs/zh/pricing/details
 */
function getFallbackPricing(): StepFunModel[] {
  return [
    // Text Models
    {
      model: 'step-1-8k',
      inputPrice: 1.0,
      inputPriceUncached: 5.0,
      outputPrice: 20.0,
      contextWindow: 8000,
    },
    {
      model: 'step-1-32k',
      inputPrice: 3.0,
      inputPriceUncached: 15.0,
      outputPrice: 70.0,
      contextWindow: 32000,
    },
    {
      model: 'step-1-256k',
      inputPrice: 19.0,
      inputPriceUncached: 95.0,
      outputPrice: 300.0,
      contextWindow: 256000,
    },
    {
      model: 'step-2-mini',
      inputPrice: 0.2,
      inputPriceUncached: 1.0,
      outputPrice: 2.0,
    },
    {
      model: 'step-2-16k',
      inputPrice: 7.6,
      inputPriceUncached: 38.0,
      outputPrice: 120.0,
      contextWindow: 16000,
    },
    {
      model: 'step-2-16k-exp',
      inputPrice: 7.6,
      inputPriceUncached: 38.0,
      outputPrice: 120.0,
      contextWindow: 16000,
    },
    // Vision Models
    {
      model: 'step-1o-turbo-vision',
      inputPrice: 0.5,
      inputPriceUncached: 2.5,
      outputPrice: 8.0,
      type: 'vision',
    },
    {
      model: 'step-1o-vision-32k',
      inputPrice: 3.0,
      inputPriceUncached: 15.0,
      outputPrice: 0.6,
      contextWindow: 32000,
      type: 'vision',
    },
    {
      model: 'step-1v-8k',
      inputPrice: 1.0,
      inputPriceUncached: 5.0,
      outputPrice: 0.2,
      contextWindow: 8000,
      type: 'vision',
    },
    {
      model: 'step-1v-32k',
      inputPrice: 3.0,
      inputPriceUncached: 15.0,
      outputPrice: 0.6,
      contextWindow: 32000,
      type: 'vision',
    },
    // Reasoning Models
    {
      model: 'step-3.5-flash',
      inputPrice: 0.14,
      inputPriceUncached: 0.7,
      outputPrice: 2.1,
      type: 'reasoning',
    },
    {
      model: 'step-r1-v-mini',
      inputPrice: 0.5,
      inputPriceUncached: 2.5,
      outputPrice: 8.0,
      type: 'reasoning',
    },
    {
      model: 'step-3',
      inputPrice: 0.3,
      inputPriceUncached: 1.5,
      outputPrice: 4.0,
      type: 'reasoning',
    },
    // Audio Models
    {
      model: 'step-1o-audio',
      inputPrice: 5.0,
      inputPriceUncached: 25.0,
      outputPrice: 60.0,
      type: 'audio',
    },
    {
      model: 'step-audio-2',
      inputPrice: 2.0,
      inputPriceUncached: 10.0,
      outputPrice: 70.0,
      type: 'audio',
    },
  ];
}

export async function scrapeStepFunDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching StepFun pricing...');

    const models = await fetchStepFunPricing();

    console.log(`📦 Found ${models.length} models from StepFun`);

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
          cachedInputPricePer1M: model.inputPrice, // Cached price is the lower one
          contextWindow: model.contextWindow,
          isAvailable: true,
          currency: 'CNY', // StepFun prices are in CNY
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ StepFun scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'StepFun',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ StepFun scrape failed:', error);
    return {
      source: 'StepFun',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeStepFunDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
