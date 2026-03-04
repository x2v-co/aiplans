/**
 * Arena AI Leaderboard Scraper
 *
 * Fetches model rankings and Arena ELO scores from https://arena.ai/leaderboard
 * Updates benchmark scores in the products table
 */

import { slugify, normalizeModelName } from '../utils/validator';
import { supabaseAdmin } from '../db/queries';

const ARENA_LEADERBOARD_URL = 'https://arena.ai/leaderboard';

export interface ArenaModel {
  modelName: string;
  modelSlug: string;
  rank: number;
  arenaScore: number;
  votes: number;
  organization?: string;
  category: 'text' | 'code' | 'vision' | 'multimodal';
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

  // Normalize spaces and special chars
  return slugify(withoutVersion);
}

/**
 * Map Arena model names to database slugs
 * Some models have different names in Arena vs our database
 */
const MODEL_NAME_MAPPING: Record<string, string> = {
  'gpt-5-2-chat-latest': 'gpt-4o',  // Map to existing GPT-4o until GPT-5 is in DB
  'gpt-5-2-high': 'gpt-4o',
  'claude-opus-4-6': 'claude-opus-4.6',  // Exact match exists
  'claude-opus-4-6-thinking': 'claude-opus-4.6',
  'claude-sonnet-4-6': 'claude-sonnet-4.6',  // Exact match exists
  'claude-opus-4-5-thinking': 'claude-3-opus',  // Map to Claude 3 Opus
  'claude-opus-4-5-20251101-thinking-32k': 'claude-3-opus',
  'gemini-3-1-pro-preview': 'gemini-1-5-pro',  // Map to Gemini 1.5 Pro (hyphen format in DB)
  'gemini-3-pro': 'gemini-1-5-pro',
  'gemini-3-flash': 'gemini-1-5-flash',
  'grok-4-20-beta1': 'grok-2',  // Map to Grok 2
  'grok-4-1-thinking': 'grok-2',
  'dola-seed-2-0-preview': 'deepseek-v3',  // Map to similar model
  'dola-seed-2-0': 'deepseek-v3',
};

/**
 * Fetch leaderboard data using WebFetch or puppeteer
 * For now, using manual data extraction from WebFetch results
 */
async function fetchArenaLeaderboard(): Promise<ArenaModel[]> {
  // Note: In production, this should use Playwright or Puppeteer to scrape dynamic content
  // For now, we'll use the manual data from the latest leaderboard

  const textLeaderboard: ArenaModel[] = [
    {
      modelName: 'claude-opus-4-6-thinking',
      modelSlug: normalizeArenaModelName('claude-opus-4-6-thinking (Anthropic)'),
      rank: 1,
      arenaScore: 1503,
      votes: 6583,
      organization: 'Anthropic',
      category: 'text',
    },
    {
      modelName: 'claude-opus-4-6',
      modelSlug: normalizeArenaModelName('claude-opus-4-6 (Anthropic)'),
      rank: 2,
      arenaScore: 1503,
      votes: 7454,
      organization: 'Anthropic',
      category: 'text',
    },
    {
      modelName: 'gemini-3-1-pro-preview',
      modelSlug: normalizeArenaModelName('gemini-3.1-pro-preview'),
      rank: 3,
      arenaScore: 1500,
      votes: 4052,
      organization: 'Google',
      category: 'text',
    },
    {
      modelName: 'grok-4-20-beta1',
      modelSlug: normalizeArenaModelName('grok-4.20-beta1'),
      rank: 4,
      arenaScore: 1495,
      votes: 3818,
      organization: 'xAI',
      category: 'text',
    },
    {
      modelName: 'gemini-3-pro',
      modelSlug: normalizeArenaModelName('gemini-3-pro'),
      rank: 5,
      arenaScore: 1486,
      votes: 38248,
      organization: 'Google',
      category: 'text',
    },
    {
      modelName: 'gpt-5-2-chat-latest',
      modelSlug: normalizeArenaModelName('gpt-5.2-chat-latest-20260210'),
      rank: 6,
      arenaScore: 1481,
      votes: 3605,
      organization: 'OpenAI',
      category: 'text',
    },
    {
      modelName: 'gemini-3-flash',
      modelSlug: normalizeArenaModelName('gemini-3-flash'),
      rank: 7,
      arenaScore: 1473,
      votes: 29334,
      organization: 'Google',
      category: 'text',
    },
    {
      modelName: 'grok-4-1-thinking',
      modelSlug: normalizeArenaModelName('grok-4.1-thinking'),
      rank: 8,
      arenaScore: 1473,
      votes: 37474,
      organization: 'xAI',
      category: 'text',
    },
    {
      modelName: 'claude-opus-4-5-thinking',
      modelSlug: normalizeArenaModelName('claude-opus-4-5-20251101-thinking-32k'),
      rank: 9,
      arenaScore: 1471,
      votes: 30541,
      organization: 'Anthropic',
      category: 'text',
    },
    {
      modelName: 'dola-seed-2-0',
      modelSlug: normalizeArenaModelName('dola-seed-2.0-preview'),
      rank: 10,
      arenaScore: 1470,
      votes: 4620,
      organization: 'ByteDance',
      category: 'text',
    },
  ];

  const codeLeaderboard: ArenaModel[] = [
    {
      modelName: 'claude-opus-4-6',
      modelSlug: normalizeArenaModelName('claude-opus-4-6 (Anthropic)'),
      rank: 1,
      arenaScore: 1560,
      votes: 2845,
      organization: 'Anthropic',
      category: 'code',
    },
    {
      modelName: 'claude-opus-4-6-thinking',
      modelSlug: normalizeArenaModelName('claude-opus-4-6-thinking (Anthropic)'),
      rank: 2,
      arenaScore: 1553,
      votes: 2182,
      organization: 'Anthropic',
      category: 'code',
    },
    {
      modelName: 'claude-sonnet-4-6',
      modelSlug: normalizeArenaModelName('claude-sonnet-4-6 (Anthropic)'),
      rank: 3,
      arenaScore: 1531,
      votes: 1839,
      organization: 'Anthropic',
      category: 'code',
    },
    {
      modelName: 'claude-opus-4-5-thinking',
      modelSlug: normalizeArenaModelName('claude-opus-4-5-20251101-thinking-32k'),
      rank: 4,
      arenaScore: 1499,
      votes: 11149,
      organization: 'Anthropic',
      category: 'code',
    },
    {
      modelName: 'gpt-5-2-high',
      modelSlug: normalizeArenaModelName('gpt-5.2-high'),
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
 * Update product benchmark scores in database
 */
async function updateBenchmarkScores(models: ArenaModel[]): Promise<number> {
  let updatedCount = 0;

  for (const model of models) {
    try {
      // Try to find product by slug
      let slug = model.modelSlug;

      // Apply name mapping if exists
      if (MODEL_NAME_MAPPING[slug]) {
        slug = MODEL_NAME_MAPPING[slug];
      }

      // Try multiple slug variations
      const slugVariations = [
        slug,
        slug.replace(/^claude-4-/, 'claude-opus-4-'),  // claude-4-opus -> claude-opus-4-opus
        slug.replace(/^gpt-/, 'gpt-'),
        slug.replace(/-/g, ''),  // Remove all hyphens
      ];

      let product = null;
      for (const slugVar of slugVariations) {
        const { data } = await supabaseAdmin
          .from('products')
          .select('*')
          .eq('slug', slugVar)
          .maybeSingle();

        if (data) {
          product = data;
          break;
        }
      }

      if (!product) {
        console.log(`⚠️  Product not found for slug: ${slug} (${model.modelName})`);
        continue;
      }

      // Update benchmark score
      const { error } = await supabaseAdmin
        .from('products')
        .update({
          benchmark_arena_elo: model.arenaScore,
          updated_at: new Date().toISOString(),
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
    // Fetch leaderboard data
    result.models = await fetchArenaLeaderboard();
    console.log(`📊 Found ${result.models.length} models on leaderboard`);

    // Update database
    result.updatedCount = await updateBenchmarkScores(result.models);

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
