/**
 * Seed / Volcengine API Scraper - Dynamic fetching from pricing page
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import { normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData, ScraperResult } from './lib/playwright-scraper';

const SEED_PRICING_URL = 'https://www.volcengine.com/docs/82379/1544106';

/**
 * Known Seed/Volcengine Doubao models with their characteristics
 * Updated 2026-03-19 based on Volcengine pricing documentation
 */
const KNOWN_MODELS = [
  // Doubao 2.0 Pro series (flagship)
  { pattern: /doubao.*2\.0.*pro|seed.*2\.0.*pro/i, name: 'doubao-seed-2.0-pro', minInput: 0.5, maxInput: 2, minOutput: 2, maxOutput: 6, context: 256000 },

  // Doubao 2.0 Lite series
  { pattern: /doubao.*2\.0.*lite|seed.*2\.0.*lite/i, name: 'doubao-seed-2.0-lite', minInput: 0.1, maxInput: 0.5, minOutput: 0.5, maxOutput: 2, context: 256000 },

  // Doubao 2.0 Mini series
  { pattern: /doubao.*2\.0.*mini|seed.*2\.0.*mini/i, name: 'doubao-seed-2.0-mini', minInput: 0.05, maxInput: 0.3, minOutput: 0.3, maxOutput: 1, context: 256000 },

  // Doubao 2.0 Code series
  { pattern: /doubao.*2\.0.*code|seed.*2\.0.*code/i, name: 'doubao-seed-2.0-code', minInput: 0.3, maxInput: 1, minOutput: 1, maxOutput: 4, context: 256000 },

  // Doubao 1.5 Pro
  { pattern: /doubao.*1\.5.*pro/i, name: 'doubao-1.5-pro', minInput: 0.3, maxInput: 1, minOutput: 1, maxOutput: 4, context: 128000 },

  // Doubao Lite
  { pattern: /doubao.*lite(?!.*2\.0)/i, name: 'doubao-lite', minInput: 0.05, maxInput: 0.2, minOutput: 0.2, maxOutput: 0.8, context: 128000 },

  // GLM models (third-party)
  { pattern: /glm-?4\.?7/i, name: 'glm-4.7', minInput: 5, maxInput: 15, minOutput: 15, maxOutput: 50, context: 200000 },

  // DeepSeek models (third-party)
  { pattern: /deepseek.*v3/i, name: 'deepseek-v3', minInput: 0.5, maxInput: 2, minOutput: 1, maxOutput: 8, context: 128000 },
];

class SeedScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'Seed-Volcengine';
  }

  getSourceUrl(): string {
    return SEED_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const prices: PriceData[] = [];

    await this.navigate(SEED_PRICING_URL);

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
          console.log(`  ✅ Found: ${found.modelName} - ¥${found.inputPricePer1M}/¥${found.outputPricePer1M} per 1M tokens`);
        }
      }
    }

    // Deduplicate by model name
    const uniquePrices = prices.filter((price, index, self) =>
      index === self.findIndex(p => p.modelName === price.modelName)
    );

    if (uniquePrices.length === 0) {
      errors.push('No pricing data could be extracted from Seed/Volcengine pricing page. The page structure may have changed.');
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
   * Parses format: "doubao-2.0-pro 0.8元 3.2元" or "输入: 0.8元 输出: 3.2元"
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
        // Pattern: "0.8元" or "¥0.8" or "￥0.8"
        for (const ctxLine of contextLines) {
          // Stop if we hit another model section
          if (/(doubao|seed|glm|deepseek)/i.test(ctxLine) && !modelInfo.pattern.test(ctxLine)) {
            break;
          }

          // Extract all prices from the line
          const priceMatches = [...ctxLine.matchAll(/[¥￥]?(\d+\.?\d*)\s*元?/g)];
          const allPrices = priceMatches.map(m => parseFloat(m[1])).filter(p => p > 0 && p < 100);

          if (allPrices.length >= 2) {
            // Find input and output prices in expected ranges
            const inpPrice = allPrices.find(p => p >= modelInfo.minInput && p <= modelInfo.maxInput);
            const outPrice = allPrices.find(p => p >= modelInfo.minOutput && p <= modelInfo.maxOutput);

            if (inpPrice && outPrice) {
              inputPrice = inpPrice;
              outputPrice = outPrice;
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
            currency: 'CNY',
          };
        }

        // Fallback: Try to extract from the line itself
        const linePrices = [...line.matchAll(/[¥￥]?(\d+\.?\d*)\s*元?/g)];
        const prices = linePrices.map(m => parseFloat(m[1])).filter(p => p > 0 && p < 100);

        if (prices.length >= 2) {
          const inpPrice = prices.find(p => p >= modelInfo.minInput && p <= modelInfo.maxInput);
          const outPrice = prices.find(p => p >= modelInfo.minOutput && p <= modelInfo.maxOutput);

          if (inpPrice && outPrice) {
            return {
              modelName: normalizeModelName(modelInfo.name),
              inputPricePer1M: inpPrice,
              outputPricePer1M: outPrice,
              contextWindow: modelInfo.context,
              isAvailable: true,
              currency: 'CNY',
            };
          }
        }
      }
    }

    return null;
  }
}

export async function scrapeSeedDynamic(): Promise<ScraperResult> {
  const scraper = new SeedScraper();
  return scraper.run();
}

// CLI test
if (require.main === module) {
  scrapeSeedDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}