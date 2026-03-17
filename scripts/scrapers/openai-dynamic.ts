/**
 * OpenAI API Scraper - Uses Playwright for real HTML parsing
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData } from './lib/playwright-scraper';

const OPENAI_PRICING_URL = 'https://openai.com/api/pricing/';

class OpenAIScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'OpenAI-API';
  }

  getSourceUrl(): string {
    return OPENAI_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const prices: PriceData[] = [];

    await this.navigate(OPENAI_PRICING_URL);

    // Wait for pricing tables to load
    await this.page!.waitForTimeout(2000);

    // Try to extract pricing from the page
    // OpenAI's pricing page structure may vary, so we try multiple approaches

    // Approach 1: Look for pricing tables
    const pricingRows = await this.page!.$$('[class*="pricing"] tr, [class*="PricingTable"] tr, table tbody tr');

    if (pricingRows.length > 0) {
      for (const row of pricingRows) {
        try {
          const text = await row.textContent();
          if (!text) continue;

          // Extract model name and prices from row text
          const modelMatch = text.match(/(gpt-4[\w.-]*|gpt-3\.5[\w.-]*|o[1-9][\w.-]*|chatgpt-4[\w.-]*)/i);
          if (!modelMatch) continue;

          const modelName = modelMatch[1].toLowerCase();

          // Extract prices - look for $X.XX patterns
          const priceMatches = text.matchAll(/\$([\d.]+)/g);
          const priceValues = Array.from(priceMatches).map(m => parseFloat(m[1]));

          if (priceValues.length >= 2) {
            const inputPrice = priceValues[0];
            const outputPrice = priceValues[1];

            if (validatePrice(inputPrice) && validatePrice(outputPrice)) {
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
        } catch (error) {
          // Skip rows that fail to parse
        }
      }
    }

    // Approach 2: Look for structured data or specific selectors
    if (prices.length === 0) {
      const allText = await this.page!.textContent('body') || '';

      // Try to find model names and their associated prices
      const models = [
        'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo',
        'o1', 'o1-mini', 'o1-preview', 'o3-mini', 'gpt-4.1', 'gpt-4.1-mini'
      ];

      for (const model of models) {
        // Look for price patterns near model name
        const modelSection = this.extractSectionAroundModel(allText, model);
        if (!modelSection) continue;

        const priceMatches = modelSection.matchAll(/\$?([\d.]+)\s*(?:per\s*)?(?:million|1M)/gi);
        const priceValues = Array.from(priceMatches).map(m => parseFloat(m[1]));

        if (priceValues.length >= 2) {
          prices.push({
            modelName: normalizeModelName(model),
            inputPricePer1M: priceValues[0],
            outputPricePer1M: priceValues[1],
            contextWindow: this.inferContextWindow(model),
            isAvailable: true,
            currency: 'USD',
          });
        }
      }
    }

    if (prices.length === 0) {
      errors.push('No pricing data could be extracted from the page. The page structure may have changed.');
    }

    return {
      success: errors.length === 0 && prices.length > 0,
      source: this.getSourceName(),
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private extractSectionAroundModel(text: string, model: string): string | null {
    const index = text.toLowerCase().indexOf(model.toLowerCase());
    if (index === -1) return null;

    // Extract 500 chars before and after
    const start = Math.max(0, index - 500);
    const end = Math.min(text.length, index + model.length + 500);
    return text.slice(start, end);
  }

  private inferContextWindow(model: string): number {
    const contextWindows: Record<string, number> = {
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 16385,
      'o1': 200000,
      'o1-mini': 128000,
      'o1-preview': 128000,
      'o3-mini': 200000,
      'gpt-4.1': 128000,
      'gpt-4.1-mini': 128000,
    };
    return contextWindows[model.toLowerCase()] || 128000;
  }
}

export async function scrapeOpenAIDynamic(): Promise<ScraperResult> {
  const scraper = new OpenAIScraper();
  return scraper.run();
}

// CLI test
if (require.main === module) {
  scrapeOpenAIDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}