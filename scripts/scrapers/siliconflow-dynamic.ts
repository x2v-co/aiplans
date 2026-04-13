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
    await this.page!.waitForTimeout(3000);

    // Get all text content from the page
    const pageContent = await this.page!.textContent('body') || '';

    // Try to find pricing tables
    const tables = await this.page!.$$('table');
    for (const table of tables) {
      const rows = await table.$$('tr');
      for (const row of rows) {
        const text = await row.textContent();
        if (!text) continue;

        // Extract model name - support Provider/Model format
        const modelNameMatch = text.match(/([a-zA-Z][\w.-]+\/[a-zA-Z][\w.-]+)/);
        if (!modelNameMatch) continue;

        const modelName = modelNameMatch[1];

        // Extract prices - look for numbers in the row
        // Format: 输入 (元 / M tokens) and 输出 (元 / M tokens)
        const cells = await row.$$('td');
        if (cells.length >= 2) {
          const inputText = await cells[cells.length - 2].textContent() || '';
          const outputText = await cells[cells.length - 1].textContent() || '';

          const inputMatch = inputText.match(/([\d.]+)/);
          const outputMatch = outputText.match(/([\d.]+)/);

          if (inputMatch && outputMatch) {
            const inputPrice = parseFloat(inputMatch[1]);
            const outputPrice = parseFloat(outputMatch[1]);

            if (validatePrice(inputPrice) && validatePrice(outputPrice)) {
              // Avoid duplicates
              if (!prices.some(p => p.modelName === modelName)) {
                prices.push({
                  modelName: normalizeModelName(modelName.split('/')[1] || modelName),
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
    }

    // Alternative: Look for card-based pricing layout
    if (prices.length === 0) {
      const cards = await this.page!.$$('[class*="pricing"], [class*="card"], [class*="model"]');
      for (const card of cards) {
        const text = await card.textContent();
        if (!text) continue;

        // Support Provider/Model format
        const modelNameMatch = text.match(/([a-zA-Z][\w.-]+\/[a-zA-Z][\w.-]+)/);
        if (!modelNameMatch) continue;

        const modelName = modelNameMatch[1];

        // Look for price patterns: 数字 followed by 元/M tokens context
        const priceMatches = [...text.matchAll(/([\d.]+)\s*(?:元)?/g)];
        const validPrices = priceMatches
          .map(m => parseFloat(m[1]))
          .filter(p => p > 0 && p < 1000);

        if (validPrices.length >= 2) {
          const inputPrice = validPrices[0];
          const outputPrice = validPrices[1];

          if (validatePrice(inputPrice) && validatePrice(outputPrice)) {
            if (!prices.some(p => p.modelName === modelName)) {
              prices.push({
                modelName: normalizeModelName(modelName.split('/')[1] || modelName),
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

    // Third attempt: Parse from body text
    if (prices.length === 0) {
      // Look for patterns like: "deepseek-ai/DeepSeek-V3 2.00 8.00"
      const lines = pageContent.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const modelMatch = line.match(/([a-zA-Z][\w.-]+\/[a-zA-Z][\w.-]+)/);
        if (!modelMatch) continue;

        const modelName = modelMatch[1];
        const contextLines = lines.slice(i, i + 3).join(' ');

        // Look for price patterns nearby
        const priceMatches = [...contextLines.matchAll(/([\d.]+)\s*(?:元)?/g)];
        const validPrices = priceMatches
          .map(m => parseFloat(m[1]))
          .filter(p => p > 0 && p < 100);

        if (validPrices.length >= 2) {
          if (!prices.some(p => p.modelName === modelName)) {
            prices.push({
              modelName: normalizeModelName(modelName.split('/')[1] || modelName),
              inputPricePer1M: validPrices[0],
              outputPricePer1M: validPrices[1],
              contextWindow: this.inferContextWindow(modelName),
              isAvailable: true,
              currency: 'CNY',
            });
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