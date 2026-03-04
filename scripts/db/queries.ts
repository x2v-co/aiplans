// Load environment variables first
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

// Import and create Supabase clients after env is loaded
const { createClient } = require('@supabase/supabase-js') as any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required in .env.local');
}

if (!supabaseKey) {
  throw new Error('SUPABASE_SERVICE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required in .env.local');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// Query helpers
export async function upsertChannelPrice(data: {
  product_id: number;
  channel_id: number;
  input_price_per_1m: number;
  output_price_per_1m: number;
  cached_input_price_per_1m?: number;
  rate_limit?: string | number;
  is_available: boolean;
  last_verified: Date;
  currency?: string;
  price_unit?: string;
}) {
  // Convert rate_limit to string if it's a number
  const rateLimit = data.rate_limit !== undefined
    ? typeof data.rate_limit === 'number'
      ? data.rate_limit.toString()
      : data.rate_limit
    : undefined;

  const { data: result, error } = await supabaseAdmin
    .from('channel_prices')
    .upsert({
      ...data,
      rate_limit: rateLimit,
    }, { onConflict: 'product_id,channel_id' })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function logPriceChange(data: {
  channel_price_id: number;
  old_input_price: number;
  new_input_price: number;
  old_output_price: number;
  new_output_price: number;
  change_percent: number;
}) {
  // Temporarily disabled due to price_history table schema issues
  // TODO: Re-enable after proper table structure is set up
  console.log('📝 Price change logging disabled temporarily');
  return;

  /* Original code (disabled for now):
  const { error } = await supabaseAdmin
    .from('price_history')
    .insert(data);

  if (error) throw error;
  */
}

export async function logScrapeResult(data: {
  source: string;
  status: 'success' | 'failed' | 'partial';
  models_found: number;
  prices_updated: number;
  errors?: string;
  started_at: Date;
  completed_at: Date;
}) {
  const { error } = await supabaseAdmin
    .from('scrape_logs')
    .insert(data);

  if (error) throw error;
}

export async function getOrCreateProduct(data: {
  name: string;
  slug: string;
  provider_id: number;
  type: string;
  context_window?: number;
}) {
  // First: try to find by exact slug match
  const { data: existingBySlug } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('slug', data.slug)
    .single();

  if (existingBySlug) {
    // Update slug if different
    if (existingBySlug.slug !== data.slug) {
      await supabaseAdmin
        .from('products')
        .update({ slug: data.slug })
        .eq('id', existingBySlug.id);
      existingBySlug.slug = data.slug;
    }
    return existingBySlug;
  }

  // Second: try to find by name + provider_id (should return at most one)
  // But there might be duplicates, so we order by id and take the first
  const { data: existingByName } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('name', data.name)
    .eq('provider_id', data.provider_id)
    .order('id')
    .limit(1);

  if (existingByName && existingByName.length > 0) {
    // Update the slug to match the normalized version
    if (existingByName[0].slug !== data.slug) {
      await supabaseAdmin
        .from('products')
        .update({ slug: data.slug })
        .eq('id', existingByName[0].id);
      existingByName[0].slug = data.slug;
    }
    return existingByName[0];
  }

  // Third: create new
  const { data: newProduct, error } = await supabaseAdmin
    .from('products')
    .insert(data)
    .select()
    .single();

  if (error) {
    // If unique constraint error, find existing
    if (error.code === '23505') {
      const { data: retry } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('slug', data.slug)
        .single();
      if (retry) return retry;
    }
    throw error;
  }
  return newProduct;
}

export async function getOrCreateChannel(data: {
  name: string;
  slug: string;
  type: string;
  website_url?: string;
  region?: string;
  access_from_china?: boolean;
}) {
  // Try to find existing
  const { data: existing } = await supabaseAdmin
    .from('channels')
    .select('*')
    .eq('slug', data.slug)
    .single();

  if (existing) return existing;

  // Create new
  const { data: newChannel, error } = await supabaseAdmin
    .from('channels')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return newChannel;
}

// Plan-related functions
export async function upsertPlan(data: {
  provider_id: number;
  name: string;
  slug: string;
  pricing_model: string;
  tier: string;
  price_monthly: number;
  price_yearly?: number;
  daily_message_limit?: number;
  requests_per_minute?: number;
  features?: string[];
  region?: string;
  access_from_china?: boolean;
  payment_methods?: string[];
  is_official: boolean;
  last_verified: Date;
  currency?: string;
  price_unit?: string;
}) {
  // Map field names to match actual database columns
  const dbData = {
    provider_id: data.provider_id,
    name: data.name,
    slug: data.slug,
    pricing_model: data.pricing_model,
    tier: data.tier,
    price: data.price_monthly,  // price_monthly -> price
    annual_price: data.price_yearly,  // price_yearly -> annual_price
    daily_message_limit: data.daily_message_limit,
    requests_per_minute: data.requests_per_minute,
    features: data.features,
    region: data.region,
    access_from_china: data.access_from_china,
    payment_methods: data.payment_methods,
    is_official: data.is_official,
    last_verified: data.last_verified,
    currency: data.currency || 'USD',
    price_unit: data.price_unit || 'per_month',
  };

  const { data: result, error } = await supabaseAdmin
    .from('plans')
    .upsert(dbData, { onConflict: 'provider_id,slug' })
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Update or create provider with full metadata
 * Stores additional metadata in the description field as JSON
 */
export async function upsertProvider(data: {
  name: string;
  slug: string;
  website?: string;
  logo?: string;
  region?: string;
  pricing_url?: string;
  api_docs_url?: string;
  payment_methods?: string[];
  invite_link?: string;
  priority?: number;
  notes?: string;
  type?: string;
  access_from_china?: boolean;
}) {
  // Create metadata object to store in description field
  const metadata: Record<string, unknown> = {
    region: data.region,
    pricingUrl: data.pricing_url,
    apiDocsUrl: data.api_docs_url,
    paymentMethods: data.payment_methods,
    inviteLink: data.invite_link,
    priority: data.priority,
    type: data.type,
    accessFromChina: data.access_from_china,
  };

  // Remove undefined values
  Object.keys(metadata).forEach(key => {
    if (metadata[key] === undefined) {
      delete metadata[key];
    }
  });

  // Map field names to database columns
  const dbData: Record<string, unknown> = {
    name: data.name,
    slug: data.slug,
    website: data.website,
    logo: data.logo,
  };

  // Store notes and metadata in description
  const descriptionParts: string[] = [];
  if (data.notes) {
    descriptionParts.push(data.notes);
  }
  if (Object.keys(metadata).length > 0) {
    descriptionParts.push(JSON.stringify(metadata));
  }
  if (descriptionParts.length > 0) {
    dbData.description = descriptionParts.join('\n---\n');
  }

  // Check for additional columns that may exist
  const { data: existing } = await supabaseAdmin
    .from('providers')
    .select('*')
    .eq('slug', data.slug)
    .single();

  if (existing) {
    // Update existing provider
    const { data: updated, error } = await supabaseAdmin
      .from('providers')
      .update({
        ...dbData,
        updated_at: new Date(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  }

  // Create new
  const { data: newProvider, error } = await supabaseAdmin
    .from('providers')
    .insert(dbData)
    .select()
    .single();

  if (error) throw error;
  return newProvider;
}

/**
 * Get provider by slug
 */
export async function getProviderBySlug(slug: string) {
  const { data, error } = await supabaseAdmin
    .from('providers')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get channel by name and type
 */
export async function getOrCreateChannelWithType(data: {
  name: string;
  slug: string;
  type: string;
  website?: string;
  region?: string;
  access_from_china?: boolean;
  provider_id?: number;
}) {
  // Try to find existing by slug
  const { data: existing } = await supabaseAdmin
    .from('channels')
    .select('*')
    .eq('slug', data.slug)
    .single();

  if (existing) return existing;

  // Create new
  const { data: newChannel, error } = await supabaseAdmin
    .from('channels')
    .insert({
      name: data.name,
      slug: data.slug,
      provider_id: data.provider_id,
      type: data.type,
      logo: data.website,
      website: data.website,
      region: data.region,
      access_from_china: data.access_from_china,
      description: `${data.type} channel for ${data.name}`,
    })
    .select()
    .single();

  if (error) throw error;
  return newChannel;
}

/**
 * Legacy function for backward compatibility
 */
export async function getOrCreateProvider(data: {
  name: string;
  slug: string;
  website_url?: string;
  logo_url?: string;
  region?: string;
}) {
  return upsertProvider({
    name: data.name,
    slug: data.slug,
    website: data.website_url,
    logo: data.logo_url,
  });
}

/**
 * Get all plans for a provider
 */
export async function getPlansByProviderId(providerId: number) {
  const { data, error } = await supabaseAdmin
    .from('plans')
    .select('*')
    .eq('provider_id', providerId)
    .order('id');

  if (error) throw error;
  return data || [];
}

/**
 * Update an existing plan
 */
export async function updatePlan(planId: number, data: Partial<{
  name: string;
  slug: string;
  pricing_model: string;
  tier: string;
  price: number;
  annual_price?: number;
  daily_message_limit?: number;
  weekly_message_limit?: number;
  monthly_message_limit?: number;
  rate_limit?: number;
  requests_per_minute?: number;
  requests_per_day?: number;
  requests_per_month?: number;
  qps?: number;
  concurrent_requests?: number;
  tokens_per_minute?: number;
  tokens_per_day?: number;
  tokens_per_month?: number;
  max_tokens_per_request?: number;
  max_input_tokens?: number;
  max_output_tokens?: number;
  price_yearly_monthly?: number;
  yearly_discount_percent?: number;
  features?: string[];
  region?: string;
  access_from_china?: boolean;
  payment_methods?: string[];
  is_official?: boolean;
  last_verified?: Date;
  currency?: string;
  price_unit?: string;
}>) {
  const { data: result, error } = await supabaseAdmin
    .from('plans')
    .update({
      ...data,
      updated_at: new Date(),
    })
    .eq('id', planId)
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Delete a plan by ID
 */
export async function deletePlan(planId: number) {
  const { error } = await supabaseAdmin
    .from('plans')
    .delete()
    .eq('id', planId);

  if (error) throw error;
}

/**
 * Cleanup outdated plans for a provider
 * Deletes plans that are not in the current slug list
 */
export async function cleanupOutdatedPlans(providerId: number, currentSlugs: string[]) {
  // Get all existing plans for this provider
  const existingPlans = await getPlansByProviderId(providerId);

  // Find plans to delete (slugs not in current list)
  const plansToDelete = existingPlans.filter(plan => !currentSlugs.includes(plan.slug));

  if (plansToDelete.length > 0) {
    console.log(`🗑️  Deleting ${plansToDelete.length} outdated plans for provider ${providerId}`);
    for (const plan of plansToDelete) {
      try {
        await deletePlan(plan.id);
        console.log(`   - Deleted: ${plan.name} (${plan.slug})`);
      } catch (error) {
        console.error(`   - Failed to delete plan ${plan.name}:`, error);
      }
    }
  } else {
    console.log(`✅ No outdated plans to delete for provider ${providerId}`);
  }

  return {
    deleted: plansToDelete.length,
    remaining: existingPlans.length - plansToDelete.length,
  };
}

/**
 * Get plan by provider and slug
 */
export async function getPlanByProviderSlug(providerId: number, slug: string) {
  const { data, error } = await supabaseAdmin
    .from('plans')
    .select('*')
    .eq('provider_id', providerId)
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw error;
  }
  return data;
}

/**
 * Upsert model-plan relationship
 */
export async function upsertModelPlanRelation(data: {
  plan_id: number;
  product_id: number;
  provider_id: number;
  is_available?: boolean;
  is_default?: boolean;
  display_order?: number;
  override_rpm?: number;
  override_qps?: number;
  override_input_price_per_1m?: number;
  override_output_price_per_1m?: number;
  max_output_tokens?: number;
  note?: string;
}) {
  const { data: result, error } = await supabaseAdmin
    .from('models')
    .upsert(data, { onConflict: 'plan_id,product_id' })
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Get models for a plan
 */
export async function getModelsForPlan(planId: number) {
  const { data, error } = await supabaseAdmin
    .from('models')
    .select(`
      *,
      products:product_id (
        id,
        name,
        slug
      )
    `)
    .eq('plan_id', planId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get plans for a model (product)
 */
export async function getPlansForModel(productId: number, isAvailable = true) {
  const { data, error } = await supabaseAdmin
    .from('models')
    .select(`
      plan_id,
      is_available,
      override_rpm,
      override_qps,
      override_input_price_per_1m,
      override_output_price_per_1m,
      max_output_tokens,
      plans:plan_id (
        *,
        providers:provider_id (
          id,
          name,
          slug,
          logo_url
        )
      )
    `)
    .eq('product_id', productId)
    .eq('is_available', isAvailable);

  if (error) throw error;
  return (data || []).map((m: any) => ({ ...m.plans, overrides: m }));
}

/**
 * Delete model-plan relationship
 */
export async function deleteModelPlanRelation(planId: number, productId: number) {
  const { error } = await supabaseAdmin
    .from('models')
    .delete()
    .eq('plan_id', planId)
    .eq('product_id', productId);

  if (error) throw error;
}

/**
 * Delete all models for a plan
 */
export async function deleteModelsForPlan(planId: number) {
  const { error } = await supabaseAdmin
    .from('models')
    .delete()
    .eq('plan_id', planId);

  if (error) throw error;
}
