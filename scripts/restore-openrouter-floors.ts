/**
 * Restore the four verified OpenRouter floor rows (#90, verified 2026-10-13)
 * after planprice-api-scraper overwrote them with the /api/v1/models
 * default-route price (e.g. gpt-oss-120b 0.03/0.15 -> 0.15/0.60).
 *
 * Touches only provider=openrouter rows of the four models in
 * OPENROUTER_FLOOR_PRICES: api_channel_prices (in/out/cached) and the
 * matching headline variant (openrouter-auto). Nothing else.
 *
 *   npx tsx scripts/restore-openrouter-floors.ts                 # dry-run (default)
 *   npx tsx scripts/restore-openrouter-floors.ts --apply --backup=/path.json
 *
 * Aborts without writing if any model or row is missing / ambiguous.
 */
import fs from 'node:fs';
import { databaseSql as sql } from './db/postgres-admin';
import { OPENROUTER_FLOOR_PRICES } from './data/verified-2026-10-chatgpt-pro-openrouter';

const APPLY = process.argv.includes('--apply');
const BACKUP = process.argv.find((a) => a.startsWith('--backup='))?.slice(9)
  ?? `/tmp/aiplans-openrouter-floors-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

type Row = { id: number; model_id: number; slug: string; input_price_per_1m: string; output_price_per_1m: string; cached_input_price_per_1m: string | null };
const fmt = (v: string | number | null) => (v == null ? 'NULL' : String(Number(v)));
const same = (a: string | null, b: number | null) => (a == null ? b == null : b != null && Math.abs(Number(a) - b) < 1e-9);

async function main() {
  console.log(`\n🔧 restore-openrouter-floors ${APPLY ? '[APPLY]' : '[DRY-RUN]'}\n`);
  const [openrouter] = await sql<{ id: number }[]>`SELECT id FROM providers WHERE slug = 'openrouter'`;
  if (!openrouter) throw new Error('provider openrouter missing');

  const plan: Array<{ row: Row; f: (typeof OPENROUTER_FLOOR_PRICES)[number] }> = [];
  const errors: string[] = [];
  for (const f of OPENROUTER_FLOOR_PRICES) {
    const rows = await sql<Row[]>`
      SELECT p.id, p.model_id, m.slug, p.input_price_per_1m::text, p.output_price_per_1m::text, p.cached_input_price_per_1m::text
        FROM api_channel_prices p JOIN models m ON m.id = p.model_id
       WHERE p.provider_id = ${openrouter.id} AND lower(m.slug) IN ${sql(f.modelSlugCandidates.map((s) => s.toLowerCase()))}`;
    if (rows.length !== 1) { errors.push(`${f.openRouterId}: expected 1 openrouter row, found ${rows.length}`); continue; }
    const r = rows[0];
    const ok = same(r.input_price_per_1m, f.inputPer1m) && same(r.output_price_per_1m, f.outputPer1m) && same(r.cached_input_price_per_1m, f.cachedInputPer1m);
    console.log(`  ${ok ? '=' : '↻'} #${r.id} ${r.slug}: in ${fmt(r.input_price_per_1m)} / out ${fmt(r.output_price_per_1m)} / cached ${fmt(r.cached_input_price_per_1m)}` +
      (ok ? '  (already correct)' : `  ->  in ${f.inputPer1m} / out ${f.outputPer1m} / cached ${fmt(f.cachedInputPer1m)} (floor ${f.floorProvider})`));
    if (!ok) plan.push({ row: r, f });
  }
  if (errors.length) { console.error(`\n✗ aborting, nothing written:\n  ${errors.join('\n  ')}`); process.exitCode = 1; return; }
  console.log(`\n  → ${plan.length} row(s) to restore`);
  if (!plan.length || !APPLY) { if (!APPLY) console.log('Dry-run only. Re-run with --apply --backup=<path> to write (single transaction).'); return; }

  const ids = plan.map((p) => p.row.id);
  const modelIds = plan.map((p) => p.row.model_id);
  const backup = {
    at: new Date().toISOString(),
    api_channel_prices: await sql`SELECT * FROM api_channel_prices WHERE id IN ${sql(ids)}`,
    api_channel_price_variants: await sql`SELECT * FROM api_channel_price_variants
      WHERE provider_id = ${openrouter.id} AND model_id IN ${sql(modelIds)} AND variant_key = 'openrouter-auto'`,
  };
  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 2), { mode: 0o600 });
  console.log(`💾 backup: ${BACKUP}`);

  const now = new Date();
  await sql.begin(async (tx) => {
    for (const { row, f } of plan) {
      await tx`UPDATE api_channel_prices SET input_price_per_1m = ${f.inputPer1m}, output_price_per_1m = ${f.outputPer1m},
        cached_input_price_per_1m = ${f.cachedInputPer1m}, updated_at = ${now} WHERE id = ${row.id}`;
      await tx`UPDATE api_channel_price_variants SET input_price_per_1m = ${f.inputPer1m}, output_price_per_1m = ${f.outputPer1m},
        cached_input_price_per_1m = ${f.cachedInputPer1m}, updated_at = ${now}
        WHERE provider_id = ${openrouter.id} AND model_id = ${row.model_id} AND variant_key = 'openrouter-auto'`;
    }
  });
  console.log(`✅ restored ${plan.length} row(s)`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => sql.end());
