/** MiniMax China language-model pricing from the official pay-as-you-go tables. */
import { normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, type PriceData, type ScraperResult } from './lib/playwright-scraper';

const MINIMAX_PRICING_URL = 'https://platform.minimaxi.com/docs/guides/pricing-paygo';

function finalPrice(text: string | undefined): number | null {
  const matches = text?.match(/[\d.]+/g);
  if (!matches?.length) return null;
  const value = Number(matches[matches.length - 1]);
  return Number.isFinite(value) ? value : null;
}

class MiniMaxScraper extends PlaywrightScraper {
  getSourceName(): string { return 'Minimax'; }
  getSourceUrl(): string { return MINIMAX_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(MINIMAX_PRICING_URL);
    await this.page!.waitForFunction(() =>
      Array.from(document.querySelectorAll('table')).some(table =>
        /输入价格/.test(table.textContent ?? '') && /输出价格/.test(table.textContent ?? '')
      ),
      undefined,
      { timeout: 15_000 }
    );

    const tables = await this.page!.locator('table').evaluateAll(elements =>
      elements.map(table => Array.from(table.querySelectorAll('tr')).map(row =>
        Array.from(row.querySelectorAll('th,td')).map(cell =>
          (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
        )
      ))
    );

    const prices: PriceData[] = [];
    const seen = new Set<string>();
    for (const rows of tables) {
      const header = rows[0] ?? [];
      const modelIndex = header.findIndex(cell => /^模型$/.test(cell));
      const inputIndex = header.findIndex(cell => /^输入价格/.test(cell));
      const outputIndex = header.findIndex(cell => /^输出价格/.test(cell));
      const cachedIndex = header.findIndex(cell => /^缓存读取/.test(cell));
      if ([modelIndex, inputIndex, outputIndex].some(index => index < 0)) continue;

      for (const cells of rows.slice(1)) {
        const rawModel = cells[modelIndex] ?? '';
        const modelMatch = rawModel.match(/^MiniMax-M[\d.]+(?:-highspeed)?/i);
        if (!modelMatch) continue;
        const modelName = normalizeModelName(modelMatch[0]).toLowerCase();
        if (seen.has(modelName)) continue;

        const input = finalPrice(cells[inputIndex]);
        const output = finalPrice(cells[outputIndex]);
        const cachedInput = cachedIndex >= 0 ? finalPrice(cells[cachedIndex]) : null;
        if (input == null || output == null || output < input) continue;
        prices.push({
          modelName,
          inputPricePer1M: input,
          cachedInputPricePer1M: cachedInput ?? undefined,
          outputPricePer1M: output,
          contextWindow: modelName === 'minimax-m3' ? 1_000_000 : null,
          isAvailable: true,
          currency: 'CNY',
        });
        seen.add(modelName);
      }
    }

    return {
      source: this.getSourceName(),
      success: prices.length > 0,
      prices,
      errors: prices.length > 0 ? undefined : ['No MiniMax language-model token pricing rows found'],
    };
  }
}

export async function scrapeMiniMaxDynamic(): Promise<ScraperResult> {
  return new MiniMaxScraper().run();
}

if (require.main === module) scrapeMiniMaxDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
