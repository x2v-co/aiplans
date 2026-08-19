/** AWS Bedrock on-demand token pricing from official table rows. */
import type { ScraperResult } from '../utils/validator';
import { PlaywrightScraper, type PriceData } from './lib/playwright-scraper';

const AWS_PRICING_URL = 'https://aws.amazon.com/bedrock/pricing/';

function price(text: string): number | undefined {
  const match = text.match(/\$\s*([\d.]+)/);
  return match ? Number(match[1]) : undefined;
}

function canonicalModel(provider: string, raw: string): string | null {
  if (!/^(Anthropic|Mistral AI?)$/i.test(provider)) return null;
  const clean = raw
    .replace(/\s*\([^)]*\).*$/g, '')
    .replace(/\s+v\d+$/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  if (/^claude-3\.5-sonnet/.test(clean)) return 'claude-3.5-sonnet';
  if (/^claude-3\.5-haiku/.test(clean)) return 'claude-3.5-haiku';
  if (/^claude-3-opus/.test(clean)) return 'claude-3-opus';
  if (/^claude-3-sonnet/.test(clean)) return 'claude-3-sonnet';
  if (/^claude-3-haiku/.test(clean)) return 'claude-3-haiku';
  if (/^claude-(?:opus|sonnet|haiku)-4/.test(clean)) return clean;
  if (/^mistral-large-3/.test(clean)) return 'mistral-large-3';
  if (/^mistral-large/.test(clean)) return 'mistral-large';
  if (/^mixtral-8x7b/.test(clean)) return 'mixtral-8x7b';
  return null;
}

class AWSBedrockScraper extends PlaywrightScraper {
  getSourceName(): string { return 'AWS-Bedrock'; }
  getSourceUrl(): string { return AWS_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(AWS_PRICING_URL);
    await this.page!.waitForTimeout(3_000);

    const tables = await this.page!.locator('table').evaluateAll(elements =>
      elements.map(table => Array.from(table.querySelectorAll('tr')).map(row =>
        Array.from(row.querySelectorAll('th,td'))
          .map(cell => (cell.textContent ?? '').replace(/\s+/g, ' ').trim())
      ))
    );

    const prices: PriceData[] = [];
    const seen = new Set<string>();
    for (const rows of tables) {
      const header = rows[0] ?? [];
      const inputIndex = header.findIndex(cell => /Price per 1M input tokens$/i.test(cell));
      const outputIndex = header.findIndex(cell => /Price per 1M output tokens$/i.test(cell));
      const providerIndex = header.findIndex(cell => /^Provider$/i.test(cell));
      const modelIndex = header.findIndex(cell => /^Model Name$/i.test(cell));
      if (inputIndex < 0 || outputIndex < 0 || providerIndex < 0 || modelIndex < 0) continue;

      for (const cells of rows.slice(1)) {
        const modelName = canonicalModel(cells[providerIndex] ?? '', cells[modelIndex] ?? '');
        if (!modelName || seen.has(modelName)) continue;
        const input = price(cells[inputIndex] ?? '');
        const output = price(cells[outputIndex] ?? '');
        if (input == null || output == null || input <= 0 || output < input) continue;

        prices.push({
          modelName,
          inputPricePer1M: input,
          outputPricePer1M: output,
          contextWindow: modelName.startsWith('claude') ? 200_000 : 128_000,
          isAvailable: true,
          currency: 'USD',
        });
        seen.add(modelName);
      }
    }

    const errors = prices.length === 0
      ? ['No supported on-demand token prices found in AWS Bedrock pricing tables']
      : undefined;
    return { source: this.getSourceName(), success: prices.length > 0, prices, errors };
  }
}

export async function scrapeAWSBedrockDynamic(): Promise<ScraperResult> {
  return new AWSBedrockScraper().run() as Promise<ScraperResult>;
}

if (require.main === module) {
  scrapeAWSBedrockDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
}
