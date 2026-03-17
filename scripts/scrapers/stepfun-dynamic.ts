/**
 * StepFun / 阶跃星辰 API Scraper - Dynamic fetching from pricing page
 * NO FALLBACK DATA - Fails cleanly when scraping fails
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
async function fetchStepFunPricing(): Promise<{ models: StepFunModel[], errors: string[] }> {
  const result = await fetchHTML(STEPFUN_PRICING_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { models: [], errors: ['Failed to fetch StepFun pricing page'] };
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

  if (models.length === 0) {
    errors.push('No models could be parsed from StepFun pricing page. The page structure may have changed.');
  }

  return { models, errors };
}

export async function scrapeStepFunDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching StepFun pricing...');

    const { models, errors: fetchErrors } = await fetchStepFunPricing();
    errors.push(...fetchErrors);

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
          currency: 'CNY',
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
      success: prices.length > 0,
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