/**
 * HTTP Client with retry logic for API scraping
 */

export interface FetchOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
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
