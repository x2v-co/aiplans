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
    await this.page!.waitForFunction(() =>
      Array.from(document.querySelectorAll('mistral-block-card-model')).some(card =>
        /Input.*\/M tokens/.test(card.textContent ?? '')
          && /Output.*\/M tokens/.test(card.textContent ?? '')
      ),
      undefined,
      { timeout: 15_000 }
    );

    const cards = await this.page!.locator('mistral-block-card-model').evaluateAll(elements =>
      elements.map(card => ({
        text: (card.textContent ?? '').replace(/\s+/g, ' ').trim(),
        aliases: Array.from(card.querySelectorAll('label')).map(label =>
          (label.textContent ?? '').replace(/\s+/g, ' ').trim()
        ),
      }))
    );

    const prices: PriceData[] = [];
    const seen = new Set<string>();
    for (const card of cards) {
      const alias = card.aliases.find(value => /^[a-z][a-z0-9-]+$/i.test(value));
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
