/**
 * Together AI Scraper - Uses Playwright for real HTML parsing
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData } from './lib/playwright-scraper';

const TOGETHER_AI_PRICING_URL = 'https://together.ai/pricing';

class TogetherAIScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'Together-AI';
  }

  getSourceUrl(): string {
    return TOGETHER_AI_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const prices: PriceData[] = [];

    await this.navigate(TOGETHER_AI_PRICING_URL);

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

        // Extract model name from first cell
        const cells = await row.$$('td');
        if (cells.length >= 3) {
          const modelText = await cells[0].textContent() || '';
          const inputText = await cells[1].textContent() || '';
          const outputText = await cells[2].textContent() || '';

          // Skip header rows
          if (modelText.toLowerCase().includes('model') ||
              inputText.toLowerCase().includes('input') ||
              modelText.trim() === '') {
            continue;
          }

          // Extract prices - look for dollar amounts
          const inputMatch = inputText.match(/\$?([\d.]+)/);
          const outputMatch = outputText.match(/\$?([\d.]+)/);

          if (inputMatch && outputMatch) {
            const inputPrice = parseFloat(inputMatch[1]);
            const outputPrice = parseFloat(outputMatch[1]);

            if (validatePrice(inputPrice) && validatePrice(outputPrice)) {
              const modelName = normalizeModelName(modelText.trim());

              // Avoid duplicates
              if (!prices.some(p => p.modelName === modelName)) {
                prices.push({
                  modelName,
                  inputPricePer1M: inputPrice,
                  outputPricePer1M: outputPrice,
                  contextWindow: this.inferContextWindow(modelName),
                  isAvailable: true,
                  currency: 'USD',
                });
              }
            }
          }
        }
      }
    }

    // Alternative: Look for card/list-based pricing layout
    if (prices.length === 0) {
      const items = await this.page!.$$('.w-dyn-item, [class*="pricing"] tr, [class*="model"]');
      for (const item of items) {
        const text = await item.textContent();
        if (!text) continue;

        // Extract model name and prices from text
        // Pattern: "Model Name $0.50 $1.20"
        const priceMatches = [...text.matchAll(/\$?([\d.]+)/g)];
        const validPrices = priceMatches
          .map(m => parseFloat(m[1]))
          .filter(p => p > 0 && p < 100);

        if (validPrices.length >= 2) {
          // Try to extract model name - text before the first price
          const textBeforePrice = text.split(/\$?[\d.]+/)[0].trim();
          if (textBeforePrice && textBeforePrice.length > 2 && textBeforePrice.length < 100) {
            const modelName = normalizeModelName(textBeforePrice);

            if (!prices.some(p => p.modelName === modelName)) {
              prices.push({
                modelName,
                inputPricePer1M: validPrices[0],
                outputPricePer1M: validPrices[1],
                contextWindow: this.inferContextWindow(modelName),
                isAvailable: true,
                currency: 'USD',
              });
            }
          }
        }
      }
    }

    // Third attempt: Parse from body text using known patterns
    if (prices.length === 0) {
      const lines = pageContent.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for lines with model names followed by prices
        // Pattern: "Llama 4 Maverick $0.27 $0.85"
        const match = line.match(/^(.+?)\s+\$?([\d.]+)\s+\$?([\d.]+)$/);
        if (match) {
          const modelName = normalizeModelName(match[1].trim());
          const inputPrice = parseFloat(match[2]);
          const outputPrice = parseFloat(match[3]);

          // Skip if this looks like a header or non-model text
          if (modelName.toLowerCase().includes('price') ||
              modelName.toLowerCase().includes('input') ||
              modelName.toLowerCase().includes('model')) {
            continue;
          }

          if (validatePrice(inputPrice) && validatePrice(outputPrice)) {
            if (!prices.some(p => p.modelName === modelName)) {
              prices.push({
                modelName,
                inputPricePer1M: inputPrice,
                outputPricePer1M: outputPrice,
                contextWindow: this.inferContextWindow(modelName),
                isAvailable: true,
                currency: 'USD',
              });
            }
          }
        }
      }
    }

    // Filter out non-LLM models (image, audio, video, etc.)
    const llmPrices = prices.filter(p => {
      const name = p.modelName.toLowerCase();
      // Keep LLM/chat models
      if (name.includes('llama') || name.includes('qwen') || name.includes('deepseek') ||
          name.includes('mistral') || name.includes('gemma') || name.includes('glm') ||
          name.includes('kimi') || name.includes('gpt') || name.includes('minimax')) {
        return true;
      }
      // Exclude image/audio/video models
      if (name.includes('flux') || name.includes('whisper') || name.includes('image') ||
          name.includes('video') || name.includes('audio')) {
        return false;
      }
      return true;
    });

    if (llmPrices.length === 0) {
      errors.push('No pricing data could be extracted from Together AI pricing page. The page structure may have changed.');
    }

    return {
      success: errors.length === 0 && llmPrices.length > 0,
      source: this.getSourceName(),
      prices: llmPrices,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private inferContextWindow(model: string): number {
    const contextWindows: Record<string, number> = {
      'llama-4': 128000,
      'llama-3.3': 128000,
      'llama-3.1': 128000,
      'llama-3': 8192,
      'qwen3': 32768,
      'qwen2.5': 32768,
      'deepseek-v3': 128000,
      'deepseek-r1': 128000,
      'mistral': 32768,
      'gemma': 8192,
      'glm-5': 128000,
      'glm-4': 128000,
      'kimi': 128000,
      'minimax': 24576,
    };

    const normalizedModel = model.toLowerCase();
    for (const [key, value] of Object.entries(contextWindows)) {
      if (normalizedModel.includes(key)) {
        return value;
      }
    }
    return 8192;
  }
}

export async function scrapeTogetherAIDynamic(): Promise<ScraperResult> {
  const scraper = new TogetherAIScraper();
  return scraper.run();
}

// CLI test
if (require.main === module) {
  scrapeTogetherAIDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}