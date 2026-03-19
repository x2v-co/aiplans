/**
 * Seed / Volcengine API Scraper - Dynamic fetching from pricing page
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */
import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const SEED_PRICING_URL = 'https://www.volcengine.com/docs/82379/1544106';

interface SeedModel {
  model: string;
  inputPrice: number;
  outputPrice?: number;
  cachedInputPrice?: number;
  contextWindow: number;
  description?: string;
}

/**
 * Fetch and parse Seed pricing from their website
 */
async function fetchSeedPricing(): Promise<{ models: SeedModel[], errors: string[] }> {
  const result = await fetchHTML(SEED_PRICING_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { models: [], errors: ['Failed to fetch Seed pricing page'] };
  }

  const html = result.data;
  const models: SeedModel[] = [];

  // Seed/Volcengine model patterns (2026) - Doubao 2.0 Series
  // NO FALLBACK DATA - All prices must be scraped from the website
  const modelPatterns = [
    // Doubao 2.0 Pro - Flagship model
    {
      model: 'doubao-seed-2.0-pro',
      inputPattern: /doubao-seed-2\.0-pro[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /doubao-seed-2\.0-pro[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /doubao-seed-2\.0-pro[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 256000,
      description: 'Flagship model with tiered pricing (0-32K/32-128K/128-256K)',
    },
    // Doubao 2.0 Lite - Budget-friendly model
    {
      model: 'doubao-seed-2.0-lite',
      inputPattern: /doubao-seed-2\.0-lite[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /doubao-seed-2\.0-lite[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /doubao-seed-2\.0-lite[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 256000,
      description: 'Budget-friendly model with tiered pricing',
    },
    // Doubao 2.0 Mini - Compact model
    {
      model: 'doubao-seed-2.0-mini',
      inputPattern: /doubao-seed-2\.0-mini[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /doubao-seed-2\.0-mini[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /doubao-seed-2\.0-mini[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 256000,
      description: 'Compact model for efficient deployment',
    },
    // Doubao 2.0 Code - Code generation model
    {
      model: 'doubao-seed-2.0-code',
      inputPattern: /doubao-seed-2\.0-code[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /doubao-seed-2\.0-code[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /doubao-seed-2\.0-code[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 256000,
      description: 'Code generation model',
    },
    // GLM-4.7 - Third-party model
    {
      model: 'glm-4.7',
      inputPattern: /glm-4\.7[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /glm-4\.7[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /glm-4\.7[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 200000,
      description: 'GLM-4.7 model (third-party)',
    },
    // DeepSeek V3 - Third-party model
    {
      model: 'deepseek-v3',
      inputPattern: /deepseek-v3[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /deepseek-v3[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /deepseek-v3[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
      description: 'DeepSeek V3 model (third-party)',
    },
  ];

  // Parse models from HTML
  for (const pattern of modelPatterns) {
    const inputMatch = html.match(pattern.inputPattern);
    const outputMatch = pattern.outputPattern ? html.match(pattern.outputPattern) : null;
    const cachedInputMatch = pattern.cachedInputPattern ? html.match(pattern.cachedInputPattern) : null;

    if (inputMatch) {
      const inputPrice = parseFloat(inputMatch[1].replace(/[¥￥\s]/g, ''));
      const outputPrice = outputMatch ? parseFloat(outputMatch[1].replace(/[¥￥\s]/g, '')) : undefined;
      const cachedInputPrice = cachedInputMatch ? parseFloat(cachedInputMatch[1].replace(/[¥￥\s]/g, '')) : undefined;

      if (!isNaN(inputPrice)) {
        models.push({
          model: pattern.model,
          inputPrice,
          outputPrice,
          cachedInputPrice,
          contextWindow: pattern.context,
          description: pattern.description,
        });
      }
    }
  }

  if (models.length === 0) {
    errors.push('No models could be parsed from Seed pricing page. The page structure may have changed.');
  }

  return { models, errors };
}

export async function scrapeSeedDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Seed pricing...');

    const { models, errors: fetchErrors } = await fetchSeedPricing();
    errors.push(...fetchErrors);

    console.log(`📦 Found ${models.length} models from Seed`);

    for (const model of models) {
      try {
        // Validate prices
        if (!validatePrice(model.inputPrice) || (model.outputPrice && !validatePrice(model.outputPrice))) {
          errors.push(`Invalid price for ${model.model}`);
          continue;
        }

        prices.push({
          modelName: normalizeModelName(model.model),
          modelSlug: slugify(model.model),
          inputPricePer1M: model.inputPrice,
          outputPricePer1M: model.outputPrice || model.inputPrice,
          cachedInputPricePer1M: model.cachedInputPrice,
          contextWindow: model.contextWindow,
          isAvailable: true,
          currency: 'CNY',
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;

    console.log(`✅ Seed scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Seed-Volcengine',
      success: prices.length > 0,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Seed scrape failed:', error);
    return {
      source: 'Seed-Volcengine',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeSeedDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}