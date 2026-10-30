#!/usr/bin/env tsx
/** #275. Offline dry-run by default. Never reads .env.local or DATABASE_URL.
 * --snapshot FILE: exact DB-free plan for an exported test snapshot.
 * --db-dry-run / --apply: explicitly opt into REPAIR_275_DATABASE_URL (loopback only).
 * Apply resolves and writes under one serializable, locked transaction.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import {
  TABLES_275, emptySnapshot275, exampleSnapshot275, planRepair275,
  type Row275, type Snapshot275, type Table275,
} from './data/plan-minimax-flash-kimi-tiers';

export function options275(args: string[]) {
  const options = { apply: false, dbDryRun: false, snapshot: '', priceBasis: 'annual-equivalent' as 'annual-equivalent' | 'issue-monthly' };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--apply': options.apply = true; break;
      case '--dry-run': break;
      case '--db-dry-run': options.dbDryRun = true; break;
      case '--snapshot':
        options.snapshot = args[++i];
        if (!options.snapshot || options.snapshot.startsWith('--')) throw new Error('--snapshot needs a JSON file');
        break;
      case '--issue-monthly': options.priceBasis = 'issue-monthly'; break;
      default: throw new Error(`Unknown option: ${args[i]}`);
    }
  }
  if ((options.apply && (args.includes('--dry-run') || options.dbDryRun || options.snapshot)) || (options.dbDryRun && options.snapshot)) throw new Error('Choose offline dry-run, --snapshot FILE, --db-dry-run, or --apply');
  return options;
}

export function localDatabaseUrl275(value?: string): string {
  if (!value) throw new Error('Set REPAIR_275_DATABASE_URL explicitly to a local test database; DATABASE_URL is ignored');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.searchParams.has('host') || url.searchParams.has('hostaddr')) throw new Error('Only a loopback PostgreSQL test database is allowed');
  return value;
}

async function main() {
  const options = options275(process.argv.slice(2));
  const report = (snapshot: Snapshot275, label: string) => {
    const result = planRepair275(snapshot, options.priceBasis);
    console.log(label);
    console.log(JSON.stringify({ ...result, after: undefined }, null, 2));
    console.log(`${result.steps.length} row changes; ${options.apply ? 'APPLY' : 'DRY-RUN (no writes)'}. Temporary negative IDs are resolved on insertion.`);
    return result;
  };
  if (!options.apply && !options.dbDryRun) {
    report(options.snapshot ? JSON.parse(readFileSync(options.snapshot, 'utf8')) : exampleSnapshot275(),
      options.snapshot ? `Snapshot: ${options.snapshot}` : 'OFFLINE EXAMPLE from issue #275; illustrative IDs, not a live database inventory. Use --snapshot FILE or --db-dry-run for exact row IDs.');
    return;
  }
  const sql = postgres(localDatabaseUrl275(process.env.REPAIR_275_DATABASE_URL), { max: 1, prepare: false, connect_timeout: 5 });
  try {
    await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (!options.apply) await tx`SET TRANSACTION READ ONLY`;
      const refs = await tx<{ table_name: string; column_name: string }[]>`
        SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name
        FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'f' AND c.confrelid = 'models'::regclass`;
      const unknown = refs.filter(r => !TABLES_275.includes(r.table_name as Table275) || r.column_name !== 'model_id');
      if (unknown.length) throw new Error(`Unrecognized model references; nothing written: ${JSON.stringify(unknown)}`);
      if (options.apply) {
        // Lock before reading; a concurrent scrape cannot change the merge plan.
        for (const table of TABLES_275) await tx`LOCK TABLE ${tx(table)} IN SHARE ROW EXCLUSIVE MODE`;
      }
      const snapshot = emptySnapshot275();
      for (const table of TABLES_275) snapshot[table] = JSON.parse(JSON.stringify(await tx`SELECT * FROM ${tx(table)}`));
      const result = report(snapshot, 'Local test database (exact row plan)');
      if (!options.apply || !result.steps.length) return;
      // Tables such as models/plans/mappings have no source_url column. Keep
      // provenance AND before/after for every change, without altering their schema.
      await tx`CREATE TABLE IF NOT EXISTS data_fix_275_audit (
        id bigserial PRIMARY KEY, table_name text NOT NULL, row_key jsonb NOT NULL,
        action text NOT NULL, before_row jsonb, after_row jsonb,
        source_url text NOT NULL, last_verified timestamptz NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now())`;
      const insertedIds = new Map<string, number>();
      const resolveRow = (table: Table275, row: Row275): Row275 => Object.fromEntries(Object.entries(row).map(([key, value]) => {
        const ref = key === 'model_id' ? 'models' : key === 'plan_id' ? 'plans' : key === 'channel_price_id' ? 'api_channel_prices' : key === 'id' ? table : null;
        if (ref && typeof value === 'number' && value < 0) {
          const id = insertedIds.get(`${ref}:${value}`);
          if (id == null) throw new Error(`Unresolved insertion ${ref}:${value}`);
          return [key, id];
        }
        return [key, value];
      }));
      for (const step of result.steps) {
        const values = resolveRow(step.table, step.values);
        let key: Row275;
        let after: Row275 | null;
        if (step.action === 'insert') {
          const [row] = await tx`INSERT INTO ${tx(step.table)} ${tx(values as never, ...Object.keys(values))} RETURNING *`;
          if (typeof step.key.id === 'number') insertedIds.set(`${step.table}:${step.key.id}`, row.id);
          key = step.table === 'model_slug_redirects' ? { old_slug: row.old_slug } : { id: row.id };
          after = row as Row275;
        } else {
          key = resolveRow(step.table, step.key);
          const column = step.table === 'model_slug_redirects' ? 'old_slug' : 'id';
          const where = tx`${tx(column)} = ${key[column] as string | number}`;
          if (step.action === 'delete') {
            const rows = await tx`DELETE FROM ${tx(step.table)} WHERE ${where} RETURNING *`;
            if (rows.length !== 1) throw new Error(`Delete failed: ${step.table}`);
            after = null;
          } else {
            const [row] = await tx`UPDATE ${tx(step.table)} SET ${tx(values as never, ...Object.keys(values))} WHERE ${where} RETURNING *`;
            if (!row) throw new Error(`Update failed: ${step.table}`);
            after = row as Row275;
          }
        }
        await tx`INSERT INTO data_fix_275_audit (table_name, row_key, action, before_row, after_row, source_url, last_verified)
          VALUES (${step.table}, ${tx.json(key as never)}, ${step.action}, ${step.before ? tx.json(step.before as never) : null},
            ${after ? tx.json(after as never) : null}, ${step.source_url}, ${step.last_verified})`;
      }
      const check = emptySnapshot275();
      for (const table of TABLES_275) check[table] = JSON.parse(JSON.stringify(await tx`SELECT * FROM ${tx(table)}`));
      if (planRepair275(check, options.priceBasis).steps.length) throw new Error('Postcondition failed: second plan must be empty; rolling back');
      console.log('Applied atomically; second run is a no-op. Every change recorded in data_fix_275_audit.');
    });
  } finally { await sql.end(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
