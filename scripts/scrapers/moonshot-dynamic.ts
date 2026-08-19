/** Moonshot/Kimi token pricing from the official Kimi pricing tables. */
import { normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, type PriceData, type ScraperResult } from './lib/playwright-scraper';

const PRICING_PAGES = [
  'https://platform.kimi.com/docs/pricing/chat-k3',
  'https://platform.kimi.com/docs/pricing/chat-k27-code',
  'https://platform.kimi.com/docs/pricing/chat-k26',
  'https://platform.kimi.com/docs/pricing/chat-k25',
  'https://platform.kimi.com/docs/pricing/chat-v1',
];

function price(text: string | undefined): number | null {
  const match = text?.match(/[¥￥]?\s*([\d.]+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function context(text: string | undefined): number | null {
  const match = text?.match(/([\d,]+)\s*tokens?/i);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

class MoonshotScraper extends PlaywrightScraper {
  getSourceName(): string { return 'Moonshot'; }
  getSourceUrl(): string { return PRICING_PAGES[0]; }

  async scrape(): Promise<ScraperResult> {
    const prices: PriceData[] = [];
    const seen = new Set<string>();
    for (const url of PRICING_PAGES) {
      await this.navigate(url);
      await this.page!.waitForFunction(() =>
        Array.from(document.querySelectorAll('table')).some(table =>
          /^模型\s*计费单位/.test((table.textContent ?? '').replace(/\s+/g, ' ').trim())
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
      for (const rows of tables) {
        const header = rows[0] ?? [];
        const modelIndex = header.findIndex(cell => /^模型$/.test(cell));
        const unitIndex = header.findIndex(cell => /^计费单位$/.test(cell));
        const inputIndex = header.findIndex(cell => /输入价格.*缓存未命中/.test(cell) || /^输入价格$/.test(cell));
        const cachedIndex = header.findIndex(cell => /输入价格.*缓存命中/.test(cell));
        const outputIndex = header.findIndex(cell => /^输出价格$/.test(cell));
        const contextIndex = header.findIndex(cell => /上下文窗口/.test(cell));
        if ([modelIndex, unitIndex, inputIndex, outputIndex].some(index => index < 0)) continue;
        for (const cells of rows.slice(1)) {
          if (!/1M\s*tokens/i.test(cells[unitIndex] ?? '')) continue;
          const modelName = normalizeModelName(cells[modelIndex] ?? '').toLowerCase();
          const input = price(cells[inputIndex]);
          const output = price(cells[outputIndex]);
          if (!modelName || seen.has(modelName) || input == null || output == null || output < input) continue;
          prices.push({
            modelName,
            inputPricePer1M: input,
            cachedInputPricePer1M: cachedIndex >= 0 ? price(cells[cachedIndex]) ?? undefined : undefined,
            outputPricePer1M: output,
            contextWindow: context(cells[contextIndex]),
            isAvailable: true,
            currency: 'CNY',
          });
          seen.add(modelName);
        }
      }
    }
    return {
      source: this.getSourceName(),
      success: prices.length > 0,
      prices,
      errors: prices.length > 0 ? undefined : ['No Moonshot token pricing rows found'],
    };
  }
}

export async function scrapeMoonshotDynamic(): Promise<ScraperResult> {
  return new MoonshotScraper().run();
}

if (require.main === module) scrapeMoonshotDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
