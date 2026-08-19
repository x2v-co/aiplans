/**
 * Replicate API scraper - reads the token-priced examples from the pricing page.
 * The page also contains image, video, hardware, and training prices, so only
 * entries with explicit input/output token units are accepted.
 */

import { normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData, ScraperResult } from './lib/playwright-scraper';

const REPLICATE_PRICING_URL = 'https://replicate.com/pricing';

const TOKEN_PRICE_PATTERN =
  /\$(\d+(?:\.\d+)?)\s*\/\s*(thousand|million)\s+output tokens\s*\$(\d+(?:\.\d+)?)\s*\/\s*(thousand|million)\s+input tokens/i;

function perMillion(value: string, unit: string): number {
  const price = Number.parseFloat(value);
  return unit.toLowerCase() === 'thousand' ? price * 1000 : price;
}

function inferContextWindow(modelName: string): number | null {
  if (modelName.includes('claude-')) return 200000;
  if (modelName.includes('deepseek-')) return 128000;
  return null;
}

class ReplicateScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'Replicate';
  }

  getSourceUrl(): string {
    return REPLICATE_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(REPLICATE_PRICING_URL);
    await this.page!.waitForTimeout(3000);

    const prices: PriceData[] = [];
    const modelCards = this.page!.locator('a[href^="https://replicate.com/"]');

    for (let index = 0; index < await modelCards.count(); index++) {
      const card = modelCards.nth(index);
      const href = await card.getAttribute('href');
      if (!href) continue;

      const pathname = new URL(href).pathname;
      const modelPath = pathname.match(/^\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9._-]*)\/?$/i);
      const priceMatch = (await card.innerText()).match(TOKEN_PRICE_PATTERN);
      if (!modelPath || !priceMatch) continue;

      const modelName = normalizeModelName(modelPath[2]);
      const outputPrice = perMillion(priceMatch[1], priceMatch[2]);
      const inputPrice = perMillion(priceMatch[3], priceMatch[4]);

      if (!Number.isFinite(inputPrice) || !Number.isFinite(outputPrice) || outputPrice < inputPrice) {
        continue;
      }

      if (!prices.some(price => price.modelName === modelName)) {
        prices.push({
          modelName,
          inputPricePer1M: inputPrice,
          outputPricePer1M: outputPrice,
          contextWindow: inferContextWindow(modelName),
          isAvailable: true,
          currency: 'USD',
        });
      }
    }

    const errors = prices.length === 0
      ? ['No entries with explicit input and output token pricing were found on the Replicate pricing page.']
      : undefined;

    return {
      success: prices.length > 0,
      source: this.getSourceName(),
      prices,
      errors,
    };
  }
}

export async function scrapeReplicateDynamic(): Promise<ScraperResult> {
  const scraper = new ReplicateScraper();
  return scraper.run();
}

if (require.main === module) {
  scrapeReplicateDynamic().then(result => {
    console.log('\nScrape result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
