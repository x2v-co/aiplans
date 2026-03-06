import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

const BASE_URL = 'https://aiplans.dev';

// Provider slugs from database
const PROVIDER_SLUGS = [
  'openai', 'anthropic', 'google', 'deepseek', 'mistral',
  'moonshot', 'qwen', 'zhipu', 'hunyuan', 'baidu',
  'minimax', 'seed', 'stepfun', 'grok'
];

// Major model slugs - these are the most popular models
const MODEL_SLUGS = [
  // OpenAI
  'gpt-4o', 'gpt-4o-mini', 'gpt-5', 'o1', 'o1-mini', 'o3', 'o3-mini',
  // Anthropic
  'claude-sonnet-4.6', 'claude-opus-4.6', 'claude-3.5-sonnet', 'claude-3.7-sonnet', 'claude-haiku-4-5',
  // DeepSeek
  'deepseek-v3', 'deepseek-chat', 'deepseek-r1', 'deepseek-reasoner',
  // Google
  'gemini-2.5-pro', 'gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash',
  // Grok
  'grok-3', 'grok-2', 'grok-3-mini',
  // Qwen
  'qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3-max', 'qwen3-plus',
  // GLM
  'glm-4', 'glm-4-flash', 'glm-5',
  // Kimi
  'kimi-k2.5', 'kimi-k2',
  // Hunyuan
  'hunyuan-pro', 'hunyuan-lite',
  // ERNIE
  'ernie-4.5-21b-a3b', 'ernie-lite'
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [];

  // Helper to create URL entry
  const createUrl = (loc: string, priority: number, changefreq: string = 'weekly') => ({
    url: loc,
    lastModified: new Date(),
    changeFrequency: changefreq as any,
    priority,
  });

  // Main pages - English
  urls.push(createUrl(`${BASE_URL}/en`, 1.0, 'daily'));
  urls.push(createUrl(`${BASE_URL}/en/compare/plans`, 0.9, 'daily'));
  urls.push(createUrl(`${BASE_URL}/en/api-pricing`, 0.9, 'daily'));
  urls.push(createUrl(`${BASE_URL}/en/coupons`, 0.7, 'weekly'));
  urls.push(createUrl(`${BASE_URL}/en/compare/models`, 0.9, 'daily'));
  urls.push(createUrl(`${BASE_URL}/en/compare/api`, 0.9, 'daily'));

  // Main pages - Chinese
  urls.push(createUrl(`${BASE_URL}/zh`, 1.0, 'daily'));
  urls.push(createUrl(`${BASE_URL}/zh/compare/plans`, 0.9, 'daily'));
  urls.push(createUrl(`${BASE_URL}/zh/api-pricing`, 0.9, 'daily'));
  urls.push(createUrl(`${BASE_URL}/zh/coupons`, 0.7, 'weekly'));
  urls.push(createUrl(`${BASE_URL}/zh/compare/models`, 0.9, 'daily'));
  urls.push(createUrl(`${BASE_URL}/zh/compare/api`, 0.9, 'daily'));

  // Non-locale routes
  urls.push(createUrl(`${BASE_URL}/compare/plans`, 0.9, 'daily'));
  urls.push(createUrl(`${BASE_URL}/compare/models`, 0.9, 'daily'));
  urls.push(createUrl(`${BASE_URL}/compare/api`, 0.9, 'daily'));
  urls.push(createUrl(`${BASE_URL}/api-pricing`, 0.9, 'daily'));
  urls.push(createUrl(`${BASE_URL}/coupons`, 0.7, 'weekly'));

  // Provider plan pages
  for (const provider of PROVIDER_SLUGS) {
    urls.push(createUrl(`${BASE_URL}/plans/${provider}`, 0.8, 'weekly'));
  }

  // Model channel price pages - English
  for (const model of MODEL_SLUGS) {
    urls.push(createUrl(`${BASE_URL}/en/models/${model}`, 0.8, 'weekly'));
  }

  // Model channel price pages - Chinese
  for (const model of MODEL_SLUGS) {
    urls.push(createUrl(`${BASE_URL}/zh/models/${model}`, 0.8, 'weekly'));
  }

  // Try to fetch additional models from database
  try {
    const { data: products } = await supabase
      .from('products')
      .select('slug')
      .eq('type', 'llm')
      .limit(100);

    if (products && products.length > 0) {
      // Add any additional models not in our manual list
      const existingSlugs = new Set(MODEL_SLUGS);
      for (const product of products) {
        if (product.slug && !existingSlugs.has(product.slug)) {
          urls.push(createUrl(`${BASE_URL}/models/${product.slug}`, 0.6, 'weekly'));
          urls.push(createUrl(`${BASE_URL}/en/models/${product.slug}`, 0.6, 'weekly'));
          urls.push(createUrl(`${BASE_URL}/zh/models/${product.slug}`, 0.6, 'weekly'));
        }
      }
    }
  } catch (error) {
    console.error('Error fetching products for sitemap:', error);
  }

  return urls;
}
