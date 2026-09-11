#!/usr/bin/env tsx
/**
 * Remove confirmed phantom model rows: slugs present in our catalog with
 * benchmark scores (so they ranked on /api-pricing) but no channel price, no
 * price history, and — verified 2026-09-11 against both models.dev and the
 * producers' current lists — models that do not exist under those names.
 *
 * Most are parser artifacts or renamed models superseded by a correctly
 * slugged row (qwen3-235b-a22b-instruct → qwen3-235b-a22b; qwen3.5-max →
 * qwen3.7-max; gpt-5.2-high → gpt-5.2; grok-4.1 → grok-4.20).
 *
 * Only `derived` plan mappings are removed; manual links would abort.
 *
 * Usage: npx tsx scripts/fix-remove-phantom-models.ts [--dry-run] [slug ...]
 */
import { db } from './db/queries';

const DRY_RUN = process.argv.includes('--dry-run');
const EXTRA = process.argv.slice(2).filter(a => !a.startsWith('--'));

const PHANTOM_SLUGS = [
  'chatgpt-4o-latest',   // alias slug never priced; OpenAI id retired
  'gpt-4.5',             // superseded by gpt-5; no channel has it
  'gpt-5.2-high',        // no such OpenAI SKU ("high" was a parser artifact)
  'grok-4.1',            // never released (line jumped grok-4 → 4.20)
  'qwen3.5-max',         // superseded by qwen3.7-max
  'qwen3-235b-a22b-instruct', // canonical row is qwen3-235b-a22b
  ...EXTRA,
];

async function main() {
  console.log(`\n👻 phantom model cleanup  ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);
  let removed = 0;

  for (const slug of PHANTOM_SLUGS) {
    const { data: model } = await db.from('models').select('id').eq('slug', slug).maybeSingle();
    if (!model) {
      console.log(`  · ${slug}: already gone`);
      continue;
    }

    // Safety: never delete a row that still carries a live or historical price.
    const { count: priceCount } = await db
      .from('api_channel_prices')
      .select('id', { count: 'exact', head: true })
      .eq('model_id', model.id);
    if ((priceCount ?? 0) > 0) {
      console.log(`  ⛔ ${slug}: ${priceCount} channel price row(s) — skipping`);
      continue;
    }

    const { data: links } = await db
      .from('model_plan_mapping')
      .select('id, source')
      .eq('model_id', model.id);
    const manual = (links ?? []).filter(l => l.source === 'manual');
    if (manual.length > 0) {
      console.log(`  ⛔ ${slug}: ${manual.length} manual plan link(s) — skipping`);
      continue;
    }

    console.log(`  🗑  ${slug} (id ${model.id}): ${links?.length ?? 0} derived links removed, model removed`);
    if (DRY_RUN) {
      removed++;
      continue;
    }

    if ((links?.length ?? 0) > 0) {
      const { error: linkErr } = await db
        .from('model_plan_mapping')
        .delete()
        .eq('model_id', model.id);
      if (linkErr) throw linkErr;
    }
    const { error: scoreErr } = await db
      .from('model_benchmark_scores')
      .delete()
      .eq('model_id', model.id);
    if (scoreErr) throw scoreErr;
    const { error: delErr } = await db.from('models').delete().eq('id', model.id);
    if (delErr) throw delErr;
    removed++;
  }

  console.log(`\nRemoved: ${removed}${DRY_RUN ? ' (dry-run)' : ''}`);
}

main().catch(e => { console.error(e); process.exit(1); });
