export type CurrencyCode = 'USD' | 'CNY' | 'EUR' | 'GBP' | 'JPY' | 'KRW';

export interface ScrapedPlan {
  planName: string;
  planSlug: string;
  priceMonthly: number;
  priceYearly?: number;
  pricingModel: 'subscription' | 'token_pack' | 'pay_as_you_go';
  tier: 'free' | 'basic' | 'pro' | 'team' | 'enterprise';

  // Currency (optional, will be inferred from region if not provided)
  currency?: CurrencyCode;

  // Limits
  dailyMessageLimit?: number;
  requestsPerMinute?: number;
  qps?: number;
  tokensPerMinute?: number;

  // Features
  features: string[];

  // Product slugs available in this plan
  productSlugs?: string[];

  // Other
  region: string;
  accessFromChina: boolean;
  paymentMethods: string[];
  isOfficial: boolean;
}

export interface PlanScraperResult {
  source: string;
  success: boolean;
  plans: ScrapedPlan[];
  errors?: string[];
}

export function validatePlanPrice(price: number): boolean {
  return typeof price === 'number' && price >= 0 && price < 100000;
}

export function slugifyPlan(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizePlanName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .trim();
}
