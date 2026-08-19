/**
 * OpenAI API pricing scraper.
 *
 * The marketing pricing page is Cloudflare-protected. OpenAI's official
 * developer documentation exposes the same data in semantic HTML tables.
 */
import type { ScraperResult } from '../utils/validator';
import { PlaywrightScraper, type PriceData } from './lib/playwright-scraper';

const OPENAI_PRICING_URL = 'https://developers.openai.com/api/docs/pricing';

class OpenAIScraper extends PlaywrightScraper {
  getSourceName(): string { return 'OpenAI-API'; }
  getSourceUrl(): string { return OPENAI_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(OPENAI_PRICING_URL);

    const tables = await this.page!.locator('main table').evaluateAll(elements =>
      elements.map(table => Array.from(table.querySelectorAll('tr')).map(row =>
        Array.from(row.querySelectorAll('th, td')).map(cell =>
          (cell.textContent || '').replace(/\s+/g, ' ').trim()
        )
      ))
    );

    const prices: PriceData[] = [];
    const seen = new Set<string>();
    for (const rows of tables) {
      const header = rows.find(row => row.some(cell => /^Model$/i.test(cell)));
      if (!header) continue;
      if (header.some(cell => /^Training$/i.test(cell))) continue;
      const modelIndex = header.findIndex(cell => /^Model$/i.test(cell));
      const inputIndex = header.findIndex(cell => /^Input$/i.test(cell));
      const cachedIndex = header.findIndex(cell => /^Cached input$/i.test(cell));
      const outputIndex = header.findIndex(cell => /^Output(?: \/ cost)?$/i.test(cell));
      if ([modelIndex, inputIndex, cachedIndex, outputIndex].some(index => index < 0)) continue;

      for (const cells of rows.slice(rows.indexOf(header) + 1)) {
        const modelName = (cells[modelIndex] || '').toLowerCase();
        if (!/^(?:gpt-|o\d|chat-latest)/i.test(modelName) || seen.has(modelName)) continue;

        const input = parseDollar(cells[inputIndex]);
        const cachedInput = parseDollar(cells[cachedIndex]);
        const output = parseDollar(cells[outputIndex]);
        if (input == null || output == null || output < input) continue;

        prices.push({
          modelName,
          inputPricePer1M: input,
          outputPricePer1M: output,
          cachedInputPricePer1M: cachedInput,
          contextWindow: 128_000,
          isAvailable: true,
          currency: 'USD',
        });
        seen.add(modelName);
      }
    }

    const errors = prices.length === 0
      ? ['No standard token prices found in the official OpenAI pricing table.']
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

export async function scrapeOpenAIDynamic(): Promise<ScraperResult> {
  return new OpenAIScraper().run();
}

if (require.main === module) {
  scrapeOpenAIDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
