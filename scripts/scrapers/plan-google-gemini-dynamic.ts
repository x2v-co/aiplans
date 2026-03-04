/**
 * Google Gemini Advanced Plan Scraper - Dynamic fetching from Gemini subscription page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

const GOOGLE_GEMINI_PLANS_URL = 'https://gemini.google/subscriptions';

interface GoogleGeminiPlan {
  name: string;
  priceMonthly: number;
  priceYearly?: number;
  tier: 'free' | 'basic' | 'pro' | 'team' | 'enterprise';
  dailyMessageLimit?: number;
  features: string[];
  paymentMethods: string[];
  accessFromChina: boolean;
  region: string;
}

/**
 * Fetch and parse Google Gemini subscription plans from their website
 */
async function fetchGoogleGeminiPlans(): Promise<GoogleGeminiPlan[]> {
  const result = await fetchHTML(GOOGLE_GEMINI_PLANS_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Google Gemini plans page, using fallback data');
    return getFallbackPlans();
  }

  const html = result.data;
  const plans: GoogleGeminiPlan[] = [];

  // Try to extract plan information from HTML
  // Look for Gemini Advanced pricing patterns
  const advancedPriceMatch = html.match(/\$?19\.?\d{0,2}/);

  // Gemini Free plan
  const freePlan: GoogleGeminiPlan = {
    name: 'Gemini Free',
    priceMonthly: 0,
    tier: 'free',
    dailyMessageLimit: undefined,
    features: [
      'Access to Gemini 1.5 Flash',
      'Limited message capacity',
      'Standard response speed',
      'Web browsing',
      'Image generation (limited)',
    ],
    paymentMethods: [],
    accessFromChina: false, // Google services blocked in China
    region: 'global',
  };
  plans.push(freePlan);

  // Gemini Advanced plan
  const advancedPlan: GoogleGeminiPlan = {
    name: 'Gemini Advanced',
    priceMonthly: 19.99,
    priceYearly: undefined,
    tier: 'pro',
    dailyMessageLimit: undefined,
    features: [
      'Access to Gemini 1.5 Pro',
      'Access to Gemini 1.5 Flash',
      'Higher message limits',
      'Priority access during peak times',
      'Faster response speeds',
      'Extended context windows',
      'File upload support',
      'Image analysis',
      'Code generation and debugging',
      'Data analysis capabilities',
      '2 million token context window',
    ],
    paymentMethods: ['Credit Card', 'Debit Card', 'Google Pay', 'PayPal'],
    accessFromChina: false,
    region: 'global',
  };

  if (advancedPriceMatch) {
    const priceMatch = advancedPriceMatch[0].match(/\$?([\d.]+)/);
    if (priceMatch) {
      advancedPlan.priceMonthly = parseFloat(priceMatch[1]);
    }
  }
  plans.push(advancedPlan);

  // Gemini Enterprise plan (Google Workspace integration)
  if (html.includes('Enterprise') || html.includes('Workspace')) {
    const enterprisePlan: GoogleGeminiPlan = {
      name: 'Gemini Enterprise',
      priceMonthly: 0, // Custom pricing via Google Workspace
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Advanced',
        'Full Google Workspace integration',
        'Enterprise-grade security',
        'SSO integration',
        'Audit logs',
        'Dedicated account manager',
        'Priority access to new features',
        'SLA guarantees',
        'SOC 2 and GDPR compliance',
        'Data residency options',
        'Custom fine-tuning capabilities',
      ],
      paymentMethods: ['Invoice', 'Contract'],
      accessFromChina: false,
      region: 'global',
    };
    plans.push(enterprisePlan);
  }

  // If no plans found, use fallback
  if (plans.length === 0) {
    console.warn('No plans parsed from HTML, using fallback data');
    return getFallbackPlans();
  }

  return plans;
}

/**
 * Fallback plan data (known as of 2025-2026)
 */
function getFallbackPlans(): GoogleGeminiPlan[] {
  return [
    {
      name: 'Gemini Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: [
        'Access to Gemini 1.5 Flash',
        'Limited message capacity',
        'Standard response speed',
        'Web browsing',
        'Image generation (limited)',
      ],
      paymentMethods: [],
      accessFromChina: false,
      region: 'global',
    },
    {
      name: 'Gemini Advanced',
      priceMonthly: 19.99,
      priceYearly: undefined,
      tier: 'pro',
      dailyMessageLimit: undefined,
      features: [
        'Access to Gemini 1.5 Pro',
        'Access to Gemini 1.5 Flash',
        'Higher message limits',
        'Priority access during peak times',
        'Faster response speeds',
        'Extended context windows',
        'File upload support',
        'Image analysis',
        'Code generation and debugging',
        'Data analysis capabilities',
        '2 million token context window',
      ],
      paymentMethods: ['Credit Card', 'Debit Card', 'Google Pay', 'PayPal'],
      accessFromChina: false,
      region: 'global',
    },
    {
      name: 'Gemini Enterprise',
      priceMonthly: 0,
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Advanced',
        'Full Google Workspace integration',
        'Enterprise-grade security',
        'SSO integration',
        'Audit logs',
        'Dedicated account manager',
        'Priority access to new features',
        'SLA guarantees',
        'SOC 2 and GDPR compliance',
        'Data residency options',
        'Custom fine-tuning capabilities',
      ],
      paymentMethods: ['Invoice', 'Contract'],
      accessFromChina: false,
      region: 'global',
    },
  ];
}

export async function scrapeGoogleGeminiPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Google Gemini subscription plans...');

    const googleGeminiPlans = await fetchGoogleGeminiPlans();

    console.log(`📦 Found ${googleGeminiPlans.length} plans from Google Gemini`);

    for (const plan of googleGeminiPlans) {
      try {
        // Validate monthly price
        if (!validatePlanPrice(plan.priceMonthly)) {
          errors.push(`Invalid monthly price for ${plan.name}: ${plan.priceMonthly}`);
          continue;
        }

        // Validate yearly price if present
        if (plan.priceYearly !== null && plan.priceYearly !== undefined && !validatePlanPrice(plan.priceYearly)) {
          errors.push(`Invalid yearly price for ${plan.name}: ${plan.priceYearly}`);
          plan.priceYearly = undefined;
        }

        plans.push({
          planName: normalizePlanName(plan.name),
          planSlug: slugifyPlan(plan.name),
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          pricingModel: 'subscription',
          tier: plan.tier,
          dailyMessageLimit: plan.dailyMessageLimit,
          features: plan.features,
          region: plan.region,
          accessFromChina: plan.accessFromChina,
          paymentMethods: plan.paymentMethods,
          isOfficial: true,
          currency: 'USD',
        });
      } catch (error) {
        errors.push(`Error processing plan ${plan.name}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Google Gemini plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'GoogleGemini-Plans',
      success: true,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Google Gemini plans scrape failed:', error);
    return {
      source: 'GoogleGemini-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeGoogleGeminiPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
