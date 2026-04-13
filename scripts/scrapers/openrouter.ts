/**
 * OpenRouter API Scraper - Fetches pricing from OpenRouter /v1/models API
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;  // Price per token ($/token) - INPUT
    completion: string;  // Price per token ($/token) - OUTPUT
    input_cache_read?: string;  // Cache price per token ($/token) - CACHE
  };
  context_length: number;
  architecture?: {
    modality?: string;
  };
}

/**
 * Provider name normalization mapping
 * Maps OpenRouter provider names to standardized names
 */
const PROVIDER_NORMALIZATION: Record<string, string> = {
  'openai': 'openai',
  'anthropic': 'anthropic',
  'google': 'google-gemini',
  'google-ai': 'google-gemini',
  'meta': 'meta',
  'meta-llama': 'meta',
  'bytedance': 'bytedance',
  '01-ai': '01-ai',
  'deepseek': 'deepseek',
  'mistralai': 'mistral',
  'qwen': 'qwen',
  'alibaba': 'qwen',
  'zhipuai': 'zhipu',
  'minimax': 'minimax',
  'baai': 'baai',
  'thudm': 'thudm',
  'inflection': 'inflection',
  'cohere': 'cohere',
  'perplexity': 'perplexity',
  'together': 'together-ai',
  'x-ai': 'x-ai',
  'xai': 'x-ai',
  'grok': 'x-ai',
  'sao10k': 'sao10k',
};

/**
 * Normalize OpenRouter provider name
 */
function normalizeProvider(provider: string): string {
  // Handle "openai/" prefix or similar
  const cleaned = provider.replace(/^\/+|\/+$/g, '').toLowerCase();

  // Check against normalization map
  return PROVIDER_NORMALIZATION[cleaned] || cleaned;
}

/**
 * Normalize OpenRouter model name
 * Handles "provider/model" format and other naming variations
 */
function normalizeOpenRouterModelName(id: string, name?: string): string {
  // If id contains "/" (provider/model format), extract model part
  if (id.includes('/')) {
    const parts = id.split('/');
    const modelPart = parts[parts.length - 1] || name || id;

    // Handle "provider/model" format in name
    if (name && name.includes(': ')) {
      return normalizeModelName(name);
    }

    return modelPart;
  }

  // Fall back to original name normalization
  return normalizeModelName(name || id);
}

/**
 * Generate a normalized slug for OpenRouter models
 * Format: provider-model
 */
function generateOpenRouterSlug(id: string): string {
  if (!id.includes('/')) {
    // No provider separator, use the full id
    return slugify(id);
  }

  const parts = id.split('/');
  const provider = normalizeProvider(parts[0]);
  const model = parts.slice(1).join('/'); // Handle cases with multiple /

  return `${provider}-${slugify(model)}`;
}

export async function scrapeOpenRouter(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching OpenRouter models...');

    const response = await fetch(OPENROUTER_API);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const models: OpenRouterModel[] = data.data || [];

    console.log(`📦 Found ${models.length} models from OpenRouter`);

    for (const model of models) {
      try {
        // Skip OpenRouter's own meta/routing pseudo-models — they have no
        // per-token price (openrouter/auto, openrouter/bodybuilder, etc.)
        // These would otherwise fail validation and poison the success flag.
        if (model.id.startsWith('openrouter/')) continue;

        // Convert price per token ($/token) to price per 1M tokens
        // OpenRouter prices are in USD per token
        const inputPrice = parseFloat(model.pricing.prompt) * 1_000_000;
        const outputPrice = parseFloat(model.pricing.completion) * 1_000_000;

        // Get cache price if available
        const cachePrice = model.pricing.input_cache_read
          ? parseFloat(model.pricing.input_cache_read) * 1_000_000
          : undefined;

        // Skip if prices are invalid
        if (!validatePrice(inputPrice) || !validatePrice(outputPrice)) {
          errors.push(`Invalid price for ${model.id}`);
          continue;
        }

        // Skip non-LLM models (but include multimodal models that can process text)
        const modality = model.architecture?.modality || '';
        if (modality && !modality.includes('text')) {
          continue;
        }

        const modelName = normalizeOpenRouterModelName(model.id, model.name);
        const modelSlug = generateOpenRouterSlug(model.id);

        prices.push({
          modelName,
          modelSlug,
          inputPricePer1M: inputPrice,
          outputPricePer1M: outputPrice,
          cachedInputPricePer1M: cachePrice,
          contextWindow: model.context_length,
          isAvailable: true,
          currency: 'USD',
        });
      } catch (error) {
        errors.push(`Error processing ${model.id}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ OpenRouter scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'OpenRouter',
      success: errors.length === 0 && prices.length > 0,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ OpenRouter scrape failed:', error);
    return {
      source: 'OpenRouter',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeOpenRouter().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
