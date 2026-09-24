/** Moonshot/Kimi token pricing from the official Kimi pricing tables. */
import { normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, type PriceData, type ScraperResult } from './lib/playwright-scraper';

const PRICING_PAGE = 'https://platform.kimi.com/docs/pricing/chat';
const PRICING_MARKDOWN_URL = `${PRICING_PAGE}.md`;

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
  getSourceUrl(): string { return PRICING_PAGE; }

  async scrape(): Promise<ScraperResult> {
    // Mintlify exposes the same rendered tables as a small, documented
    // markdown representation. The old per-model URLs now redirect to a
    // generic page, so parsing this source avoids a brittle DOM wait.
    const response = await fetch(PRICING_MARKDOWN_URL, {
      headers: {
        Accept: 'text/markdown,text/plain',
        'User-Agent': 'aiplans.dev pricing scraper (+https://aiplans.dev)',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Kimi pricing markdown returned HTTP ${response.status}`);
    const markdown = await response.text();

    const prices: PriceData[] = [];
    const seen = new Set<string>();
    const tablePattern = /columns=\{\[\s*(.*?)\]\}\s*rows=\{\[\s*(.*?)\]\}\s*\/>/gs;
    for (const table of markdown.matchAll(tablePattern)) {
      const columns = [...table[1].matchAll(/\{\s*title:\s*"([^"]+)"/g)].map(match => match[1]);
      const modelIndex = columns.findIndex(column => /^模型$/.test(column));
      const unitIndex = columns.findIndex(column => /^计费单位$/.test(column));
      const inputIndex = columns.findIndex(column => /输入价格.*缓存未命中/.test(column));
      const cachedIndex = columns.findIndex(column => /输入价格.*缓存命中/.test(column));
      const outputIndex = columns.findIndex(column => /^输出价格$/.test(column));
      const contextIndex = columns.findIndex(column => /上下文窗口/.test(column));
      if ([modelIndex, unitIndex, inputIndex, outputIndex].some(index => index < 0)) continue;

      for (const line of table[2].split('\n')) {
        const rowText = line.trim().replace(/,$/, '');
        if (!rowText.startsWith('[')) continue;
        let cells: unknown;
        try {
          cells = JSON.parse(rowText);
        } catch {
          continue;
        }
        if (!Array.isArray(cells) || !/1M\s*tokens/i.test(String(cells[unitIndex] ?? ''))) continue;
        const modelName = normalizeModelName(String(cells[modelIndex] ?? '')).toLowerCase();
        const input = price(String(cells[inputIndex] ?? ''));
        const output = price(String(cells[outputIndex] ?? ''));
        if (!modelName || seen.has(modelName) || input == null || output == null || output < input) continue;
        prices.push({
          modelName,
          inputPricePer1M: input,
          cachedInputPricePer1M: cachedIndex >= 0 ? price(String(cells[cachedIndex] ?? '')) ?? undefined : undefined,
          outputPricePer1M: output,
          contextWindow: context(String(cells[contextIndex] ?? '')),
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
      errors: prices.length > 0 ? undefined : ['No Moonshot token pricing rows found'],
    };
  }
}

export async function scrapeMoonshotDynamic(): Promise<ScraperResult> {
  return new MoonshotScraper().run();
}

if (require.main === module) scrapeMoonshotDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
