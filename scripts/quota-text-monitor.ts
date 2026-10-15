#!/usr/bin/env tsx
/** Manual only. Default/--dry-run reads snapshots; --apply enables writes and Telegram. */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Sql } from 'postgres';
import { QUOTA_TEXT_SOURCES, type QuotaTextSource } from './config/quota-text-sources';
import {
  contentHash, extractText, lineDiff, monitorOptions, normalizeQuotaText, snapshotDecision,
  type SnapshotState,
} from './utils/quota-text-monitor';

type SnapshotRow = {
  id: number; content_hash: string; extracted_text: string;
  changed: boolean; alerted_at: Date | null;
};

function state(row?: SnapshotRow): SnapshotState | undefined {
  return row && { contentHash: row.content_hash, extractedText: row.extracted_text, changed: row.changed, alertedAt: row.alerted_at };
}

/** Injected fetch makes delivery behavior testable without network. Never log token-bearing URLs. */
export async function sendTelegram(token: string, chatId: string, message: string, fetcher: typeof fetch = fetch): Promise<void> {
  let response: Response;
  try {
    response = await fetcher(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message.slice(0, 3900), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error('Telegram request failed');
  }
  if (!response.ok || (await response.json() as { ok?: boolean }).ok !== true) {
    throw new Error(`Telegram send failed (http=${response.status})`);
  }
}

export async function observeSnapshot(sql: Sql | undefined, source: QuotaTextSource, text: string, dryRun: boolean, token: string | undefined) {
  const hash = contentHash(text);
  const inspect = async (connection: Sql) => {
    const [latest] = await connection<SnapshotRow[]>`
      SELECT id, content_hash, extracted_text, changed, alerted_at FROM quota_text_snapshots
      WHERE source_id = ${source.id} ORDER BY fetched_at DESC, id DESC LIMIT 1
    `;
    const [known] = await connection<SnapshotRow[]>`
      SELECT id, content_hash, extracted_text, changed, alerted_at FROM quota_text_snapshots
      WHERE source_id = ${source.id} AND content_hash = ${hash}
    `;
    return { latest, known };
  };
  const preview = (latest?: SnapshotRow, known?: SnapshotRow) => {
    const decision = snapshotDecision(state(latest), state(known), hash);
    const diff = lineDiff(latest?.extracted_text ?? '', text);
    console.log(`[${source.id}] ${dryRun ? '[dry-run] ' : ''}${!latest ? 'baseline' : latest.content_hash === hash ? 'unchanged' : 'changed'}${known ? ' (known hash)' : ''}\n${source.url}${diff ? `\n${diff}` : ''}`);
    return { decision, diff };
  };

  if (dryRun) {
    if (!sql) console.log(`[${source.id}] DATABASE_URL absent; preview without a stored baseline`);
    const rows = sql ? await inspect(sql) : undefined;
    preview(rows?.latest, rows?.known);
    return;
  }
  if (!sql || !token) throw new Error('Apply requires database and Telegram credentials');

  await sql.begin(async (rawTransaction) => {
    // postgres@3's TransactionSql Omit type drops callable signatures (same as audit ingestion).
    const transaction = rawTransaction as unknown as Sql;
    // Serialize manual runs per source, including alert delivery and dedup marking.
    await transaction`SELECT pg_advisory_xact_lock(hashtextextended(${`quota-text:${source.id}`}, 0))`;
    const { latest, known } = await inspect(transaction);
    const { decision, diff } = preview(latest, known);
    let id = known?.id;
    if (decision.insert) {
      const [inserted] = await transaction<{ id: number }[]>`
        INSERT INTO quota_text_snapshots (source_id, url, content_hash, extracted_text, changed, fetched_at)
        VALUES (${source.id}, ${source.url}, ${hash}, ${text}, ${decision.changed}, clock_timestamp()) RETURNING id
      `;
      id = inserted.id;
      if (decision.changed) {
        await transaction`
          INSERT INTO quota_evidence (evidence_type, url, captured_at, raw_value, notes)
          VALUES ('official_text', ${source.url}, CURRENT_DATE, ${text}, 'pending review')
        `;
      }
    } else {
      // Unique hashes represent content versions; fetched_at is the last observation.
      // Refresh reappearing content so the next comparison uses the actual last text.
      await transaction`UPDATE quota_text_snapshots SET fetched_at = clock_timestamp() WHERE id = ${id!}`;
    }
    if (decision.alert) {
      try {
        await sendTelegram(token, process.env.AIPLANS_TG_CHAT_ID || '6217573976', `[aiplans] Quota text changed: ${source.name} (${source.id})\n${source.url}\n${diff || '(retrying pending alert)'}`);
        await transaction`UPDATE quota_text_snapshots SET alerted_at = clock_timestamp() WHERE id = ${id!}`;
      } catch (error) {
        // Commit snapshot/evidence; an unchanged retry can deliver this pending alert.
        console.error(`[${source.id}] ${error instanceof Error ? error.message : 'Telegram failed'}; alert remains pending`);
      }
    }
  });
}

export async function main(args = process.argv.slice(2)) {
  config({ path: resolve(process.cwd(), '.env.local') });
  const { dryRun, sourceId } = monitorOptions(args);
  const sources = QUOTA_TEXT_SOURCES.filter((source) => !sourceId || source.id === sourceId);
  if (!sources.length) throw new Error(`Unknown source: ${sourceId}`);
  const token = process.env.AIPLANS_TG_BOT_TOKEN;
  if (!dryRun && !token) {
    console.log('quota-text-monitor: AIPLANS_TG_BOT_TOKEN missing; skipping (no writes or alerts)');
    return;
  }
  // Reuse the audit DB client, but do not initialize it for credential-free previews.
  const sql = process.env.DATABASE_URL ? (await import('./db/postgres-admin')).databaseSql : undefined;
  if (!dryRun && !sql) throw new Error('DATABASE_URL is required for --apply');
  let failures = 0;
  try {
    for (const source of sources) {
      try {
        const response = await fetch(source.url, {
          headers: { 'user-agent': 'aiplans-quota-monitor/1.0', accept: 'text/html,text/plain' },
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.text();
        const text = normalizeQuotaText(response.headers.get('content-type')?.includes('text/plain') ? body : extractText(body));
        if (!text) throw new Error('No quota text; page may require JavaScript/authentication (snapshot skipped)');
        await observeSnapshot(sql, source, text, dryRun, token);
      } catch (error) {
        failures++;
        console.error(`[${source.id}] ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } finally {
    await sql?.end({ timeout: 5 });
  }
  if (failures > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error('quota-text-monitor:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
