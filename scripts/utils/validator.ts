export type CurrencyCode = 'USD' | 'CNY' | 'EUR' | 'GBP' | 'JPY' | 'KRW';

export interface ScrapedPrice {
  modelName: string;
  modelSlug: string;
  inputPricePer1M: number;
  outputPricePer1M: number;
  cachedInputPricePer1M?: number;
  contextWindow?: number;
  rateLimit?: string | number;
  isAvailable: boolean;
  currency?: CurrencyCode;
}

export interface ScraperResult {
  source: string;
  success: boolean;
  prices: ScrapedPrice[];
  errors?: string[];
}

export function validatePrice(price: number): boolean {
  return typeof price === 'number' && price >= 0 && price < 1000;
}

export function calculateChangePercent(oldPrice: number, newPrice: number): number {
  if (oldPrice === 0) return 0;
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

export function isSignificantChange(changePercent: number): boolean {
  return Math.abs(changePercent) > 20;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeModelName(name: string): string {
  // Handle OpenRouter format "OpenAI: GPT-5.1" -> extract "GPT-5.1"
  // Handle "Provider: Model Name" format
  let cleaned = name
    .replace(/\s+/g, ' ')
    .trim();

  // If contains ": ", extract the part after it
  if (cleaned.includes(': ')) {
    const parts = cleaned.split(': ');
    // If the part after colon looks like a model name (contains letters), use it
    const lastPart = parts[parts.length - 1];
    if (/[a-zA-Z]/.test(lastPart)) {
      cleaned = lastPart;
    }
  }

  return cleaned;
}
