#!/usr/bin/env tsx
/**
 * Seed verified subscription prices for public creative/video/music plans.
 *
 * Scope is intentionally narrow: only prices that were visible on official
 * pricing pages during manual/browser verification are written as numeric
 * values. Ambiguous credit burn rates remain in seed-vertical-pricing-references.
 */
import { db } from './db/queries';

const APPLY = process.argv.includes('--apply');
const NOW = new Date();
const VERIFIED_AT = new Date('2026-09-15T00:00:00.000Z');

type Currency = 'USD';
type UsageUnit = 'credit';

interface VerifiedPlanSeed {
  providerSlug: string;
  modelSlugs: string[];
  slug: string;
  name: string;
  tier: string;
  tierRank: number;
  price: number | null;
  annualPrice: number | null;
  currency: Currency;
  includedUsageUnit: UsageUnit;
  includedUsageAmount: number | null;
  pricingModel?: 'subscription' | 'token_pack';
  priceUnit?: 'per_month' | 'one_time';
  quotaPeriod?: 'month' | 'day' | 'total';
  billingNote: string;
  sourceUrl: string;
  sourceQuote: string;
  features: string[];
}

interface ProviderRow { id: number; slug: string; name: string }
interface ModelRow { id: number; slug: string; name: string }
interface PlanRow { id: number; slug: string; provider_id: number | null }

const VERIFIED_PLANS: VerifiedPlanSeed[] = [
  // Runway pricing page, Individual tab, yearly toggle selected in browser:
  // Free $0/mo 125 one-time credits; Standard $12/mo 625 credits/mo;
  // Pro $28/mo 2250 credits/mo; Max $76/mo 9500 credits/mo.
  {
    providerSlug: 'runway',
    modelSlugs: ['runway-gen-4'],
    slug: 'runway-free-verified',
    name: 'Runway Free',
    tier: 'free',
    tierRank: 0,
    price: 0,
    annualPrice: null,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 125,
    billingNote: 'Free forever; 125 one-time credits.',
    sourceUrl: 'https://runwayml.com/pricing',
    sourceQuote: 'Free Free forever ... $0 /month 125 credits',
    features: ['125 one-time credits', 'Explore Runway AI tools'],
  },
  {
    providerSlug: 'runway',
    modelSlugs: ['runway-gen-4'],
    slug: 'runway-standard-yearly-verified',
    name: 'Runway Standard (yearly)',
    tier: 'standard',
    tierRank: 1,
    price: 12,
    annualPrice: 144,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 625,
    billingNote: 'Billed annually; displayed as $12/month on yearly toggle.',
    sourceUrl: 'https://runwayml.com/pricing',
    sourceQuote: 'Standard Billed annually ... $15 $12 /month 625 credits /mo',
    features: ['625 credits monthly', 'Access to AI video and image models', 'No watermarks'],
  },
  {
    providerSlug: 'runway',
    modelSlugs: ['runway-gen-4'],
    slug: 'runway-pro-yearly-verified',
    name: 'Runway Pro (yearly)',
    tier: 'pro',
    tierRank: 2,
    price: 28,
    annualPrice: 336,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 2250,
    billingNote: 'Billed annually; displayed as $28/month on yearly toggle.',
    sourceUrl: 'https://runwayml.com/pricing',
    sourceQuote: 'Pro Billed annually ... $35 $28 /month 2250 credits /mo',
    features: ['2250 credits monthly', 'Top-up credits anytime', 'Runway MCP'],
  },
  {
    providerSlug: 'runway',
    modelSlugs: ['runway-gen-4'],
    slug: 'runway-max-yearly-verified',
    name: 'Runway Max (yearly)',
    tier: 'max',
    tierRank: 3,
    price: 76,
    annualPrice: 912,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 9500,
    billingNote: 'Billed annually; displayed as $76/month on yearly toggle.',
    sourceUrl: 'https://runwayml.com/pricing',
    sourceQuote: 'Max ... Billed annually ... $95 $76 /month 9500 credits /mo',
    features: ['9500 credits monthly', 'Credits roll over 1 month', 'Early access to new models'],
  },

  // Pika pricing page, yearly toggle selected in browser. Fancy has visible
  // 6000 credits but no stable visible price in the accessible snapshot, so it
  // remains reference-only for now.
  {
    providerSlug: 'pika',
    modelSlugs: ['pika'],
    slug: 'pika-free-yearly-verified',
    name: 'Pika Free',
    tier: 'free',
    tierRank: 0,
    price: 0,
    annualPrice: null,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: null,
    billingNote: 'Free plan shown on Pika pricing page yearly tab.',
    sourceUrl: 'https://pika.art/pricing',
    sourceQuote: 'Free ... $0 ... billed yearly',
    features: ['Free plan'],
  },
  {
    providerSlug: 'pika',
    modelSlugs: ['pika'],
    slug: 'pika-basic-yearly-verified',
    name: 'Pika Basic (yearly)',
    tier: 'basic',
    tierRank: 1,
    price: 8,
    annualPrice: 96,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 80,
    billingNote: 'Billed yearly; displayed as $8/month.',
    sourceUrl: 'https://pika.art/pricing',
    sourceQuote: 'Basic ... 80 monthly video credits ... $8 / month ... billed yearly',
    features: ['80 monthly video credits', 'Pika 2.5 480p only', 'Commercial use'],
  },
  {
    providerSlug: 'pika',
    modelSlugs: ['pika'],
    slug: 'pika-standard-yearly-verified',
    name: 'Pika Standard (yearly)',
    tier: 'standard',
    tierRank: 2,
    price: 28,
    annualPrice: 336,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 700,
    billingNote: 'Billed yearly; displayed as $28/month.',
    sourceUrl: 'https://pika.art/pricing',
    sourceQuote: 'Standard ... 700 monthly video credits ... $28 / month ... billed yearly',
    features: ['700 monthly video credits', 'All resolutions', 'Fast generations'],
  },
  {
    providerSlug: 'pika',
    modelSlugs: ['pika'],
    slug: 'pika-pro-yearly-verified',
    name: 'Pika Pro (yearly)',
    tier: 'pro',
    tierRank: 3,
    price: 76,
    annualPrice: 912,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 2300,
    billingNote: 'Billed yearly; displayed as $76/month.',
    sourceUrl: 'https://pika.art/pricing',
    sourceQuote: 'Pro ... 2300 monthly video credits ... $76 / month ... billed yearly',
    features: ['2300 monthly video credits', 'Faster generations', 'Commercial use'],
  },

  // Luma Dream Machine pricing page, monthly toggle selected by default in browser.
  {
    providerSlug: 'luma-ai',
    modelSlugs: ['luma-ray'],
    slug: 'luma-plus-monthly-verified',
    name: 'Luma Plus',
    tier: 'plus',
    tierRank: 1,
    price: 30,
    annualPrice: null,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 10000,
    billingNote: 'Monthly price shown on Luma Dream Machine pricing section.',
    sourceUrl: 'https://lumalabs.ai/dream-machine',
    sourceQuote: 'Plus $30/month 10,000 credits',
    features: ['10,000 credits', 'Luma and third-party image and video models', 'Commercial use'],
  },
  {
    providerSlug: 'luma-ai',
    modelSlugs: ['luma-ray'],
    slug: 'luma-pro-monthly-verified',
    name: 'Luma Pro',
    tier: 'pro',
    tierRank: 2,
    price: 90,
    annualPrice: null,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 40000,
    billingNote: 'Monthly price shown on Luma Dream Machine pricing section.',
    sourceUrl: 'https://lumalabs.ai/dream-machine',
    sourceQuote: 'Pro $90/month ... 40,000 credits',
    features: ['40,000 credits', 'Everything in Plus'],
  },
  {
    providerSlug: 'luma-ai',
    modelSlugs: ['luma-ray'],
    slug: 'luma-premier-monthly-verified',
    name: 'Luma Premier',
    tier: 'premier',
    tierRank: 3,
    price: 300,
    annualPrice: null,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 150000,
    billingNote: 'Monthly price shown on Luma Dream Machine pricing section.',
    sourceUrl: 'https://lumalabs.ai/dream-machine',
    sourceQuote: 'Premier $300/month ... 150,000 credits',
    features: ['150,000 credits', 'Everything in Pro'],
  },

  // Udio pricing page, annually + USD selected in browser:
  // Free $0/mo, Standard $8/mo billed $96 annually, Pro $24/mo billed $288 annually,
  // plus official top-up packs of 100 credits for $3 and 1000 credits for $25.
  {
    providerSlug: 'udio',
    modelSlugs: ['udio'],
    slug: 'udio-free-verified',
    name: 'Udio Free',
    tier: 'free',
    tierRank: 0,
    price: 0,
    annualPrice: null,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 100,
    billingNote: 'Free plan: $0/month, 100 credits per month and 10 credits per day, no rollovers.',
    sourceUrl: 'https://www.udio.com/pricing',
    sourceQuote: 'Free ... $0/month $0 billed annually ... 10 credits per day and 100 credits per month',
    features: ['100 credits per month', '10 credits per day', 'Limited daily quota'],
  },
  {
    providerSlug: 'udio',
    modelSlugs: ['udio'],
    slug: 'udio-standard-yearly-verified',
    name: 'Udio Standard (yearly)',
    tier: 'standard',
    tierRank: 1,
    price: 8,
    annualPrice: 96,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 2400,
    billingNote: 'Billed annually; displayed as $8/month with $96 billed annually. Monthly price shown as $10.',
    sourceUrl: 'https://www.udio.com/pricing',
    sourceQuote: 'Standard ... $10 $8/month $96 billed annually ... 2400 credits per month',
    features: ['2400 credits per month', 'No daily generation limit for 2-minute songs', 'Editing and upload features'],
  },
  {
    providerSlug: 'udio',
    modelSlugs: ['udio'],
    slug: 'udio-pro-yearly-verified',
    name: 'Udio Pro (yearly)',
    tier: 'pro',
    tierRank: 2,
    price: 24,
    annualPrice: 288,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 6000,
    billingNote: 'Billed annually; displayed as $24/month with $288 billed annually. Monthly price shown as $30.',
    sourceUrl: 'https://www.udio.com/pricing',
    sourceQuote: 'Pro ... $30 $24/month $288 billed annually ... 6000 credits per month',
    features: ['6000 credits per month', 'Generate up to 10 songs at the same time', 'All features from other plans'],
  },
  {
    providerSlug: 'udio',
    modelSlugs: ['udio'],
    slug: 'udio-100-credit-pack-verified',
    name: 'Udio 100 credits pack',
    tier: 'top-up',
    tierRank: 10,
    price: 3,
    annualPrice: null,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 100,
    pricingModel: 'token_pack',
    priceUnit: 'one_time',
    quotaPeriod: 'total',
    billingNote: 'One-time top-up pack shown on Udio pricing page.',
    sourceUrl: 'https://www.udio.com/pricing',
    sourceQuote: 'Purchase 100 credits - $3.00',
    features: ['100 purchased credits'],
  },
  {
    providerSlug: 'udio',
    modelSlugs: ['udio'],
    slug: 'udio-1000-credit-pack-verified',
    name: 'Udio 1000 credits pack',
    tier: 'top-up',
    tierRank: 11,
    price: 25,
    annualPrice: null,
    currency: 'USD',
    includedUsageUnit: 'credit',
    includedUsageAmount: 1000,
    pricingModel: 'token_pack',
    priceUnit: 'one_time',
    quotaPeriod: 'total',
    billingNote: 'One-time top-up pack shown on Udio pricing page.',
    sourceUrl: 'https://www.udio.com/pricing',
    sourceQuote: 'Purchase 1000 credits - $25.00',
    features: ['1000 purchased credits'],
  },
];

async function loadProviders(): Promise<Map<string, ProviderRow>> {
  const { data, error } = await db.from('providers').select('id, slug, name');
  if (error) throw error;
  return new Map((data ?? []).map((provider: ProviderRow) => [provider.slug, provider]));
}

async function loadModels(): Promise<Map<string, ModelRow>> {
  const slugs = [...new Set(VERIFIED_PLANS.flatMap((plan) => plan.modelSlugs))];
  const { data, error } = await db.from('models').select('id, slug, name').in('slug', slugs);
  if (error) throw error;
  return new Map((data ?? []).map((model: ModelRow) => [model.slug, model]));
}

function planRow(seed: VerifiedPlanSeed, provider: ProviderRow) {
  return {
    provider_id: provider.id,
    product_id: provider.id,
    name: seed.name,
    slug: seed.slug,
    pricing_model: seed.pricingModel ?? 'subscription',
    price: seed.price,
    annual_price: seed.annualPrice,
    currency: seed.currency,
    price_unit: seed.priceUnit ?? 'per_month',
    tier: seed.tier,
    is_official: true,
    is_contact_sales: false,
    access_from_china: false,
    region: 'global',
    source: 'manual',
    plan_kind: 'creative',
    plan_category: 'creative',
    plan_line: `creative-${seed.providerSlug}`,
    tier_rank: seed.tierRank,
    included_usage_unit: seed.includedUsageUnit,
    included_usage_amount: seed.includedUsageAmount,
    features: seed.features,
    quotas: seed.includedUsageAmount == null ? [] : [{
      amount: seed.includedUsageAmount,
      unit: seed.includedUsageUnit,
      period: seed.quotaPeriod ?? (seed.price === 0 && seed.providerSlug === 'runway' ? 'total' : 'month'),
      note: seed.billingNote,
    }],
    notes: [
      'Verified numeric subscription price for creative/multimodal plan.',
      seed.billingNote,
      `Source quote: ${seed.sourceQuote}`,
      `Source: ${seed.sourceUrl}`,
    ].join('\n'),
    last_verified: VERIFIED_AT,
    updated_at: NOW,
  };
}

async function upsertPlan(seed: VerifiedPlanSeed, provider: ProviderRow): Promise<PlanRow> {
  const existing = await db
    .from('plans')
    .select('id, slug, provider_id')
    .eq('provider_id', provider.id)
    .eq('slug', seed.slug)
    .maybeSingle();
  if (existing.error) throw existing.error;

  const row = planRow(seed, provider);
  if (existing.data) {
    console.log(`  ↻ plan ${provider.slug}/${seed.slug}: ${seed.currency} ${seed.price ?? 'contact-sales'}/mo`);
    if (APPLY) {
      const { error } = await db.from('plans').update(row).eq('id', existing.data.id);
      if (error) throw error;
    }
    return existing.data as PlanRow;
  }

  console.log(`  ➕ plan ${provider.slug}/${seed.slug}: ${seed.currency} ${seed.price ?? 'contact-sales'}/mo`);
  if (!APPLY) return { id: -1, slug: seed.slug, provider_id: provider.id };
  const { data, error } = await db.from('plans').insert(row).select('id, slug, provider_id').single();
  if (error) throw error;
  return data as PlanRow;
}

async function upsertMapping(model: ModelRow, plan: PlanRow) {
  if (plan.id < 0) {
    console.log(`    ↳ map ${model.slug} → ${plan.slug}`);
    return;
  }
  const existing = await db.from('model_plan_mapping').select('id').eq('model_id', model.id).eq('plan_id', plan.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return;
  console.log(`    ↳ map ${model.slug} → ${plan.slug}`);
  if (APPLY) {
    const { error } = await db.from('model_plan_mapping').insert({ model_id: model.id, plan_id: plan.id, priority: 20, source: 'manual' });
    if (error) throw error;
  }
}

async function main() {
  console.log(`\n💵 seed-verified-creative-plan-prices ${APPLY ? '[APPLY]' : '[DRY-RUN]'} (${VERIFIED_PLANS.length} plans)\n`);
  const providers = await loadProviders();
  const models = await loadModels();
  let seeded = 0;
  let skipped = 0;

  for (const seed of VERIFIED_PLANS) {
    const provider = providers.get(seed.providerSlug);
    if (!provider) {
      console.log(`  ⚠ missing provider: ${seed.providerSlug}`);
      skipped++;
      continue;
    }
    const targetModels = seed.modelSlugs.map((slug) => models.get(slug)).filter((model): model is ModelRow => Boolean(model));
    if (targetModels.length !== seed.modelSlugs.length) {
      console.log(`  ⚠ ${seed.slug}: missing models ${seed.modelSlugs.filter((slug) => !models.get(slug)).join(', ')}`);
      skipped++;
      continue;
    }

    const plan = await upsertPlan(seed, provider);
    for (const model of targetModels) await upsertMapping(model, plan);
    seeded++;
  }

  console.log('\n━━━ Summary ━━━');
  console.log(`Verified plans: ${seeded}`);
  console.log(`Skipped: ${skipped}`);
  if (!APPLY) console.log('Dry-run only. Re-run with --apply or npm run seed:verified-creative-plans to write.');
  if (skipped > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
