/**
 * DeepSeek API Scraper — parses https://api-docs.deepseek.com/quick_start/pricing
 * NO FALLBACK DATA — fails cleanly when scraping fails.
 *
 * Migrated 2026-04-13 to use KnownModelsExtractor base class.
 * Original was ~187 lines; this is ~40 lines.
 */
import type { ScraperResult } from '../utils/validator';
import { KnownModelsExtractor, type KnownModel } from './lib/known-models-extractor';

const DEEPSEEK_PRICING_URL = 'https://api-docs.deepseek.com/quick_start/pricing';

// As of 2026-04-13: deepseek-chat and deepseek-reasoner both alias to V3.2.
// Cache-miss prices: $0.28 input / $0.42 output per 1M tokens.
const KNOWN_MODELS: KnownModel[] = [
  { pattern: /deepseek[-\s]?chat/i,         name: 'deepseek-chat',     minInput: 0.20, maxInput: 0.40, minOutput: 0.30, maxOutput: 0.60, contextWindow: 128_000 },
  { pattern: /deepseek[-\s]?reasoner/i,     name: 'deepseek-reasoner', minInput: 0.20, maxInput: 0.40, minOutput: 0.30, maxOutput: 0.60, contextWindow: 128_000 },
  { pattern: /deepseek[-\s]?v3\.2/i,        name: 'deepseek-v3.2',     minInput: 0.20, maxInput: 0.40, minOutput: 0.30, maxOutput: 0.60, contextWindow: 128_000 },
  { pattern: /deepseek[-\s]?v3(?!\.)/i,     name: 'deepseek-v3',       minInput: 0.20, maxInput: 0.50, minOutput: 0.50, maxOutput: 1.50, contextWindow: 128_000 },
  { pattern: /deepseek[-\s]?r1/i,           name: 'deepseek-r1',       minInput: 0.50, maxInput: 2.00, minOutput: 1.00, maxOutput: 5.00, contextWindow: 128_000 },
];

class DeepSeekScraper extends KnownModelsExtractor {
  getSourceName(): string { return 'DeepSeek-API'; }
  getSourceUrl(): string { return DEEPSEEK_PRICING_URL; }
  models(): KnownModel[] { return KNOWN_MODELS; }
  extractMode() { return 'positional' as const; }
  waitAfterNav(): number { return 3000; }
  modelHeaderRegex(): RegExp { return /deepseek[-\s]?(chat|reasoner|v3|r1)/i; }
}

export async function scrapeDeepSeekDynamic(): Promise<ScraperResult> {
  return new DeepSeekScraper().run();
}

if (require.main === module) {
  scrapeDeepSeekDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
