/** Mistral API token pricing from the official model cards. */
import { normalizeModelName } from '../utils/validator';
import { PlaywrightScraper, type PriceData, type ScraperResult } from './lib/playwright-scraper';

const MISTRAL_PRICING_URL = 'https://mistral.ai/pricing/api/';

function dollar(text: string | undefined): number | null {
  const match = text?.match(/\$\s*([\d.]+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

class MistralScraper extends PlaywrightScraper {
  getSourceName(): string { return 'Mistral-AI'; }
  getSourceUrl(): string { return MISTRAL_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(MISTRAL_PRICING_URL);
    // The cards are server-rendered custom elements, while their inner price
    // labels are hydrated at slightly different times. Waiting for the
    // element itself is more reliable than requiring one exact label string.
    await this.page!.waitForSelector('mistral-block-card-model', { timeout: 15_000 });
    await this.page!.waitForTimeout(1_000);

    const cards = await this.page!.locator('mistral-block-card-model').evaluateAll(elements =>
      elements.map(card => ({
        text: (card.textContent ?? '').replace(/\s+/g, ' ').trim(),
        names: Array.from(card.querySelectorAll('label, p.text-h5, h3, [class*="modelName"]')).map(name =>
          (name.textContent ?? '').replace(/\s+/g, ' ').trim()
        ),
      }))
    );

    const prices: PriceData[] = [];
    const seen = new Set<string>();
    for (const card of cards) {
      // The current cards expose a human-readable model title in `p.text-h5`;
      // older cards used a lower-case label. Both forms are valid model IDs
      // after the shared normalizer has converted spaces to hyphens.
      const alias = card.names.find(value => /^[a-z][a-z0-9 .+\-]+$/i.test(value));
      if (!alias) continue;
      const modelName = normalizeModelName(alias).toLowerCase();
      const input = dollar(card.text.match(/Input\s*\([^)]*\/M tokens\)\s*\$?[\d.]+/i)?.[0]);
      const output = dollar(card.text.match(/Output\s*\([^)]*\/M tokens\)\s*\$?[\d.]+/i)?.[0]);
      const cached = dollar(card.text.match(/Cached input\s*\([^)]*\/M tokens\)\s*\$?[\d.]+/i)?.[0]);
      if (seen.has(modelName) || input == null || output == null || output < input) continue;
      prices.push({
        modelName,
        inputPricePer1M: input,
        cachedInputPricePer1M: cached ?? undefined,
        outputPricePer1M: output,
        contextWindow: null,
        isAvailable: true,
        currency: 'USD',
      });
      seen.add(modelName);
    }

    return {
      source: this.getSourceName(),
      success: prices.length > 0,
      prices,
      errors: prices.length > 0 ? undefined : ['No Mistral token pricing cards found'],
    };
  }
}

export async function scrapeMistralDynamic(): Promise<ScraperResult> {
  return new MistralScraper().run();
}

if (require.main === module) scrapeMistralDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
