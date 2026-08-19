/** Volcengine Ark online inference prices from the official model table. */
import type { ScraperResult } from '../utils/validator';
import { PlaywrightScraper, type PriceData } from './lib/playwright-scraper';

const SEED_PRICING_URL = 'https://docs.volcengine.com/docs/82379/1544106?lang=zh';

function clean(text: string): string {
  return text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function numeric(text: string | undefined): number | undefined {
  const value = clean(text ?? '');
  return /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : undefined;
}

class SeedScraper extends PlaywrightScraper {
  constructor() {
    super({ blockResources: false, timeout: 60_000 });
  }

  getSourceName(): string { return 'Seed-Volcengine'; }
  getSourceUrl(): string { return SEED_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(SEED_PRICING_URL);
    await this.page!.waitForTimeout(5_000);
    const priceTable = this.page!.locator('table').filter({ hasText: 'doubao-seed-2.1-pro' }).first();
    await priceTable.waitFor({ state: 'attached', timeout: 15_000 });

    const rows = await priceTable.locator('tr').evaluateAll(elements => elements.map(row =>
        Array.from(row.querySelectorAll('th,td')).map(cell => cell.textContent ?? '')
      ));

    const prices: PriceData[] = [];
    const seen = new Set<string>();
    for (const cells of rows.slice(1)) {
      const modelName = clean(cells[0] ?? '').toLowerCase();
      if (!/^doubao-/.test(modelName) || seen.has(modelName)) continue;
      const input = numeric(cells[2]);
      const cached = numeric(cells[5]);
      const output = numeric(cells[7]);
      if (input == null || output == null || input <= 0 || output < input) continue;

      prices.push({
        modelName,
        inputPricePer1M: input,
        outputPricePer1M: output,
        cachedInputPricePer1M: cached,
        contextWindow: 256_000,
        isAvailable: true,
        currency: 'CNY',
      });
      seen.add(modelName);
    }

    const errors = prices.length === 0
      ? ['No Doubao online inference prices found in the official Ark table']
      : undefined;
    return { source: this.getSourceName(), success: prices.length > 0, prices, errors };
  }
}

export async function scrapeSeedDynamic(): Promise<ScraperResult> {
  return new SeedScraper().run() as Promise<ScraperResult>;
}

if (require.main === module) {
  scrapeSeedDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
}
