/**
 * Seed / Volcengine API Scraper - Dynamic fetching from pricing page
 */
import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const SEED_PRICING_URL = 'https://www.volcengine.com/docs/82379/1544106';

interface SeedModel {
  model: string;
  inputPrice: number;
  outputPrice?: number;  // Some models have different output pricing
  cachedInputPrice?: number;  // Cached input price
  contextWindow: number;
  description?: string;
  tier?: string;  // Input length tier: '0-32k', '32-128k', '128-256k'
}

/**
 * Fetch and parse Seed pricing from their website
 */
async function fetchSeedPricing(): Promise<SeedModel[]> {
  const result = await fetchHTML(SEED_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Seed pricing page, using fallback data');
    return getFallbackPricing();
  }

  const html = result.data;
  const models: SeedModel[] = [];

  // Seed/Volcengine model patterns (2026) - Doubao 2.0 Series
  const modelPatterns = [
    // Doubao 2.0 Pro - Flagship model
    {
      model: 'doubao-seed-2.0-pro',
      inputPattern: /doubao-seed-2\.0-pro[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /doubao-seed-2\.0-pro[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /doubao-seed-2\.0-pro[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 256000,
      defaultInput: 3.20,
      defaultOutput: 16.00,
      defaultCachedInput: 0.64,
      description: 'Flagship model with tiered pricing (0-32K/32-128K/128-256K)',
    },
    // Doubao 2.0 Lite - Budget-friendly model
    {
      model: 'doubao-seed-2.0-lite',
      inputPattern: /doubao-seed-2\.0-lite[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /doubao-seed-2\.0-lite[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /doubao-seed-2\.0-lite[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 256000,
      defaultInput: 0.60,
      defaultOutput: 3.60,
      defaultCachedInput: 0.12,
      description: 'Budget-friendly model with tiered pricing',
    },
    // Doubao 2.0 Mini - Compact model
    {
      model: 'doubao-seed-2.0-mini',
      inputPattern: /doubao-seed-2\.0-mini[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /doubao-seed-2\.0-mini[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /doubao-seed-2\.0-mini[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 256000,
      defaultInput: 0.20,
      defaultOutput: 2.00,
      defaultCachedInput: 0.04,
      description: 'Compact model for efficient deployment',
    },
    // Doubao 2.0 Code - Code generation model
    {
      model: 'doubao-seed-2.0-code',
      inputPattern: /doubao-seed-2\.0-code[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /doubao-seed-2\.0-code[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /doubao-seed-2\.0-code[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 256000,
      defaultInput: 3.20,
      defaultOutput: 16.00,
      defaultCachedInput: 0.64,
      description: 'Code generation model',
    },
    // GLM-4.7 - Third-party model
    {
      model: 'glm-4.7',
      inputPattern: /glm-4\.7[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /glm-4\.7[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /glm-4\.7[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 200000,
      defaultInput: 2.00,
      defaultOutput: 8.00,
      defaultCachedInput: 0.40,
      description: 'GLM-4.7 model (third-party)',
    },
    // DeepSeek V3.2 - Third-party model
    {
      model: 'deepseek-v3.2',
      inputPattern: /deepseek-v3\.2[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /deepseek-v3\.2[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /deepseek-v3\.2[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
      defaultInput: 2.00,
      defaultOutput: 3.00,
      defaultCachedInput: 0.40,
      description: 'DeepSeek V3.2 model (third-party)',
    },
    // DeepSeek V3.1 - Third-party model
    {
      model: 'deepseek-v3.1',
      inputPattern: /deepseek-v3\.1[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /deepseek-v3\.1[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /deepseek-v3\.1[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
      defaultInput: 4.00,
      defaultOutput: 12.00,
      defaultCachedInput: 0.80,
      description: 'DeepSeek V3.1 model (third-party)',
    },
    // DeepSeek V3 - Third-party model
    {
      model: 'deepseek-v3',
      inputPattern: /deepseek-v3[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /deepseek-v3[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /deepseek-v3[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
      defaultInput: 2.00,
      defaultOutput: 8.00,
      defaultCachedInput: 0.40,
      description: 'DeepSeek V3 model (third-party)',
    },
    // DeepSeek R1 - Third-party reasoning model
    {
      model: 'deepseek-r1',
      inputPattern: /deepseek-r1[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /deepseek-r1[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /deepseek-r1[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
      defaultInput: 4.00,
      defaultOutput: 16.00,
      defaultCachedInput: 0.80,
      description: 'DeepSeek R1 reasoning model (third-party)',
    },
    // Kimi K2 - Third-party model
    {
      model: 'kimi-k2',
      inputPattern: /kimi-k2[^¥]*?([¥￥]\s*[\d.]+)/i,
      outputPattern: /kimi-k2[^¥]*?输入[^¥]*?输出[^¥]*?([¥￥]\s*[\d.]+)/i,
      cachedInputPattern: /kimi-k2[^¥]*?缓存[^¥]*?([¥￥]\s*[\d.]+)/i,
      context: 128000,
      defaultInput: 4.00,
      defaultOutput: 16.00,
      defaultCachedInput: 0.80,
      description: 'Kimi K2 model (third-party)',
    },
  ];

  // Parse models from HTML
  for (const pattern of modelPatterns) {
    const inputMatch = html.match(pattern.inputPattern);
    const outputMatch = pattern.outputPattern ? html.match(pattern.outputPattern) : null;
    const cachedInputMatch = pattern.cachedInputPattern ? html.match(pattern.cachedInputPattern) : null;

    if (inputMatch) {
      const inputPrice = parseFloat(inputMatch[1].replace(/[¥￥\s]/g, ''));
      const outputPrice = outputMatch ? parseFloat(outputMatch[1].replace(/[¥￥\s]/g, '')) : pattern.defaultOutput;
      const cachedInputPrice = cachedInputMatch ? parseFloat(cachedInputMatch[1].replace(/[¥￥\s]/g, '')) : pattern.defaultCachedInput;

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

  // If no models found, use fallback
  if (models.length === 0) {
    console.warn('No models parsed from HTML, using fallback data');
    return getFallbackPricing();
  }

  return models;
}

/**
 * Fallback pricing data (for when HTML parsing fails)
 * Prices in CNY per 1M tokens (using base tier 0-32K pricing)
 */
function getFallbackPricing(): SeedModel[] {
  return [
    // Doubao 2.0 Pro models (flagship)
    {
      model: 'doubao-seed-2.0-pro',
      inputPrice: 3.20,
      outputPrice: 16.00,
      cachedInputPrice: 0.64,
      contextWindow: 256000,
      description: 'Flagship model, tiered pricing: ¥3.2-9.6 input, ¥16-48 output',
    },
    // Doubao 2.0 Lite (budget-friendly)
    {
      model: 'doubao-seed-2.0-lite',
      inputPrice: 0.60,
      outputPrice: 3.60,
      cachedInputPrice: 0.12,
      contextWindow: 256000,
      description: 'Budget-friendly model, tiered pricing: ¥0.6-1.8 input, ¥3.6-10.8 output',
    },
    // Doubao 2.0 Mini (compact)
    {
      model: 'doubao-seed-2.0-mini',
      inputPrice: 0.20,
      outputPrice: 2.00,
      cachedInputPrice: 0.04,
      contextWindow: 256000,
      description: 'Compact model, tiered pricing: ¥0.2-0.8 input, ¥2-8 output',
    },
    // Doubao 2.0 Code (code generation)
    {
      model: 'doubao-seed-2.0-code',
      inputPrice: 3.20,
      outputPrice: 16.00,
      cachedInputPrice: 0.64,
      contextWindow: 256000,
      description: 'Code generation model, tiered pricing: ¥3.2-9.6 input, ¥16-48 output',
    },
    // Third-party models available on Volcengine
    {
      model: 'glm-4.7',
      inputPrice: 2.00,
      outputPrice: 8.00,
      cachedInputPrice: 0.40,
      contextWindow: 200000,
      description: 'GLM-4.7 model (third-party), tiered pricing: ¥2-4 input, ¥8-16 output',
    },
    {
      model: 'deepseek-v3.2',
      inputPrice: 2.00,
      outputPrice: 3.00,
      cachedInputPrice: 0.40,
      contextWindow: 128000,
      description: 'DeepSeek V3.2 model (third-party), tiered pricing: ¥2-4 input, ¥3-6 output',
    },
    {
      model: 'deepseek-v3.1',
      inputPrice: 4.00,
      outputPrice: 12.00,
      cachedInputPrice: 0.80,
      contextWindow: 128000,
      description: 'DeepSeek V3.1 model (third-party)',
    },
    {
      model: 'deepseek-v3',
      inputPrice: 2.00,
      outputPrice: 8.00,
      cachedInputPrice: 0.40,
      contextWindow: 128000,
      description: 'DeepSeek V3 model (third-party)',
    },
    {
      model: 'deepseek-r1',
      inputPrice: 4.00,
      outputPrice: 16.00,
      cachedInputPrice: 0.80,
      contextWindow: 128000,
      description: 'DeepSeek R1 reasoning model (third-party)',
    },
    {
      model: 'kimi-k2',
      inputPrice: 4.00,
      outputPrice: 16.00,
      cachedInputPrice: 0.80,
      contextWindow: 128000,
      description: 'Kimi K2 model (third-party)',
    },
  ];
}

export async function scrapeSeedDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Seed pricing...');

    const models = await fetchSeedPricing();

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
          currency: 'CNY', // Seed prices are in CNY
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
      success: true,
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
