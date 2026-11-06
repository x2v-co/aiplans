#!/usr/bin/env tsx
/**
 * Official quota-text monitor. Default/--dry-run reads snapshots only; --apply writes and alerts.
 * Scheduled daily via deploy/production/aiplans-quota-monitor.{service,timer}:
 *   npm run quota:monitor -- --apply
 * Per-source fetch/extraction failures are warnings; exit is non-zero only when every
 * enabled source fails or the database fails. --test-alert only tests delivery.
 */
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
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

/** Native requests with a private direct connection bypass proxy env/global fetch agents. */
const directFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Unsupported protocol');
  return new Promise<Response>((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method: 'POST', agent: false, headers: { 'content-type': 'application/json' },
      signal: init?.signal ?? undefined,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        try {
          const status = response.statusCode ?? 500;
          resolve(new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks).toString('utf8'), { status }));
        } catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    request.end(init?.body);
  });
};

/** Do not expose request errors or API response bodies: either may contain credentials. */
export async function sendFeishu(webhookUrl: string, message: string, fetcher: typeof fetch = directFetch): Promise<void> {
  try {
    const response = await fetcher(webhookUrl, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ msg_type: 'text', content: { text: message } }),
      signal: AbortSignal.timeout(15_000),
    });
    const body: unknown = response.ok ? await response.json() : undefined;
    if (!body || typeof body !== 'object' || !('code' in body) || body.code !== 0) throw new Error();
  } catch {
    throw new Error('Feishu send failed (request, HTTP or API error)');
  }
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
  let accepted = false;
  try { accepted = response.ok && (await response.json() as { ok?: boolean } | null)?.ok === true; } catch { /* invalid JSON */ }
  if (!accepted) {
    throw new Error(`Telegram send failed (http=${response.status})`);
  }
}

export type AlertChannels = { feishuWebhookUrl?: string; telegramToken?: string; telegramChatId?: string };

/** Compatibility for the separate quota collector; the text monitor uses alertChannels. */
export function telegramCredentials(env: NodeJS.ProcessEnv = process.env): { token?: string; chatId: string; tokenEnv?: string } {
  const token = env.AIPLANS_TG_BOT_TOKEN || env.BRAIN_TG_TOKEN || undefined;
  const tokenEnv = env.AIPLANS_TG_BOT_TOKEN ? 'AIPLANS_TG_BOT_TOKEN' : env.BRAIN_TG_TOKEN ? 'BRAIN_TG_TOKEN' : undefined;
  return { token, tokenEnv, chatId: env.AIPLANS_TG_CHAT_ID || env.BRAIN_TG_CHAT_ID || '6217573976' };
}

export function alertChannels(env: NodeJS.ProcessEnv = process.env): AlertChannels {
  return {
    feishuWebhookUrl: env.FEISHU_ALERT_WEBHOOK_URL || undefined,
    telegramToken: env.AIPLANS_TG_BOT_TOKEN || env.BRAIN_TG_TOKEN || undefined,
    telegramChatId: env.AIPLANS_TG_CHAT_ID || env.BRAIN_TG_CHAT_ID || undefined,
  };
}

/** Telegram is used only when Feishu is absent or fails. Success on either completes delivery. */
export async function sendAlert(channels: AlertChannels, message: string, fetcher?: typeof fetch): Promise<void> {
  if (channels.feishuWebhookUrl) {
    try { await sendFeishu(channels.feishuWebhookUrl, message, fetcher); return; }
    catch { console.warn('quota-text-monitor: WARN Feishu delivery failed; trying Telegram fallback if configured'); }
  }
  if (channels.telegramToken && channels.telegramChatId) {
    await sendTelegram(channels.telegramToken, channels.telegramChatId, message, fetcher);
    return;
  }
  throw new Error(channels.feishuWebhookUrl ? 'Feishu delivery failed; no Telegram fallback configured' : 'No alert channel configured');
}

export async function observeSnapshot(sql: Sql | undefined, source: QuotaTextSource, text: string, dryRun: boolean, channels: AlertChannels = alertChannels(), fetcher?: typeof fetch) {
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
  if (!sql) throw new Error('Apply requires database');

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
        await sendAlert(channels, `[aiplans] Quota text changed: ${source.name} (${source.id})\n${source.url}\n${diff || '(retrying pending alert)'}`, fetcher);
        await transaction`UPDATE quota_text_snapshots SET alerted_at = clock_timestamp() WHERE id = ${id!}`;
      } catch {
        // Commit snapshot/evidence; an unchanged retry can deliver this pending alert.
        console.warn(`[${source.id}] WARN alert delivery failed or no channel configured; alert remains pending`);
      }
    }
  });
}

const BROWSER_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 aiplans-quota-monitor/1.1',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
  'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8',
};
const PLAIN_HEADERS = { 'user-agent': 'aiplans-quota-monitor/1.1 (+https://aiplans.dev)', accept: 'text/html,text/plain' };

/** One retry with alternate headers on 403/429; other statuses fail immediately. */
export async function fetchSourceText(source: QuotaTextSource, fetcher: typeof fetch = fetch): Promise<string> {
  let response = await fetcher(source.url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(30_000) });
  if (response.status === 403 || response.status === 429) {
    response = await fetcher(source.url, { headers: PLAIN_HEADERS, signal: AbortSignal.timeout(30_000) });
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.text();
  const text = normalizeQuotaText(response.headers.get('content-type')?.includes('text/plain') ? body : extractText(body));
  if (!text) throw new Error('No quota text; page may require JavaScript/authentication (snapshot skipped)');
  return text;
}

export type SourceStatus = { id: string; status: 'ok' | 'failed' | 'disabled'; detail?: string };
export type FailureState = Record<string, { consecutive: number; lastError: string; alertedAt?: string }>;

/** Update consecutive-failure counts; return ids that just reached the threshold (alert once). */
export function updateFailureState(state: FailureState, results: SourceStatus[], threshold: number): string[] {
  const reached: string[] = [];
  for (const result of results) {
    if (result.status === 'ok') { delete state[result.id]; continue; }
    if (result.status !== 'failed') continue;
    const entry = state[result.id] ?? { consecutive: 0, lastError: '' };
    entry.consecutive += 1;
    entry.lastError = result.detail ?? '';
    if (entry.consecutive >= threshold && !entry.alertedAt) { entry.alertedAt = new Date().toISOString(); reached.push(result.id); }
    state[result.id] = entry;
  }
  return reached;
}

/** Exit policy: DB errors are thrown elsewhere; here only "everything failed" is fatal. */
export function runExitCode(results: SourceStatus[]): number {
  const attempted = results.filter((result) => result.status !== 'disabled');
  return attempted.length > 0 && attempted.every((result) => result.status === 'failed') ? 1 : 0;
}

async function readState(path: string): Promise<FailureState> {
  try { return JSON.parse(await readFile(path, 'utf8')) as FailureState; } catch { return {}; }
}
async function writeState(path: string, state: FailureState) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, JSON.stringify(state, null, 2));
  await rename(`${path}.tmp`, path);
}

export async function main(args = process.argv.slice(2), loadEnv = () => { config({ path: resolve(process.cwd(), '.env.local'), quiet: true }); }, dependencies: { env?: NodeJS.ProcessEnv; sql?: Sql; fetcher?: typeof fetch } = {}) {
  loadEnv();
  const env = dependencies.env ?? process.env;
  const { dryRun, sourceId, testAlert } = monitorOptions(args);
  const channels = alertChannels(env);
  if (testAlert) {
    await sendAlert(channels, '【x2v 告警·测试】aiplans quota monitor alert delivery test', dependencies.fetcher);
    console.log('quota-text-monitor: test alert delivered');
    return;
  }
  const sources = QUOTA_TEXT_SOURCES.filter((source) => !sourceId || source.id === sourceId);
  if (!sources.length) throw new Error(`Unknown source: ${sourceId}`);
  if (!dryRun && !channels.feishuWebhookUrl && !(channels.telegramToken && channels.telegramChatId)) {
    console.warn('quota-text-monitor: WARN no alert channel configured; snapshots will still be written');
  }
  // Reuse the audit DB client, but do not initialize it for credential-free previews.
  const sql = dependencies.sql ?? (env.DATABASE_URL ? (await import('./db/postgres-admin')).databaseSql : undefined);
  if (!dryRun && !sql) throw new Error('DATABASE_URL is required for --apply');
  const results: SourceStatus[] = [];
  try {
    for (const source of sources) {
      if (source.enabled === false) {
        results.push({ id: source.id, status: 'disabled', detail: source.disabledReason });
        console.log(`[${source.id}] disabled: ${source.disabledReason ?? 'no reason given'}`);
        continue;
      }
      let text: string;
      try {
        text = await fetchSourceText(source, dependencies.fetcher);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        results.push({ id: source.id, status: 'failed', detail });
        console.warn(`[${source.id}] WARN ${detail}`);
        continue;
      }
      // DB errors are fatal (thrown out of the loop).
      await observeSnapshot(sql, source, text, dryRun, channels, dependencies.fetcher);
      results.push({ id: source.id, status: 'ok' });
    }
  } finally {
    await sql?.end({ timeout: 5 });
  }
  const failed = results.filter((result) => result.status === 'failed');
  console.log(`quota-text-monitor: ${results.filter((r) => r.status === 'ok').length} ok, ${failed.length} failed, ${results.filter((r) => r.status === 'disabled').length} disabled`
    + (failed.length ? ` (failed: ${failed.map((r) => `${r.id}=${r.detail}`).join('; ')})` : ''));
  const statePath = env.QUOTA_MONITOR_STATE_FILE;
  if (!dryRun && statePath && !sourceId) {
    const threshold = Math.max(1, Number(env.QUOTA_MONITOR_FAIL_ALERT_DAYS) || 3);
    const state = await readState(statePath);
    const reached = updateFailureState(state, results, threshold);
    if (reached.length) {
      const lines = reached.map((id) => `${id}: ${state[id].lastError}`).join('\n');
      try {
        await sendAlert(channels, `[aiplans] Quota monitor: source failing ${threshold}+ consecutive runs\n${lines}\nFix the URL/extraction or set enabled:false in scripts/config/quota-text-sources.ts`, dependencies.fetcher);
      } catch {
        for (const id of reached) delete state[id].alertedAt; // retry next run
        console.warn('quota-text-monitor: WARN failure alert not sent; alert remains pending');
      }
    }
    await writeState(statePath, state);
  }
  process.exitCode = runExitCode(results);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error('quota-text-monitor:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
