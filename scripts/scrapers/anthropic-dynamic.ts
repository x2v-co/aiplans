/** Anthropic API pricing scraper using the official model pricing cards. */
import type { ScraperResult } from '../utils/validator';
import { PlaywrightScraper, type PriceData } from './lib/playwright-scraper';

const ANTHROPIC_PRICING_URL = 'https://www.anthropic.com/pricing';

class AnthropicScraper extends PlaywrightScraper {
  getSourceName(): string { return 'Anthropic-API'; }
  getSourceUrl(): string { return ANTHROPIC_PRICING_URL; }

  async scrape(): Promise<ScraperResult> {
    await this.navigate(ANTHROPIC_PRICING_URL);

    const cards = await this.page!.locator('.card_pricing_api_wrap').allInnerTexts();
    const prices: PriceData[] = [];

    for (const card of cards) {
      const compact = card.replace(/\s+/g, ' ').trim();
      const model = compact.match(/^(Fable|Opus|Sonnet|Haiku)\s+(\d+(?:\.\d+)?)/i);
      const input = parseLabeledPrice(compact, 'Input');
      const output = parseLabeledPrice(compact, 'Output');
      const cachedInput = parseLabeledPrice(compact, 'Read');
      if (!model || input == null || output == null) continue;

      prices.push({
        modelName: `claude-${model[1].toLowerCase()}-${model[2]}`,
        inputPricePer1M: input,
        outputPricePer1M: output,
        cachedInputPricePer1M: cachedInput,
        contextWindow: 200_000,
        isAvailable: true,
        currency: 'USD',
      });
    }

    const errors = prices.length === 0
      ? ['No model pricing cards found on the official Anthropic pricing page.']
      : undefined;
    return {
      success: errors == null,
      source: this.getSourceName(),
      prices,
      errors,
    };
  }
}

function parseLabeledPrice(card: string, label: string): number | null {
  const match = card.match(new RegExp(`${label}\\s*\\$([\\d.]+)`, 'i'));
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function scrapeAnthropicDynamic(): Promise<ScraperResult> {
  return new AnthropicScraper().run();
}

if (require.main === module) {
  scrapeAnthropicDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
