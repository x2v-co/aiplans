/**
 * Anyscale API Scraper - Dynamic fetching from pricing page
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 *
 * NOTE: As of 2026-03-19, Anyscale has pivoted to GPU compute pricing.
 * They no longer offer per-token LLM model pricing.
 * The pricing page now shows GPU instance pricing (NVIDIA T4, A100, H100, etc.)
 * This scraper returns no data but provides a clear error message.
 */

import { PlaywrightScraper, ScraperResult } from './lib/playwright-scraper';

const ANYSCALE_PRICING_URL = 'https://www.anyscale.com/pricing';

class AnyscaleScraper extends PlaywrightScraper {
  getSourceName(): string {
    return 'Anyscale';
  }

  getSourceUrl(): string {
    return ANYSCALE_PRICING_URL;
  }

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];

    await this.navigate(ANYSCALE_PRICING_URL);

    // Wait for page to fully load
    await this.page!.waitForTimeout(3000);

    // Get all text content from the page
    const bodyText = await this.page!.textContent('body') || '';
    console.log('📝 Body text length:', bodyText.length);

    // Debug: Print first 2000 chars
    console.log('📄 First 2000 chars of body text:');
    console.log(bodyText.substring(0, 2000));

    // Anyscale now shows GPU compute pricing, not token-based LLM pricing
    // Check if we can find any GPU instance names to confirm page loaded
    const hasGpuPricing = /nvidia.*(t4|a10g|a100|h100|h200)/i.test(bodyText);

    if (hasGpuPricing) {
      errors.push('Anyscale has pivoted to GPU compute pricing. They no longer offer per-token LLM model pricing. See https://www.anyscale.com/pricing for GPU instance pricing.');
    } else {
      errors.push('No pricing data could be extracted from Anyscale pricing page. The page structure may have changed.');
    }

    return {
      success: false,
      source: this.getSourceName(),
      prices: [],
      errors: errors,
      metadata: {
        isRealTime: true,
        confidence: 'high',
        sourceUrl: this.getSourceUrl(),
        lastVerified: new Date().toISOString(),
      },
    };
  }
}

export async function scrapeAnyscaleDynamic(): Promise<ScraperResult> {
  const scraper = new AnyscaleScraper();
  return scraper.run();
}

// CLI test
if (require.main === module) {
  scrapeAnyscaleDynamic().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}