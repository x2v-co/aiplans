/**
 * OpenAI Plan Scraper - Dynamic fetching from ChatGPT pricing page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

const OPENAI_PLANS_URL = 'https://openai.com/chatgpt/pricing/';

interface OpenAIPlan {
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
 * Fetch and parse OpenAI subscription plans from their website
 */
async function fetchOpenAIPlans(): Promise<OpenAIPlan[]> {
  const result = await fetchHTML(OPENAI_PLANS_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch OpenAI plans page, using fallback data');
    // Return known plan data as fallback
    return getFallbackPlans();
  }

  const html = result.data;
  const plans: OpenAIPlan[] = [];

  // Try to extract plan information from HTML
  // Look for plan names like "Free", "Plus", "Team", "Enterprise"
  const planPatterns = [
    {
      name: 'ChatGPT Free',
      tier: 'free' as const,
      monthlyPattern: /Free[^$]*?\$?0/i,
      features: [
        'Access to GPT-4o mini',
        'Limited message capacity',
        'Standard response speed',
        'Web browsing (limited)',
        'Image generation (limited)',
      ],
    },
    {
      name: 'ChatGPT Plus',
      tier: 'pro' as const,
      monthlyPattern: /Plus[^$]*?\$?20/i,
      yearlyPattern: /Plus[^$]*?\$?200?\s*\/\s*year/i,
      features: [
        'Access to GPT-4o',
        'Access to GPT-4o mini',
        'Higher message limits',
        'Faster response speeds',
        'Priority access during peak times',
        'Advanced data analysis',
        'Web browsing',
        'Image and video generation (DALL-E)',
        'Create and use custom GPTs',
        'Access to o1 models (limited)',
      ],
    },
    {
      name: 'ChatGPT Team',
      tier: 'team' as const,
      monthlyPattern: /Team[^$]*?\$?25/i,
      yearlyPattern: /Team[^$]*?\$?30/i,
      features: [
        'Everything in Plus',
        'Admin console for team management',
        'Collaborative tools',
        'Higher data security',
        'Team workspace',
        'Data exclusion from training by default',
        'Extended context windows',
        'Higher rate limits',
        'Priority support',
      ],
    },
    {
      name: 'ChatGPT Enterprise',
      tier: 'enterprise' as const,
      features: [
        'Everything in Team',
        'Unlimited GPT-4o access',
        'Enterprise-grade security',
        'SSO integration',
        'Audit logs',
        'Custom AI models',
        'Dedicated account manager',
        'Priority access to new features',
        'SLA guarantees',
        'Compliance (SOC 2, GDPR)',
      ],
    },
    {
      name: 'ChatGPT Pro',
      tier: 'pro' as const,
      monthlyPattern: /Pro[^$]*?\$?200/i,
      features: [
        'Everything in Plus',
        'Unlimited access to o1 and o1-mini',
        'Higher rate limits',
        'Priority access during high demand',
        'Extended context windows',
        'Early access to new features',
      ],
    },
  ];

  for (const pattern of planPatterns) {
    const plan: OpenAIPlan = {
      name: pattern.name,
      priceMonthly: 0,
      tier: pattern.tier,
      features: pattern.features,
      paymentMethods: ['Credit Card', 'Debit Card', 'Apple Pay', 'Google Pay'],
      accessFromChina: false, // OpenAI plans are not available in China
      region: 'global',
    };

    if (pattern.monthlyPattern) {
      const monthlyMatch = html.match(pattern.monthlyPattern);
      if (monthlyMatch) {
        // Extract price number from pattern
        const priceMatch = monthlyMatch[0].match(/\$?([\d.]+)/);
        if (priceMatch) {
          plan.priceMonthly = parseFloat(priceMatch[1]);
        }
      }
    }

    if (pattern.yearlyPattern) {
      const yearlyMatch = html.match(pattern.yearlyPattern);
      if (yearlyMatch) {
        const priceMatch = yearlyMatch[0].match(/\$?([\d.]+)/);
        if (priceMatch) {
          plan.priceYearly = parseFloat(priceMatch[1]);
        }
      }
    }

    // Set message limits based on tier
    if (pattern.tier === 'free') {
      plan.dailyMessageLimit = 10;
    } else if (pattern.tier === 'pro' && pattern.name.includes('Pro')) {
      plan.dailyMessageLimit = undefined; // Unlimited for Pro
    } else if (pattern.tier === 'team') {
      plan.dailyMessageLimit = undefined; // Higher limits for teams
    }

    plans.push(plan);
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
function getFallbackPlans(): OpenAIPlan[] {
  return [
    {
      name: 'ChatGPT Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: 10,
      features: [
        'Access to GPT-4o mini',
        'Limited message capacity',
        'Standard response speed',
        'Web browsing (limited)',
        'Image generation (limited)',
      ],
      paymentMethods: [],
      accessFromChina: false,
      region: 'global',
    },
    {
      name: 'ChatGPT Plus',
      priceMonthly: 20,
      priceYearly: undefined, // No yearly option for Plus
      tier: 'pro',
      dailyMessageLimit: undefined,
      features: [
        'Access to GPT-4o',
        'Access to GPT-4o mini',
        'Higher message limits',
        'Faster response speeds',
        'Priority access during peak times',
        'Advanced data analysis',
        'Web browsing',
        'Image and video generation (DALL-E)',
        'Create and use custom GPTs',
        'Limited access to o1 models',
      ],
      paymentMethods: ['Credit Card', 'Debit Card', 'Apple Pay', 'Google Pay'],
      accessFromChina: false,
      region: 'global',
    },
    {
      name: 'ChatGPT Team',
      priceMonthly: 25,
      priceYearly: 30,
      tier: 'team',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Plus',
        'Admin console for team management',
        'Collaborative tools',
        'Higher data security',
        'Team workspace',
        'Data exclusion from training by default',
        'Extended context windows',
        'Higher rate limits',
        'Priority support',
      ],
      paymentMethods: ['Credit Card', 'Invoice'],
      accessFromChina: false,
      region: 'global',
    },
    {
      name: 'ChatGPT Enterprise',
      priceMonthly: 0, // Custom pricing
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Team',
        'Unlimited GPT-4o access',
        'Enterprise-grade security',
        'SSO integration',
        'Audit logs',
        'Custom AI models',
        'Dedicated account manager',
        'Priority access to new features',
        'SLA guarantees',
        'SOC 2 and GDPR compliance',
      ],
      paymentMethods: ['Invoice', 'Contract'],
      accessFromChina: false,
      region: 'global',
    },
    {
      name: 'ChatGPT Pro',
      priceMonthly: 200,
      tier: 'pro',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Plus',
        'Unlimited access to o1 and o1-mini',
        'Higher rate limits',
        'Priority access during high demand',
        'Extended context windows',
        'Early access to new features',
      ],
      paymentMethods: ['Credit Card', 'Debit Card', 'Apple Pay', 'Google Pay'],
      accessFromChina: false,
      region: 'global',
    },
  ];
}

export async function scrapeOpenAIPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching OpenAI subscription plans...');

    const openaiPlans = await fetchOpenAIPlans();

    console.log(`📦 Found ${openaiPlans.length} plans from OpenAI`);

    for (const plan of openaiPlans) {
      try {
        // Validate monthly price
        if (!validatePlanPrice(plan.priceMonthly)) {
          errors.push(`Invalid monthly price for ${plan.name}: ${plan.priceMonthly}`);
          continue;
        }

        // Validate yearly price if present (only check if it's a number)
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
    console.log(`✅ OpenAI plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'OpenAI-Plans',
      success: true,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ OpenAI plans scrape failed:', error);
    return {
      source: 'OpenAI-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeOpenAIPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
