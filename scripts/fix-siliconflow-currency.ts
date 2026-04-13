#!/usr/bin/env tsx
/**
 * One-shot: flip currency='CNY' on every api_channel_prices row from siliconflow.
 *
 * Background: siliconflow scrapes prices in CNY (元/M tokens) and the scraper
 * correctly tags `currency: 'CNY'`, but two layers further down the value was
 * silently dropped:
 *   - scripts/index-dynamic.ts:209-220 computed `priceCurrency` then never
 *     passed it to upsertChannelPrice
 *   - scripts/db/queries.ts upsertChannelPrice listed `currency` as a parameter
 *     but never wrote it to the row
 * Result: ~30+ rows have CNY numbers stored but currency='USD', so frontend
 * displayed e.g. ¥21 as "$21" — 7x inflation.
 *
 * Both code bugs are fixed in this commit. This script repairs the historical
 * rows. Idempotent: only touches rows where currency != 'CNY'.
 *
 * Usage:
 *   npx tsx scripts/fix-siliconflow-currency.ts --dry-run
 *   npx tsx scripts/fix-siliconflow-currency.ts
 */
import { supabaseAdmin } from './db/queries';

const DRY_RUN = process.argv.includes('--dry-run');
const SILICONFLOW_PROVIDER_ID = 54;

async function main() {
  console.log(`\n🔧 fix-siliconflow-currency ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);

  const { data: rows, error } = await supabaseAdmin
    .from('api_channel_prices')
    .select('id, model_id, input_price_per_1m, output_price_per_1m, currency, is_available')
    .eq('provider_id', SILICONFLOW_PROVIDER_ID);
  if (error) throw error;

  const all = rows ?? [];
  const wrong = all.filter(r => r.currency !== 'CNY');
  console.log(`siliconflow rows total: ${all.length}, needing currency fix: ${wrong.length}`);

  if (wrong.length === 0) {
    console.log('\n✅ Nothing to do — all siliconflow rows already CNY');
    return;
  }

  // Resolve model slugs for nicer logging
  const modelIds = [...new Set(wrong.map(r => r.model_id).filter((x): x is number => x != null))];
  const { data: models } = await supabaseAdmin
    .from('models')
    .select('id, slug')
    .in('id', modelIds);
  const slugById = new Map((models ?? []).map(m => [m.id, m.slug]));

  for (const r of wrong) {
    const slug = slugById.get(r.model_id ?? 0) ?? `model#${r.model_id}`;
    console.log(`  · ${slug}: in=${r.input_price_per_1m} out=${r.output_price_per_1m} ${r.currency} → CNY`);
  }

  if (DRY_RUN) {
    console.log(`\n(dry-run — would update ${wrong.length} rows)`);
    return;
  }

  const ids = wrong.map(r => r.id);
  const { error: upErr } = await supabaseAdmin
    .from('api_channel_prices')
    .update({
      currency: 'CNY',
      notes: 'audit-fix 2026-04-13: scraper bug — values were CNY, currency was mistagged as USD',
      updated_at: new Date().toISOString(),
    })
    .in('id', ids);

  if (upErr) {
    console.error(`❌ ${upErr.message}`);
    process.exit(1);
  }
  console.log(`\n✅ Updated ${wrong.length} siliconflow rows to currency='CNY'`);
}

main().catch(e => { console.error(e); process.exit(1); });
