/**
 * Cleanup for scraper-created "models" that are really promo copy
 * (e.g. kimi-k3promopromotion-valid-until-october-11,) plus stale cached-input
 * prices above ordinary input rates.
 *
 *   npx tsx scripts/cleanup-dirty-models.ts            # dry-run (default, read-only)
 *   npx tsx scripts/cleanup-dirty-models.ts --apply    # one transaction
 *   --backup=<path>  where to write the JSON backup of deleted rows (apply only)
 *
 * Part A - dirty models: every model whose name/slug fails the identity guard is
 * listed. Only rows flagged for promo/validity/date wording are delete
 * candidates; comma/slash/charset-only hits are reported for manual review.
 * A candidate is deleted (with its api_channel_prices, variants, usage_prices,
 * price_history, model_plan_mapping, model_offical rows) only if nothing
 * "public" points at it: model_slug_redirects, benchmark/coding-agent scores,
 * evaluation runs, external price references, outbound clicks mentioning the
 * slug, or a literal slug reference in src/ (guides, compare, hard-coded links).
 * Referenced candidates are skipped and reported as MANUAL_REVIEW.
 *
 * Part B - cached-input sanity:
 * rows with cached > input are listed; --apply sets their cached price to NULL.
 * Endpoint cache prices are never copied onto default-route headlines.
 */
import fs from 'node:fs';
import path from 'node:path';
import { databaseSql as sql } from './db/postgres-admin';
import { checkModelIdentity } from './utils/model-identity-guard';

const APPLY = process.argv.includes('--apply');
const BACKUP = process.argv.find((a) => a.startsWith('--backup='))?.slice(9)
  ?? `/tmp/aiplans-dirty-models-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
const DELETE_REASONS = new Set(['promo wording', 'validity wording', 'calendar date (d/m/y)', 'calendar date (month name)']);
const CASCADE_TABLES = ['api_channel_price_variants', 'usage_prices', 'model_plan_mapping', 'model_offical'] as const;
const BLOCKING_TABLES = ['model_benchmark_scores', 'evaluation_run', 'coding_agent_scores', 'external_price_references', 'model_slug_redirects'] as const;

type Model = { id: number; name: string; slug: string; created_at: string; provider_ids: number[] | null };

async function tableExists(name: string) {
  const [r] = await sql<{ ok: boolean }[]>`SELECT to_regclass(${`public.${name}`}) IS NOT NULL AS ok`;
  return r.ok;
}

async function countBy(table: string, modelId: number) {
  if (!(await tableExists(table))) return 0;
  const [r] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM ${sql(table)} WHERE model_id = ${modelId}`;
  return r.n;
}

function srcReferences(slug: string): string[] {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|json|md)$/.test(e.name) && fs.readFileSync(p, 'utf8').includes(slug)) hits.push(p);
    }
  };
  for (const d of ['src', 'messages']) if (fs.existsSync(d)) walk(d);
  return hits;
}

async function main() {
  console.log(`\n🧹 cleanup-dirty-models ${APPLY ? '[APPLY]' : '[DRY-RUN]'}\n`);

  // ---------- Part A ----------
  const all = await sql<Model[]>`SELECT id, name, slug, created_at::text, provider_ids FROM models ORDER BY id`;
  const flagged = all.map((m) => ({ m, v: checkModelIdentity(m.name, m.slug) })).filter((x) => !x.v.ok);
  console.log(`A. Models failing the identity guard: ${flagged.length} of ${all.length}`);

  const toDelete: Array<{ m: Model; channelPriceIds: number[] }> = [];
  for (const { m, v } of flagged) {
    const deletable = v.reasons.some((r) => DELETE_REASONS.has(r));
    const channelPrices = await sql<{ id: number }[]>`SELECT id FROM api_channel_prices WHERE model_id = ${m.id}`;
    const cascade: Record<string, number> = { api_channel_prices: channelPrices.length };
    for (const t of CASCADE_TABLES) cascade[t] = await countBy(t, m.id);
    const [ph] = channelPrices.length
      ? await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM price_history WHERE channel_price_id IN ${sql(channelPrices.map((r) => r.id))}`
      : [{ n: 0 }];
    cascade.price_history = ph.n;
    const blocking: Record<string, number> = {};
    for (const t of BLOCKING_TABLES) { const n = await countBy(t, m.id); if (n) blocking[t] = n; }
    if (await tableExists('clicks')) {
      const [clicks] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM clicks WHERE product ILIKE ${`%${m.slug}%`}`;
      if (clicks.n) blocking.clicks = clicks.n;
    }
    const src = srcReferences(m.slug);
    if (src.length) blocking.src = src.length;

    const verdict = !deletable ? 'REPORT_ONLY' : Object.keys(blocking).length ? 'MANUAL_REVIEW' : 'DELETE';
    console.log(`  [${verdict}] #${m.id} ${JSON.stringify(m.slug)} created ${m.created_at} providers=${JSON.stringify(m.provider_ids)}`);
    console.log(`      reasons: ${v.reasons.join(', ')}`);
    console.log(`      rows going with it: ${JSON.stringify(cascade)}${Object.keys(blocking).length ? `  blocking refs: ${JSON.stringify(blocking)}` : ''}`);
    if (verdict === 'DELETE') toDelete.push({ m, channelPriceIds: channelPrices.map((r) => r.id) });
  }
  console.log(`  → ${toDelete.length} model(s) to delete: ${toDelete.map((d) => d.m.slug).join(' | ') || '(none)'}\n`);

  // ---------- Part B ----------
  // Endpoint cache prices belong only to endpoint variants; never copy to a route.
  const bad = await sql<{ id: number; slug: string; provider: string; input: number; cached: number }[]>`
    SELECT p.id, m.slug, pr.slug AS provider, p.input_price_per_1m::float8 AS input, p.cached_input_price_per_1m::float8 AS cached
      FROM api_channel_prices p JOIN models m ON m.id = p.model_id JOIN providers pr ON pr.id = p.provider_id
     WHERE p.cached_input_price_per_1m > p.input_price_per_1m ORDER BY p.id`;
  const otherBad = bad.filter((r) => !toDelete.some((d) => d.channelPriceIds.includes(r.id)));
  const badVariants = await sql<{ id: number; slug: string; provider: string; variant_key: string; input: number; cached: number }[]>`
    SELECT v.id, m.slug, pr.slug AS provider, v.variant_key, v.input_price_per_1m::float8 AS input, v.cached_input_price_per_1m::float8 AS cached
      FROM api_channel_price_variants v JOIN models m ON m.id = v.model_id JOIN providers pr ON pr.id = v.provider_id
     WHERE v.cached_input_price_per_1m > v.input_price_per_1m ORDER BY v.id`;
  console.log(`B2. Other rows with cached > input → set NULL: ${otherBad.length} api_channel_prices, ${badVariants.length} variants`);
  for (const r of otherBad) console.log(`  #${r.id} ${r.provider}/${r.slug}: input ${r.input} < cached ${r.cached}`);
  for (const r of badVariants) console.log(`  variant #${r.id} ${r.provider}/${r.slug} [${r.variant_key}]: input ${r.input} < cached ${r.cached}`);

  console.log(`\nSummary: delete ${toDelete.length} model(s); null ${otherBad.length + badVariants.length} cached > input row(s).`);
  if (!APPLY) { console.log('Dry-run only. Re-run with --apply to write (single transaction).'); return; }

  // Backup everything we touch before writing.
  const ids = toDelete.map((d) => d.m.id);
  const cpIds = toDelete.flatMap((d) => d.channelPriceIds);
  const backup: Record<string, unknown> = { at: new Date().toISOString(), otherBad, badVariants };
  if (ids.length) {
    backup.models = await sql`SELECT * FROM models WHERE id IN ${sql(ids)}`;
    backup.api_channel_prices = await sql`SELECT * FROM api_channel_prices WHERE model_id IN ${sql(ids)}`;
    if (cpIds.length) backup.price_history = await sql`SELECT * FROM price_history WHERE channel_price_id IN ${sql(cpIds)}`;
    for (const t of CASCADE_TABLES) if (await tableExists(t)) backup[t] = await sql`SELECT * FROM ${sql(t)} WHERE model_id IN ${sql(ids)}`;
  }
  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 2));
  console.log(`💾 backup: ${BACKUP}`);

  await sql.begin(async (rawTx) => {
    const tx = rawTx as unknown as typeof sql;
    if (ids.length) {
      if (cpIds.length) await tx`DELETE FROM price_history WHERE channel_price_id IN ${tx(cpIds)}`;
      for (const t of CASCADE_TABLES) if (await tableExists(t)) await tx`DELETE FROM ${tx(t)} WHERE model_id IN ${tx(ids)}`;
      await tx`DELETE FROM api_channel_prices WHERE model_id IN ${tx(ids)}`;
      const deleted = await tx`DELETE FROM models WHERE id IN ${tx(ids)} RETURNING id`;
      if (deleted.length !== ids.length) throw new Error(`expected ${ids.length} model deletes, got ${deleted.length}`);
    }
    if (otherBad.length) await tx`UPDATE api_channel_prices SET cached_input_price_per_1m = NULL, updated_at = now() WHERE id IN ${tx(otherBad.map((r) => r.id))}`;
    if (badVariants.length) await tx`UPDATE api_channel_price_variants SET cached_input_price_per_1m = NULL, updated_at = now() WHERE id IN ${tx(badVariants.map((r) => r.id))}`;
  });
  console.log('✅ Applied in one transaction.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => sql.end());
