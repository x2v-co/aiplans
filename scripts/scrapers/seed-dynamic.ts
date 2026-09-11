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

    // doubao-seed-1.6/1.8 tier models are billed by BOTH input-length band
    // ([0,32K], (32K,128K], …) and output length: responses ≤200 output
    // tokens get a short-output price, all longer responses the standard one
    // (e.g. ¥2 vs ¥8 per 1M). Rows share one rowspan model-name cell, so the
    // continuation rows arrive with an empty first cell. We keep the base
    // [0,32K] input/cache price and always take the STANDARD output tier
    // (0.2K,+∞); the ≤0.2K tier understates normal chat/agent output 4x.
    interface SeedEntry { input?: number; cached?: number; output?: number; band?: number | null }
    const byModel = new Map<string, SeedEntry>();
    let current = '';
    for (const cells of rows.slice(1)) {
      const firstName = clean(cells[0] ?? '').toLowerCase();
      if (/^doubao-/.test(firstName)) {
        current = firstName;
        if (!byModel.has(current)) byModel.set(current, { band: undefined });
      } else if (firstName !== '') {
        // A different product's row (glm-*, etc.); stop attributing tiers.
        current = '';
        continue;
      }
      if (!current) continue;
      const entry = byModel.get(current);
      if (!entry) continue;
      const condition = clean(cells[1] ?? '');
      // Each model's bands are listed shortest first; the first row fixes the
      // base band ([0,32K] for Seed 1.x/2.0, [0,256K] for 2.1, [0,1024K] for
      // evolving). Longer input bands are different products price-wise and
      // must not overwrite base-band values.
      const bandMatch = condition.match(/输入长度\s*\[\s*0\s*,\s*(\d+)/);
      const band: number | null = bandMatch ? Number(bandMatch[1]) : null;
      if (entry.band === undefined) entry.band = band;
      if (band !== entry.band) continue;
      const tieredOutput = condition.includes('输出长度');
      const isStandardOutputTier = /\(0\s*[,.]\s*2\s*,/.test(condition);
      if (tieredOutput && !isStandardOutputTier) continue;

      if (entry.input == null && numeric(cells[2]) != null) {
        entry.input = numeric(cells[2]);
        entry.cached = numeric(cells[5]);
      }
      const out = numeric(cells[7]);
      if (out != null && entry.output == null) entry.output = out;
    }

    const prices: PriceData[] = [];
    for (const [modelName, entry] of byModel) {
      if (entry.input == null || entry.output == null || entry.input <= 0 || entry.output < entry.input) continue;
      prices.push({
        modelName,
        inputPricePer1M: entry.input,
        outputPricePer1M: entry.output,
        cachedInputPricePer1M: entry.cached,
        contextWindow: 256_000,
        isAvailable: true,
        currency: 'CNY',
      });
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
