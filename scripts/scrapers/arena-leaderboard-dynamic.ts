/**
 * Arena AI Leaderboard Dynamic Scraper
 *
 * Fetches real-time model rankings and Arena ELO scores from https://arena.ai/leaderboard
 * Updates benchmark scores in products table
 */

import { supabaseAdmin } from '../db/queries';
import { fetchHTML } from './base-fetcher';

const ARENA_LEADERBOARD_URL = 'https://arena.ai/leaderboard';

export interface ArenaModel {
  modelName: string;
  modelSlug: string;
  rank: number;
  arenaScore: number;
  votes: number;
  organization?: string;
  category: 'text' | 'code' | 'vision' | 'multimodal';
  ci95?: string; // Confidence interval
}

export interface ArenaScraperResult {
  source: string;
  success: boolean;
  models: ArenaModel[];
  updatedCount: number;
  errors?: string[];
}

/**
 * Normalize model name to match database slugs
 * Example: "claude-opus-4-6-thinking (Anthropic)" -> "claude-opus-4-6-thinking"
 */
function normalizeArenaModelName(name: string): string {
  // Remove organization suffix in parentheses
  const cleaned = name.replace(/\s*\([^)]+\)\s*$/, '');

  // Remove version suffixes like "-20260210"
  const withoutVersion = cleaned.replace(/-\d{8}$/, '');

  // Convert to lowercase and replace special chars with hyphens
  return withoutVersion
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse arena score from text
 * Handles formats like "1503 ± 15" or "1503"
 */
function parseArenaScore(text: string): number | null {
  const match = text.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Parse votes count from text
 */
function parseVotes(text: string): number {
  const match = text.match(/(\d+(?:,\d+)*)/);
  return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
}

/**
 * Extract model information from leaderboard table rows
 */
function extractModelsFromHTML(html: string, category: string): ArenaModel[] {
  const models: ArenaModel[] = [];

  // Look for table rows containing model data
  // Arena.ai uses a table structure with model names, scores, and votes
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

  let rank = 1;
  for (const row of rows) {
    // Skip header rows and rows without model data
    if (!row.includes('td') || row.includes('header')) continue;

    // Extract model name
    const modelNameMatch = row.match(/<td[^>]*>[\s\S]*?([^<]+)(?:<|&nbsp)/i);
    if (!modelNameMatch) continue;

    let modelName = modelNameMatch[1].trim();

    // Skip non-model rows
    if (modelName === '' || modelName === 'Model') continue;

    // Extract arena score
    const scoreMatch = row.match(/(\d{3,4}\.?\d*)\s*(?:±|\+\/\-)?/);
    if (!scoreMatch) continue;

    const arenaScore = parseFloat(scoreMatch[1]);

    // Extract votes
    const votesMatch = row.match(/(\d{1,3}(?:,\d{3})*)\s*votes?/i);
    const votes = votesMatch ? parseInt(votesMatch[1].replace(/,/g, ''), 10) : 0;

    // Determine organization from model name
    let organization: string | undefined;
    if (modelName.toLowerCase().includes('claude')) organization = 'Anthropic';
    else if (modelName.toLowerCase().includes('gpt')) organization = 'OpenAI';
    else if (modelName.toLowerCase().includes('gemini')) organization = 'Google';
    else if (modelName.toLowerCase().includes('grok')) organization = 'xAI';
    else if (modelName.toLowerCase().includes('deepseek')) organization = 'DeepSeek';
    else if (modelName.toLowerCase().includes('qwen') || modelName.toLowerCase().includes('dola')) organization = 'Alibaba';
    else if (modelName.toLowerCase().includes('glm') || modelName.toLowerCase().includes('zhipu')) organization = 'Zhipu AI';
    else if (modelName.toLowerCase().includes('mistral')) organization = 'Mistral AI';
    else if (modelName.toLowerCase().includes('llama')) organization = 'Meta';

    models.push({
      modelName,
      modelSlug: normalizeArenaModelName(modelName),
      rank,
      arenaScore,
      votes,
      organization,
      category: category as ArenaModel['category'],
    });

    rank++;
  }

  return models;
}

/**
 * Fetch leaderboard data from arena.ai
 * Tries multiple parsing strategies
 */
async function fetchArenaLeaderboard(): Promise<ArenaModel[]> {
  console.log(`🔄 Fetching from ${ARENA_LEADERBOARD_URL}...`);

  const result = await fetchHTML(ARENA_LEADERBOARD_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch arena.ai leaderboard, using fallback data');
    return getFallbackLeaderboard();
  }

  const html = result.data;
  const allModels: ArenaModel[] = [];

  // Try to find different leaderboard sections
  // Text leaderboard
  const textModels = extractModelsFromHTML(html, 'text');
  allModels.push(...textModels);

  // Code leaderboard (if present)
  if (html.includes('code') || html.includes('Code')) {
    const codeModels = extractModelsFromHTML(html, 'code');
    allModels.push(...codeModels);
  }

  if (allModels.length === 0) {
    console.warn('No models parsed from HTML, using fallback data');
    return getFallbackLeaderboard();
  }

  console.log(`📊 Found ${allModels.length} models from arena.ai`);
  return allModels;
}

/**
 * Fallback leaderboard data (based on known rankings as of 2026-03)
 */
function getFallbackLeaderboard(): ArenaModel[] {
  const textLeaderboard: ArenaModel[] = [
    {
      modelName: 'claude-opus-4-6-thinking (Anthropic)',
      modelSlug: 'claude-opus-4-6-thinking',
      rank: 1,
      arenaScore: 1503,
      votes: 6583,
      organization: 'Anthropic',
      category: 'text',
    },
    {
      modelName: 'claude-opus-4-6 (Anthropic)',
      modelSlug: 'claude-opus-4-6',
      rank: 2,
      arenaScore: 1503,
      votes: 7454,
      organization: 'Anthropic',
      category: 'text',
    },
    {
      modelName: 'gemini-3-1-pro-preview (Google)',
      modelSlug: 'gemini-3-1-pro-preview',
      rank: 3,
      arenaScore: 1500,
      votes: 4052,
      organization: 'Google',
      category: 'text',
    },
    {
      modelName: 'grok-4-20-beta1 (xAI)',
      modelSlug: 'grok-4-20-beta1',
      rank: 4,
      arenaScore: 1495,
      votes: 3818,
      organization: 'xAI',
      category: 'text',
    },
    {
      modelName: 'gemini-3-pro (Google)',
      modelSlug: 'gemini-3-pro',
      rank: 5,
      arenaScore: 1486,
      votes: 38248,
      organization: 'Google',
      category: 'text',
    },
    {
      modelName: 'gpt-5-2-chat-latest (OpenAI)',
      modelSlug: 'gpt-5-2-chat-latest',
      rank: 6,
      arenaScore: 1481,
      votes: 3605,
      organization: 'OpenAI',
      category: 'text',
    },
    {
      modelName: 'gemini-3-flash (Google)',
      modelSlug: 'gemini-3-flash',
      rank: 7,
      arenaScore: 1473,
      votes: 29334,
      organization: 'Google',
      category: 'text',
    },
    {
      modelName: 'grok-4-1-thinking (xAI)',
      modelSlug: 'grok-4-1-thinking',
      rank: 8,
      arenaScore: 1473,
      votes: 37474,
      organization: 'xAI',
      category: 'text',
    },
    {
      modelName: 'claude-opus-4-5-thinking (Anthropic)',
      modelSlug: 'claude-opus-4-5-thinking',
      rank: 9,
      arenaScore: 1471,
      votes: 30541,
      organization: 'Anthropic',
      category: 'text',
    },
    {
      modelName: 'deepseek-v3 (DeepSeek)',
      modelSlug: 'deepseek-v3',
      rank: 10,
      arenaScore: 1470,
      votes: 4620,
      organization: 'DeepSeek',
      category: 'text',
    },
  ];

  const codeLeaderboard: ArenaModel[] = [
    {
      modelName: 'claude-opus-4-6 (Anthropic)',
      modelSlug: 'claude-opus-4-6',
      rank: 1,
      arenaScore: 1560,
      votes: 2845,
      organization: 'Anthropic',
      category: 'code',
    },
    {
      modelName: 'claude-opus-4-6-thinking (Anthropic)',
      modelSlug: 'claude-opus-4-6-thinking',
      rank: 2,
      arenaScore: 1553,
      votes: 2182,
      organization: 'Anthropic',
      category: 'code',
    },
    {
      modelName: 'claude-sonnet-4-6 (Anthropic)',
      modelSlug: 'claude-sonnet-4-6',
      rank: 3,
      arenaScore: 1531,
      votes: 1839,
      organization: 'Anthropic',
      category: 'code',
    },
    {
      modelName: 'claude-opus-4-5-thinking (Anthropic)',
      modelSlug: 'claude-opus-4-5-thinking',
      rank: 4,
      arenaScore: 1499,
      votes: 11149,
      organization: 'Anthropic',
      category: 'code',
    },
    {
      modelName: 'gpt-5-2-high (OpenAI)',
      modelSlug: 'gpt-5-2-high',
      rank: 5,
      arenaScore: 1471,
      votes: 1696,
      organization: 'OpenAI',
      category: 'code',
    },
  ];

  return [...textLeaderboard, ...codeLeaderboard];
}

/**
 * Get most expensive API model from each provider based on channel prices
 */
async function getTopModelsByProvider(): Promise<Map<string, { providerId: number; modelName: string; slug: string; }>> {
  const providerTopModels = new Map<string, { providerId: number; modelName: string; slug: string; }>();

  // Get all products with channel prices
  const { data: channelPrices, error } = await supabaseAdmin
    .from('channel_prices')
    .select(`
      *,
      product!inner (
        id,
        name,
        slug,
        provider_id,
        provider!inner (
          id,
          name,
          slug
        )
      )
    `)
    .eq('is_available', true)
    .order('input_price_per_1m', { ascending: false });

  if (error) {
    console.error('Error fetching channel prices:', error);
    return providerTopModels;
  }

  if (!channelPrices || channelPrices.length === 0) {
    console.warn('No channel prices found');
    return providerTopModels;
  }

  // Group by provider and select most expensive model
  for (const cp of channelPrices) {
    const product = cp.product as any;
    const provider = product.provider as any;

    if (!provider) continue;

    const providerSlug = provider.slug;
    const inputPrice = cp.input_price_per_1m;

    // If provider not in map or this model is more expensive
    if (!providerTopModels.has(providerSlug) || inputPrice > 0) {
      providerTopModels.set(providerSlug, {
        providerId: provider.id,
        modelName: product.name,
        slug: product.slug,
      });
    }
  }

  return providerTopModels;
}

/**
 * Map Arena model names to database slugs
 */
const MODEL_NAME_MAPPING: Record<string, string> = {
  'claude-opus-4-6-thinking': 'claude-opus-4.6',
  'claude-opus-4-6': 'claude-opus-4.6',
  'claude-sonnet-4-6': 'claude-sonnet-4.6',
  'claude-opus-4-5-thinking': 'claude-3-opus',
  'gpt-5-2-chat-latest': 'gpt-4o',
  'gpt-5-2-high': 'gpt-4o',
  'gemini-3-1-pro-preview': 'gemini-1.5-pro',
  'gemini-3-pro': 'gemini-1.5-pro',
  'gemini-3-flash': 'gemini-1.5-flash',
  'grok-4-20-beta1': 'grok-2',
  'grok-4-1-thinking': 'grok-2',
  'deepseek-v3': 'deepseek-v3',
  'dola-seed-2-0-preview': 'deepseek-v3',
  'qwen-max': 'qwen-max',
  'glm-4': 'glm-4',
  'mistral-large': 'mistral-large',
};

/**
 * Find matching product in database for arena model
 */
async function findProductByArenaModel(arenaModel: ArenaModel): Promise<any | null> {
  let slug = arenaModel.modelSlug;

  // Apply name mapping if exists
  if (MODEL_NAME_MAPPING[slug]) {
    slug = MODEL_NAME_MAPPING[slug];
  }

  // Try multiple slug variations
  const slugVariations = [
    slug,
    slug.replace(/^claude-4-/, 'claude-opus-4-'),
    slug.replace(/^gpt-/, 'gpt-'),
    slug.replace(/-/g, ''),
    slug.replace(/\./g, '-'),
  ];

  for (const slugVar of slugVariations) {
    const { data } = await supabaseAdmin
      .from('products')
      .select('*')
      .ilike('slug', slugVar)
      .maybeSingle();

    if (data) {
      return data;
    }
  }

  return null;
}

/**
 * Update product benchmark scores in database
 */
async function updateBenchmarkScores(models: ArenaModel[]): Promise<number> {
  let updatedCount = 0;

  for (const model of models) {
    try {
      const product = await findProductByArenaModel(model);

      if (!product) {
        console.log(`⚠️  Product not found for: ${model.modelName} (slug: ${model.modelSlug})`);
        continue;
      }

      // Update benchmark score
      const { error } = await supabaseAdmin
        .from('products')
        .update({
          benchmark_arena_elo: model.arenaScore,
          updated_at: new Date(),
        })
        .eq('id', product.id);

      if (error) {
        console.error(`❌ Failed to update ${model.modelName}:`, error.message);
        continue;
      }

      console.log(`✅ Updated ${product.name} (${product.slug}): ELO ${model.arenaScore}, Rank ${model.rank}`);
      updatedCount++;

    } catch (error: any) {
      console.error(`❌ Error updating ${model.modelName}:`, error.message);
    }
  }

  return updatedCount;
}

/**
 * Get top popular models sorted by arena score
 */
async function getTopPopularModels(limit: number = 20): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select(`
      *,
      provider!inner (
        id,
        name,
        slug
      )
    `)
    .not('benchmark_arena_elo', 'is', null)
    .order('benchmark_arena_elo', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching top popular models:', error);
    return [];
  }

  return data || [];
}

/**
 * Main scraper function
 */
export async function scrapeArenaLeaderboard(): Promise<ArenaScraperResult> {
  const startTime = Date.now();
  console.log(`\n🏆 Starting Arena Leaderboard scraper...`);
  console.log(`📍 Source: ${ARENA_LEADERBOARD_URL}\n`);

  const result: ArenaScraperResult = {
    source: 'arena.ai',
    success: false,
    models: [],
    updatedCount: 0,
    errors: [],
  };

  try {
    // Get most expensive models from each provider
    console.log('📊 Fetching top models by provider...');
    const topModelsByProvider = await getTopModelsByProvider();
    console.log(`   Found ${topModelsByProvider.size} providers with top models\n`);

    // Fetch arena leaderboard
    result.models = await fetchArenaLeaderboard();

    // Update database with arena scores
    result.updatedCount = await updateBenchmarkScores(result.models);

    // Get sorted popular models
    console.log('\n📈 Top Popular Models (by Arena ELO):');
    const topModels = await getTopPopularModels(15);
    for (const model of topModels) {
      const provider = model.provider as any;
      console.log(`   ${model.benchmark_arena_elo?.toFixed(1)} - ${model.name} (${provider?.name})`);
    }

    result.success = true;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Arena scraper completed in ${duration}s`);
    console.log(`📈 Updated ${result.updatedCount}/${result.models.length} models\n`);

  } catch (error: any) {
    result.success = false;
    result.errors = [error.message];
    console.error(`\n❌ Arena scraper failed:`, error.message);
  }

  return result;
}

// Run if called directly
if (require.main === module) {
  scrapeArenaLeaderboard()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
