/**
 * Anthropic API Scraper - Uses Playwright for real HTML parsing
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData } from './lib/playwright-scraper';

const ANTHROPIC_PRICING_URL = 'https://www.anthropic.com/pricing';

class AnthropicScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'Anthropic-API';
  }

  getSourceUrl(): string {
    return ANTHROPIC_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const prices: PriceData[] = [];

    await this.navigate(ANTHROPIC_PRICING_URL);

    // Wait for pricing content to load
    await this.page!.waitForTimeout(2000);

    // Get all text content from the page
    const pageContent = await this.page!.textContent('body') || '';

    // Known Claude model patterns
    const models = [
      { name: 'claude-3-5-sonnet', patterns: [/claude\s*3\.5\s*sonnet/i, /claude-3-5-sonnet/i] },
      { name: 'claude-3-5-haiku', patterns: [/claude\s*3\.5\s*haiku/i, /claude-3-5-haiku/i] },
      { name: 'claude-3-opus', patterns: [/claude\s*3\s*opus/i, /claude-3-opus/i] },
      { name: 'claude-3-sonnet', patterns: [/claude\s*3\s*sonnet(?!\s*3\.5)/i, /claude-3-sonnet/i] },
      { name: 'claude-3-haiku', patterns: [/claude\s*3\s*haiku(?!\s*3\.5)/i, /claude-3-haiku/i] },
      { name: 'claude-3-7-sonnet', patterns: [/claude\s*3\.?7\s*sonnet/i, /claude-3-7-sonnet/i] },
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
            const end = Math.min(pageContent.length, match.index + match[0].length + 300);
            modelSection = pageContent.slice(start, end);
            break;
          }
        }

        if (!modelSection) continue;

        // Extract prices from the section
        // Look for patterns like "$3.00", "$15.00", etc.
        const pricePattern = /\$([\d.]+)/g;
        const priceMatches = [...modelSection.matchAll(pricePattern)];

        if (priceMatches.length >= 2) {
          const prices_found = priceMatches.map(m => parseFloat(m[1]));
          const inputPrice = prices_found[0];
          const outputPrice = prices_found[1];
          const cachedPrice = prices_found.length >= 3 ? prices_found[2] : undefined;

          if (validatePrice(inputPrice) && validatePrice(outputPrice)) {
            prices.push({
              modelName: normalizeModelName(modelInfo.name),
              inputPricePer1M: inputPrice,
              outputPricePer1M: outputPrice,
              cachedInputPricePer1M: cachedPrice,
              contextWindow: 200000,
              isAvailable: true,
              currency: 'USD',
            });
          }
        }
      } catch (error) {
        errors.push(`Failed to extract pricing for ${modelInfo.name}`);
      }
    }

    // Try alternative approach: look for API pricing table
    if (prices.length === 0) {
      // Look for tables or structured pricing data
      const tables = await this.page!.$$('table');
      for (const table of tables) {
        const rows = await table.$$('tr');
        for (const row of rows) {
          const text = await row.textContent();
          if (!text) continue;

          // Check if this row mentions a Claude model
          if (/claude/i.test(text)) {
            const priceMatches = [...text.matchAll(/\$([\d.]+)/g)];
            if (priceMatches.length >= 2) {
              const modelNameMatch = text.match(/claude[-\s]?\d\.?\d?\s*(sonnet|haiku|opus)/i);
              if (modelNameMatch) {
                const modelName = 'claude-' + modelNameMatch[0]
                  .toLowerCase()
                  .replace(/\s+/g, '-')
                  .replace(/claude-?/, '');

                const inputPrice = parseFloat(priceMatches[0][1]);
                const outputPrice = parseFloat(priceMatches[1][1]);

                if (validatePrice(inputPrice) && validatePrice(outputPrice)) {
                  // Avoid duplicates
                  if (!prices.some(p => p.modelName.toLowerCase().includes(modelName.toLowerCase()))) {
                    prices.push({
                      modelName: normalizeModelName(modelName),
                      inputPricePer1M: inputPrice,
                      outputPricePer1M: outputPrice,
                      contextWindow: 200000,
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
      errors.push('No pricing data could be extracted from Anthropic pricing page. The page structure may have changed.');
    }

    return {
      success: errors.length === 0 && prices.length > 0,
      source: this.getSourceName(),
      prices,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

export async function scrapeAnthropicDynamic(): Promise<ScraperResult> {
  const scraper = new AnthropicScraper();
  return scraper.run();
}

// CLI test
if (require.main === module) {
  scrapeAnthropicDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}