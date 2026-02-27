import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';

const ANTHROPIC_PLAN_URL = 'https://anthropic.com/claude';

// Manual mapping from Anthropic Claude pricing page
const ANTHROPIC_PLANS: ScrapedPlan[] = [
  {
    planName: 'Claude Free',
    planSlug: 'claude-free',
    priceMonthly: 0,
    pricingModel: 'subscription',
    tier: 'free',
    features: [
      'Access to Claude Sonnet 4.6',
      'Access to claude.ai and Claude mobile apps',
      'Create and discover Projects',
      'Access to our latest features',
    ],
    models: ['claude-sonnet-4-6'],
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    isOfficial: true,
  },
  {
    planName: 'Claude Pro',
    planSlug: 'claude-pro',
    priceMonthly: 20,
    priceYearly: 200,  // $200/year
    pricingModel: 'subscription',
    tier: 'pro',
    features: [
      'At least 5x Claude usage',
      'Priority access during high-traffic periods',
      'Early access to new features',
      'Access to Claude Opus 4.6, Sonnet 4.6, and Haiku 4.5',
      'Create and discover more Projects',
      'Longer chat history retention',
    ],
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    isOfficial: true,
  },
  {
    planName: 'Claude Max',
    planSlug: 'claude-max',
    priceMonthly: 100,
    priceYearly: 1000,  // $1000/year (~$83.33/month, 17% savings)
    pricingModel: 'subscription',
    tier: 'pro',  // Similar tier to Pro but higher limits
    features: [
      'At least 10x Claude Pro usage',
      'Extended thinking on complex tasks',
      'Priority access during peak times',
      'Access to Claude Opus 4.6, Sonnet 4.6, and Haiku 4.5',
      'Create and discover more Projects',
      'Extended chat history retention',
      'Best for power users and professionals',
    ],
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    isOfficial: true,
  },
  {
    planName: 'Claude Team',
    planSlug: 'claude-team',
    priceMonthly: 25,  // $25/user/month (minimum 5 users)
    priceYearly: 300,  // $30/user/month billed annually ($25 * 12 = $300)
    pricingModel: 'subscription',
    tier: 'team',
    features: [
      'Everything in Pro',
      'Higher usage limits than Pro',
      'Share and discover chats with your team',
      'Centralized billing and admin',
      'Priority support',
    ],
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    isOfficial: true,
  },
];

export async function scrapeAnthropicPlan(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Processing Anthropic Plan pricing...');

    for (const plan of ANTHROPIC_PLANS) {
      try {
        // Validate prices
        if (!validatePlanPrice(plan.priceMonthly)) {
          errors.push(`Invalid price for ${plan.planName}`);
          continue;
        }

        plans.push(plan);
      } catch (error) {
        errors.push(`Error processing ${plan.planName}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Anthropic Plan scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Anthropic-Plan',
      success: true,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Anthropic Plan scrape failed:', error);
    return {
      source: 'Anthropic-Plan',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeAnthropicPlan().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
