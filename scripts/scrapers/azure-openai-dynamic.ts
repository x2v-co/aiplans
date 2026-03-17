/**
 * Azure OpenAI API Scraper - Uses Playwright for real HTML parsing
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData } from './lib/playwright-scraper';

const AZURE_PRICING_URL = 'https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/';

class AzureOpenAIScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'Azure-OpenAI';
  }

  getSourceUrl(): string {
    return AZURE_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const prices: PriceData[] = [];

    await this.navigate(AZURE_PRICING_URL);

    // Wait for pricing content to load
    await this.page!.waitForTimeout(3000);

    // Get all text content from the page
    const pageContent = await this.page!.textContent('body') || '';

    // Known Azure OpenAI model patterns
    // Azure prices are typically per 1K tokens, so we need to convert to per 1M
    const models = [
      { name: 'gpt-4o', patterns: [/gpt-4o/i] },
      { name: 'gpt-4o-mini', patterns: [/gpt-4o-mini/i] },
      { name: 'gpt-4-turbo', patterns: [/gpt-4-turbo/i, /gpt-4\.\d-turbo/i] },
      { name: 'gpt-35-turbo', patterns: [/gpt-3\.5-turbo/i, /gpt-35-turbo/i] },
      { name: 'o1', patterns: [/o1(?!-mini)/i] },
      { name: 'o1-mini', patterns: [/o1-mini/i] },
      { name: 'claude-3-5-sonnet', patterns: [/claude\s*3\.5\s*sonnet/i] },
      { name: 'claude-3-5-haiku', patterns: [/claude\s*3\.5\s*haiku/i] },
    ];

    for (const modelInfo of models) {
      try {
        // Find the section containing this model's pricing
        let modelSection: string | null = null;

        for (const pattern of modelInfo.patterns) {
          const match = pageContent.match(pattern);
          if (match && match.index !== undefined) {
            // Extract surrounding context
            const start = Math.max(0, match.index - 200);
            const end = Math.min(pageContent.length, match.index + match[0].length + 500);
            modelSection = pageContent.slice(start, end);
            break;
          }
        }

        if (!modelSection) continue;

        // Azure prices are typically per 1K tokens
        const isPer1K = /per\s*1K/i.test(modelSection) || /per\s*1,000/i.test(modelSection);

        // Extract prices from the section
        const pricePattern = /\$?([\d.]+)\s*(?:per\s*)?(?:1K|1,000|1M|million)?/gi;
        const priceMatches = [...modelSection.matchAll(pricePattern)];

        const validPrices = priceMatches
          .map(m => parseFloat(m[1]))
          .filter(p => p > 0 && p < 100);

        if (validPrices.length >= 2) {
          let inputPrice = validPrices[0];
          let outputPrice = validPrices[1];

          // Convert per 1K to per 1M
          if (isPer1K) {
            inputPrice *= 1000;
            outputPrice *= 1000;
          }

          if (validatePrice(inputPrice) && validatePrice(outputPrice)) {
            prices.push({
              modelName: normalizeModelName(modelInfo.name),
              inputPricePer1M: inputPrice,
              outputPricePer1M: outputPrice,
              contextWindow: this.inferContextWindow(modelInfo.name),
              isAvailable: true,
              currency: 'USD',
            });
          }
        }
      } catch (error) {
        errors.push(`Failed to extract pricing for ${modelInfo.name}`);
      }
    }

    // Try alternative approach: look for pricing tables
    if (prices.length === 0) {
      const tables = await this.page!.$$('table');
      for (const table of tables) {
        const rows = await table.$$('tr');
        for (const row of rows) {
          const text = await row.textContent();
          if (!text) continue;

          // Check if this row mentions a model
          if (/gpt|claude|o1/i.test(text)) {
            const modelNameMatch = text.match(/(gpt-4o(?:-mini)?|gpt-4-turbo|gpt-3\.5-turbo|gpt-35-turbo|o1(?:-mini)?|claude-3\.5-(?:sonnet|haiku))/i);
            if (modelNameMatch) {
              const modelName = modelNameMatch[1].toLowerCase();

              const isPer1K = /per\s*1K/i.test(text) || /per\s*1,000/i.test(text);
              const priceMatches = [...text.matchAll(/\$?([\d.]+)/g)];
              const validPrices = priceMatches
                .map(m => parseFloat(m[1]))
                .filter(p => p > 0 && p < 100);

              if (validPrices.length >= 2) {
                let inputPrice = validPrices[0];
                let outputPrice = validPrices[1];

                if (isPer1K) {
                  inputPrice *= 1000;
                  outputPrice *= 1000;
                }

                if (validatePrice(inputPrice) && validatePrice(outputPrice)) {
                  // Avoid duplicates
                  if (!prices.some(p => p.modelName.toLowerCase().includes(modelName.toLowerCase()))) {
                    prices.push({
                      modelName: normalizeModelName(modelName),
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
      }
    }

    if (prices.length === 0) {
      errors.push('No pricing data could be extracted from Azure OpenAI pricing page. The page structure may have changed.');
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
      'gpt-4-turbo': 128000,
      'gpt-35-turbo': 16385,
      'o1': 200000,
      'o1-mini': 128000,
      'claude-3': 200000,
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

export async function scrapeAzureOpenAIDynamic(): Promise<ScraperResult> {
  const scraper = new AzureOpenAIScraper();
  return scraper.run();
}

// CLI test
if (require.main === module) {
  scrapeAzureOpenAIDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}