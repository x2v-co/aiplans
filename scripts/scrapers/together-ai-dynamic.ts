/**
 * Together AI scraper - reads only the Serverless Inference model tables.
 * The same page contains GPU, fine-tuning, and dedicated deployment tables
 * whose columns are not token input/output prices.
 */

import { validatePrice, normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, PriceData, ScraperResult } from './lib/playwright-scraper';

const TOGETHER_AI_PRICING_URL = 'https://together.ai/pricing';

function parseDollarPrice(text: string): number | null {
  const match = text.match(/\$(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const price = Number.parseFloat(match[1]);
  return validatePrice(price) ? price : null;
}

class TogetherAIScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'Together-AI';
  }

  getSourceUrl(): string {
    return TOGETHER_AI_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(TOGETHER_AI_PRICING_URL);
    await this.page!.waitForTimeout(3000);

    const prices: PriceData[] = [];
    const serverlessSection = this.page!.locator('#serverless-inference').locator('xpath=..');
    const tables = serverlessSection.locator('table');

    for (let tableIndex = 0; tableIndex < await tables.count(); tableIndex++) {
      const table = tables.nth(tableIndex);
      const headers = (await table.locator('thead').innerText()).toLowerCase();
      if (!headers.includes('model') || !headers.includes('input') || !headers.includes('output')) {
        continue;
      }

      const rows = table.locator('tbody tr');
      for (let rowIndex = 0; rowIndex < await rows.count(); rowIndex++) {
        const cells = rows.nth(rowIndex).locator('td');
        if (await cells.count() < 3) continue;

        const rawModelName = (await cells.nth(0).innerText()).replace(/\s+/g, ' ').trim();
        const inputPrice = parseDollarPrice(await cells.nth(1).innerText());
        const outputPrice = parseDollarPrice(await cells.nth(2).innerText());
        if (!rawModelName || rawModelName.length > 100 || inputPrice === null || outputPrice === null) {
          continue;
        }
        if (outputPrice < inputPrice) continue;

        const modelName = normalizeModelName(rawModelName);
        if (!prices.some(price => price.modelName === modelName)) {
          prices.push({
            modelName,
            inputPricePer1M: inputPrice,
            outputPricePer1M: outputPrice,
            contextWindow: this.inferContextWindow(modelName),
            isAvailable: true,
            currency: 'USD',
          });
        }
      }
    }

    const errors = prices.length === 0
      ? ['No model input/output tables were found in the Together AI Serverless Inference section.']
      : undefined;

    return {
      success: prices.length > 0,
      source: this.getSourceName(),
      prices,
      errors,
    };
  }

  private inferContextWindow(model: string): number | null {
    const contextWindows: Array<[string, number]> = [
      ['llama-4', 128000],
      ['llama-3.3', 128000],
      ['llama-3.1', 128000],
      ['llama-3', 8192],
      ['qwen', 32768],
      ['deepseek', 128000],
      ['mistral', 32768],
      ['glm', 128000],
      ['kimi', 128000],
      ['minimax', 24576],
    ];

    const normalizedModel = model.toLowerCase();
    return contextWindows.find(([key]) => normalizedModel.includes(key))?.[1] ?? null;
  }
}

export async function scrapeTogetherAIDynamic(): Promise<ScraperResult> {
  const scraper = new TogetherAIScraper();
  return scraper.run();
}

if (require.main === module) {
  scrapeTogetherAIDynamic().then(result => {
    console.log('\nScrape result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
