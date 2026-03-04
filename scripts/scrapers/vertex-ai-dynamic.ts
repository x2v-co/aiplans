/**
 * Google Vertex AI API Scraper - Dynamic fetching from pricing page
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { fetchHTML } from './base-fetcher';

const VERTEX_AI_PRICING_URL = 'https://cloud.google.com/vertex-ai/pricing';

interface VertexModel {
  model: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
}

/**
 * Fetch and parse Google Vertex AI pricing from their website
 */
async function fetchVertexAIPricing(): Promise<VertexModel[]> {
  const result = await fetchHTML(VERTEX_AI_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Vertex AI pricing page, using fallback data');
    return getFallbackPricing();
  }

  const html = result.data;
  const models: VertexModel[] = [];

  // Known Vertex AI model patterns (2025-2026)
  const modelPatterns = [
    {
      model: 'gemini-2.0-flash-exp',
      vertexId: 'gemini-2.0-flash-exp',
      inputPattern: /gemini-2\.0-flash[^$]*?\$?([\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /gemini-2\.0-flash[^$]*?\$?([\d.]+)\s*per\s*1M\s*output/i,
      context: 1000000,
    },
    {
      model: 'gemini-2.0-flash-thinking-exp',
      vertexId: 'gemini-2.0-flash-thinking-exp',
      inputPattern: /gemini-2\.0-flash-thinking[^$]*?\$?([\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /gemini-2\.0-flash-thinking[^$]*?\$?([\d.]+)\s*per\s*1M\s*output/i,
      context: 1000000,
    },
    {
      model: 'gemini-1.5-pro',
      vertexId: 'gemini-1.5-pro',
      inputPattern: /gemini-1\.5-pro[^$]*?\$?([\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /gemini-1\.5-pro[^$]*?\$?([\d.]+)\s*per\s*1M\s*output/i,
      context: 2000000,
    },
    {
      model: 'gemini-1.5-flash',
      vertexId: 'gemini-1.5-flash',
      inputPattern: /gemini-1\.5-flash[^$]*?\$?([\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /gemini-1\.5-flash[^$]*?\$?([\d.]+)\s*per\s*1M\s*output/i,
      context: 1000000,
    },
    {
      model: 'gemini-1.5-flash-002',
      vertexId: 'gemini-1.5-flash-002',
      inputPattern: /gemini-1\.5-flash-002[^$]*?\$?([\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /gemini-1\.5-flash-002[^$]*?\$?([\d.]+)\s*per\s*1M\s*output/i,
      context: 28000000,
    },
    {
      model: 'gemini-1.5-pro-001',
      vertexId: 'gemini-1.5-pro-001',
      inputPattern: /gemini-1\.5-pro-001[^$]*?\$?([\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /gemini-1\.5-pro-001[^$]*?\$?([\d.]+)\s*per\s*1M\s*output/i,
      context: 2000000,
    },
    {
      model: 'gemini-1.0-pro',
      vertexId: 'gemini-1.0-pro',
      inputPattern: /gemini-1\.0-pro[^$]*?\$?([\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /gemini-1\.0-pro[^$]*?\$?([\d.]+)\s*per\s*1M\s*output/i,
      context: 2800000,
    },
    {
      model: 'gemini-exp-1206',
      vertexId: 'gemini-exp-1206',
      inputPattern: /gemini-exp-1206[^$]*?\$?([\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /gemini-exp-1206[^$]*?\$?([\d.]+)\s*per\s*1M\s*output/i,
      context: 2000000,
    },
    {
      model: 'gemini-1.5-pro-002',
      vertexId: 'gemini-1.5-pro-002',
      inputPattern: /gemini-1\.5-pro-002[^$]*?\$?([\d.]+)\s*per\s*1M\s*input/i,
      outputPattern: /gemini-1\.5-pro-002[^$]*?\$?([\d.]+)\s*per\s*1M\s*output/i,
      context: 2000000,
    },
  ];

  for (const pattern of modelPatterns) {
    const inputMatch = html.match(pattern.inputPattern);
    const outputMatch = html.match(pattern.outputPattern);

    if (inputMatch && outputMatch) {
      const inputPrice = parseFloat(inputMatch[1]);
      const outputPrice = parseFloat(outputMatch[1]);

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
 * Fallback pricing data (known as of 2025-2026)
 */
function getFallbackPricing(): VertexModel[] {
  return [
    {
      model: 'gemini-2.0-flash-exp',
      inputPrice: 0.075,
      outputPrice: 0.30,
      contextWindow: 1000000,
    },
    {
      model: 'gemini-2.0-flash-thinking-exp',
      inputPrice: 0.075,
      outputPrice: 0.30,
      contextWindow: 1000000,
    },
    {
      model: 'gemini-1.5-pro',
      inputPrice: 1.25,
      outputPrice: 5.00,
      contextWindow: 2000000,
    },
    {
      model: 'gemini-1.5-flash',
      inputPrice: 0.075,
      outputPrice: 0.30,
      contextWindow: 1000000,
    },
    {
      model: 'gemini-1.5-flash-002',
      inputPrice: 0.075,
      outputPrice: 0.30,
      contextWindow: 28000000,
    },
    {
      model: 'gemini-1.5-pro-001',
      inputPrice: 1.25,
      outputPrice: 5.00,
      contextWindow: 2000000,
    },
    {
      model: 'gemini-1.0-pro',
      inputPrice: 0.50,
      outputPrice: 1.50,
      contextWindow: 2800000,
    },
    {
      model: 'gemini-exp-1206',
      inputPrice: 0.125,
      outputPrice: 0.375,
      contextWindow: 2000000,
    },
    {
      model: 'gemini-1.5-pro-002',
      inputPrice: 1.25,
      outputPrice: 5.00,
      contextWindow: 2000000,
    },
  ];
}

export async function scrapeVertexAIDynamic(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const prices: ScrapedPrice[] = [];

  try {
    console.log('🔄 Fetching Vertex AI pricing...');

    const models = await fetchVertexAIPricing();

    console.log(`📦 Found ${models.length} models from Vertex AI`);

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
          currency: 'USD', // Vertex AI prices are in USD
        });
      } catch (error) {
        errors.push(`Error processing ${model.model}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Vertex AI scrape completed in ${duration}ms`);
    console.log(`   - Models processed: ${prices.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Vertex-AI',
      success: true,
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Vertex AI scrape failed:', error);
    return {
      source: 'Vertex-AI',
      success: false,
      prices: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeVertexAIDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
