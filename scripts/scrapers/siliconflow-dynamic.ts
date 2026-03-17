/**
 * SiliconFlow API Scraper - Uses Playwright for real HTML parsing
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData } from './lib/playwright-scraper';

const SILICONFLOW_PRICING_URL = 'https://siliconflow.cn/pricing';

class SiliconFlowScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'SiliconFlow';
  }

  getSourceUrl(): string {
    return SILICONFLOW_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const prices: PriceData[] = [];

    await this.navigate(SILICONFLOW_PRICING_URL);

    // Wait for pricing content to load
    await this.page!.waitForTimeout(2000);

    // Get all text content from the page
    const pageContent = await this.page!.textContent('body') || '';

    // Try to find pricing tables
    const tables = await this.page!.$$('table');
    for (const table of tables) {
      const rows = await table.$$('tr');
      for (const row of rows) {
        const text = await row.textContent();
        if (!text) continue;

        // Extract model name from row
        const modelNameMatch = text.match(/([a-zA-Z][\w.-]*(?:gpt|claude|deepseek|qwen|llama|glm|mistral|mixtral|codestral)[\w.-]*)/i);
        if (!modelNameMatch) continue;

        const modelName = modelNameMatch[1].toLowerCase();

        // Extract prices - look for CNY patterns
        const priceMatches = [...text.matchAll(/[¥￥]?\s*([\d.]+)\s*(?:元)?(?:\/)?(?:万|M|百万)?/g)];
        const validPrices = priceMatches
          .map(m => parseFloat(m[1]))
          .filter(p => p > 0 && p < 1000);

        if (validPrices.length >= 2) {
          const inputPrice = validPrices[0];
          const outputPrice = validPrices[1];

          if (validatePrice(inputPrice) && validatePrice(outputPrice)) {
            // Avoid duplicates
            if (!prices.some(p => p.modelName.toLowerCase().includes(modelName.toLowerCase()))) {
              prices.push({
                modelName: normalizeModelName(modelName),
                inputPricePer1M: inputPrice,
                outputPricePer1M: outputPrice,
                contextWindow: this.inferContextWindow(modelName),
                isAvailable: true,
                currency: 'CNY', // SiliconFlow uses CNY
              });
            }
          }
        }
      }
    }

    // Alternative: Look for card-based pricing layout
    if (prices.length === 0) {
      const cards = await this.page!.$$('[class*="pricing"], [class*="card"], [class*="model"]');
      for (const card of cards) {
        const text = await card.textContent();
        if (!text) continue;

        const modelNameMatch = text.match(/([a-zA-Z][\w.-]*(?:gpt|claude|deepseek|qwen|llama|glm|mistral|mixtral|codestral)[\w.-]*)/i);
        if (!modelNameMatch) continue;

        const modelName = modelNameMatch[1].toLowerCase();

        const priceMatches = [...text.matchAll(/[¥￥]?\s*([\d.]+)\s*(?:元)?/g)];
        const validPrices = priceMatches
          .map(m => parseFloat(m[1]))
          .filter(p => p > 0 && p < 1000);

        if (validPrices.length >= 2) {
          const inputPrice = validPrices[0];
          const outputPrice = validPrices[1];

          if (validatePrice(inputPrice) && validatePrice(outputPrice)) {
            if (!prices.some(p => p.modelName.toLowerCase().includes(modelName.toLowerCase()))) {
              prices.push({
                modelName: normalizeModelName(modelName),
                inputPricePer1M: inputPrice,
                outputPricePer1M: outputPrice,
                contextWindow: this.inferContextWindow(modelName),
                isAvailable: true,
                currency: 'CNY',
              });
            }
          }
        }
      }
    }

    if (prices.length === 0) {
      errors.push('No pricing data could be extracted from SiliconFlow pricing page. The page structure may have changed.');
    }

    return {
      success: errors.length === 0 && prices.length > 0,
      source: this.getSourceName(),
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private inferContextWindow(model: string): number {
    const contextWindows: Record<string, number> = {
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'claude-3': 200000,
      'deepseek': 128000,
      'qwen': 32000,
      'llama': 131072,
      'glm': 128000,
    };

    const normalizedModel = model.toLowerCase();
    for (const [key, value] of Object.entries(contextWindows)) {
      if (normalizedModel.includes(key)) {
        return value;
      }
    }
    return 128000;
  }
}

export async function scrapeSiliconFlowDynamic(): Promise<ScraperResult> {
  const scraper = new SiliconFlowScraper();
  return scraper.run();
}

// CLI test
if (require.main === module) {
  scrapeSiliconFlowDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}