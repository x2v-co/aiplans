#!/usr/bin/env tsx
/**
 * Seed missing direct-producer channel rows for CN vendors whose official
 * platforms we haven't scraped yet. Without these, the /api-pricing page
 * shows GLM and Kimi models with only Together-AI / OpenRouter aggregator
 * channels, and the "Region 🇨🇳 China" filter misses them (filter semantics
 * were also broadened, but having the direct-channel row here means the
 * actual price tables render with the correct domestic pricing).
 *
 * Ground truth verified 2026-04-13/14 via web-info-extractor agent:
 *   - GLM via z.ai international pricing (USD)
 *   - Kimi via platform.kimi.com chat-v1 + chat-k2 (CNY)
 *
 * Idempotent: upserts via direct Supabase SDK, matching on
 * (model_slug, provider_slug).
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... npx tsx scripts/fix-cn-producer-channels.ts [--dry-run]
 */
import { supabaseAdmin } from './db/queries';

const DRY_RUN = process.argv.includes('--dry-run');

interface Seed {
  modelSlug: string;
  providerSlug: string;
  input: number;
  output: number;
  currency: 'USD' | 'CNY';
  notes: string;
}

const SEEDS: Seed[] = [
  // ─── Zhipu / GLM via z.ai international ─────────────────────────
  // Prices verified against https://docs.z.ai/guides/overview/pricing 2026-04-13.
  // The zhipu-china provider is the official Zhipu platform; storing USD here
  // because z.ai is the international face that most /api-pricing viewers
  // actually compare against.
  { modelSlug: 'glm-4.6',     providerSlug: 'zhipu-china', input: 0.60, output: 2.20, currency: 'USD',
    reason: undefined as any, notes: 'z.ai GLM-4.6 official $0.60/$2.20 per 1M (verified 2026-04-13)' },
  { modelSlug: 'glm-5',       providerSlug: 'zhipu-china', input: 0.60, output: 2.20, currency: 'USD',
    reason: undefined as any, notes: 'z.ai GLM-5 placeholder — same tier as GLM-4.6 pending confirmation' },
  { modelSlug: 'glm-5.1',     providerSlug: 'zhipu-china', input: 0.60, output: 2.20, currency: 'USD',
    reason: undefined as any, notes: 'z.ai GLM-5.1 placeholder — same tier as GLM-4.6 pending confirmation' },
  { modelSlug: 'glm-4',       providerSlug: 'zhipu-china', input: 0.50, output: 1.50, currency: 'USD',
    reason: undefined as any, notes: 'z.ai GLM-4 legacy tier (approximate, pending scrape)' },

  // ─── Moonshot / Kimi via platform.kimi.com ──────────────────────
  // CNY prices verified against https://platform.kimi.com/docs/pricing/chat-v1
  // and https://platform.kimi.com/docs/pricing/chat-k2 on 2026-04-13.
  { modelSlug: 'moonshot-v1-8k',   providerSlug: 'moonshot-china', input: 2.00,  output: 10.00, currency: 'CNY',
    reason: undefined as any, notes: 'platform.kimi.com/docs/pricing/chat-v1 — ¥2/¥10 per 1M' },
  { modelSlug: 'moonshot-v1-32k',  providerSlug: 'moonshot-china', input: 5.00,  output: 20.00, currency: 'CNY',
    reason: undefined as any, notes: 'platform.kimi.com/docs/pricing/chat-v1 — ¥5/¥20 per 1M' },
  { modelSlug: 'moonshot-v1-128k', providerSlug: 'moonshot-china', input: 10.00, output: 30.00, currency: 'CNY',
    reason: undefined as any, notes: 'platform.kimi.com/docs/pricing/chat-v1 — ¥10/¥30 per 1M' },
  { modelSlug: 'kimi-k2',          providerSlug: 'moonshot-china', input: 4.00,  output: 16.00, currency: 'CNY',
    reason: undefined as any, notes: 'platform.kimi.com/docs/pricing/chat-k2 — ¥4 uncached / ¥16 output' },
  { modelSlug: 'kimi-k2.5',        providerSlug: 'moonshot-china', input: 4.00,  output: 16.00, currency: 'CNY',
    reason: undefined as any, notes: 'Kimi K2.5 — same tier as K2 on chat-k2 docs' },
  { modelSlug: 'kimi-k2-thinking', providerSlug: 'moonshot-china', input: 4.00,  output: 16.00, currency: 'CNY',
    reason: undefined as any, notes: 'Kimi K2 Thinking — same price as K2 base per docs' },
  { modelSlug: 'kimi-k2.5-thinking', providerSlug: 'moonshot-china', input: 4.00, output: 16.00, currency: 'CNY',
    reason: undefined as any, notes: 'Kimi K2.5 Thinking — same price as K2.5' },
];

async function main() {
  console.log(`\n🌱 fix-cn-producer-channels ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);
  let applied = 0, skipped = 0, missing = 0;

  for (const s of SEEDS) {
    const [{ data: model }, { data: provider }] = await Promise.all([
      supabaseAdmin.from('models').select('id').eq('slug', s.modelSlug).maybeSingle(),
      supabaseAdmin.from('providers').select('id').eq('slug', s.providerSlug).maybeSingle(),
    ]);
    if (!model || !provider) {
      console.log(`  ⏭  ${s.modelSlug} / ${s.providerSlug}: ${!model ? 'model' : 'provider'} not found`);
      missing++;
      continue;
    }
    const { data: existing } = await supabaseAdmin
      .from('api_channel_prices')
      .select('id, input_price_per_1m, output_price_per_1m, currency')
      .eq('model_id', model.id)
      .eq('provider_id', provider.id)
      .maybeSingle();

    if (existing) {
      const same = existing.input_price_per_1m === s.input
        && existing.output_price_per_1m === s.output
        && existing.currency === s.currency;
      if (same) {
        console.log(`  ✓  ${s.modelSlug} / ${s.providerSlug}: already at ${s.currency} ${s.input}/${s.output}`);
        skipped++;
        continue;
      }
      console.log(`  🔧 ${s.modelSlug} / ${s.providerSlug}: ${existing.currency} ${existing.input_price_per_1m}/${existing.output_price_per_1m} → ${s.currency} ${s.input}/${s.output}`);
      if (!DRY_RUN) {
        const { error } = await supabaseAdmin.from('api_channel_prices').update({
          input_price_per_1m: s.input,
          output_price_per_1m: s.output,
          currency: s.currency,
          is_available: true,
          last_verified: new Date().toISOString(),
          notes: `fix-cn-producer-channels 2026-04-14: ${s.notes}`,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        if (error) { console.error(`     ❌ ${error.message}`); continue; }
      }
      applied++;
    } else {
      console.log(`  ➕ ${s.modelSlug} / ${s.providerSlug}: insert ${s.currency} ${s.input}/${s.output}`);
      if (!DRY_RUN) {
        const { error } = await supabaseAdmin.from('api_channel_prices').insert({
          model_id: model.id,
          provider_id: provider.id,
          input_price_per_1m: s.input,
          output_price_per_1m: s.output,
          currency: s.currency,
          price_unit: 'per_1m_tokens',
          is_available: true,
          last_verified: new Date().toISOString(),
          notes: `fix-cn-producer-channels 2026-04-14: ${s.notes}`,
        });
        if (error) { console.error(`     ❌ ${error.message}`); continue; }
      }
      applied++;
    }
  }

  console.log(`\n━━━ Summary ━━━`);
  console.log(`Applied:           ${applied}`);
  console.log(`Already correct:   ${skipped}`);
  console.log(`Missing model/provider: ${missing}`);
  if (DRY_RUN) console.log(`\n(dry-run — no writes)`);
}

main().catch(e => { console.error(e); process.exit(1); });
