#!/usr/bin/env tsx
/** Read-only: list unit CHECK constraints and flag non-llm catalog values they would reject. */
import { NON_LLM_CATALOG } from '../src/lib/non-llm-catalog';
import { IMAGE_MODEL_CATALOG } from '../src/lib/image-model-catalog';

const used: Record<string, Set<string>> = { pricing_unit: new Set(), price_unit: new Set(), unit: new Set(), included_usage_unit: new Set() };
for (const item of [...NON_LLM_CATALOG, ...IMAGE_MODEL_CATALOG]) {
  if (item.pricingUnit) { used.pricing_unit.add(item.pricingUnit); used.price_unit.add(item.pricingUnit); }
  for (const rate of item.usageRates ?? []) used.unit.add(rate.unit);
  used.included_usage_unit.add(/minute|character/i.test(item.pricingUnit ?? '') ? 'minute' : /hour/i.test(item.pricingUnit ?? '') ? 'hour' : 'availability');
}

async function main() {
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const rows = await sql<Array<{ tbl: string; conname: string; def: string }>>`
      SELECT con.conrelid::regclass::text AS tbl, con.conname, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con JOIN pg_namespace ns ON ns.oid = con.connamespace
      WHERE con.contype = 'c' AND ns.nspname = 'public' AND pg_get_constraintdef(con.oid) ~* 'unit'`;
    let problems = 0;
    for (const row of rows) {
      console.log(`${row.tbl}.${row.conname}: ${row.def}`);
      const column = Object.keys(used).find(col => new RegExp(`\\(${col}\\)|\\b${col} =`).test(row.def));
      if (!column) continue;
      // Single-value pins (e.g. api_channel_price_variants = 'per_1m_tokens') guard token-only tables.
      if (!row.def.includes('ARRAY[')) { console.log('  (single-value pin, skipped)'); continue; }
      const allowed = new Set([...row.def.matchAll(/'([^']+)'/g)].map(m => m[1]));
      for (const value of used[column]) if (!allowed.has(value)) { problems++; console.log(`  ✗ ${column}='${value}' rejected`); }
    }
    console.log(problems ? `${problems} non-llm unit value(s) rejected` : 'All non-llm unit values allowed by unit constraints.');
    if (problems) process.exitCode = 1;
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
