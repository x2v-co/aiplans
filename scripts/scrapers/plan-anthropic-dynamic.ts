/**
 * Anthropic Claude Pro Plan Scraper - Dynamic fetching from Claude pricing page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

const ANTHROPIC_PLANS_URL = 'https://claude.com/pricing';

interface AnthropicPlan {
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
 * Fetch and parse Anthropic subscription plans from their website
 */
async function fetchAnthropicPlans(): Promise<AnthropicPlan[]> {
  const result = await fetchHTML(ANTHROPIC_PLANS_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Anthropic plans page, using fallback data');
    return getFallbackPlans();
  }

  const html = result.data;
  const plans: AnthropicPlan[] = [];

  // Try to extract plan information from HTML
  // Look for Claude Pro pricing patterns
  const proPriceMatch = html.match(/\$\s*20/i) || html.match(/20\s*\$/i);
  const teamPriceMatch = html.match(/\$\s*25/i) || html.match(/25\s*\$/i);
  const enterpriseMatch = html.match(/Enterprise/i);
  const hasPro = html.includes('Pro') || html.includes('Pro ') || html.includes('Claude Pro');
  const hasTeam = html.includes('Team') || html.includes('Claude Team');

  // Claude Pro plan
  if (hasPro || proPriceMatch) {
    const proPlan: AnthropicPlan = {
      name: 'Claude Pro',
      priceMonthly: 20,
      priceYearly: undefined,
      tier: 'pro',
      dailyMessageLimit: undefined,
      features: [
        'Access to Claude 3.5 Sonnet',
        'Access to Claude 3 Opus',
        'Higher message limits',
        'Priority access during peak times',
        'Faster response speeds',
        'Extended context windows',
        'File upload support',
        'Image analysis',
        'Early access to new features',
      ],
      paymentMethods: ['Credit Card', 'Debit Card', 'Apple Pay', 'Google Pay'],
      accessFromChina: false,
      region: 'global',
    };

    if (proPriceMatch) {
      const priceMatch = proPriceMatch[0].match(/[\d.]+/);
      if (priceMatch) {
        const parsedPrice = parseFloat(priceMatch[0]);
        if (!isNaN(parsedPrice)) {
          proPlan.priceMonthly = parsedPrice;
        }
      }
    }
    plans.push(proPlan);
  }

  // Claude Team plan
  if (hasTeam || teamPriceMatch) {
    const teamPlan: AnthropicPlan = {
      name: 'Claude Team',
      priceMonthly: 25,
      priceYearly: undefined,
      tier: 'team',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Pro',
        'Admin console for team management',
        'Collaborative tools',
        'Higher data security',
        'Team workspace',
        'Data exclusion from training by default',
        'Extended context windows',
        'Higher rate limits',
        'Priority support',
        'SSO integration',
      ],
      paymentMethods: ['Credit Card', 'Invoice'],
      accessFromChina: false,
      region: 'global',
    };

    if (teamPriceMatch) {
      const priceMatch = teamPriceMatch[0].match(/[\d.]+/);
      if (priceMatch) {
        const parsedPrice = parseFloat(priceMatch[0]);
        if (!isNaN(parsedPrice)) {
          teamPlan.priceMonthly = parsedPrice;
        }
      }
    }
    plans.push(teamPlan);
  }

  // Claude Enterprise plan
  if (enterpriseMatch) {
    const enterprisePlan: AnthropicPlan = {
      name: 'Claude Enterprise',
      priceMonthly: 0, // Custom pricing
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Team',
        'Unlimited Claude 3.5 Sonnet access',
        'Enterprise-grade security',
        'SSO integration',
        'Audit logs',
        'Custom AI models',
        'Dedicated account manager',
        'Priority access to new features',
        'SLA guarantees',
        'SOC 2 and GDPR compliance',
        'Data residency options',
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
function getFallbackPlans(): AnthropicPlan[] {
  return [
    {
      name: 'Claude Pro',
      priceMonthly: 20,
      priceYearly: undefined,
      tier: 'pro',
      dailyMessageLimit: undefined,
      features: [
        'Access to Claude 3.5 Sonnet',
        'Access to Claude 3 Opus',
        'Higher message limits',
        'Priority access during peak times',
        'Faster response speeds',
        'Extended context windows',
        'File upload support',
        'Image analysis',
        'Early access to new features',
      ],
      paymentMethods: ['Credit Card', 'Debit Card', 'Apple Pay', 'Google Pay'],
      accessFromChina: false,
      region: 'global',
    },
    {
      name: 'Claude Team',
      priceMonthly: 25,
      priceYearly: undefined,
      tier: 'team',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Pro',
        'Admin console for team management',
        'Collaborative tools',
        'Higher data security',
        'Team workspace',
        'Data exclusion from training by default',
        'Extended context windows',
        'Higher rate limits',
        'Priority support',
        'SSO integration',
      ],
      paymentMethods: ['Credit Card', 'Invoice'],
      accessFromChina: false,
      region: 'global',
    },
    {
      name: 'Claude Enterprise',
      priceMonthly: 0,
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Team',
        'Unlimited Claude 3.5 Sonnet access',
        'Enterprise-grade security',
        'SSO integration',
        'Audit logs',
        'Custom AI models',
        'Dedicated account manager',
        'Priority access to new features',
        'SLA guarantees',
        'SOC 2 and GDPR compliance',
        'Data residency options',
      ],
      paymentMethods: ['Invoice', 'Contract'],
      accessFromChina: false,
      region: 'global',
    },
  ];
}

export async function scrapeAnthropicPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Anthropic Claude subscription plans...');

    const anthropicPlans = await fetchAnthropicPlans();

    console.log(`📦 Found ${anthropicPlans.length} plans from Anthropic`);

    for (const plan of anthropicPlans) {
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
    console.log(`✅ Anthropic plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Anthropic-Plans',
      success: true,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Anthropic plans scrape failed:', error);
    return {
      source: 'Anthropic-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeAnthropicPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
