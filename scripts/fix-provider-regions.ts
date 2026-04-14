#!/usr/bin/env tsx
/**
 * Classify providers by geographic origin + China accessibility.
 *
 * Context: providers.region defaults to 'global' and providers.access_from_china
 * defaults to true. No classification ever ran, so all 27 providers looked
 * identical and the /api-pricing filters "Region = 🇨🇳 China" and
 * "China Access Only" returned either zero results or everything.
 *
 * This script sets the two fields based on a curated classification.
 * Idempotent: re-running is a no-op if values already match.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... npx tsx scripts/fix-provider-regions.ts [--dry-run]
 */
import { supabaseAdmin } from './db/queries';

const DRY_RUN = process.argv.includes('--dry-run');

interface Classification {
  slug: string;
  region: 'china' | 'global';
  accessFromChina: boolean;
  reason: string;
}

// Chinese providers (origin = CN). Globally accessible by default; setting
// access_from_china=true because domestic users get direct access.
const CN_PROVIDERS: Classification[] = [
  { slug: 'deepseek',        region: 'china', accessFromChina: true, reason: 'DeepSeek (CN company, global-reach API)' },
  { slug: 'qwen',            region: 'china', accessFromChina: true, reason: 'Alibaba Qwen / 通义千问 (CN platform)' },
  { slug: 'moonshot-china',  region: 'china', accessFromChina: true, reason: 'Kimi / 月之暗面 CN platform' },
  { slug: 'minimax-china',   region: 'china', accessFromChina: true, reason: 'MiniMax CN platform' },
  { slug: 'zhipu-china',     region: 'china', accessFromChina: true, reason: 'Zhipu / 智谱 CN platform' },
  { slug: 'stepfun',         region: 'china', accessFromChina: true, reason: '阶跃星辰 StepFun CN' },
  { slug: 'seed',            region: 'china', accessFromChina: true, reason: 'ByteDance Seed / 火山方舟 CN' },
  { slug: 'hunyuan',         region: 'china', accessFromChina: true, reason: 'Tencent 混元 CN' },
  { slug: 'baidu',           region: 'china', accessFromChina: true, reason: 'Baidu ERNIE / 千帆 CN' },
  { slug: 'siliconflow',     region: 'china', accessFromChina: true, reason: '硅基流动 CN aggregator' },
  { slug: 'dmxapi',          region: 'china', accessFromChina: true, reason: 'DMXAPI CN reseller' },
  // Legacy slugs kept around by older scraper-inserted rows
  { slug: 'minimax',         region: 'china', accessFromChina: true, reason: 'Legacy MiniMax slug' },
  { slug: 'moonshot',        region: 'china', accessFromChina: true, reason: 'Legacy Moonshot slug' },
  { slug: 'volcengine',      region: 'china', accessFromChina: true, reason: 'Legacy 火山引擎 slug' },
];

// Global-only providers. Users in mainland China cannot reach these without
// a proxy / VPN, so access_from_china=false.
const GLOBAL_PROVIDERS: Classification[] = [
  { slug: 'openai',          region: 'global', accessFromChina: false, reason: 'OpenAI — blocked in CN' },
  { slug: 'anthropic',       region: 'global', accessFromChina: false, reason: 'Anthropic — blocked in CN' },
  { slug: 'google',          region: 'global', accessFromChina: false, reason: 'Google Gemini — blocked in CN' },
  { slug: 'grok',            region: 'global', accessFromChina: false, reason: 'xAI Grok — blocked in CN' },
  { slug: 'mistral',         region: 'global', accessFromChina: false, reason: 'Mistral — EU-hosted, not CN-native' },

  // Cloud mirrors of US providers — same accessibility story as the source
  { slug: 'aws-bedrock',     region: 'global', accessFromChina: false, reason: 'AWS Bedrock global regions — CN region separate' },
  { slug: 'azure-openai',    region: 'global', accessFromChina: false, reason: 'Azure OpenAI global — CN region separate' },
  { slug: 'vertex-ai',       region: 'global', accessFromChina: false, reason: 'Google Vertex AI — blocked in CN' },

  // Aggregators / routers — reachable in CN depends on network; mark false
  // to keep filter conservative. OpenRouter technically proxies but the
  // main cdn is blocked without VPN.
  { slug: 'openrouter',      region: 'global', accessFromChina: false, reason: 'OpenRouter — Cloudflare CDN blocked in CN' },
  { slug: 'together-ai',     region: 'global', accessFromChina: false, reason: 'Together AI — US-hosted' },
  { slug: 'fireworks',       region: 'global', accessFromChina: false, reason: 'Fireworks AI — US-hosted' },
  { slug: 'replicate',       region: 'global', accessFromChina: false, reason: 'Replicate — US-hosted' },
  { slug: 'anyscale',        region: 'global', accessFromChina: false, reason: 'Anyscale — US-hosted' },

  // Global mirrors of CN products (targeted at overseas users)
  { slug: 'moonshot-global', region: 'global', accessFromChina: false, reason: 'Kimi Global endpoint — not CN-facing' },
  { slug: 'minimax-global',  region: 'global', accessFromChina: false, reason: 'MiniMax Global endpoint' },
  { slug: 'zhipu-global',    region: 'global', accessFromChina: false, reason: 'Zhipu / Z.AI Global endpoint' },
];

const ALL: Classification[] = [...CN_PROVIDERS, ...GLOBAL_PROVIDERS];

async function main() {
  console.log(`\n🌍 fix-provider-regions ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);

  const { data: providers, error } = await supabaseAdmin
    .from('providers')
    .select('id, slug, name, region, access_from_china');
  if (error) throw error;

  const bySlug = new Map((providers ?? []).map(p => [p.slug, p]));
  let applied = 0;
  let skipped = 0;
  let missing = 0;

  for (const c of ALL) {
    const p = bySlug.get(c.slug);
    if (!p) {
      console.log(`  ⏭  ${c.slug}: not in providers table`);
      missing++;
      continue;
    }
    const same = p.region === c.region && p.access_from_china === c.accessFromChina;
    if (same) {
      skipped++;
      continue;
    }
    const badge = c.region === 'china' ? '🇨🇳' : '🌍';
    console.log(`  🔧 ${badge} ${c.slug}: region=${p.region}→${c.region} access_from_china=${p.access_from_china}→${c.accessFromChina}`);
    console.log(`      ${c.reason}`);
    if (!DRY_RUN) {
      const { error: upErr } = await supabaseAdmin
        .from('providers')
        .update({ region: c.region, access_from_china: c.accessFromChina, updated_at: new Date().toISOString() })
        .eq('id', p.id);
      if (upErr) {
        console.error(`      ❌ ${upErr.message}`);
        continue;
      }
    }
    applied++;
  }

  // Flag any providers NOT in either classification list
  const classifiedSlugs = new Set(ALL.map(c => c.slug));
  const unclassified = (providers ?? []).filter(p => !classifiedSlugs.has(p.slug));
  if (unclassified.length > 0) {
    console.log(`\n⚠ Unclassified providers in DB (staying at default):`);
    for (const p of unclassified) {
      console.log(`  - ${p.slug} (${p.name})  region=${p.region} access_from_china=${p.access_from_china}`);
    }
  }

  console.log(`\n━━━ Summary ━━━`);
  console.log(`Applied: ${applied}`);
  console.log(`Already correct: ${skipped}`);
  console.log(`Missing from DB: ${missing}`);
  console.log(`Unclassified: ${unclassified.length}`);
  if (DRY_RUN) console.log(`\n(dry-run — no writes)`);
}

main().catch(e => { console.error(e); process.exit(1); });
