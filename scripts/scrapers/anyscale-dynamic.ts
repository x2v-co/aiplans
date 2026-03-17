/**
 * Anyscale API Scraper - Dynamic fetching from pricing page
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const ANYSCALE_PRICING_URL = 'https://www.anyscale.com/pricing';

interface AnyscaleModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
}

/**
 * Fetch and parse Anyscale pricing from their website
 */
async function fetchAnyscalePricing(): Promise<{ models: AnyscaleModel[], errors: string[] }> {
  const result = await fetchHTML(ANYSCALE_PRICING_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { models: [], errors: ['Failed to fetch Anyscale pricing page'] };
  }

  const html = result.data;
  const models: AnyscaleModel[] = [];

  // Known Anyscale model patterns (2025-2026)
  const modelPatterns = [
    {
      model: 'llama-3.1-405b-instruct',
      inputPattern: /llama.*405b[^$]*?\$?([\d.]+)\s*per/i,
      context: 131072,
    },
    {
      model: 'llama-3.1-70b-instruct',
      inputPattern: /llama.*70b[^$]*?\$?([\d.]+)\s*per/i,
      context: 131072,
    },
    {
      model: 'mixtral-8x7b-instruct',
      inputPattern: /mixtral.*8x7b[^$]*?\$?([\d.]+)\s*per/i,
      context: 32000,
    },
  ];

  for (const pattern of modelPatterns) {
    const priceMatch = html.match(pattern.inputPattern);

    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      // Anyscale charges same rate for input/output
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
    errors.push('No models could be parsed from Anyscale pricing page. The page structure may have changed.');
  }

  return { models, errors };
}

export async function scrapeAnyscaleDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Anyscale pricing...');

    const { models, errors: fetchErrors } = await fetchAnyscalePricing();
    errors.push(...fetchErrors);

    console.log(`📦 Found ${models.length} models from Anyscale`);

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
          currency: 'USD',
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Anyscale scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Anyscale',
      success: prices.length > 0,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Anyscale scrape failed:', error);
    return {
      source: 'Anyscale',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeAnyscaleDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}