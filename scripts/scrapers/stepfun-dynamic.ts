/**
 * StepFun / 阶跃星辰 API Scraper - Dynamic fetching from pricing page
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import { normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData, ScraperResult } from './lib/playwright-scraper';

const STEPFUN_PRICING_URL = 'https://platform.stepfun.com/docs/zh/pricing/details';

/**
 * Known StepFun models with their characteristics
 * StepFun (阶跃星辰) is a Chinese LLM provider
 * Updated 2026-03-19
 */
const KNOWN_MODELS = [
  // Step 1 series - text models
  { pattern: /step-1-8k(?!-vision)/i, name: 'step-1-8k', minInput: 3, maxInput: 8, minOutput: 15, maxOutput: 25, context: 8000 },
  { pattern: /step-1-32k(?!-vision)/i, name: 'step-1-32k', minInput: 10, maxInput: 20, minOutput: 50, maxOutput: 90, context: 32000 },
  { pattern: /step-1-128k(?!-vision)/i, name: 'step-1-128k', minInput: 20, maxInput: 50, minOutput: 60, maxOutput: 150, context: 128000 },
  { pattern: /step-1-256k(?!-vision)/i, name: 'step-1-256k', minInput: 60, maxInput: 120, minOutput: 200, maxOutput: 400, context: 256000 },

  // Step 1o series - multimodal/vision models
  { pattern: /step-1o(?:-turbo)?-vision/i, name: 'step-1o-vision', minInput: 1.5, maxInput: 4, minOutput: 5, maxOutput: 12, context: 128000 },
  { pattern: /step-1o-turbo(?!-vision)/i, name: 'step-1o-turbo', minInput: 1, maxInput: 3, minOutput: 3, maxOutput: 8, context: 128000 },

  // Step 1.5 series
  { pattern: /step-1\.5(?!-vision)/i, name: 'step-1.5', minInput: 0.5, maxInput: 2, minOutput: 1, maxOutput: 5, context: 128000 },
  { pattern: /step-1\.5-vision/i, name: 'step-1.5-vision', minInput: 1, maxInput: 3, minOutput: 3, maxOutput: 8, context: 128000 },

  // Step 2 series
  { pattern: /step-2(?!-vision)/i, name: 'step-2', minInput: 5, maxInput: 15, minOutput: 15, maxOutput: 50, context: 128000 },

  // Step 3 series
  { pattern: /step-3(?:-mini)?(?!-vision|-flash)/i, name: 'step-3', minInput: 2, maxInput: 8, minOutput: 8, maxOutput: 25, context: 128000 },
  { pattern: /step-3-flash/i, name: 'step-3-flash', minInput: 0.5, maxInput: 2, minOutput: 1.5, maxOutput: 5, context: 128000 },

  // Step 3.5 series
  { pattern: /step-3\.5(?:-mini)?(?!-vision|-flash)/i, name: 'step-3.5', minInput: 1, maxInput: 4, minOutput: 4, maxOutput: 12, context: 128000 },
  { pattern: /step-3\.5-flash/i, name: 'step-3.5-flash', minInput: 0.4, maxInput: 1.5, minOutput: 1, maxOutput: 4, context: 128000 },
  { pattern: /step-3\.5-vision/i, name: 'step-3.5-vision', minInput: 1, maxInput: 3, minOutput: 3, maxOutput: 8, context: 128000 },

  // Step R1 series - reasoning models
  { pattern: /step-r1-v-mini/i, name: 'step-r1-v-mini', minInput: 1.5, maxInput: 4, minOutput: 5, maxOutput: 12, context: 128000 },
  { pattern: /step-r1(?:-mini)?(?!-v)/i, name: 'step-r1', minInput: 2, maxInput: 6, minOutput: 6, maxOutput: 18, context: 128000 },

  // Audio/TTS models
  { pattern: /step-tts/i, name: 'step-tts', minInput: 0.01, maxInput: 0.1, minOutput: 0.01, maxOutput: 0.1, context: 4096 },
  { pattern: /step-asr/i, name: 'step-asr', minInput: 0.01, maxInput: 0.1, minOutput: 0.01, maxOutput: 0.1, context: 4096 },
];

class StepFunScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'StepFun';
  }

  getSourceUrl(): string {
    return STEPFUN_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const prices: PriceData[] = [];

    await this.navigate(STEPFUN_PRICING_URL);

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
      errors.push('No pricing data could be extracted from StepFun pricing page. The page structure may have changed.');
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
   * Parses format: "step-1-8k 5元 20元" or "输入: 5元 输出: 20元"
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
        // Pattern: "5元" or "¥5" or "￥5" or "5.0 元"
        for (const ctxLine of contextLines) {
          // Stop if we hit another model section
          if (/step-[0-9]/i.test(ctxLine) && !modelInfo.pattern.test(ctxLine)) {
            break;
          }

          // Extract all prices from the line
          const priceMatches = [...ctxLine.matchAll(/[¥￥]?(\d+\.?\d*)\s*元?/g)];
          const allPrices = priceMatches.map(m => parseFloat(m[1])).filter(p => p > 0 && p < 500);

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
        const prices = linePrices.map(m => parseFloat(m[1])).filter(p => p > 0 && p < 500);

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

export async function scrapeStepFunDynamic(): Promise<ScraperResult> {
  const scraper = new StepFunScraper();
  return scraper.run();
}

// CLI test
if (require.main === module) {
  scrapeStepFunDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}