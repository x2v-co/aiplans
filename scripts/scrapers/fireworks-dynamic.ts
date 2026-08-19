/**
 * Fireworks AI API scraper - reads the official serverless pricing document.
 * Only individually named text/vision models are returned. Size-based generic
 * rows and embedding prices cannot be mapped safely to a specific model.
 */

import { normalizeModelName } from '../utils/validator';
import { PriceData, ScraperResult } from './lib/playwright-scraper';

const FIREWORKS_PRICING_URL = 'https://docs.fireworks.ai/serverless/pricing.md';
const STANDARD_PRICE_PATTERN =
  /\\?\$(\d+(?:\.\d+)?)\s*\/\s*\\?\$(\d+(?:\.\d+)?)\s*\/\s*\\?\$(\d+(?:\.\d+)?)/;

function parseNamedModelTable(markdown: string): PriceData[] {
  const prices: PriceData[] = [];
  let inNamedModelTable = false;

  for (const line of markdown.split('\n')) {
    if (line.startsWith('## Text and vision models')) {
      inNamedModelTable = true;
      continue;
    }
    if (inNamedModelTable && line.startsWith('## ')) break;
    if (!inNamedModelTable || !line.trim().startsWith('|')) continue;

    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    if (cells.length < 2) continue;

    const modelMatch = cells[0].match(/^\[([^\]]+)]\(https:\/\/app\.fireworks\.ai\/models\/[^)]+\)$/);
    const priceMatch = cells[1].match(STANDARD_PRICE_PATTERN);
    if (!modelMatch || !priceMatch) continue;

    const inputPrice = Number.parseFloat(priceMatch[1]);
    const cachedInputPrice = Number.parseFloat(priceMatch[2]);
    const outputPrice = Number.parseFloat(priceMatch[3]);
    if (outputPrice < inputPrice) continue;

    const canonicalName = modelMatch[1]
      .replace(/^OpenAI\s+/i, '')
      .replace(/^Qwen\s+(?=\d)/i, 'Qwen')
      .replace(/[()]/g, '');

    prices.push({
      modelName: normalizeModelName(canonicalName),
      inputPricePer1M: inputPrice,
      cachedInputPricePer1M: cachedInputPrice,
      outputPricePer1M: outputPrice,
      isAvailable: true,
      currency: 'USD',
    });
  }

  return prices;
}

export async function scrapeFireworksDynamic(): Promise<ScraperResult> {
  try {
    const response = await fetch(FIREWORKS_PRICING_URL, {
      headers: { Accept: 'text/markdown, text/plain;q=0.9' },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      throw new Error(`Fireworks pricing request failed with HTTP ${response.status}`);
    }

    const prices = parseNamedModelTable(await response.text());
    const errors = prices.length === 0
      ? ['No named model prices could be extracted from the Fireworks serverless pricing document.']
      : undefined;

    return {
      success: prices.length > 0,
      source: 'Fireworks-AI',
      prices,
      errors,
      metadata: {
        isRealTime: true,
        confidence: 'high',
        sourceUrl: FIREWORKS_PRICING_URL,
        lastVerified: new Date(),
      },
    };
  } catch (error) {
    return {
      success: false,
      source: 'Fireworks-AI',
      prices: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

if (require.main === module) {
  scrapeFireworksDynamic().then(result => {
    console.log('\nScrape result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
