#!/usr/bin/env tsx
/**
 * One-shot: snapshot core models and their current channel prices.
 * Used by data accuracy audit flow to drive web cross-verification.
 */
import { supabaseAdmin } from './db/queries';

const CORE_SLUGS = [
  'gpt-4o',
  'gpt-4o-mini',
  'claude-sonnet-4-5',
  'claude-sonnet-4.6',
  'claude-opus-4.6',
  'claude-3-5-sonnet',
  'deepseek-v3',
  'deepseek-v3.2',
  'deepseek-r1',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'qwen-max',
  'kimi-k2.5',
  'glm-4.6',
  'minimax-m2.5',
];

async function main() {
  const { data: models, error: modelsErr } = await supabaseAdmin
    .from('models')
    .select('id, name, slug, provider_ids')
    .in('slug', CORE_SLUGS);

  if (modelsErr) throw modelsErr;
  const found = models ?? [];
  console.log(`\nFound ${found.length} / ${CORE_SLUGS.length} core models in DB`);
  const missing = CORE_SLUGS.filter(s => !found.some(m => m.slug === s));
  if (missing.length) console.log(`Missing slugs: ${missing.join(', ')}`);

  const modelIds = found.map(m => m.id);
  const { data: prices, error: pricesErr } = await supabaseAdmin
    .from('api_channel_prices')
    .select('id, model_id, provider_id, input_price_per_1m, output_price_per_1m, is_available, last_verified, updated_at')
    .in('model_id', modelIds);
  if (pricesErr) throw pricesErr;

  const { data: providers } = await supabaseAdmin
    .from('providers')
    .select('id, name, slug, type');
  const provById = new Map((providers ?? []).map(p => [p.id, p]));
  const modelById = new Map(found.map(m => [m.id, m]));

  console.log('\n=== Prices by core model ===');
  for (const m of found) {
    const rows = (prices ?? []).filter(p => p.model_id === m.id);
    console.log(`\n[${m.slug}] id=${m.id} name="${m.name}" (${rows.length} channel prices)`);
    for (const r of rows) {
      const prov = provById.get(r.provider_id);
      const lv = r.last_verified ? new Date(r.last_verified).toISOString().slice(0, 10) : 'null';
      console.log(
        `  - ${prov?.slug ?? '?'} (${prov?.type ?? '?'}): in=$${r.input_price_per_1m} out=$${r.output_price_per_1m} avail=${r.is_available} verified=${lv}`
      );
    }
  }

  // Also dump counts
  console.log('\n=== Global counts ===');
  const [m, p, c, pl] = await Promise.all([
    supabaseAdmin.from('models').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('providers').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('api_channel_prices').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('plans').select('id', { count: 'exact', head: true }),
  ]);
  console.log(`models=${m.count} providers=${p.count} api_channel_prices=${c.count} plans=${pl.count}`);
}

main().catch(e => { console.error(e); process.exit(1); });
