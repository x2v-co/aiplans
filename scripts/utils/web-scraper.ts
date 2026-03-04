/**
 * Web scraper utility for extracting pricing information from HTML pages
 * This uses a simple approach with fetch + Cheerio-like parsing
 */

export async function scrapePricingPage(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    throw new Error(`Failed to scrape ${url}: ${error}`);
  }
}

export function extractPriceFromText(text: string, keyword: string): number | null {
  // Try to find patterns like "¥12/1M", "$2.5/1M tokens", "12元/百万tokens"
  const patterns = [
    new RegExp(`${keyword}[\\s:：,]*[\\s¥$]?([\\d.]+)[\\s¥$元,]*[\\s/\\s]+1M`, 'i'),
    new RegExp(`${keyword}[\\s:：,]*[\\s¥$]?([\\d.]+)[\\s¥$元,]*[\\s/\\s]+百万[\\s\\s]*token`, 'i'),
    new RegExp(`([¥$元,]*[\\d.]+)[\\s¥$元,]*[\\s/\\s]+1M\\s+tokens`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
  }

  return null;
}

export function extractInputOutputPrices(text: string, keywords: string[]): { input: number; output: number } | null {
  let inputPrice: number | null = null;
  let outputPrice: number | null = null;

  for (const keyword of keywords) {
    const inputMatch = text.match(new RegExp(`${keyword}[\\s:：,]*[\\s¥$]?([\\d.]+)[\\s¥$元,]*[\\s/\\s]+1M`, 'i'));
    if (inputMatch) {
      inputPrice = parseFloat(inputMatch[1]);
    }

    const outputMatch = text.match(new RegExp(`${keyword}[\\s:：,]*[\\s¥$]?([\\d.]+)[\\s¥$元,]*[\\s/\\s]+1M`, 'i'));
    if (outputMatch) {
      outputPrice = parseFloat(outputMatch[1]);
    }
  }

  if (inputPrice !== null && outputPrice !== null) {
    return { input: inputPrice, output: outputPrice };
  }

  return null;
}

export function extractContextWindow(text: string, keyword: string): number | null {
  const patterns = [
    new RegExp(`${keyword}[\\s:：,]*[\\s上下文窗口,context\\s]*[\\s:：,]*[\\s¥$]?([\\d.]+)[Kk,]`, 'i'),
    new RegExp(`[\\s上下文窗口,context\\s]*[\\s:：,]*[\\s¥$]?([\\d.]+)[Kk,]`, 'i'),
    new RegExp(`(\\d+)[Kk,]`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1]) * 1000; // Convert k to tokens
    }
  }

  return null;
}
