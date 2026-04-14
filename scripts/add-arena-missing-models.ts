#!/usr/bin/env tsx
/**
 * Create stub models for Arena top-60 entries that don't exist in DB yet.
 *
 * After running this, re-run scripts/ingest-arena-leaderboard.ts to get the
 * 14+ additional arena rows matched. Idempotent — skips slugs that exist.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... npx tsx scripts/add-arena-missing-models.ts [--dry-run]
 */
import { supabaseAdmin } from './db/queries';

const DRY_RUN = process.argv.includes('--dry-run');

interface Stub {
  slug: string;
  name: string;
  providerSlug: string;
  contextWindow?: number;
  type?: string;
}

const STUBS: Stub[] = [
  // Anthropic — legacy major versions still on Arena leaderboard
  { slug: 'claude-opus-4.5',   name: 'Claude Opus 4.5',   providerSlug: 'anthropic', contextWindow: 200_000 },
  { slug: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', providerSlug: 'anthropic', contextWindow: 200_000 },
  { slug: 'claude-opus-4.1',   name: 'Claude Opus 4.1',   providerSlug: 'anthropic', contextWindow: 200_000 },
  { slug: 'claude-opus-4',     name: 'Claude Opus 4',     providerSlug: 'anthropic', contextWindow: 200_000 },
  // xAI
  { slug: 'grok-4.1',          name: 'Grok 4.1',          providerSlug: 'grok',      contextWindow: 128_000 },
  // Alibaba Qwen
  { slug: 'qwen3.5-max',                 name: 'Qwen 3.5 Max',                 providerSlug: 'qwen',   contextWindow: 32_000 },
  { slug: 'qwen3-235b-a22b-instruct',    name: 'Qwen 3 235B A22B Instruct',    providerSlug: 'qwen',   contextWindow: 32_000 },
  // Baidu ERNIE
  { slug: 'ernie-5.0',         name: 'ERNIE 5.0',         providerSlug: 'baidu',     contextWindow: 128_000 },
  // Also: chatgpt-4o-latest is a real OpenAI alias — create as stub so arena
  // ingestion will find it, since scraper-side KNOWN_MODELS track gpt-4o not
  // chatgpt-4o-latest.
  { slug: 'chatgpt-4o-latest', name: 'ChatGPT-4o (latest alias)', providerSlug: 'openai', contextWindow: 128_000 },
  { slug: 'gpt-4.5',           name: 'GPT-4.5',           providerSlug: 'openai',    contextWindow: 128_000 },
];

async function main() {
  console.log(`\n➕ add-arena-missing-models ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);

  const providerCache = new Map<string, number>();
  async function getProviderId(slug: string): Promise<number | null> {
    if (providerCache.has(slug)) return providerCache.get(slug)!;
    const { data } = await supabaseAdmin.from('providers').select('id').eq('slug', slug).maybeSingle();
    if (data) providerCache.set(slug, data.id);
    return data?.id ?? null;
  }

  let created = 0;
  let skipped = 0;
  for (const s of STUBS) {
    const { data: existing } = await supabaseAdmin
      .from('models').select('id').eq('slug', s.slug).maybeSingle();
    if (existing) {
      console.log(`  ✓ ${s.slug}: exists, skip`);
      skipped++;
      continue;
    }
    const providerId = await getProviderId(s.providerSlug);
    if (!providerId) {
      console.log(`  ⏭ ${s.slug}: provider "${s.providerSlug}" not found`);
      continue;
    }
    console.log(`  ➕ ${s.slug} → provider=${s.providerSlug} (${providerId}) ctx=${s.contextWindow}`);
    if (!DRY_RUN) {
      const { error } = await supabaseAdmin.from('models').insert({
        slug: s.slug,
        name: s.name,
        type: s.type ?? 'llm',
        provider_ids: [providerId],
        context_window: s.contextWindow,
      });
      if (error) {
        console.error(`     ❌ ${error.message}`);
        continue;
      }
    }
    created++;
  }

  console.log(`\n━━━ Summary ━━━`);
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  if (DRY_RUN) console.log(`(dry-run — no writes)`);
}

main().catch(e => { console.error(e); process.exit(1); });
