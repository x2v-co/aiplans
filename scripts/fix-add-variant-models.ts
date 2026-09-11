#!/usr/bin/env tsx
/**
 * Add standalone model rows for OpenRouter variant SKUs.
 *
 * The mini/nano models and the `:batch` half-price endpoints are distinct
 * products, not aliases: after the normalizer stopped collapsing them onto
 * the base slug (2026-09), the scrape pipeline skipped them because no model
 * row existed. This idempotent script creates those rows by inheriting the
 * base model's provider_ids/type/context, so subsequent OpenRouter (and Azure
 * for the mini rows) scrapes attach channel prices instead of skipping.
 *
 * Naming follows the existing claude-*-batch rows: slug doubles as name.
 *
 * Usage:
 *   npx tsx scripts/fix-add-variant-models.ts --dry-run
 *   npx tsx scripts/fix-add-variant-models.ts
 */
import { db } from './db/queries';

const DRY_RUN = process.argv.includes('--dry-run');

// Verified present in OpenRouter's live catalog on 2026-09-11; every slug's
// base model (strip -batch then -mini/-nano) exists in our models table.
const VARIANT_SLUGS = [
  'codestral-batch',
  'deepseek-v4-flash-batch',
  'deepseek-v4-flash-vision-batch',
  'deepseek-v4-pro-batch',
  'gemini-2.5-flash-batch',
  'gemini-2.5-flash-lite-batch',
  'gemini-2.5-pro-batch',
  'gemini-3-flash-batch',
  'gemini-3.1-flash-lite-batch',
  'gemini-3.1-pro-batch',
  'gemini-3.5-flash-batch',
  'gemini-3.5-flash-lite-batch',
  'gemini-3.6-flash-batch',
  'gemini-3.7-flash-batch',
  'gemini-3.8-flash-batch',
  'gemma-4-31b-batch',
  'glm-5.2-batch',
  'glm-5.3-batch',
  'glm-5.3-flash-batch',
  'gpt-3.5-turbo-batch',
  'gpt-4-turbo-batch',
  'gpt-4.1-batch',
  'gpt-4.1-mini-batch',
  'gpt-4.1-nano-batch',
  'gpt-4o-batch',
  'gpt-4o-mini-batch',
  'gpt-5-batch',
  'gpt-5-mini',
  'gpt-5-mini-batch',
  'gpt-5-nano-batch',
  'gpt-5-pro-batch',
  'gpt-5.1-batch',
  'gpt-5.1-codex-mini',
  'gpt-5.2-batch',
  'gpt-5.2-pro-batch',
  'gpt-5.4-batch',
  'gpt-5.4-mini',
  'gpt-5.4-mini-batch',
  'gpt-5.4-nano-batch',
  'gpt-5.4-pro-batch',
  'gpt-5.5-batch',
  'gpt-5.5-pro-batch',
  'gpt-5.6-luna-batch',
  'gpt-5.6-luna-pro-batch',
  'gpt-5.6-sol-batch',
  'gpt-5.6-sol-pro-batch',
  'gpt-5.6-terra-batch',
  'gpt-5.6-terra-pro-batch',
  'gpt-6-astra-batch',
  'gpt-6-astra-pro-batch',
  'gpt-oss-120b-batch',
  'gpt-oss-20b-batch',
  'grok-4.3-batch',
  'kimi-k3-batch',
  'minimax-m3-batch',
  'ministral-8b-batch',
  'mistral-large-batch',
  'mistral-medium-3.1-batch',
  'mistral-medium-3.5-batch',
  'mistral-small-batch',
  'o3-batch',
  'o3-mini-batch',
  'o4-mini',
  'o4-mini-batch',
  'qwen3.5-9b-batch',
  'qwen3.8-2.4t-a95b-batch',
  'seed-2.0-mini',
] as const;

function baseSlug(slug: string): string {
  return slug.replace(/-batch$/, '').replace(/-(?:mini|nano)$/, '');
}

async function main() {
  console.log(`\n➕ variant model rows  ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);
  let created = 0;
  let skipped = 0;

  for (const slug of VARIANT_SLUGS) {
    const { data: existing } = await db
      .from('models')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    const base = baseSlug(slug);
    const { data: baseModel, error } = await db
      .from('models')
      .select('id, provider_ids, type, context_window')
      .eq('slug', base)
      .maybeSingle();
    if (error) throw error;
    if (!baseModel) {
      console.log(`  ⏭  ${slug}: base model '${base}' not found`);
      skipped++;
      continue;
    }

    console.log(`  ➕ ${slug}  (base ${base}, providers ${JSON.stringify(baseModel.provider_ids)}, ctx ${baseModel.context_window ?? '-'})`);
    if (!DRY_RUN) {
      const { error: insertError } = await db.from('models').insert({
        slug,
        name: slug,
        // Trim: a handful of legacy rows carry type='llm ' (trailing space),
        // which inherits silently and makes the row invisible to every
        // type='llm' query (grouped API, sitemap, most scrapers).
        type: (baseModel.type ?? 'llm').trim(),
        provider_ids: baseModel.provider_ids,
        context_window: baseModel.context_window ?? null,
      });
      if (insertError) {
        console.log(`      ❌ ${insertError.message}`);
        skipped++;
        continue;
      }
    }
    created++;
  }

  console.log(`\nCreated: ${created}${DRY_RUN ? ' (dry-run)' : ''}, skipped: ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
