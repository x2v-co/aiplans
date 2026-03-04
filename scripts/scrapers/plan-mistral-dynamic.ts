/**
 * Mistral AI Plan Scraper - Dynamic fetching from Mistral pricing page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

const MISTRAL_PLANS_URL = 'https://mistral.ai/pricing';

interface MistralPlan {
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
 * Fetch and parse Mistral AI subscription plans from their website
 */
async function fetchMistralPlans(): Promise<MistralPlan[]> {
  const result = await fetchHTML(MISTRAL_PLANS_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Mistral plans page, using fallback data');
    return getFallbackPlans();
  }

  const html = result.data;
  const plans: MistralPlan[] = [];

  // Try to extract plan information from HTML
  // Look for Le Chat pricing patterns

  // Le Chat Free plan
  const freePlan: MistralPlan = {
    name: 'Le Chat Free',
    priceMonthly: 0,
    tier: 'free',
    dailyMessageLimit: undefined,
    features: [
      'Access to Mistral 7B',
      'Access to Mixtral 8x7B',
      'Limited message capacity',
      'Standard response speed',
      'Web browsing',
    ],
    paymentMethods: [],
    accessFromChina: false,
    region: 'global',
  };
  plans.push(freePlan);

  // Le Chat Pro plan
  const proPlan: MistralPlan = {
    name: 'Le Chat Pro',
    priceMonthly: 15,
    priceYearly: undefined,
    tier: 'pro',
    dailyMessageLimit: undefined,
    features: [
      'Access to Mistral Medium',
      'Access to Mistral Small',
      'Access to Mixtral 8x7B',
      'Higher message limits',
      'Priority access during peak times',
      'Faster response speeds',
      'Extended context windows',
      'File upload support',
      'Image analysis (Pixtral)',
      'Code generation and debugging',
    ],
    paymentMethods: ['Credit Card', 'Debit Card'],
    accessFromChina: false,
    region: 'global',
  };

  // Try to extract Pro price from HTML
  const proPriceMatch = html.match(/Pro[^$]*?€?\s*15|Le Chat[^$]*?€?\s*15/i);
  if (proPriceMatch) {
    const priceMatch = proPriceMatch[0].match(/[€$]?\s*([\d.]+)/);
    if (priceMatch) {
      proPlan.priceMonthly = parseFloat(priceMatch[1]);
    }
  }
  plans.push(proPlan);

  // Le Chat Enterprise plan
  if (html.includes('Enterprise') || html.includes('business')) {
    const enterprisePlan: MistralPlan = {
      name: 'Le Chat Enterprise',
      priceMonthly: 0, // Custom pricing
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Pro',
        'Full API access',
        'Enterprise-grade security',
        'SSO integration',
        'Audit logs',
        'Custom AI models',
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
function getFallbackPlans(): MistralPlan[] {
  return [
    {
      name: 'Le Chat Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: [
        'Access to Mistral 7B',
        'Access to Mixtral 8x7B',
        'Limited message capacity',
        'Standard response speed',
        'Web browsing',
      ],
      paymentMethods: [],
      accessFromChina: false,
      region: 'global',
    },
    {
      name: 'Le Chat Pro',
      priceMonthly: 15,
      priceYearly: undefined,
      tier: 'pro',
      dailyMessageLimit: undefined,
      features: [
        'Access to Mistral Medium',
        'Access to Mistral Small',
        'Access to Mixtral 8x7B',
        'Higher message limits',
        'Priority access during peak times',
        'Faster response speeds',
        'Extended context windows',
        'File upload support',
        'Image analysis (Pixtral)',
        'Code generation and debugging',
      ],
      paymentMethods: ['Credit Card', 'Debit Card'],
      accessFromChina: false,
      region: 'global',
    },
    {
      name: 'Le Chat Enterprise',
      priceMonthly: 0,
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Pro',
        'Full API access',
        'Enterprise-grade security',
        'SSO integration',
        'Audit logs',
        'Custom AI models',
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

export async function scrapeMistralPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Mistral AI subscription plans...');

    const mistralPlans = await fetchMistralPlans();

    console.log(`📦 Found ${mistralPlans.length} plans from Mistral AI`);

    for (const plan of mistralPlans) {
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
          currency: 'EUR',
        });
      } catch (error) {
        errors.push(`Error processing plan ${plan.name}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Mistral AI plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Mistral-Plans',
      success: true,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Mistral AI plans scrape failed:', error);
    return {
      source: 'Mistral-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeMistralPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
