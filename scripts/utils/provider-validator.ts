/**
 * Provider metadata types and validators
 * Based on SCRAPER_TABLE.md structure
 */

import type { CurrencyCode } from './validator';

export type PricingType = 'API' | 'Plan' | 'Both';
export type ChannelType = 'official' | 'cloud' | 'aggregator' | 'reseller';
export type ProviderRegion = 'global' | 'china' | 'both';

export interface ScrapedProvider {
  // Basic info
  name: string;
  slug: string;

  // URLs
  pricingUrl?: string;
  apiDocsUrl?: string;
  website?: string;

  // Classification
  type: ChannelType;
  region: ProviderRegion;
  accessFromChina: boolean;

  // Payment methods
  paymentMethods?: string[];
  inviteLink?: string;
  priority: 1 | 2 | 3; // 1=high (⭐⭐⭐), 2=medium (⭐⭐), 3=low (⭐)

  // Notes
  notes?: string;
}

export interface ScrapedModel {
  // Model identification
  modelName: string;
  modelSlug: string;

  // API pricing
  inputPricePer1M: number;
  outputPricePer1M: number;
  cachedInputPricePer1M?: number;

  // Model metadata
  contextWindow?: number;
  rateLimit?: string | number;

  // Availability
  isAvailable: boolean;

  // Currency (optional, inferred from region if not provided)
  currency?: CurrencyCode;

  // Product type
  productType?: 'llm' | 'subscription' | 'coding_tool';
}

export interface ScrapedPlan {
  // Plan identification
  planName: string;
  planSlug: string;

  // Pricing
  priceMonthly: number;
  priceYearly?: number;
  pricingModel: 'subscription' | 'token_pack' | 'pay_as_you_go';
  tier: 'free' | 'basic' | 'pro' | 'team' | 'enterprise';

  // Currency
  currency?: CurrencyCode;

  // Limits
  dailyMessageLimit?: number;
  weeklyMessageLimit?: number;
  monthlyMessageLimit?: number;
  requestsPerMinute?: number;
  qps?: number;
  tokensPerMinute?: number;

  // Features
  features: string[];
  models: string[];

  // Other
  region: string;
  accessFromChina: boolean;
  paymentMethods: string[];
  isOfficial: boolean;
}

export interface ScraperResultWithProvider {
  source: string;
  success: boolean;
  provider?: ScrapedProvider;
  models?: ScrapedModel[];
  plans?: ScrapedPlan[];
  errors?: string[];
}

/**
 * Slugify provider name for database
 */
export function slugifyProvider(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validate provider metadata
 */
export function validateProvider(provider: ScrapedProvider): boolean {
  return !!provider.name &&
    !!provider.slug &&
    ['official', 'cloud', 'aggregator', 'reseller'].includes(provider.type) &&
    ['global', 'china', 'both'].includes(provider.region) &&
    typeof provider.accessFromChina === 'boolean' &&
    [1, 2, 3].includes(provider.priority);
}
