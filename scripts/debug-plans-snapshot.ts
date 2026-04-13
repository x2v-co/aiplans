#!/usr/bin/env tsx
import { supabaseAdmin } from './db/queries';

async function main() {
  const { data: plans, error } = await supabaseAdmin
    .from('plans')
    .select('id, name, slug, provider_id, tier, pricing_model, price, annual_price, currency, price_unit, last_verified, is_official')
    .order('provider_id')
    .order('id');
  if (error) throw error;

  const { data: providers } = await supabaseAdmin.from('providers').select('id, slug, name');
  const provBySlug = new Map((providers ?? []).map(p => [p.id, p.slug]));

  console.log(`\nTotal plans: ${plans?.length ?? 0}\n`);
  console.log('id   provider           slug                       tier       price   annual  cur unit          verified');
  console.log('───  ─────────────────  ─────────────────────────  ─────────  ──────  ──────  ─── ─────────────  ──────────');
  for (const p of plans ?? []) {
    const prov = provBySlug.get(p.provider_id) ?? '?';
    const lv = p.last_verified ? new Date(p.last_verified).toISOString().slice(0, 10) : 'null      ';
    const price = p.price != null ? `$${p.price}`.padStart(6) : '   -  ';
    const annual = p.annual_price != null ? `$${p.annual_price}`.padStart(6) : '   -  ';
    console.log(
      `${String(p.id).padEnd(4)} ${prov.padEnd(18)} ${String(p.slug).padEnd(26)} ${(p.tier ?? '-').padEnd(10)} ${price}  ${annual}  ${(p.currency ?? '').padEnd(3)} ${(p.price_unit ?? '').padEnd(13)} ${lv}`
    );
  }
}

main().catch(e => { console.error(e); process.exit(1); });
