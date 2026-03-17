/**
 * DeepSeek API Scraper - Scrapes pricing documentation page
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData } from './lib/playwright-scraper';

const DEEPSEEK_PRICING_URL = 'https://api-docs.deepseek.com/quick_start/pricing';

class DeepSeekScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'DeepSeek-API';
  }

  getSourceUrl(): string {
    return DEEPSEEK_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const prices: PriceData[] = [];

    await this.navigate(DEEPSEEK_PRICING_URL);

    // Wait for pricing content to load
    await this.page!.waitForTimeout(2000);

    // Get all text content from the page
    const pageContent = await this.page!.textContent('body') || '';

    // Known DeepSeek model patterns
    const models = [
      { name: 'deepseek-chat', patterns: [/deepseek[-\s]?chat/i] },
      { name: 'deepseek-coder', patterns: [/deepseek[-\s]?coder/i] },
      { name: 'deepseek-reasoner', patterns: [/deepseek[-\s]?reasoner/i] },
      { name: 'deepseek-v3', patterns: [/deepseek[-\s]?v3/i] },
      { name: 'deepseek-r1', patterns: [/deepseek[-\s]?r1/i] },
    ];

    for (const modelInfo of models) {
      try {
        // Find the section containing this model's pricing
        let modelSection: string | null = null;

        for (const pattern of modelInfo.patterns) {
          const match = pageContent.match(pattern);
          if (match && match.index !== undefined) {
            // Extract surrounding context
            const start = Math.max(0, match.index - 100);
            const end = Math.min(pageContent.length, match.index + match[0].length + 400);
            modelSection = pageContent.slice(start, end);
            break;
          }
        }

        if (!modelSection) continue;

        // Extract prices from the section
        // DeepSeek shows prices in CNY (¥) or USD ($)
        // Look for patterns like "¥0.2", "$0.03", "0.20/M", etc.
        const cnyPattern = /[¥￥]?\s*([\d.]+)\s*(?:\u5143|CNY)?\s*(?:per\s*)?(?:million|1M)?/gi;
        const usdPattern = /\$?\s*([\d.]+)\s*(?:USD)?\s*(?:per\s*)?(?:million|1M)?/gi;

        const cnyMatches = [...modelSection.matchAll(cnyPattern)];
        const usdMatches = [...modelSection.matchAll(usdPattern)];

        const validPrices: number[] = [];

        // Process CNY prices (DeepSeek primary currency)
        for (const match of cnyMatches) {
          const price = parseFloat(match[1]);
          if (price > 0 && price < 1000) {
            validPrices.push(price);
          }
        }

        // Fallback to USD prices if no CNY found
        if (validPrices.length < 2) {
          for (const match of usdMatches) {
            const price = parseFloat(match[1]);
            if (price > 0 && price < 1000) {
              validPrices.push(price);
            }
          }
        }

        if (validPrices.length >= 2) {
          const inputPrice = validPrices[0];
          const outputPrice = validPrices[1];

          if (validatePrice(inputPrice) && validatePrice(outputPrice)) {
            prices.push({
              modelName: normalizeModelName(modelInfo.name),
              inputPricePer1M: inputPrice,
              outputPricePer1M: outputPrice,
              contextWindow: 128000,
              isAvailable: true,
              currency: 'CNY', // DeepSeek uses CNY
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

          // Check if this row mentions a DeepSeek model
          if (/deepseek/i.test(text)) {
            const priceMatches = [...text.matchAll(/[¥￥$]?\s*([\d.]+)/g)];
            const validPrices = priceMatches
              .map(m => parseFloat(m[1]))
              .filter(p => p > 0 && p < 1000);

            if (validPrices.length >= 2) {
              const modelNameMatch = text.match(/deepseek[-\s]?(chat|coder|reasoner|v3|r1)/i);
              if (modelNameMatch) {
                const modelName = 'deepseek-' + modelNameMatch[1].toLowerCase();

                const inputPrice = validPrices[0];
                const outputPrice = validPrices[1];

                if (validatePrice(inputPrice) && validatePrice(outputPrice)) {
                  // Avoid duplicates
                  if (!prices.some(p => p.modelName.toLowerCase().includes(modelName.toLowerCase()))) {
                    prices.push({
                      modelName: normalizeModelName(modelName),
                      inputPricePer1M: inputPrice,
                      outputPricePer1M: outputPrice,
                      contextWindow: 128000,
                      isAvailable: true,
                      currency: 'CNY',
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
      errors.push('No pricing data could be extracted from DeepSeek pricing page. The page structure may have changed.');
    }

    return {
      success: errors.length === 0 && prices.length > 0,
      source: this.getSourceName(),
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

export async function scrapeDeepSeekDynamic(): Promise<ScraperResult> {
  const scraper = new DeepSeekScraper();
  return scraper.run();
}

// CLI test
if (require.main === module) {
  scrapeDeepSeekDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}