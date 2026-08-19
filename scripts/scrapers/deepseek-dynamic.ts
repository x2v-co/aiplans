/** DeepSeek API pricing scraper using the official semantic pricing table. */
import type { ScraperResult } from '../utils/validator';
import { PlaywrightScraper, type PriceData } from './lib/playwright-scraper';

const DEEPSEEK_PRICING_URL = 'https://api-docs.deepseek.com/quick_start/pricing';

class DeepSeekScraper extends PlaywrightScraper {
  getSourceName(): string { return 'DeepSeek-API'; }
  getSourceUrl(): string { return DEEPSEEK_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(DEEPSEEK_PRICING_URL);

    const rows = await this.page!.locator('table').first().locator('tr').evaluateAll(tableRows =>
      tableRows.map(row =>
        Array.from(row.querySelectorAll('th, td')).map(cell =>
          (cell.textContent || '').replace(/\s+/g, ' ').trim()
        )
      )
    );

    const modelRow = rows.find(row => row[0] === 'MODEL');
    const modelNames = modelRow?.slice(1) || [];
    const cacheMissRows = rows.filter(row => row.includes('1M INPUT TOKENS (CACHE MISS)') || row[0] === 'PEAK');
    const outputRows = rows.filter(row => row.includes('1M OUTPUT TOKENS') || row[0] === 'PEAK');

    const peakRows = rows.filter(row => row[0] === 'PEAK');
    const peakInput = peakRows[1]?.slice(-modelNames.length).map(parseDollar);
    const peakOutput = peakRows[2]?.slice(-modelNames.length).map(parseDollar);
    void cacheMissRows;
    void outputRows;

    const prices: PriceData[] = [];
    for (let index = 0; index < modelNames.length; index++) {
      const input = peakInput?.[index] ?? null;
      const output = peakOutput?.[index] ?? null;
      if (input == null || output == null) continue;

      prices.push({
        modelName: modelNames[index].toLowerCase(),
        inputPricePer1M: input,
        outputPricePer1M: output,
        contextWindow: 1_000_000,
        isAvailable: true,
        currency: 'USD',
      });
    }

    const errors = prices.length === 0
      ? ['No peak cache-miss/input and output prices found in the official DeepSeek table.']
      : undefined;
    return {
      success: errors == null,
      source: this.getSourceName(),
      prices,
      errors,
    };
  }
}

function parseDollar(value: string | undefined): number | null {
  const match = value?.match(/\$([\d.]+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function scrapeDeepSeekDynamic(): Promise<ScraperResult> {
  return new DeepSeekScraper().run();
}

if (require.main === module) {
  scrapeDeepSeekDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
