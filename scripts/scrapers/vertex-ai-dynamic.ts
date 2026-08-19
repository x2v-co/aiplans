/** Google Vertex AI standard token pricing from official pricing tables. */
import type { ScraperResult } from '../utils/validator';
import { PlaywrightScraper, type PriceData } from './lib/playwright-scraper';

const VERTEX_AI_PRICING_URL = 'https://cloud.google.com/vertex-ai/generative-ai/pricing';

function usd(text: string): number | undefined {
  const match = text.match(/\$\s*([\d.]+)/);
  return match ? Number(match[1]) : undefined;
}

function canonicalModel(raw: string): string | null {
  const clean = raw
    .replace(/\*.*$/g, '')
    .replace(/starting January.*$/i, '')
    .replace(/through December.*$/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  if (!/^gemini-/.test(clean)) return null;
  if (/(image|live-api|embedding|deep-research|omni|computer-use)/.test(clean)) return null;
  return clean;
}

class VertexAIScraper extends PlaywrightScraper {
  getSourceName(): string { return 'Vertex-AI'; }
  getSourceUrl(): string { return VERTEX_AI_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(VERTEX_AI_PRICING_URL);
    await this.page!.waitForTimeout(3_000);

    const tables = await this.page!.locator('table').evaluateAll(elements =>
      elements.map(table => Array.from(table.querySelectorAll('tr')).map(row =>
        Array.from(row.querySelectorAll('th,td'))
          .map(cell => (cell.textContent ?? '').replace(/\s+/g, ' ').trim())
      ))
    );

    const inputByModel = new Map<string, number>();
    const prices: PriceData[] = [];
    const seen = new Set<string>();

    for (const rows of tables) {
      const headerText = (rows[0] ?? []).join(' ');
      if (!/\bModel\b/i.test(headerText) || !/\bType\b/i.test(headerText)
          || !/(?:1M tokens|Token Price)/i.test(headerText)) continue;
      if (/(Priority|Flex)/i.test(headerText)) continue;

      let currentModel: string | null = null;
      for (const cells of rows.slice(1)) {
        if (cells[0]) currentModel = canonicalModel(cells[0]);
        if (!currentModel || seen.has(currentModel)) continue;

        const type = cells[1] ?? '';
        const value = cells.slice(2).map(usd).find((item): item is number => item != null);
        if (value == null || value <= 0) continue;

        if (/^Input (?:\(text|text|tokens)/i.test(type)) {
          if (!inputByModel.has(currentModel)) inputByModel.set(currentModel, value);
          continue;
        }
        if (!/^(?:Text output|Output text)/i.test(type)) continue;

        const input = inputByModel.get(currentModel);
        if (input == null || value < input) continue;
        prices.push({
          modelName: currentModel,
          inputPricePer1M: input,
          outputPricePer1M: value,
          contextWindow: 1_000_000,
          isAvailable: true,
          currency: 'USD',
        });
        seen.add(currentModel);
      }
    }

    const errors = prices.length === 0
      ? ['No standard Gemini token prices found in Vertex AI pricing tables']
      : undefined;
    return { source: this.getSourceName(), success: prices.length > 0, prices, errors };
  }
}

export async function scrapeVertexAIDynamic(): Promise<ScraperResult> {
  return new VertexAIScraper().run() as Promise<ScraperResult>;
}

if (require.main === module) {
  scrapeVertexAIDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
}
