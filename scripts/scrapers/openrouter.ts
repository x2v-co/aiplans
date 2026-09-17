/**
 * OpenRouter API Scraper - Fetches pricing from OpenRouter /v1/models API
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPrice, ScrapedPriceVariant, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';
const OPENROUTER_MODEL_URL = 'https://openrouter.ai/models/';

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;  // Price per token ($/token) - INPUT
    completion: string;  // Price per token ($/token) - OUTPUT
    input_cache_read?: string;  // Cache price per token ($/token) - CACHE
  };
  context_length: number;
  created?: number;
  architecture?: {
    modality?: string;
    output_modalities?: string[];
  };
}

interface OpenRouterEndpoint {
  name?: string;
  tag?: string;
  provider_name?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
    input_cache_read?: string;
    discount?: number;
  };
  context_length?: number;
  quantization?: string;
  status?: number;
  uptime_last_30m?: number;
  uptime_last_5m?: number;
  uptime_last_1d?: number;
}

interface OpenRouterEndpointPayload {
  data?: OpenRouterModel & { endpoints?: OpenRouterEndpoint[] };
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

function openRouterModelPage(id: string): string {
  return `${OPENROUTER_MODEL_URL}${id}`;
}

function endpointVariantKey(endpoint: OpenRouterEndpoint): string {
  const provider = endpoint.provider_name || endpoint.tag || 'unknown';
  const tag = endpoint.tag && endpoint.tag.toLowerCase() !== provider.toLowerCase()
    ? `-${endpoint.tag}`
    : '';
  const quant = endpoint.quantization && endpoint.quantization !== 'unknown'
    ? `-${endpoint.quantization}`
    : '';
  const name = endpoint.name ? `-${endpoint.name}` : '';
  return slugify(`${provider}${tag}${quant}${name}`) || 'upstream-provider';
}

function endpointPrice(endpoint: OpenRouterEndpoint): { input: number; output: number; cache?: number } | null {
  const prompt = endpoint.pricing?.prompt;
  const completion = endpoint.pricing?.completion;
  if (prompt == null || completion == null) return null;
  const input = parseFloat(prompt) * 1_000_000;
  const output = parseFloat(completion) * 1_000_000;
  const cache = endpoint.pricing?.input_cache_read
    ? parseFloat(endpoint.pricing.input_cache_read) * 1_000_000
    : undefined;
  if (!validatePrice(input) || !validatePrice(output)) return null;
  if (output > 0 && input > 0 && output < input) return null;
  return { input, output, cache };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }));
  return results;
}

async function fetchEndpointVariants(model: OpenRouterModel, headline: ScrapedPrice): Promise<ScrapedPriceVariant[]> {
  const variants: ScrapedPriceVariant[] = [{
    modelName: headline.modelName,
    modelSlug: headline.modelSlug,
    variantKey: 'openrouter-auto',
    variantName: 'OpenRouter Auto / default route',
    variantKind: 'default_route',
    sourceGroupKey: 'openrouter-auto',
    sourceGroupName: 'OpenRouter Auto / default route',
    sourceUrl: `${OPENROUTER_API}/${model.id}/endpoints`,
    inputPricePer1M: headline.inputPricePer1M,
    outputPricePer1M: headline.outputPricePer1M,
    cachedInputPricePer1M: headline.cachedInputPricePer1M,
    currency: 'USD',
    priceUnit: 'per_1m_tokens',
    isAvailable: true,
    isPublic: true,
    isSelfService: true,
    isPartnerOnly: false,
    isHeadline: true,
    headlineRank: 0,
    headlineReason: 'OpenRouter model-level default route price from /api/v1/models.',
    raw: { id: model.id, pricing: model.pricing },
  }];

  const response = await fetch(`${OPENROUTER_API}/${model.id}/endpoints`, {
    headers: { Accept: 'application/json', 'User-Agent': 'aiplans.dev pricing scraper (+https://aiplans.dev)' },
  });
  if (!response.ok) throw new Error(`OpenRouter endpoints ${model.id}: HTTP ${response.status}`);
  const payload = await response.json() as OpenRouterEndpointPayload;
  for (const endpoint of payload.data?.endpoints ?? []) {
    const price = endpointPrice(endpoint);
    if (!price) continue;
    const key = `upstream-${endpointVariantKey(endpoint)}`;
    variants.push({
      modelName: headline.modelName,
      modelSlug: headline.modelSlug,
      variantKey: key,
      variantName: endpoint.name || endpoint.provider_name || key,
      variantKind: 'upstream_provider',
      sourceGroupKey: endpoint.tag,
      sourceGroupName: endpoint.provider_name,
      sourceUrl: `${OPENROUTER_API}/${model.id}/endpoints`,
      inputPricePer1M: price.input,
      outputPricePer1M: price.output,
      cachedInputPricePer1M: price.cache,
      currency: 'USD',
      priceUnit: 'per_1m_tokens',
      isAvailable: endpoint.status == null || endpoint.status === 0,
      isPublic: true,
      isSelfService: true,
      isPartnerOnly: false,
      isHeadline: false,
      headlineRank: 10,
      constraints: {
        context_length: endpoint.context_length,
        quantization: endpoint.quantization,
        uptime_last_30m: endpoint.uptime_last_30m,
        uptime_last_5m: endpoint.uptime_last_5m,
        uptime_last_1d: endpoint.uptime_last_1d,
        discount: endpoint.pricing?.discount,
      },
      raw: endpoint as Record<string, unknown>,
      notes: 'OpenRouter upstream endpoint price; model-level auto route remains the headline comparison price.',
    });
  }
  return variants;
}

export async function scrapeOpenRouter(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let prices: ScrapedPrice[] = [];
  let pricedModels: OpenRouterModel[] = [];

  try {
    console.log('🔄 Fetching OpenRouter models...');

    const response = await fetch(OPENROUTER_API);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const models: OpenRouterModel[] = data.data || [];

    // Dated snapshot ids (openai/gpt-4o-2024-05-13 at $5/$15) collapse onto
    // the base model in our catalog and overwrite the current undated row.
    // When the undated id exists, it is the canonical current price — skip
    // the snapshot. Snapshots without a base id (claude-haiku-4-5-20251001)
    // stay, because there the dated id is the only listing.
    const ids = new Set(models.map(m => m.id));
    const isDatedSnapshotOf = (id: string) => {
      const match = id.match(/^(.*)-\d{4}-\d{2}-\d{2}$/);
      return match != null && ids.has(match[1]);
    };

    console.log(`📦 Found ${models.length} models from OpenRouter`);

    for (const model of models) {
      try {
        // Skip OpenRouter's own meta/routing pseudo-models — they have no
        // per-token price (openrouter/auto, openrouter/bodybuilder, etc.)
        // These would otherwise fail validation and poison the success flag.
        if (model.id.startsWith('openrouter/')) continue;
        if (isDatedSnapshotOf(model.id)) continue;

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

        // Skip non-text-output models. OpenRouter exposes image-generation and
        // image-editing prices in the same prompt/completion fields, but those
        // are not per-token LLM output prices and must not reach the LLM
        // output>=input write boundary.
        const modality = model.architecture?.modality || '';
        const outputModalities = model.architecture?.output_modalities;
        if (
          (outputModalities && outputModalities.some(output => output !== 'text')) ||
          (!outputModalities && /->.*image/i.test(modality)) ||
          (modality && !modality.includes('text'))
        ) {
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
          releasedAt: model.created && Number.isFinite(model.created)
            ? new Date(model.created * 1000).toISOString()
            : undefined,
          notes: openRouterModelPage(model.id),
        });
        pricedModels.push(model);
      } catch (error) {
        errors.push(`Error processing ${model.id}: ${error}`);
      }
    }

    const headlineBySlug = new Map<string, ScrapedPrice>();
    const sourceModelBySlug = new Map<string, OpenRouterModel>();
    for (let i = 0; i < prices.length; i++) {
      headlineBySlug.set(prices[i].modelSlug, prices[i]);
      sourceModelBySlug.set(prices[i].modelSlug, pricedModels[i]);
    }
    prices = [...headlineBySlug.values()];
    pricedModels = [...sourceModelBySlug.values()];

    console.log(`🔎 Fetching OpenRouter endpoint variants for ${pricedModels.length} canonical model prices...`);
    const variantGroups = await mapWithConcurrency(pricedModels, 6, async (model) => {
      const headline = prices.find(price => price.modelSlug === generateOpenRouterSlug(model.id));
      if (!headline) return [];
      try {
        return await fetchEndpointVariants(model, headline);
      } catch (error) {
        errors.push(`Error fetching endpoints for ${model.id}: ${error}`);
        return [];
      }
    });
    const variants = variantGroups.flat();

    const duration = Date.now() - startTime;
    console.log(`✅ OpenRouter scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Variants processed: ${variants.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'OpenRouter',
      success: errors.length === 0 && prices.length > 0,
      prices,
      variants,
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
