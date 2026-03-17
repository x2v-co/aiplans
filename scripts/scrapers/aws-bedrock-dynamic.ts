/**
 * AWS Bedrock API Scraper - Uses Playwright for real HTML parsing
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPrice, ScraperResult } from '../utils/validator';
import { validatePrice, slugify, normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData } from './lib/playwright-scraper';

const AWS_PRICING_URL = 'https://aws.amazon.com/bedrock/pricing/';

class AWSBedrockScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'AWS-Bedrock';
  }

  getSourceUrl(): string {
    return AWS_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const prices: PriceData[] = [];

    await this.navigate(AWS_PRICING_URL);

    // Wait for pricing content to load
    await this.page!.waitForTimeout(3000);

    // Get all text content from the page
    const pageContent = await this.page!.textContent('body') || '';

    // Known AWS Bedrock model patterns
    // AWS prices are per 1K tokens for some models (Claude), per 1M for others (Llama)
    const models = [
      { name: 'claude-3-5-sonnet', patterns: [/claude\s*3\.5\s*sonnet/i, /claude-3-5-sonnet/i] },
      { name: 'claude-3-5-haiku', patterns: [/claude\s*3\.5\s*haiku/i, /claude-3-5-haiku/i] },
      { name: 'claude-3-opus', patterns: [/claude\s*3\s*opus/i, /claude-3-opus/i] },
      { name: 'claude-3-sonnet', patterns: [/claude\s*3\s*sonnet(?!\s*3\.5)/i] },
      { name: 'claude-3-haiku', patterns: [/claude\s*3\s*haiku(?!\s*3\.5)/i] },
      { name: 'llama-3-1-405b', patterns: [/llama\s*3\.1\s*405b/i, /llama-3-1-405b/i] },
      { name: 'llama-3-1-70b', patterns: [/llama\s*3\.1\s*70b/i, /llama-3-1-70b/i] },
      { name: 'llama-3-8b', patterns: [/llama\s*3\s*8b/i, /llama-3-8b/i] },
      { name: 'mistral-large', patterns: [/mistral\s*large/i, /mistral-large/i] },
      { name: 'mixtral-8x7b', patterns: [/mixtral\s*8x7b/i, /mixtral-8x7b/i] },
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

        // Extract prices from the section
        // AWS shows prices as per 1K or per 1M tokens
        const isPer1K = /per\s*1K/i.test(modelSection) || /per\s*1,000/i.test(modelSection);

        // Look for price patterns
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
          if (/claude|llama|mistral|mixtral/i.test(text)) {
            const modelNameMatch = text.match(/(claude[-\s]?\d\.?\d?\s*(sonnet|haiku|opus)|llama[-\s]?\d\.?\d?\s*\d+b|mistral[-\s]?large|mixtral[-\s]?8x7b)/i);
            if (modelNameMatch) {
              const modelName = modelNameMatch[1].toLowerCase().replace(/\s+/g, '-');

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
      errors.push('No pricing data could be extracted from AWS Bedrock pricing page. The page structure may have changed.');
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
      'claude-3': 200000,
      'llama-3-1': 131072,
      'llama-3': 131072,
      'mistral-large': 128000,
      'mixtral': 32768,
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

export async function scrapeAWSBedrockDynamic(): Promise<ScraperResult> {
  const scraper = new AWSBedrockScraper();
  return scraper.run();
}

// CLI test
if (require.main === module) {
  scrapeAWSBedrockDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}