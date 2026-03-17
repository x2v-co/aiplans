/**
 * Google Gemini API Scraper - Uses Playwright for real HTML parsing
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData } from './lib/playwright-scraper';

const GOOGLE_PRICING_URL = 'https://ai.google.dev/pricing';

class GeminiScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'Google-Gemini-API';
  }

  getSourceUrl(): string {
    return GOOGLE_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const prices: PriceData[] = [];

    await this.navigate(GOOGLE_PRICING_URL);

    // Wait for pricing content to load
    await this.page!.waitForTimeout(2000);

    // Get all text content from the page
    const pageContent = await this.page!.textContent('body') || '';

    // Known Gemini model patterns
    const models = [
      { name: 'gemini-2.0-flash', patterns: [/gemini\s*2\.?0\s*flash/i] },
      { name: 'gemini-2.0-flash-thinking', patterns: [/gemini\s*2\.?0\s*flash.*thinking/i] },
      { name: 'gemini-1.5-pro', patterns: [/gemini\s*1\.5\s*pro/i] },
      { name: 'gemini-1.5-flash', patterns: [/gemini\s*1\.5\s*flash/i] },
      { name: 'gemini-1.0-pro', patterns: [/gemini\s*1\.?0\s*pro/i] },
      { name: 'gemini-exp', patterns: [/gemini\s*exp/i] },
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
        // Look for patterns like "$0.075", "$1.25", etc.
        const pricePattern = /\$?([\d.]+)\s*(?:per\s*)?(?:million|1M)?/gi;
        const priceMatches = [...modelSection.matchAll(pricePattern)];

        // Filter out very small numbers (likely not prices) and very large numbers
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

          // Check if this row mentions a Gemini model
          if (/gemini/i.test(text)) {
            const priceMatches = [...text.matchAll(/\$?([\d.]+)/g)];
            const validPrices = priceMatches
              .map(m => parseFloat(m[1]))
              .filter(p => p > 0.01 && p < 1000);

            if (validPrices.length >= 2) {
              const modelNameMatch = text.match(/gemini[-\s]?\d\.?\d?\s*(pro|flash|exp)?/i);
              if (modelNameMatch) {
                const modelName = modelNameMatch[0]
                  .toLowerCase()
                  .replace(/\s+/g, '-')
                  .replace(/[^a-z0-9-]/g, '');

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
      errors.push('No pricing data could be extracted from Google pricing page. The page structure may have changed.');
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
      'gemini-2.0-flash': 1000000,
      'gemini-1.5-pro': 2000000,
      'gemini-1.5-flash': 1000000,
      'gemini-1.0-pro': 2800000,
    };

    const normalizedModel = model.toLowerCase();
    for (const [key, value] of Object.entries(contextWindows)) {
      if (normalizedModel.includes(key)) {
        return value;
      }
    }
    return 1000000; // Default
  }
}

export async function scrapeGoogleDynamic(): Promise<ScraperResult> {
  const scraper = new GeminiScraper();
  return scraper.run();
}

// CLI test
if (require.main === module) {
  scrapeGoogleDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}