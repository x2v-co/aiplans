/**
 * Mistral AI API Scraper - Uses Playwright for real HTML parsing
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData } from './lib/playwright-scraper';

const MISTRAL_PRICING_URL = 'https://mistral.ai/pricing';

class MistralScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'Mistral-AI';
  }

  getSourceUrl(): string {
    return MISTRAL_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const prices: PriceData[] = [];

    await this.navigate(MISTRAL_PRICING_URL);

    // Wait for pricing content to load
    await this.page!.waitForTimeout(2000);

    // Get all text content from the page
    const pageContent = await this.page!.textContent('body') || '';

    // Known Mistral model patterns
    const models = [
      { name: 'codestral', patterns: [/codestral/i] },
      { name: 'mixtral-8x7b', patterns: [/mixtral\s*8x7b/i, /mixtral-8x7b/i] },
      { name: 'mixtral-8x22b', patterns: [/mixtral\s*8x22b/i, /mixtral-8x22b/i] },
      { name: 'mistral-large', patterns: [/mistral[-\s]?large/i] },
      { name: 'mistral-medium', patterns: [/mistral[-\s]?medium/i] },
      { name: 'mistral-small', patterns: [/mistral[-\s]?small/i] },
      { name: 'mistral-nemo', patterns: [/mistral[-\s]?nemo/i] },
      { name: 'pixtral', patterns: [/pixtral/i] },
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
            const end = Math.min(pageContent.length, match.index + match[0].length + 400);
            modelSection = pageContent.slice(start, end);
            break;
          }
        }

        if (!modelSection) continue;

        // Extract prices from the section
        const pricePattern = /\$?([\d.]+)\s*(?:per\s*)?(?:million|1M)?/gi;
        const priceMatches = [...modelSection.matchAll(pricePattern)];

        const validPrices = priceMatches
          .map(m => parseFloat(m[1]))
          .filter(p => p > 0.01 && p < 1000);

        if (validPrices.length >= 2) {
          const inputPrice = validPrices[0];
          const outputPrice = validPrices[1];

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

          // Check if this row mentions a Mistral model
          if (/mistral|mixtral|codestral|pixtral/i.test(text)) {
            const priceMatches = [...text.matchAll(/\$?([\d.]+)/g)];
            const validPrices = priceMatches
              .map(m => parseFloat(m[1]))
              .filter(p => p > 0.01 && p < 1000);

            if (validPrices.length >= 2) {
              const modelNameMatch = text.match(/(mistral[-\s]?(?:large|medium|small|nemo)|mixtral[-\s]?8x(?:7|22)b|codestral|pixtral)/i);
              if (modelNameMatch) {
                const modelName = modelNameMatch[1].toLowerCase().replace(/\s+/g, '-');

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
      errors.push('No pricing data could be extracted from Mistral pricing page. The page structure may have changed.');
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
      'codestral': 32000,
      'mixtral-8x7b': 32000,
      'mixtral-8x22b': 64000,
      'mistral-large': 128000,
      'mistral-medium': 32000,
      'mistral-small': 32000,
      'mistral-nemo': 128000,
    };

    const normalizedModel = model.toLowerCase();
    for (const [key, value] of Object.entries(contextWindows)) {
      if (normalizedModel.includes(key)) {
        return value;
      }
    }
    return 32000;
  }
}

export async function scrapeMistralDynamic(): Promise<ScraperResult> {
  const scraper = new MistralScraper();
  return scraper.run();
}

// CLI test
if (require.main === module) {
  scrapeMistralDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}