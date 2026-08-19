/** Azure OpenAI standard token pricing from the official pricing tables. */
import type { ScraperResult } from '../utils/validator';
import { PlaywrightScraper, type PriceData } from './lib/playwright-scraper';

const AZURE_PRICING_URL = 'https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/';

function dollars(text: string, label: 'Input' | 'Output' | 'Cached Input'): number | undefined {
  const match = text.match(new RegExp(`(?:^|\\s)${label}:\\s*\\$([\\d.]+)`, 'i'));
  return match ? Number(match[1]) : undefined;
}

function canonicalModel(label: string): string | null {
  if (!/\bGlobal\b/i.test(label)) return null;
  if (/(realtime|audio|transcribe|tts|whisper|image)/i.test(label)) return null;
  let model = label
    .replace(/\s+Global.*$/i, '')
    .replace(/\s*\([^)]*context[^)]*\)/gi, '')
    .replace(/\s+\d{4}-\d{2}-\d{2}$/i, '')
    .replace(/-\d{4}-\d{2}-\d{2}$/i, '')
    .replace(/-\d{4}-\d{4}$/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  if (/^gpt-35-turbo/.test(model)) model = model.replace(/^gpt-35-turbo/, 'gpt-3.5-turbo');
  if (/^o3-mini/.test(model)) return 'o3-mini';
  if (/^o1-mini/.test(model)) return 'o1-mini';
  if (/^o1(?:-|$)/.test(model)) return 'o1';
  if (/^gpt-4o-mini/.test(model)) return 'gpt-4o-mini';
  if (/^gpt-4o/.test(model)) return 'gpt-4o';
  if (/^gpt-4\.1-nano/.test(model)) return 'gpt-4.1-nano';
  if (/^gpt-4\.1-mini/.test(model)) return 'gpt-4.1-mini';
  if (/^gpt-4\.1/.test(model)) return 'gpt-4.1';
  if (/^gpt-4-turbo/.test(model)) return 'gpt-4-turbo';
  if (/^gpt-3\.5-turbo/.test(model)) return 'gpt-3.5-turbo';

  // Keep current GPT-5+ names, but exclude non-text token products.
  if (/^gpt-5/.test(model) && !/(audio|image|realtime|transcribe|tts|whisper)/.test(model)) {
    return model;
  }
  return null;
}

class AzureOpenAIScraper extends PlaywrightScraper {
  getSourceName(): string { return 'Azure-OpenAI'; }
  getSourceUrl(): string { return AZURE_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(AZURE_PRICING_URL);
    await this.page!.waitForTimeout(3_000);

    const rows = await this.page!.locator('table tr').evaluateAll(elements =>
      elements.map(row => Array.from(row.querySelectorAll('th,td'))
        .map(cell => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()))
    );

    const prices: PriceData[] = [];
    const seen = new Set<string>();
    for (const cells of rows) {
      if (cells.length < 2) continue;
      const modelName = canonicalModel(cells[0]);
      if (!modelName || seen.has(modelName)) continue;

      const standard = cells[1];
      const input = dollars(standard, 'Input');
      const output = dollars(standard, 'Output');
      const cached = dollars(standard, 'Cached Input');
      if (input == null || output == null || input <= 0 || output < input) continue;

      prices.push({
        modelName,
        inputPricePer1M: input,
        outputPricePer1M: output,
        cachedInputPricePer1M: cached,
        contextWindow: /^gpt-4\.1/.test(modelName) ? 1_000_000 : 200_000,
        isAvailable: true,
        currency: 'USD',
      });
      seen.add(modelName);
    }

    const errors = prices.length === 0
      ? ['No global standard token prices found in Azure OpenAI pricing tables']
      : undefined;
    return { source: this.getSourceName(), success: prices.length > 0, prices, errors };
  }
}

export async function scrapeAzureOpenAIDynamic(): Promise<ScraperResult> {
  return new AzureOpenAIScraper().run() as Promise<ScraperResult>;
}

if (require.main === module) {
  scrapeAzureOpenAIDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
}
