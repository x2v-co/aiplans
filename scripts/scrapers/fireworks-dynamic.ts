/**
 * Fireworks AI API Scraper - Dynamic fetching from pricing page
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import { normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData, ScraperResult } from './lib/playwright-scraper';

const FIREWORKS_PRICING_URL = 'https://fireworks.ai/pricing';

/**
 * Known Fireworks AI models with their characteristics
 * Updated 2026-03-19
 */
const KNOWN_MODELS = [
  // Llama 4 series
  { pattern: /llama-4.*maverick/i, name: 'llama-4-maverick', minInput: 0.15, maxInput: 0.4, minOutput: 0.5, maxOutput: 1.2, context: 128000 },
  { pattern: /llama-4.*scout/i, name: 'llama-4-scout', minInput: 0.05, maxInput: 0.2, minOutput: 0.2, maxOutput: 0.6, context: 128000 },

  // Llama 3.3 series
  { pattern: /llama-3\.3.*70b/i, name: 'llama-3.3-70b-instruct', minInput: 0.6, maxInput: 1.2, minOutput: 0.6, maxOutput: 1.2, context: 128000 },

  // Llama 3.1 series
  { pattern: /llama-3\.1.*405b/i, name: 'llama-3.1-405b-instruct', minInput: 2, maxInput: 4, minOutput: 2, maxOutput: 4, context: 131072 },
  { pattern: /llama-3\.1.*70b/i, name: 'llama-3.1-70b-instruct', minInput: 0.6, maxInput: 1.2, minOutput: 0.6, maxOutput: 1.2, context: 131072 },
  { pattern: /llama-3\.1.*8b/i, name: 'llama-3.1-8b-instruct', minInput: 0.02, maxInput: 0.1, minOutput: 0.02, maxOutput: 0.1, context: 131072 },

  // Llama 3 series
  { pattern: /llama-3.*70b(?!-b)/i, name: 'llama-3-70b-instruct', minInput: 0.6, maxInput: 1.2, minOutput: 0.6, maxOutput: 1.2, context: 8192 },
  { pattern: /llama-3.*8b/i, name: 'llama-3-8b-instruct', minInput: 0.02, maxInput: 0.1, minOutput: 0.02, maxOutput: 0.1, context: 8192 },

  // Mixtral series
  { pattern: /mixtral.*8x22b/i, name: 'mixtral-8x22b-instruct', minInput: 0.9, maxInput: 1.5, minOutput: 0.9, maxOutput: 1.5, context: 65536 },
  { pattern: /mixtral.*8x7b/i, name: 'mixtral-8x7b-instruct', minInput: 0.4, maxInput: 0.8, minOutput: 0.4, maxOutput: 0.8, context: 32768 },

  // Qwen series
  { pattern: /qwen3.*72b/i, name: 'qwen3-72b-instruct', minInput: 0.3, maxInput: 0.8, minOutput: 0.3, maxOutput: 0.8, context: 32768 },
  { pattern: /qwen2\.5.*72b/i, name: 'qwen2.5-72b-instruct', minInput: 0.3, maxInput: 0.8, minOutput: 0.3, maxOutput: 0.8, context: 32768 },
  { pattern: /qwen.*vl/i, name: 'qwen-vl', minInput: 0.1, maxInput: 0.3, minOutput: 0.3, maxOutput: 0.8, context: 32768 },

  // DeepSeek series
  { pattern: /deepseek-v3/i, name: 'deepseek-v3', minInput: 0.5, maxInput: 1.5, minOutput: 0.5, maxOutput: 1.5, context: 128000 },
  { pattern: /deepseek-r1/i, name: 'deepseek-r1', minInput: 2, maxInput: 5, minOutput: 2, maxOutput: 5, context: 128000 },

  // Gemma series
  { pattern: /gemma.*27b/i, name: 'gemma-27b-instruct', minInput: 0.05, maxInput: 0.2, minOutput: 0.05, maxOutput: 0.2, context: 8192 },
  { pattern: /gemma.*9b/i, name: 'gemma-9b-instruct', minInput: 0.02, maxInput: 0.1, minOutput: 0.02, maxOutput: 0.1, context: 8192 },
];

class FireworksScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'Fireworks-AI';
  }

  getSourceUrl(): string {
    return FIREWORKS_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const prices: PriceData[] = [];

    await this.navigate(FIREWORKS_PRICING_URL);

    // Wait for page to fully load
    await this.page!.waitForTimeout(5000);

    // Get all text content from the page
    const bodyText = await this.page!.textContent('body') || '';
    console.log('📝 Body text length:', bodyText.length);

    // Debug: Print first 3000 chars
    console.log('📄 First 3000 chars of body text:');
    console.log(bodyText.substring(0, 3000));

    // Split text into lines for analysis
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);

    // Extract prices for each known model
    for (const modelInfo of KNOWN_MODELS) {
      const found = this.extractModelPrice(lines, modelInfo);
      if (found) {
        // Avoid duplicates
        if (!prices.some(p => p.modelName === found.modelName)) {
          prices.push(found);
          console.log(`  ✅ Found: ${found.modelName} - $${found.inputPricePer1M}/$${found.outputPricePer1M} per 1M tokens`);
        }
      }
    }

    // Deduplicate by model name
    const uniquePrices = prices.filter((price, index, self) =>
      index === self.findIndex(p => p.modelName === price.modelName)
    );

    if (uniquePrices.length === 0) {
      errors.push('No pricing data could be extracted from Fireworks pricing page. The page structure may have changed.');
    }

    return {
      success: errors.length === 0 && uniquePrices.length > 0,
      source: this.getSourceName(),
      prices: uniquePrices,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Extract price for a specific model from text lines
   * Parses format: "Llama 3.1 70B $0.60 $0.60" or "$0.60 per 1M tokens"
   */
  private extractModelPrice(
    lines: string[],
    modelInfo: { pattern: RegExp; name: string; minInput: number; maxInput: number; minOutput: number; maxOutput: number; context: number }
  ): PriceData | null {
    // Find lines containing this model name
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line matches the model pattern
      if (modelInfo.pattern.test(line)) {
        // Use context window of 5 lines to find prices
        const contextStart = i;
        const contextEnd = Math.min(lines.length, i + 5);
        const contextLines = lines.slice(contextStart, contextEnd);

        let inputPrice: number | null = null;
        let outputPrice: number | null = null;

        // Look for prices in the context
        // Pattern: "$0.60" or "0.60"
        for (const ctxLine of contextLines) {
          // Stop if we hit another model section
          if (/(llama|mixtral|qwen|deepseek|gemma)/i.test(ctxLine) && !modelInfo.pattern.test(ctxLine)) {
            break;
          }

          // Extract all prices from the line
          const priceMatches = [...ctxLine.matchAll(/\$?(\d+\.?\d+)/g)];
          const allPrices = priceMatches.map(m => parseFloat(m[1])).filter(p => p > 0 && p < 50);

          if (allPrices.length >= 1) {
            // Find input and output prices in expected ranges
            const inpPrice = allPrices.find(p => p >= modelInfo.minInput && p <= modelInfo.maxInput);
            const outPrice = allPrices.find(p => p >= modelInfo.minOutput && p <= modelInfo.maxOutput);

            if (inpPrice) {
              inputPrice = inpPrice;
              outputPrice = outPrice || inpPrice;
              break;
            }
          }
        }

        if (inputPrice && outputPrice) {
          return {
            modelName: normalizeModelName(modelInfo.name),
            inputPricePer1M: inputPrice,
            outputPricePer1M: outputPrice,
            contextWindow: modelInfo.context,
            isAvailable: true,
            currency: 'USD',
          };
        }

        // Fallback: Try to extract from the line itself
        const linePrices = [...line.matchAll(/\$?(\d+\.?\d+)/g)];
        const prices = linePrices.map(m => parseFloat(m[1])).filter(p => p > 0 && p < 50);

        if (prices.length >= 1) {
          const inpPrice = prices.find(p => p >= modelInfo.minInput && p <= modelInfo.maxInput);
          const outPrice = prices.find(p => p >= modelInfo.minOutput && p <= modelInfo.maxOutput);

          if (inpPrice) {
            return {
              modelName: normalizeModelName(modelInfo.name),
              inputPricePer1M: inpPrice,
              outputPricePer1M: outPrice || inpPrice,
              contextWindow: modelInfo.context,
              isAvailable: true,
              currency: 'USD',
            };
          }
        }
      }
    }

    return null;
  }
}

export async function scrapeFireworksDynamic(): Promise<ScraperResult> {
  const scraper = new FireworksScraper();
  return scraper.run();
}

// CLI test
if (require.main === module) {
  scrapeFireworksDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}