#!/usr/bin/env tsx
/**
 * Surgical data accuracy fixes based on scripts/audit-data.ts findings +
 * ground-truth pricing verified against provider pricing pages on 2026-04-13.
 *
 * Usage:
 *   npx tsx scripts/fix-data-audit.ts --dry-run   # preview, no writes
 *   npx tsx scripts/fix-data-audit.ts             # apply
 *
 * What it does (idempotent):
 *   1. Update known-wrong api_channel_prices rows to web-verified values
 *   2. Soft-disable (is_available=false) rows where output<input or grossly
 *      wrong and we have no ground truth to fix them
 *   3. Create missing core models (deepseek-v3.2, gpt-4.1 family) and their
 *      official channel prices
 *
 * All actions log before/after. Safe to re-run.
 */
import { supabaseAdmin } from './db/queries';

const DRY_RUN = process.argv.includes('--dry-run');

interface PriceUpdate {
  modelSlug: string;
  providerSlug: string;
  input: number;
  output: number;
  reason: string;
}

interface PriceDisable {
  modelSlug: string;
  providerSlug: string;
  reason: string;
}

interface NewModel {
  slug: string;
  name: string;
  type: string;
  contextWindow?: number;
  producerSlug: string;
  input: number;
  output: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// Ground truth updates — verified against official pricing pages 2026-04-13
// ---------------------------------------------------------------------------
const UPDATES: PriceUpdate[] = [
  // OpenAI official: gpt-4o output $8 -> $10 (off by 20%)
  { modelSlug: 'gpt-4o', providerSlug: 'openai', input: 2.5, output: 10,
    reason: 'OpenAI official gpt-4o is $2.50/$10, DB had output=$8' },

  // Anthropic openrouter: claude-opus-4.6 was priced as Opus 4.1 ($15/$75)
  { modelSlug: 'claude-opus-4.6', providerSlug: 'openrouter', input: 5, output: 25,
    reason: 'Claude Opus 4.6 official is $5/$25, DB had Opus 4.1 pricing $15/$75' },

  // Azure OpenAI tracks OpenAI pricing 1:1 for listed models
  { modelSlug: 'gpt-4o', providerSlug: 'azure-openai', input: 2.5, output: 10,
    reason: 'Azure OpenAI mirrors OpenAI pricing; DB had stale $5/$20' },
  { modelSlug: 'gpt-4o-mini', providerSlug: 'azure-openai', input: 0.15, output: 0.60,
    reason: 'Azure OpenAI mirrors OpenAI pricing; DB had $6/$4 (40x + output<input)' },

  // Vertex AI tracks Google Gemini pricing for listed models
  { modelSlug: 'gemini-2.0-flash-exp', providerSlug: 'vertex-ai', input: 0.10, output: 0.40,
    reason: 'Google Gemini 2.0 Flash official is $0.10/$0.40; DB had $14/$2 (140x + output<input)' },

  // MiniMax China producer pricing is 7x the international rate per audit
  // International/openrouter price $0.20-0.30/$1.20 is correct; local CNY
  // converts to approximately $0.30/$1.20. DB had $2.10/$8.40.
  { modelSlug: 'minimax-m2.5', providerSlug: 'minimax-china', input: 0.30, output: 1.20,
    reason: 'MiniMax official M2.5 international pricing is $0.30/$1.20; DB had 7x' },

  // ─── Round 2 ─── Additional ground truth from web verification 2026-04-13

  // Zhipu GLM-4.6 (z.ai international pricing)
  { modelSlug: 'glm-4.6', providerSlug: 'openrouter', input: 0.60, output: 2.20,
    reason: 'GLM-4.6 official z.ai pricing; DB had $0/$0 (zero-write bug)' },

  // Google Gemini producer record for 2.0-flash had $0.5/$10 — wrong
  { modelSlug: 'gemini-2.0-flash-exp', providerSlug: 'google', input: 0.10, output: 0.40,
    reason: 'Google Gemini 2.0 Flash official; DB had $0.5/$10 on producer row' },

  // Azure mirrors OpenAI — o1 was $1/$1 (parser bug, in==out)
  { modelSlug: 'o1', providerSlug: 'azure-openai', input: 15, output: 60,
    reason: 'Azure OpenAI mirrors OpenAI o1 pricing $15/$60; DB had $1/$1' },

  // Mistral official prices — these were marked disabled in round 1, re-enable with correct values
  { modelSlug: 'mistral-large', providerSlug: 'mistral', input: 2, output: 6,
    reason: 'Mistral Large 2411 official $2/$6' },
  { modelSlug: 'mistral-medium', providerSlug: 'mistral', input: 0.40, output: 2.00,
    reason: 'Mistral Medium 3 official $0.40/$2.00; DB had $8/$3 (output<input)' },
  { modelSlug: 'mistral-small', providerSlug: 'mistral', input: 0.10, output: 0.30,
    reason: 'Mistral Small 2503 official $0.10/$0.30; DB had $4/$4 (in==out)' },
  { modelSlug: 'codestral', providerSlug: 'mistral', input: 0.20, output: 0.60,
    reason: 'Codestral 2501 official $0.20/$0.60; DB had $6/$3 (output<input)' },

  // Grok via xAI direct
  { modelSlug: 'grok-2', providerSlug: 'grok', input: 2, output: 10,
    reason: 'xAI Grok-2 official $2/$10' },
  { modelSlug: 'grok-3', providerSlug: 'grok', input: 3, output: 15,
    reason: 'xAI Grok-3 official $3/$15' },
  { modelSlug: 'grok-4', providerSlug: 'grok', input: 2, output: 6,
    reason: 'xAI Grok-4.20 (current flagship) official $2/$6 + cached $0.20' },
];

// ---------------------------------------------------------------------------
// Disable unfixable rows (output<input or grossly wrong, no reliable truth)
// NOTE: rows that we have ground truth for are in UPDATES instead — keep
// these two lists disjoint by (modelSlug, providerSlug).
// ---------------------------------------------------------------------------
const DISABLES: PriceDisable[] = [
  // output<input records where we don't have ground truth on that specific channel
  { modelSlug: 'mistral-large', providerSlug: 'aws-bedrock',
    reason: 'output<input ($14/$3) — likely AWS Bedrock pricing inverted or unit wrong' },
  { modelSlug: 'mixtral-8x7b', providerSlug: 'aws-bedrock',
    reason: 'output=$0.00015 clearly wrong unit (per-token vs per-1M confusion)' },
  { modelSlug: 'claude-3-haiku', providerSlug: 'aws-bedrock',
    reason: 'output<input ($3.5/$3) — scraper bug' },

  // qwen-max on siliconflow $40/$40 — input==output + 30x inflation
  { modelSlug: 'qwen-max', providerSlug: 'siliconflow',
    reason: 'input==output==$40, 30x over official $1.20/$6.00 — parser bug' },
];

// ---------------------------------------------------------------------------
// Missing core models — prices from official pricing pages 2026-04-13
// ---------------------------------------------------------------------------
const NEW_MODELS: NewModel[] = [
  { slug: 'gpt-4.1', name: 'GPT-4.1', type: 'llm', contextWindow: 1_000_000,
    producerSlug: 'openai', input: 2.0, output: 8.0,
    reason: 'Launched 2025-04-14, absent from DB' },
  { slug: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', type: 'llm', contextWindow: 1_000_000,
    producerSlug: 'openai', input: 0.4, output: 1.6,
    reason: 'Launched 2025-04-14, absent from DB' },
  { slug: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', type: 'llm', contextWindow: 1_000_000,
    producerSlug: 'openai', input: 0.1, output: 0.4,
    reason: 'Launched 2025-04-14, absent from DB' },
  { slug: 'o3-pro', name: 'OpenAI o3-pro', type: 'llm', contextWindow: 200_000,
    producerSlug: 'openai', input: 20, output: 80,
    reason: 'Launched 2025-06-10, absent from DB' },

  // DeepSeek V3.2: per https://api-docs.deepseek.com/quick_start/pricing
  // deepseek-chat and deepseek-reasoner both map to V3.2, same pricing.
  { slug: 'deepseek-v3.2', name: 'DeepSeek V3.2', type: 'llm', contextWindow: 128_000,
    producerSlug: 'deepseek', input: 0.28, output: 0.42,
    reason: 'Latest DeepSeek, deepseek-chat slug routes here, was missing price' },
  { slug: 'deepseek-v3.2-thinking', name: 'DeepSeek V3.2 Thinking', type: 'llm',
    contextWindow: 128_000, producerSlug: 'deepseek', input: 0.28, output: 0.42,
    reason: 'deepseek-reasoner thinking mode, same pricing as V3.2' },
];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
async function findModelId(slug: string): Promise<number | null> {
  const { data } = await supabaseAdmin.from('models').select('id').eq('slug', slug).maybeSingle();
  return data?.id ?? null;
}

async function findProviderId(slug: string): Promise<number | null> {
  const { data } = await supabaseAdmin.from('providers').select('id').eq('slug', slug).maybeSingle();
  return data?.id ?? null;
}

async function findPriceRow(modelId: number, providerId: number) {
  const { data } = await supabaseAdmin
    .from('api_channel_prices')
    .select('id, input_price_per_1m, output_price_per_1m, is_available')
    .eq('model_id', modelId)
    .eq('provider_id', providerId)
    .maybeSingle();
  return data;
}

const log = (s: string) => console.log(s);
const applied: string[] = [];
const skipped: string[] = [];

async function runUpdates() {
  log(`\n━━━ [1/3] Ground-truth price updates (${UPDATES.length}) ━━━`);
  for (const u of UPDATES) {
    const modelId = await findModelId(u.modelSlug);
    const providerId = await findProviderId(u.providerSlug);
    if (!modelId || !providerId) {
      skipped.push(`UPDATE ${u.modelSlug}/${u.providerSlug}: model or provider not found`);
      log(`  ⏭  ${u.modelSlug}/${u.providerSlug}: not found (model=${modelId}, provider=${providerId})`);
      continue;
    }
    const row = await findPriceRow(modelId, providerId);
    if (!row) {
      skipped.push(`UPDATE ${u.modelSlug}/${u.providerSlug}: no existing row`);
      log(`  ⏭  ${u.modelSlug}/${u.providerSlug}: no price row to update`);
      continue;
    }
    const already = row.input_price_per_1m === u.input && row.output_price_per_1m === u.output;
    if (already && row.is_available !== false) {
      log(`  ✓  ${u.modelSlug}/${u.providerSlug}: already at $${u.input}/$${u.output}, skip`);
      continue;
    }
    if (already && row.is_available === false) {
      log(`  ♻  ${u.modelSlug}/${u.providerSlug}: price correct but disabled, re-enabling`);
    }
    log(`  🔧 ${u.modelSlug}/${u.providerSlug}: $${row.input_price_per_1m}/$${row.output_price_per_1m} → $${u.input}/$${u.output}`);
    log(`      reason: ${u.reason}`);
    if (!DRY_RUN) {
      const { error } = await supabaseAdmin
        .from('api_channel_prices')
        .update({
          input_price_per_1m: u.input,
          output_price_per_1m: u.output,
          is_available: true,
          last_verified: new Date().toISOString(),
          // All UPDATES in this script are USD-denominated ground truth.
          currency: 'USD',
          notes: `audit-fix 2026-04-13: ${u.reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (error) {
        log(`      ❌ ${error.message}`);
        skipped.push(`UPDATE ${u.modelSlug}/${u.providerSlug}: ${error.message}`);
        continue;
      }
    }
    applied.push(`UPDATE ${u.modelSlug}/${u.providerSlug}: → $${u.input}/$${u.output}`);
  }
}

async function runDisables() {
  log(`\n━━━ [2/3] Soft-disable unfixable rows (${DISABLES.length}) ━━━`);
  for (const d of DISABLES) {
    const modelId = await findModelId(d.modelSlug);
    const providerId = await findProviderId(d.providerSlug);
    if (!modelId || !providerId) {
      skipped.push(`DISABLE ${d.modelSlug}/${d.providerSlug}: model or provider not found`);
      log(`  ⏭  ${d.modelSlug}/${d.providerSlug}: not found`);
      continue;
    }
    const row = await findPriceRow(modelId, providerId);
    if (!row) {
      log(`  ⏭  ${d.modelSlug}/${d.providerSlug}: no row`);
      continue;
    }
    if (row.is_available === false) {
      log(`  ✓  ${d.modelSlug}/${d.providerSlug}: already disabled`);
      continue;
    }
    log(`  🚫 ${d.modelSlug}/${d.providerSlug}: was $${row.input_price_per_1m}/$${row.output_price_per_1m}, disabling`);
    log(`      reason: ${d.reason}`);
    if (!DRY_RUN) {
      const { error } = await supabaseAdmin
        .from('api_channel_prices')
        .update({
          is_available: false,
          notes: `audit-fix 2026-04-13 disabled: ${d.reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (error) {
        skipped.push(`DISABLE ${d.modelSlug}/${d.providerSlug}: ${error.message}`);
        log(`      ❌ ${error.message}`);
        continue;
      }
    }
    applied.push(`DISABLE ${d.modelSlug}/${d.providerSlug}`);
  }
}

async function runNewModels() {
  log(`\n━━━ [3/3] Create missing core models (${NEW_MODELS.length}) ━━━`);
  for (const m of NEW_MODELS) {
    const providerId = await findProviderId(m.producerSlug);
    if (!providerId) {
      skipped.push(`NEW ${m.slug}: producer ${m.producerSlug} not found`);
      log(`  ⏭  ${m.slug}: producer "${m.producerSlug}" not in DB`);
      continue;
    }

    // Upsert model by slug
    let modelId = await findModelId(m.slug);
    if (!modelId) {
      log(`  ➕ ${m.slug}: create model "${m.name}" (producer=${m.producerSlug})`);
      log(`      reason: ${m.reason}`);
      if (!DRY_RUN) {
        const { data: newModel, error } = await supabaseAdmin
          .from('models')
          .insert({
            slug: m.slug,
            name: m.name,
            type: m.type,
            context_window: m.contextWindow,
            provider_ids: [providerId],
          })
          .select('id')
          .single();
        if (error) {
          skipped.push(`NEW ${m.slug}: insert model failed — ${error.message}`);
          log(`      ❌ ${error.message}`);
          continue;
        }
        modelId = newModel.id;
      } else {
        modelId = -1; // placeholder in dry-run
      }
      applied.push(`NEW model ${m.slug}`);
    } else {
      log(`  ✓  ${m.slug}: model exists (id=${modelId})`);
    }

    // Ensure model_official mapping for producer
    if (!DRY_RUN && modelId > 0) {
      const { data: existingOfficial } = await supabaseAdmin
        .from('model_offical')
        .select('id')
        .eq('model_id', modelId)
        .eq('producer_id', providerId)
        .maybeSingle();
      if (!existingOfficial) {
        await supabaseAdmin.from('model_offical').insert({ model_id: modelId, producer_id: providerId });
      }
    }

    // Upsert channel price for producer
    if (modelId > 0) {
      const existing = await findPriceRow(modelId, providerId);
      if (existing) {
        const match = existing.input_price_per_1m === m.input && existing.output_price_per_1m === m.output;
        if (match) {
          log(`      ✓  ${m.producerSlug} price already correct`);
          continue;
        }
        log(`      🔧 ${m.producerSlug}: $${existing.input_price_per_1m}/$${existing.output_price_per_1m} → $${m.input}/$${m.output}`);
        if (!DRY_RUN) {
          const { error } = await supabaseAdmin
            .from('api_channel_prices')
            .update({
              input_price_per_1m: m.input,
              output_price_per_1m: m.output,
              is_available: true,
              last_verified: new Date().toISOString(),
              notes: `audit-fix 2026-04-13: ${m.reason}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          if (error) log(`      ❌ ${error.message}`);
        }
        applied.push(`NEW price ${m.slug}/${m.producerSlug}`);
      } else {
        log(`      ➕ ${m.producerSlug}: insert price $${m.input}/$${m.output}`);
        if (!DRY_RUN) {
          const { error } = await supabaseAdmin.from('api_channel_prices').insert({
            model_id: modelId,
            provider_id: providerId,
            input_price_per_1m: m.input,
            output_price_per_1m: m.output,
            is_available: true,
            last_verified: new Date().toISOString(),
            currency: 'USD',
            price_unit: 'per_1m_tokens',
            notes: `audit-fix 2026-04-13 created: ${m.reason}`,
          });
          if (error) {
            skipped.push(`NEW price ${m.slug}/${m.producerSlug}: ${error.message}`);
            log(`      ❌ ${error.message}`);
            continue;
          }
        }
        applied.push(`NEW price ${m.slug}/${m.producerSlug}`);
      }
    } else if (DRY_RUN) {
      log(`      ➕ ${m.producerSlug}: would insert price $${m.input}/$${m.output}`);
      applied.push(`NEW price ${m.slug}/${m.producerSlug}`);
    }
  }
}

async function main() {
  log(`\n🔧 fix-data-audit  ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);
  await runUpdates();
  await runDisables();
  await runNewModels();
  log(`\n━━━ Summary ━━━`);
  log(`Applied: ${applied.length}`);
  log(`Skipped: ${skipped.length}`);
  if (skipped.length > 0) {
    log(`\nSkipped entries:`);
    for (const s of skipped) log(`  - ${s}`);
  }
  if (DRY_RUN) log(`\n(dry-run — no changes written)`);
}

main().catch(e => { console.error(e); process.exit(1); });
