#!/usr/bin/env tsx
/** Set annual prices on The X Subscription tiers. Dry-run by default; --apply writes. */
import { db } from './db/queries';
import { X_SUBSCRIPTION_ANNUAL, annualPlanPatch } from './data/x-subscription-annual-2026-11-04';

const APPLY = process.argv.includes('--apply');

async function main() {
  let changes = 0; let failures = 0;
  for (const p of X_SUBSCRIPTION_ANNUAL) {
    const { data, error } = await db.from('plans').select('id, slug, price, annual_price').eq('slug', p.slug).maybeSingle();
    if (error) throw error;
    if (!data) { console.log(`  ✗ missing plan ${p.slug}`); failures++; continue; }
    if (Number(data.price) !== p.monthly) { console.log(`  ✗ ${p.slug} monthly ${data.price} ≠ ${p.monthly}; skip`); failures++; continue; }
    const patch = annualPlanPatch(p);
    if (data.annual_price != null && Number(data.annual_price) === p.annual) { console.log(`  = ${p.slug} annual ${p.annual}`); continue; }
    console.log(`  ↻ ${p.slug} annual_price ${data.annual_price} → ${patch.annual_price} (${patch.price_yearly_monthly}/mo)`);
    changes++;
    if (APPLY) {
      const { error: e } = await db.from('plans').update({ ...patch, updated_at: new Date() }).eq('id', data.id);
      if (e) throw e;
    }
  }
  console.log(`${APPLY ? 'applied' : 'dry-run'}: ${changes} change(s), ${failures} failure(s)`);
  if (failures) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
