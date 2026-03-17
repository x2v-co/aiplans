/**
 * Playwright-based HTML scraper utility
 * Used for providers that don't have API access for pricing data
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';

export interface ScraperOptions {
  headless?: boolean;
  timeout?: number;
  userAgent?: string;
  viewport?: { width: number; height: number };
  blockResources?: boolean;
}

export interface PriceData {
  modelName: string;
  inputPricePer1M: number | null;
  outputPricePer1M: number | null;
  cachedInputPricePer1M?: number | null;
  contextWindow?: number | null;
  rateLimit?: number | null;
  isAvailable?: boolean;
  currency?: string;
}

export interface ScraperResult {
  success: boolean;
  source: string;
  prices: PriceData[];
  errors?: string[];
  metadata?: {
    isRealTime: boolean;
    confidence: 'high' | 'medium' | 'low';
    sourceUrl: string;
    lastVerified: Date;
  };
}

/**
 * Base class for Playwright-based scrapers
 */
export abstract class PlaywrightScraper {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected options: ScraperOptions;

  constructor(options: ScraperOptions = {}) {
    this.options = {
      headless: true,
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      blockResources: true,
      ...options,
    };
  }

  /**
   * Initialize the browser
   */
  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.options.headless,
    });

    this.context = await this.browser.newContext({
      userAgent: this.options.userAgent,
      viewport: this.options.viewport,
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.options.timeout!);

    // Block unnecessary resources for faster loading
    if (this.options.blockResources) {
      await this.page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });
    }
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  /**
   * Navigate to a URL and wait for content to load
   */
  async navigate(url: string, waitForSelector?: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    await this.page.goto(url, { waitUntil: 'domcontentloaded' });

    if (waitForSelector) {
      await this.page.waitForSelector(waitForSelector, { timeout: this.options.timeout });
    }
  }

  /**
   * Extract text content from a selector
   */
  async getText(selector: string): Promise<string | null> {
    if (!this.page) return null;

    try {
      const element = await this.page.$(selector);
      if (!element) return null;
      return await element.textContent();
    } catch {
      return null;
    }
  }

  /**
   * Extract all text content matching a selector
   */
  async getAllText(selector: string): Promise<string[]> {
    if (!this.page) return [];

    try {
      const elements = await this.page.$$(selector);
      const texts = await Promise.all(
        elements.map(el => el.textContent())
      );
      return texts.filter((t): t is string => t !== null);
    } catch {
      return [];
    }
  }

  /**
   * Parse a price string to a number
   */
  protected parsePrice(priceStr: string | null | undefined): number | null {
    if (!priceStr) return null;

    // Remove currency symbols and whitespace
    const cleaned = priceStr
      .replace(/[$¥€£]/g, '')
      .replace(/,/g, '')
      .replace(/\s+/g, '')
      .trim();

    // Extract number
    const match = cleaned.match(/[\d.]+/);
    if (!match) return null;

    const num = parseFloat(match[0]);
    return isNaN(num) ? null : num;
  }

  /**
   * Parse price per million tokens
   * Handles various formats like "$0.50 / 1M tokens", "$0.50 per million", etc.
   */
  protected parsePricePerMillion(priceStr: string | null | undefined): number | null {
    if (!priceStr) return null;

    const price = this.parsePrice(priceStr);
    if (price === null) return null;

    // Check if it's already per million
    const lowerStr = priceStr.toLowerCase();
    if (lowerStr.includes('/1m') || lowerStr.includes('per 1m') || lowerStr.includes('per million')) {
      return price;
    }

    // Check if it's per thousand tokens
    if (lowerStr.includes('/1k') || lowerStr.includes('per 1k') || lowerStr.includes('per thousand')) {
      return price * 1000;
    }

    // Assume per million if not specified
    return price;
  }

  /**
   * Main scraping method - to be implemented by subclasses
   */
  abstract scrape(): Promise<ScraperResult>;

  /**
   * Run the scraper with proper initialization and cleanup
   */
  async run(): Promise<ScraperResult> {
    try {
      await this.init();
      const result = await this.scrape();
      return {
        ...result,
        metadata: {
          isRealTime: true,
          confidence: 'high',
          sourceUrl: this.getSourceUrl(),
          lastVerified: new Date(),
        },
      };
    } catch (error) {
      return {
        success: false,
        source: this.getSourceName(),
        prices: [],
        errors: [error instanceof Error ? error.message : String(error)],
      };
    } finally {
      await this.close();
    }
  }

  /**
   * Get the source name for logging
   */
  abstract getSourceName(): string;

  /**
   * Get the source URL being scraped
   */
  abstract getSourceUrl(): string;
}

/**
 * Utility function to wait and retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Create a scraper result with error handling
 */
export function createScraperResult(
  source: string,
  prices: PriceData[],
  errors: string[] = []
): ScraperResult {
  return {
    success: errors.length === 0,
    source,
    prices,
    errors: errors.length > 0 ? errors : undefined,
    metadata: {
      isRealTime: true,
      confidence: 'high',
      sourceUrl: '',
      lastVerified: new Date(),
    },
  };
}