#!/usr/bin/env tsx
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres, { type Sql } from 'postgres';
import {
  agreementSuggestions, ccusageDraft, intakeOptions, monthlyRange, parseEvidence, planInsert,
  type Evidence,
} from './utils/quota-evidence';

export type PlannedInsert = ReturnType<typeof planInsert>;
export function insertStatement(row: PlannedInsert) {
  const entries = Object.entries(row);
  return {
    sql: `INSERT INTO quota_evidence (${entries.map(([key]) => `"${key}"`).join(', ')}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (content_hash) DO NOTHING RETURNING id`,
    parameters: entries.map(([, value]) => value),
  };
}

export interface EvidenceDatabase {
  known(hash: string): Promise<boolean>;
  insert(row: PlannedInsert): Promise<number | undefined>;
  review(id: number, status: 'accepted' | 'rejected'): Promise<boolean>;
}

export function evidenceDatabase(sql: Sql): EvidenceDatabase {
  return {
    async known(hash) {
      // Enforce read-only at transaction level, including accidental future changes.
      return sql.begin('read only', async (tx) => {
        // postgres@3 TransactionSql drops the callable signature in its Omit type.
        const transaction = tx as unknown as Sql;
        const rows = await transaction`SELECT id FROM quota_evidence WHERE content_hash = ${hash}`;
        return rows.length > 0;
      });
    },
    async insert(row) {
      const statement = insertStatement(row);
      const rows = await sql.unsafe<{ id: number }[]>(statement.sql, statement.parameters);
      return rows[0]?.id;
    },
    async review(id, status) {
      const rows = await sql`
        UPDATE quota_evidence SET review_status = ${status}, reviewed_at = clock_timestamp()
        WHERE id = ${id} AND (review_status = 'pending' OR review_status IS NULL) RETURNING id
      `;
      return rows.length > 0;
    },
  };
}

export async function reviewEvidence(id: number, status: 'accepted' | 'rejected', apply: boolean, database?: EvidenceDatabase) {
  if (!apply) throw new Error('--review requires --apply');
  if (!Number.isSafeInteger(id) || id <= 0 || !['accepted', 'rejected'].includes(status)) throw new Error('Invalid review id/status');
  if (!database) throw new Error('DATABASE_URL is required for --review');
  if (!await database.review(id, status)) throw new Error(`Evidence ${id} is missing or already reviewed`);
}

export async function intakeEvidence(evidence: Evidence[], apply: boolean, database?: EvidenceDatabase, log: (line: string) => void = console.log) {
  if (apply && !database) throw new Error('DATABASE_URL is required for --apply');
  // Validate every derivation before the first write.
  const plans = evidence.map((item) => ({ item, row: planInsert(item) }));
  const seen = new Set<string>();
  for (const { item, row } of plans) {
    const range = monthlyRange(item);
    log(`${item.plan_slug}: implied monthly tokens ${range ? JSON.stringify({ low: range.low, high: range.high }) : 'unavailable (requires tokens, percentages and explicit calculation assumptions)'}; confidence=${row.confidence}`);
    if (seen.has(row.content_hash) || await database?.known(row.content_hash)) {
      log(`SKIP duplicate content_hash=${row.content_hash}`);
      continue;
    }
    seen.add(row.content_hash);
    log(`${apply ? 'APPLY' : 'DRY-RUN'} ${JSON.stringify(insertStatement(row))}`);
    if (apply) {
      const id = await database!.insert(row);
      log(id === undefined ? `SKIP concurrent duplicate content_hash=${row.content_hash}` : `Inserted evidence ${id}`);
    }
  }
  for (const suggestion of agreementSuggestions(evidence)) log(suggestion);
}

export async function loadEvidence(files: string[], directory = resolve('data/quota-evidence')) {
  const paths = files.length ? files : (await readdir(directory)).filter((file) => /\.(json|ya?ml)$/i.test(file)).sort().map((file) => resolve(directory, file));
  return Promise.all(paths.map(async (file) => {
    try { return parseEvidence(await readFile(file, 'utf8'), file); }
    catch (error) { throw new Error(`${file}: ${error instanceof Error ? error.message : 'Invalid evidence'}`); }
  }));
}

export async function main(args = process.argv.slice(2)) {
  const options = intakeOptions(args);
  if (options.ccusage) {
    const draft = ccusageDraft(JSON.parse(await readFile(options.ccusage, 'utf8')), {
      plan: options.plan!, before: options.before!, after: options.after!, date: options.date,
      url: options.url, screenshotUrl: options.screenshotUrl,
    });
    const json = `${JSON.stringify(draft, null, 2)}\n`;
    // Explicit --output creates a local draft; never overwrite an existing file.
    if (options.output) await writeFile(options.output, json, { flag: 'wx' });
    else process.stdout.write(json);
    return;
  }
  const evidence = options.review ? [] : await loadEvidence(options.files);
  // No dotenv: only an explicitly supplied runtime URL can enable DB access.
  const sql = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10, prepare: false }) : undefined;
  const database = sql ? evidenceDatabase(sql) : undefined;
  try {
    if (options.review) {
      await reviewEvidence(options.review.id, options.review.status, options.apply, database);
      console.log(`Evidence ${options.review.id}: ${options.review.status}`);
    } else {
      if (!evidence.length) console.log('No evidence files found (examples ending in .sample are excluded).');
      await intakeEvidence(evidence, options.apply, database);
    }
  } finally {
    await sql?.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    // Driver failures can contain connection details; expose only the SQLSTATE.
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
    console.error('quota-evidence:', code ? `Operation failed (${code}); check connection and manual migrations 0005/0012` : error instanceof Error ? error.message : 'Operation failed');
    process.exitCode = 1;
  });
}
