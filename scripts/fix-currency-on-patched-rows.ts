#!/usr/bin/env tsx
/**
 * One-shot: ensure currency='USD' on the rows that fix-data-audit.ts patched
 * with USD-denominated ground truth. Earlier versions of that script wrote
 * the price values without touching the currency column, so a row that
 * previously stored CNY values now has USD numbers but currency='CNY' —
 * which makes the audit's USD-normalized comparison report false negatives.
 *
 * After this fix the script is harmless (idempotent: only flips rows that
 * are still mistagged).
 *
 * Usage: npx tsx scripts/fix-currency-on-patched-rows.ts [--dry-run]
 */
import { supabaseAdmin } from './db/queries';

const DRY_RUN = process.argv.includes('--dry-run');

// (modelSlug, providerSlug) pairs that fix-data-audit.ts updated with USD truth
const PATCHED_USD_ROWS: { modelSlug: string; providerSlug: string }[] = [
  { modelSlug: 'gpt-4o', providerSlug: 'openai' },
  { modelSlug: 'claude-opus-4.6', providerSlug: 'openrouter' },
  { modelSlug: 'gpt-4o', providerSlug: 'azure-openai' },
  { modelSlug: 'gpt-4o-mini', providerSlug: 'azure-openai' },
  { modelSlug: 'gemini-2.0-flash-exp', providerSlug: 'vertex-ai' },
  { modelSlug: 'minimax-m2.5', providerSlug: 'minimax-china' },
  { modelSlug: 'glm-4.6', providerSlug: 'openrouter' },
  { modelSlug: 'gemini-2.0-flash-exp', providerSlug: 'google' },
  { modelSlug: 'o1', providerSlug: 'azure-openai' },
  { modelSlug: 'mistral-large', providerSlug: 'mistral' },
  { modelSlug: 'mistral-medium', providerSlug: 'mistral' },
  { modelSlug: 'mistral-small', providerSlug: 'mistral' },
  { modelSlug: 'codestral', providerSlug: 'mistral' },
  { modelSlug: 'grok-2', providerSlug: 'grok' },
  { modelSlug: 'grok-3', providerSlug: 'grok' },
  { modelSlug: 'grok-4', providerSlug: 'grok' },
];

async function main() {
  console.log(`\n🔧 fix-currency-on-patched-rows ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);
  let updated = 0;
  for (const r of PATCHED_USD_ROWS) {
    const [{ data: model }, { data: provider }] = await Promise.all([
      supabaseAdmin.from('models').select('id').eq('slug', r.modelSlug).maybeSingle(),
      supabaseAdmin.from('providers').select('id').eq('slug', r.providerSlug).maybeSingle(),
    ]);
    if (!model || !provider) {
      console.log(`  ⏭ ${r.modelSlug}/${r.providerSlug}: model or provider missing`);
      continue;
    }
    const { data: row } = await supabaseAdmin
      .from('api_channel_prices')
      .select('id, currency, input_price_per_1m, output_price_per_1m')
      .eq('model_id', model.id)
      .eq('provider_id', provider.id)
      .maybeSingle();
    if (!row) {
      console.log(`  ⏭ ${r.modelSlug}/${r.providerSlug}: no price row`);
      continue;
    }
    if (row.currency === 'USD') {
      console.log(`  ✓ ${r.modelSlug}/${r.providerSlug}: already USD`);
      continue;
    }
    console.log(`  🔧 ${r.modelSlug}/${r.providerSlug}: currency=${row.currency} → USD (price ${row.input_price_per_1m}/${row.output_price_per_1m})`);
    if (!DRY_RUN) {
      const { error } = await supabaseAdmin
        .from('api_channel_prices')
        .update({ currency: 'USD', updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) {
        console.error(`     ❌ ${error.message}`);
        continue;
      }
    }
    updated++;
  }
  console.log(`\n${DRY_RUN ? 'Would update' : 'Updated'}: ${updated} rows`);
}

main().catch(e => { console.error(e); process.exit(1); });
