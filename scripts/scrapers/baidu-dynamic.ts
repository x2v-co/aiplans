/** Baidu Qianfan ERNIE online inference prices from the official table. */
import type { ScraperResult } from '../utils/validator';
import { PlaywrightScraper, type PriceData } from './lib/playwright-scraper';

const BAIDU_PRICING_URL = 'https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya';

function canonicalModel(raw: string): string | null {
  const clean = raw.trim().toLowerCase().replace(/\s+/g, '-');
  if (!/^ernie/.test(clean)) return null;
  return clean
    .replace(/-\d{8}$/i, '')
    .replace(/-(?:32k|128k)(?:-preview)?$/i, '')
    .replace(/-preview$/i, '');
}

function numeric(text: string | undefined): number | undefined {
  if (!text || !/^\d+(?:\.\d+)?$/.test(text)) return undefined;
  return Number(text);
}

class BaiduScraper extends PlaywrightScraper {
  getSourceName(): string { return 'Baidu-ERNIE'; }
  getSourceUrl(): string { return BAIDU_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(BAIDU_PRICING_URL);
    await this.page!.waitForTimeout(3_000);

    const rows = await this.page!.locator('table').filter({ hasText: 'ERNIE 5.1' }).first()
      .locator('tr').evaluateAll(elements => elements.map(row =>
        Array.from(row.querySelectorAll('th,td'))
          .map(cell => (cell.textContent ?? '').replace(/\s+/g, ' ').trim())
      ));

    const inputByModel = new Map<string, number>();
    const prices: PriceData[] = [];
    const seen = new Set<string>();
    let currentModel: string | null = null;

    for (const cells of rows.slice(1)) {
      const modelCandidate = canonicalModel(cells[0] ?? '');
      if (modelCandidate && cells.some(cell => /^输入(?:（|$)/.test(cell))) {
        currentModel = modelCandidate;
      }
      if (!currentModel || seen.has(currentModel)) continue;

      const inputIndex = cells.findIndex(cell => /^输入(?:（|$)/.test(cell));
      if (inputIndex >= 0) {
        const input = numeric(cells[inputIndex + 1]);
        if (input != null && !inputByModel.has(currentModel)) {
          inputByModel.set(currentModel, input * 1_000);
        }
        continue;
      }

      const outputIndex = cells.findIndex(cell => /^输出(?:（|$)/.test(cell));
      if (outputIndex < 0) continue;
      const outputPerThousand = numeric(cells[outputIndex + 1]);
      const input = inputByModel.get(currentModel);
      if (input == null || outputPerThousand == null) continue;
      const output = outputPerThousand * 1_000;
      if (output < input) continue;

      prices.push({
        modelName: currentModel,
        inputPricePer1M: input,
        outputPricePer1M: output,
        contextWindow: 128_000,
        isAvailable: true,
        currency: 'CNY',
      });
      seen.add(currentModel);
    }

    const errors = prices.length === 0
      ? ['No ERNIE online inference prices found in the official Qianfan table']
      : undefined;
    return { source: this.getSourceName(), success: prices.length > 0, prices, errors };
  }
}

export async function scrapeBaiduDynamic(): Promise<ScraperResult> {
  return new BaiduScraper().run() as Promise<ScraperResult>;
}

if (require.main === module) {
  scrapeBaiduDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
}
