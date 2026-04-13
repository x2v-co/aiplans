/**
 * Mistral AI API Scraper — https://mistral.ai/pricing
 * NO FALLBACK DATA — fails cleanly when scraping fails.
 *
 * Migrated 2026-04-13 to use KnownModelsExtractor base class.
 * Original was ~179 lines and had NO range validation — it took the first 2
 * numbers in any matching section as input/output, which produced bugs like
 * mistral-medium $8/$3 (output<input). This rewrite ADDS proper KNOWN_MODELS
 * with web-verified ranges (2026-04-13 ground truth from mistral.ai/pricing).
 *
 * If Mistral changes a price by more than ±20% the validation will reject it
 * and the scraper returns an error rather than silently writing bad data.
 */
import type { ScraperResult } from '../utils/validator';
import { KnownModelsExtractor, type KnownModel } from './lib/known-models-extractor';

const MISTRAL_PRICING_URL = 'https://mistral.ai/pricing';

const KNOWN_MODELS: KnownModel[] = [
  // Flagship — verified 2026-04-13: $2/$6
  { pattern: /mistral[-\s]?large/i,        name: 'mistral-large',  minInput: 1.5,  maxInput: 2.5,  minOutput: 5,    maxOutput: 7,    contextWindow: 128_000 },
  // Mistral Medium 3 — verified $0.40/$2.00
  { pattern: /mistral[-\s]?medium/i,       name: 'mistral-medium', minInput: 0.30, maxInput: 0.50, minOutput: 1.5,  maxOutput: 2.5,  contextWindow: 32_000 },
  // Mistral Small 2503 — verified $0.10/$0.30
  { pattern: /mistral[-\s]?small/i,        name: 'mistral-small',  minInput: 0.08, maxInput: 0.15, minOutput: 0.25, maxOutput: 0.40, contextWindow: 32_000 },
  // Mistral Nemo — open-weight 12B, $0.15/$0.15 historical
  { pattern: /mistral[-\s]?nemo/i,         name: 'mistral-nemo',   minInput: 0.10, maxInput: 0.20, minOutput: 0.10, maxOutput: 0.20, contextWindow: 128_000 },
  // Codestral 2501 — verified $0.20/$0.60
  { pattern: /codestral/i,                 name: 'codestral',      minInput: 0.15, maxInput: 0.30, minOutput: 0.50, maxOutput: 0.70, contextWindow: 32_000 },
  // Pixtral (vision) — historical $0.15/$0.15
  { pattern: /pixtral/i,                   name: 'pixtral',        minInput: 0.10, maxInput: 0.20, minOutput: 0.10, maxOutput: 0.20, contextWindow: 128_000 },
  // Mixtral open-weight 8x7b — historical $0.24/$0.24
  { pattern: /mixtral[-\s]?8x7b/i,         name: 'mixtral-8x7b',   minInput: 0.20, maxInput: 0.30, minOutput: 0.20, maxOutput: 0.30, contextWindow: 32_000 },
  // Mixtral open-weight 8x22b — historical $2/$6
  { pattern: /mixtral[-\s]?8x22b/i,        name: 'mixtral-8x22b',  minInput: 1.5,  maxInput: 2.5,  minOutput: 5,    maxOutput: 7,    contextWindow: 64_000 },
];

class MistralScraper extends KnownModelsExtractor {
  getSourceName(): string { return 'Mistral-AI'; }
  getSourceUrl(): string { return MISTRAL_PRICING_URL; }
  models(): KnownModel[] { return KNOWN_MODELS; }
  extractMode() { return 'positional' as const; }
  waitAfterNav(): number { return 2000; }
  modelHeaderRegex(): RegExp { return /^(?:mistral|mixtral|codestral|pixtral|mistral[-\s]?nemo)/i; }
}

export async function scrapeMistralDynamic(): Promise<ScraperResult> {
  return new MistralScraper().run();
}

if (require.main === module) {
  scrapeMistralDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
