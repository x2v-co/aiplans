import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Provider {
  id: number;
  name: string;
  slug: string;
  website: string | null;
  logo: string | null;
}

/**
 * 获取网站的 favicon URL
 * 使用多个服务作为备选
 */
function getFaviconUrl(websiteUrl: string | null, slug: string): string {
  if (!websiteUrl) {
    // 如果没有网站URL，使用 slug 猜测域名
    return `https://logo.clearbit.com/${slug}.com`;
  }

  try {
    const url = new URL(websiteUrl);
    const domain = url.hostname;

    // 优先使用 Clearbit Logo API（高质量）
    return `https://logo.clearbit.com/${domain}`;
  } catch (error) {
    console.error(`Invalid URL for ${slug}: ${websiteUrl}`);
    return `https://logo.clearbit.com/${slug}.com`;
  }
}

/**
 * 备用方案：Google Favicon Service
 */
function getGoogleFavicon(websiteUrl: string | null, slug: string): string {
  if (!websiteUrl) {
    return `https://www.google.com/s2/favicons?domain=${slug}.com&sz=128`;
  }

  try {
    const url = new URL(websiteUrl);
    const domain = url.hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  } catch (error) {
    return `https://www.google.com/s2/favicons?domain=${slug}.com&sz=128`;
  }
}

/**
 * 备用方案：Icon Horse
 */
function getIconHorse(websiteUrl: string | null, slug: string): string {
  if (!websiteUrl) {
    return `https://icon.horse/icon/${slug}.com`;
  }

  try {
    const url = new URL(websiteUrl);
    const domain = url.hostname;
    return `https://icon.horse/icon/${domain}`;
  } catch (error) {
    return `https://icon.horse/icon/${slug}.com`;
  }
}

/**
 * 验证 URL 是否可访问
 */
async function validateLogoUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * 获取最佳的 logo URL
 */
async function getBestLogoUrl(provider: Provider): Promise<string> {
  console.log(`\n🔍 Finding logo for ${provider.name}...`);

  // 尝试多个服务
  const urls = [
    { service: 'Clearbit', url: getFaviconUrl(provider.website, provider.slug) },
    { service: 'Icon Horse', url: getIconHorse(provider.website, provider.slug) },
    { service: 'Google', url: getGoogleFavicon(provider.website, provider.slug) },
  ];

  for (const { service, url } of urls) {
    console.log(`  Trying ${service}: ${url}`);
    const isValid = await validateLogoUrl(url);
    if (isValid) {
      console.log(`  ✅ Found valid logo from ${service}`);
      return url;
    }
  }

  // 如果都失败，返回 Google Favicon（最稳定）
  console.log(`  ⚠️  No valid logo found, using Google Favicon as fallback`);
  return getGoogleFavicon(provider.website, provider.slug);
}

/**
 * 手动指定的高质量 logo URLs
 * 留空则自动从 Icon Horse/Clearbit 获取
 */
const MANUAL_LOGOS: Record<string, string> = {
  // 可以在这里手动指定特定的 logo URL
  // 'openai': 'https://example.com/openai-logo.png',
};

async function main() {
  console.log('🎨 Starting logo fetcher for providers...\n');

  // 1. 获取所有 providers
  const { data: providers, error } = await supabase
    .from('providers')
    .select('*')
    .order('id');

  if (error) {
    console.error('❌ Error fetching providers:', error);
    process.exit(1);
  }

  if (!providers || providers.length === 0) {
    console.log('⚠️  No providers found');
    process.exit(0);
  }

  console.log(`📦 Found ${providers.length} providers\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  // 2. 为每个 provider 获取 logo
  for (const provider of providers as Provider[]) {
    try {
      // 如果已经有 logo，跳过（除非强制更新）
      if (provider.logo && !process.argv.includes('--force')) {
        console.log(`⏭️  ${provider.name}: Already has logo, skipping`);
        skipped++;
        continue;
      }

      let logoUrl: string;

      // 优先使用手动指定的 logo
      if (MANUAL_LOGOS[provider.slug]) {
        logoUrl = MANUAL_LOGOS[provider.slug];
        console.log(`🎯 ${provider.name}: Using manual logo`);
      } else {
        // 自动获取
        logoUrl = await getBestLogoUrl(provider);
      }

      // 3. 更新数据库
      const { error: updateError } = await supabase
        .from('providers')
        .update({ logo: logoUrl })
        .eq('id', provider.id);

      if (updateError) {
        console.error(`❌ ${provider.name}: Update failed -`, updateError);
        failed++;
      } else {
        console.log(`✅ ${provider.name}: Updated logo to ${logoUrl}`);
        updated++;
      }

      // 延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`❌ ${provider.name}: Error -`, error);
      failed++;
    }
  }

  // 4. 总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('='.repeat(60));

  // 5. 显示更新后的结果
  console.log('\n📋 Current provider logos:');
  const { data: updatedProviders } = await supabase
    .from('providers')
    .select('name, slug, logo')
    .order('id');

  if (updatedProviders) {
    updatedProviders.forEach((p: any) => {
      console.log(`   ${p.name.padEnd(20)} → ${p.logo || 'No logo'}`);
    });
  }

  console.log('\n✨ Logo fetcher completed!');
}

// 运行
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { main as fetchProviderLogos };
