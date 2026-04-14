/**
 * HTTP Client with retry logic for API scraping
 * Supports both static HTML fetch and dynamic content via Playwright
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';

export interface FetchOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  usePlaywright?: boolean;  // Enable Playwright for JS-rendered content
  waitForSelector?: string; // CSS selector to wait for before extracting content
  waitForTimeout?: number;  // Milliseconds to wait after page load
}

export interface FetchResult<T = unknown> {
  success: boolean;
  data?: T;
  status?: number;
  error?: string;
}

/**
 * Exponential backoff delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry logic and exponential backoff
 */
export async function fetchWithRetry<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  const {
    headers = {},
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PlanPriceAI/1.0; +https://planprice.ai)',
          ...headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      let data: T;

      if (contentType.includes('application/json')) {
        data = await response.json() as T;
      } else {
        data = await response.text() as T;
      }

      return {
        success: true,
        data,
        status: response.status,
      };
    } catch (error) {
      lastError = error as Error;

      // Don't retry on abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        break;
      }

      // Don't retry on last attempt
      if (attempt < retries) {
        const waitTime = retryDelay * Math.pow(2, attempt);
        console.log(`⚠️ Fetch attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`);
        await delay(waitTime);
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Unknown error',
  };
}

/**
 * Fetch JSON from API with automatic retry
 */
export async function fetchJSON<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  return fetchWithRetry<T>(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * Fetch HTML page with automatic retry
 */
export async function fetchHTML(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult<string>> {
  return fetchWithRetry<string>(url, {
    ...options,
    headers: {
      'Accept': 'text/html,application/xhtml+xml',
      ...options.headers,
    },
  });
}

/**
 * Fetch with API key
 */
export async function fetchWithAuth<T = unknown>(
  url: string,
  apiKey: string,
  authHeader = 'Authorization',
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  return fetchWithRetry<T>(url, {
    ...options,
    headers: {
      [authHeader]: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });
}

// ============================================
// Playwright-based dynamic content fetching
// ============================================

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;

/**
 * Initialize Playwright browser instance (lazy loading)
 */
async function getBrowser(): Promise<Browser> {
  if (!_browser) {
    _browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return _browser;
}

/**
 * Get or create browser context
 */
async function getContext(): Promise<BrowserContext> {
  if (!_context) {
    const browser = await getBrowser();
    _context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (compatible; PlanPriceAI/1.0; +https://aiplans.dev)',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });
  }
  return _context;
}

/**
 * Close Playwright browser (call at end of scraping session)
 */
export async function closeBrowser(): Promise<void> {
  if (_context) {
    await _context.close();
    _context = null;
  }
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

/**
 * Fetch dynamic HTML using Playwright (for JS-rendered content)
 * This is essential for pages where prices are loaded via JavaScript
 */
export async function fetchDynamicHTML(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult<string>> {
  const {
    timeout = 30000,
    waitForSelector,
    waitForTimeout = 2000,
    headers = {},
  } = options;

  let page: Page | null = null;

  try {
    const context = await getContext();
    page = await context.newPage();

    // Set extra HTTP headers if provided
    if (Object.keys(headers).length > 0) {
      await page.setExtraHTTPHeaders(headers);
    }

    // Navigate to the page. 'domcontentloaded' is faster and more reliable
    // than 'networkidle' for pages that keep pinging analytics forever
    // (e.g. openai.com never reaches networkidle within 25s).
    // Callers that need the full async hydration should pass waitForSelector
    // or bump waitForTimeout.
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout,
    });

    if (!response) {
      return {
        success: false,
        error: 'No response received from page',
      };
    }

    if (!response.ok()) {
      return {
        success: false,
        status: response.status(),
        error: `HTTP ${response.status()}: ${response.statusText()}`,
      };
    }

    // Wait for specific selector if provided
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 10000 });
    }

    // Additional wait for dynamic content to settle
    if (waitForTimeout > 0) {
      await page.waitForTimeout(waitForTimeout);
    }

    // Get the fully rendered HTML
    const html = await page.content();

    return {
      success: true,
      data: html,
      status: response.status(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Smart fetch that automatically uses Playwright for known JS-heavy domains
 * Falls back to static fetch for simple pages
 */
const JS_HEAVY_DOMAINS = [
  'claude.ai',
  'claude.com',
  'anthropic.com',
  'gemini.google.com',
  'gemini.google',
  'openai.com',
  'chat.openai.com',
  'chatgpt.com',
  // Added 2026-04-13 — these all returned empty HTML to fetchHTML during
  // production plan scraper runs because they're React/Vue SPAs.
  'platform.minimaxi.com',
  'minimaxi.com',
  'platform.minimax.io',
  'minimax.io',
  'platform.moonshot.cn',
  'moonshot.cn',
  'kimi.com',
  'platform.kimi.com',
  'bigmodel.cn',
  'open.bigmodel.cn',
  'z.ai',
  'docs.z.ai',
  'console.bce.baidu.com',
  'cloud.baidu.com',
  'volcengine.com',
  'www.volcengine.com',
];

export async function fetchHTMLSmart(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult<string>> {
  const urlObj = new URL(url);
  const isJSHost = JS_HEAVY_DOMAINS.some(domain =>
    urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
  );

  // Use Playwright for JS-heavy domains, or if explicitly requested
  if (isJSHost || options.usePlaywright) {
    console.log(`🎭 Using Playwright for JS-rendered content: ${url}`);
    return fetchDynamicHTML(url, options);
  }

  // Use static fetch for other domains
  return fetchHTML(url, options);
}
