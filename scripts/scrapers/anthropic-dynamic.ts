/** Official cards plus the documentation's context/batch tiers. No fallback prices. */
import { chromium } from 'playwright';
import type { ScraperResult, ScrapedPrice, ScrapedPriceVariant } from '../utils/validator';

export const ANTHROPIC_PRICING_SOURCE = 'https://platform.claude.com/docs/en/about-claude/pricing';
export const HAIKU_UNVERIFIED_NOTE = '[needs-verification] Official <=100K prompt price not stated in 2026-10-15 audit; withheld. Source: ' + ANTHROPIC_PRICING_SOURCE;
export interface AnthropicPricingRow { cells: string[]; heading: string }

export function parseAnthropicPricing(cards: string[], rows: AnthropicPricingRow[]): ScraperResult {
  const prices: ScrapedPrice[] = [];
  for (const card of cards) {
    const compact = card.replace(/\s+/g, ' ').trim();
    const model = compact.match(/^(Fable|Opus|Sonnet|Haiku)\s+(\d+(?:\.\d+)?)/i);
    if (!model || /^Haiku 5\.5$/i.test(model[0])) continue;
    const input = parseLabeledPrice(compact, 'Input');
    const output = parseLabeledPrice(compact, 'Output');
    if (input == null || output == null) continue;
    const slug = `claude-${model[1].toLowerCase()}-${model[2]}`;
    prices.push({ modelName: slug, modelSlug: slug, inputPricePer1M: input, outputPricePer1M: output,
      cachedInputPricePer1M: parseLabeledPrice(compact, 'Read'), contextWindow: 200_000, isAvailable: true, currency: 'USD' });
  }
  const variants: ScrapedPriceVariant[] = [];
  let foundHaiku = cards.some(card => /Haiku\s+5\.5/i.test(card));
  for (const row of rows) {
    if (!/^(?:Claude\s+)?Haiku\s+5[.\-]5\b/i.test(row.cells[0]?.trim() ?? '')) continue;
    foundHaiku = true;
    const text = [...row.cells, row.heading].join(' ');
    // Require an explicit prompt-length condition; never publish the tier as a base price.
    if (!/(?:>|&gt;|over|above)\s*100(?:[,.]?000|k)\b/i.test(text)) continue;
    const dollars = [...row.cells.join(' ').matchAll(/\$\s*(\d+(?:\.\d+)?)/g)].map(match => Number(match[1]));
    if (dollars.length !== 2 || dollars.some(price => !Number.isFinite(price))) continue;
    const batch = /\bbatch\b/i.test(text);
    variants.push({ modelName: 'Claude Haiku 5.5', modelSlug: 'claude-haiku-5.5',
      variantKey: batch ? 'batch-prompt-gt-100k' : 'prompt-gt-100k',
      variantName: batch ? 'Batch >100K prompt' : '>100K prompt', variantKind: batch ? 'batch' : 'context_band',
      inputPricePer1M: dollars[0], outputPricePer1M: dollars[1], currency: 'USD',
      sourceUrl: ANTHROPIC_PRICING_SOURCE, isAvailable: true, isPublic: true, isHeadline: false,
      constraints: { prompt_tokens_gt: 100000, processing: batch ? 'batch' : 'standard' } });
  }
  const unverifiedPrices: NonNullable<ScraperResult['unverifiedPrices']> = foundHaiku ? [{
    modelName: 'Claude Haiku 5.5', modelSlug: 'claude-haiku-5.5', notes: HAIKU_UNVERIFIED_NOTE,
  }] : [];
  const warnings = foundHaiku && variants.length < 2 ? ['Haiku 5.5: not all >100K standard/batch rows parsed; preserve existing tier data.'] : [];
  return { source: 'Anthropic-API', success: prices.length + unverifiedPrices.length > 0,
    prices, variants, unverifiedPrices, ...(warnings.length ? { warnings } : {}),
    ...(prices.length + unverifiedPrices.length ? {} : { errors: ['No official Anthropic model pricing found.'] }) };
}

function parseLabeledPrice(card: string, label: string): number | null {
  const match = card.match(new RegExp(`${label}\\s*\\$([\\d.]+)`, 'i'));
  return match && Number.isFinite(Number(match[1])) ? Number(match[1]) : null;
}

export async function scrapeAnthropicDynamic(): Promise<ScraperResult> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const response = await page.goto('https://www.anthropic.com/pricing', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (!response?.ok()) throw new Error(`Cards HTTP ${response?.status()}`);
    const cards = await page.locator('div[class*="modelCard"], .card_pricing_api_wrap').allInnerTexts();
    const docsResponse = await page.goto(ANTHROPIC_PRICING_SOURCE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (!docsResponse?.ok()) throw new Error(`Documentation HTTP ${docsResponse?.status()}`);
    const rows = await page.evaluate(() => {
      let heading = '';
      const rows: AnthropicPricingRow[] = [];
      for (const element of document.querySelectorAll('h2, h3, h4, table')) {
        if (element.tagName !== 'TABLE') { heading = element.textContent ?? ''; continue; }
        for (const row of element.querySelectorAll('tr')) {
          const cells = [...row.querySelectorAll('td')].map(cell => cell.textContent?.trim() ?? '');
          if (cells.length) rows.push({ cells, heading });
        }
      }
      return rows;
    });
    return parseAnthropicPricing(cards, rows);
  } catch (error) {
    return { source: 'Anthropic-API', success: false, prices: [], errors: [String(error)] };
  } finally {
    await browser.close();
  }
}

if (require.main === module) scrapeAnthropicDynamic().then(result => console.log(JSON.stringify(result, null, 2)));
