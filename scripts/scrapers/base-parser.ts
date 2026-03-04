/**
 * HTML Parsing utilities for scraping pricing pages
 */

/**
 * Parse pricing table from HTML
 * Expects a table with headers like: Model, Input/1M, Output/1M, Context
 */
export function parsePricingTable(
  html: string,
  options: {
    modelColumn?: number;
    inputPriceColumn?: number;
    outputPriceColumn?: number;
    cachedPriceColumn?: number;
    contextColumn?: number;
    skipRows?: number[];
    currency?: string;
  } = {}
): Array<{
  modelName: string;
  inputPrice: number;
  outputPrice: number;
  cachedPrice?: number | null;
  context?: number | null;
  currency?: string;
}> {
  const {
    modelColumn = 0,
    inputPriceColumn = 1,
    outputPriceColumn = 2,
    cachedPriceColumn = -1,
    contextColumn = -1,
    skipRows = [],
    currency = 'USD',
  } = options;

  const results: Array<{
    modelName: string;
    inputPrice: number;
    outputPrice: number;
    cachedPrice?: number | null;
    context?: number | null;
    currency?: string;
  }> = [];

  // Create a simple DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find all tables
  const tables = doc.querySelectorAll('table');
  if (tables.length === 0) {
    console.warn('No tables found in HTML');
    return results;
  }

  // Use the first table (could be made more selective)
  const table = tables[0];
  const rows = table.querySelectorAll('tr');

  rows.forEach((row, rowIndex) => {
    if (skipRows.includes(rowIndex)) return;

    const cells = row.querySelectorAll('td, th');
    if (cells.length <= Math.max(modelColumn, inputPriceColumn, outputPriceColumn)) {
      return; // Not enough columns
    }

    const modelName = cells[modelColumn]?.textContent?.trim();
    const inputPriceText = cells[inputPriceColumn]?.textContent?.trim();
    const outputPriceText = cells[outputPriceColumn]?.textContent?.trim();
    const cachedPriceText = cachedPriceColumn >= 0 ? cells[cachedPriceColumn]?.textContent?.trim() : undefined;
    const contextText = contextColumn >= 0 ? cells[contextColumn]?.textContent?.trim() : undefined;

    if (!modelName || !inputPriceText || !outputPriceText) {
      return;
    }

    // Parse prices (remove currency symbols, commas, etc.)
    const inputPrice = parsePrice(inputPriceText);
    const outputPrice = parsePrice(outputPriceText);
    const cachedPrice = cachedPriceText ? parsePrice(cachedPriceText) : undefined;
    const context = contextText ? parseNumber(contextText) : undefined;

    if (inputPrice === null || outputPrice === null) {
      return;
    }

    results.push({
      modelName,
      inputPrice,
      outputPrice,
      cachedPrice,
      context,
      currency,
    });
  });

  return results;
}

/**
 * Parse price text to number
 * Handles: "$2.50", "¥15.00", "€10.50", "2.50", "2,50"
 */
export function parsePrice(text: string): number | null {
  if (!text) return null;

  // Remove currency symbols and whitespace
  const cleaned = text
    .replace(/[$€£¥₹₽]/g, '')
    .replace(/\s/g, '')
    .trim();

  // Handle European format (2,50) vs US format (2.50)
  // If there's a comma and no dot, treat comma as decimal
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return parseFloat(cleaned.replace(',', '.'));
  }

  // If there's both, remove thousands separator (comma) and use dot as decimal
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return parseFloat(cleaned.replace(/,/g, ''));
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse number from text (handles K, M, etc.)
 * Examples: "128K", "1M", "100,000"
 */
export function parseNumber(text: string): number | null {
  if (!text) return null;

  const cleaned = text.replace(/,/g, '').toUpperCase().trim();
  const match = cleaned.match(/^([\d.]+)\s*([KMGT]?)B?$/);

  if (!match) {
    return parseFloat(cleaned);
  }

  const value = parseFloat(match[1]);
  const suffix = match[2];

  const multipliers: Record<string, number> = {
    '': 1,
    'K': 1000,
    'M': 1000000,
    'G': 1000000000,
    'T': 1000000000000,
  };

  return value * (multipliers[suffix] || 1);
}

/**
 * Extract JSON data from HTML (for embedded JSON-LD, etc.)
 */
export function extractJSON<T = unknown>(html: string, selector = 'script[type="application/ld+json"]'): T[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const scripts = doc.querySelectorAll(selector);
  const results: T[] = [];

  scripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent || '{}') as T;
      results.push(data);
    } catch {
      // Skip invalid JSON
    }
  });

  return results;
}

/**
 * Extract text content by CSS selector
 */
export function extractText(html: string, selector: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = doc.querySelectorAll(selector);

  return Array.from(elements).map(el => el.textContent?.trim() || '');
}

/**
 * Extract attribute value by CSS selector
 */
export function extractAttribute(
  html: string,
  selector: string,
  attribute: string
): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = doc.querySelectorAll(selector);

  return Array.from(elements).map(el =>
    (el as HTMLElement).getAttribute(attribute) || ''
  ).filter(Boolean);
}

/**
 * Parse pricing card data (for card-based layouts)
 * Looks for cards with model name, prices, etc.
 */
export function parsePricingCards(
  html: string,
  selectors: {
    card: string;
    name: string;
    inputPrice?: string;
    outputPrice?: string;
    price?: string;
    context?: string;
  }
): Array<{
  modelName: string;
  inputPrice?: number;
  outputPrice?: number;
  price?: number;
  context?: number | null;
}> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const cards = doc.querySelectorAll(selectors.card);

  const results: Array<{
    modelName: string;
    inputPrice?: number;
    outputPrice?: number;
    price?: number;
    context?: number | null;
  }> = [];

  cards.forEach(card => {
    const nameEl = card.querySelector(selectors.name);
    const modelName = nameEl?.textContent?.trim();

    if (!modelName) return;

    const result: {
      modelName: string;
      inputPrice?: number;
      outputPrice?: number;
      price?: number;
      context?: number | null;
    } = { modelName };

    if (selectors.inputPrice) {
      const inputEl = card.querySelector(selectors.inputPrice);
      const inputText = inputEl?.textContent?.trim();
      if (inputText) {
        result.inputPrice = parsePrice(inputText) || undefined;
      }
    }

    if (selectors.outputPrice) {
      const outputEl = card.querySelector(selectors.outputPrice);
      const outputText = outputEl?.textContent?.trim();
      if (outputText) {
        result.outputPrice = parsePrice(outputText) || undefined;
      }
    }

    if (selectors.price) {
      const priceEl = card.querySelector(selectors.price);
      const priceText = priceEl?.textContent?.trim();
      if (priceText) {
        result.price = parsePrice(priceText) || undefined;
      }
    }

    if (selectors.context) {
      const contextEl = card.querySelector(selectors.context);
      const contextText = contextEl?.textContent?.trim();
      if (contextText) {
        result.context = parseNumber(contextText) || undefined;
      }
    }

    results.push(result);
  });

  return results;
}

/**
 * Rate limit helper - add delay between requests
 */
export class RateLimiter {
  private lastRequest: number = 0;
  private minDelay: number;

  constructor(minDelay: number = 1000) {
    this.minDelay = minDelay;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;

    if (elapsed < this.minDelay) {
      await new Promise(resolve => setTimeout(resolve, this.minDelay - elapsed));
    }

    this.lastRequest = Date.now();
  }
}
