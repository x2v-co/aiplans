/** Tencent Hunyuan official list prices from the published pricing table. */
import type { ScraperResult } from '../utils/validator';
import { PlaywrightScraper, type PriceData } from './lib/playwright-scraper';

const HUNYUAN_PRICING_URL = 'https://cloud.tencent.com/document/product/1729/97731';

function canonicalModel(raw: string): string | null {
  const clean = raw.trim().toLowerCase().replace(/\s+/g, '-');
  if (clean === 'tencent-hy-vision-1.5-instruct') return 'hy-vision-1.5-instruct';
  if (!/^(hunyuan|tencent-hy)/.test(clean)) return null;
  return clean;
}

class HunyuanScraper extends PlaywrightScraper {
  getSourceName(): string { return 'Hunyuan-Tencent'; }
  getSourceUrl(): string { return HUNYUAN_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(HUNYUAN_PRICING_URL);
    await this.page!.waitForTimeout(2_000);

    const rows = await this.page!.locator('table').filter({ hasText: '刊例价' }).first()
      .locator('tr').allTextContents();
    const prices: PriceData[] = [];
    const seen = new Set<string>();

    for (const text of rows) {
      const match = text.replace(/\s+/g, ' ').trim()
        .match(/^(.*?)输入[：:]\s*([\d.]+)元\s*输出[：:]\s*([\d.]+)元/i);
      if (!match) continue;
      const modelName = canonicalModel(match[1]);
      if (!modelName || seen.has(modelName)) continue;
      const input = Number(match[2]);
      const output = Number(match[3]);
      if (input <= 0 || output < input) continue;

      prices.push({
        modelName,
        inputPricePer1M: input,
        outputPricePer1M: output,
        contextWindow: modelName.includes('vision') ? 32_000 : 128_000,
        isAvailable: true,
        currency: 'CNY',
      });
      seen.add(modelName);
    }

    const errors = prices.length === 0
      ? ['No Hunyuan list prices found in the official pricing table']
      : undefined;
    return { source: this.getSourceName(), success: prices.length > 0, prices, errors };
  }
}

export async function scrapeHunyuanDynamic(): Promise<ScraperResult> {
  return new HunyuanScraper().run() as Promise<ScraperResult>;
}

if (require.main === module) {
  scrapeHunyuanDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
}
