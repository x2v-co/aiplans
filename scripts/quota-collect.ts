#!/usr/bin/env tsx
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Sql } from 'postgres';
import { sendTelegram, telegramCredentials } from './quota-text-monitor';
import { dailyMeasurements, detectAnomalies, formatAnomaly } from './quota-collect/anomaly';
import { collectors } from './quota-collect/index';
import { loadHistory, persistSamples } from './quota-collect/store';
import { dailySummary, formatDailySummary, windowSummary } from './quota-collect/summary';
import { COLLECTOR_IDS, CollectorSkipped, opaqueLabel, uniqueSamples, type CollectOptions, type Sample } from './quota-collect/types';

export type Options = CollectOptions & { collector?: string; apply: boolean; alert: boolean; out?: string; help: boolean };
export function parseOptions(args: string[]): Options {
  const opts: Options = { accountLabel: 'local-paid', apply: false, alert: false, help: false };
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    const [flag, ...rest] = args[i].split('=');
    const inline = rest.length ? rest.join('=') : undefined;
    if (['--apply', '--alert', '--dry-run', '--help'].includes(flag)) {
      if (inline !== undefined) throw new Error(`${flag} does not take a value`);
      if (flag === '--apply') opts.apply = true;
      if (flag === '--alert') opts.alert = true;
      if (flag === '--dry-run') dryRun = true;
      if (flag === '--help') opts.help = true;
      continue;
    }
    const fields = {
      '--collector': 'collector', '--account-label': 'accountLabel', '--codex-dir': 'codexDir',
      '--ccusage-json': 'ccusageJson', '--ccusage-plan': 'ccusagePlan', '--out': 'out',
    } as const;
    const key = fields[flag as keyof typeof fields];
    if (!key) throw new Error(`Unknown argument: ${flag}`);
    const value = inline ?? args[++i];
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
    opts[key] = value;
  }
  opaqueLabel(opts.accountLabel);
  if (opts.apply && dryRun) throw new Error('--apply and --dry-run are mutually exclusive');
  if (opts.alert && !opts.apply) throw new Error('--alert requires --apply; dry-run never sends messages');
  if (opts.collector && !COLLECTOR_IDS.includes(opts.collector as typeof COLLECTOR_IDS[number])) throw new Error('Unknown collector');
  return opts;
}

export async function alertAnomalies(
  anomalies: ReturnType<typeof detectAnomalies>, apply: boolean, alert: boolean,
  env = process.env, send = sendTelegram,
): Promise<number> {
  if (!apply || !alert || !anomalies.length) return 0;
  const { token, chatId } = telegramCredentials(env);
  if (!token) throw new Error('--apply --alert requires Telegram credentials in the environment (see quota-text-monitor)');
  for (const anomaly of anomalies) await send(token, chatId, formatAnomaly(anomaly));
  return anomalies.length;
}

export async function collectSamples(opts: Options) {
  const samples: Sample[] = [];
  let failed = 0;
  for (const collector of collectors.filter((c) => !opts.collector || c.id === opts.collector)) {
    try {
      const result = await collector.collect({ ...opts, warn: (message) => console.warn(message) });
      samples.push(...result);
      console.log(`[${collector.id}] ok: ${result.length} samples`);
    } catch (error) {
      if (error instanceof CollectorSkipped) console.log(`[${collector.id}] skipped: ${error.message}`);
      else {
        failed++;
        // Avoid propagating arbitrary JSON/log content through parser errors.
        console.error(`[${collector.id}] failed: ${error instanceof SyntaxError ? 'Invalid input JSON' : error instanceof Error ? error.message : 'Collector error'}`);
      }
    }
  }
  return { samples: uniqueSamples(samples), failed };
}

export async function main(args = process.argv.slice(2)) {
  const opts = parseOptions(args);
  if (opts.help) {
    console.log('quota:collect [--collector ID] [--account-label ALIAS] [--codex-dir CODEX_HOME]\n'
      + '  [--ccusage-json FILE --ccusage-plan PLAN_SLUG] [--out NEW_FILE.jsonl] [--apply [--alert]]\n'
      + 'Default: local dry-run, no DB access or Telegram. --out exclusively creates a mode-600 JSONL file.\n'
      + '--apply uses DATABASE_URL from the environment; never loads credential files or runs migrations.');
    return;
  }
  if (opts.apply && !process.env.DATABASE_URL) throw new Error('--apply requires DATABASE_URL in the environment');
  if (opts.alert && !telegramCredentials().token) throw new Error('--apply --alert requires Telegram credentials in the environment');
  const { samples, failed } = await collectSamples(opts);
  for (const sample of samples) console.log(JSON.stringify(sample));
  console.log(formatDailySummary(dailySummary(samples)));
  for (const window of windowSummary(samples)) console.log(`Window summary: ${JSON.stringify(window)}`);
  const previewAnomalies = detectAnomalies(dailyMeasurements(windowSummary(samples)));
  for (const anomaly of previewAnomalies) console.log(formatAnomaly(anomaly));
  console.log(`Anomalies: ${previewAnomalies.length} (local history)`);
  // A failed requested collector prevents partial writes/alerts. Stubs are skipped, not failures.
  if (failed) { process.exitCode = 1; return; }
  if (opts.out) {
    await writeFile(opts.out, samples.map((s) => JSON.stringify(s)).join('\n') + (samples.length ? '\n' : ''), { flag: 'wx', mode: 0o600 });
    console.log(`Wrote ${samples.length} samples to local JSONL`);
  }
  if (!opts.apply || !samples.length) {
    console.log(opts.apply ? 'No samples to apply' : 'Dry-run: no database access or Telegram messages');
    return;
  }
  // Lazy import and connection only after explicit --apply. No dotenv/auth-file loading.
  const postgres = (await import('postgres')).default;
  const sql: Sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 10 });
  try {
    await persistSamples(sql, samples);
    const history = await loadHistory(sql, samples);
    const currentDays = new Set(samples.map((s) => `${s.collector}/${s.accountLabel}/${s.planSlug}/${s.observedAt.slice(0, 10)}`));
    const anomalies = detectAnomalies(dailyMeasurements(windowSummary(history))).filter((a) => currentDays.has(`${a.collector}/${a.accountLabel}/${a.planSlug}/${a.day}`));
    for (const anomaly of anomalies) console.log(formatAnomaly(anomaly));
    console.log(`Applied ${samples.length} samples; anomalies: ${anomalies.length}`);
    const alerts = await alertAnomalies(anomalies, opts.apply, opts.alert);
    if (opts.alert) console.log(`Telegram alerts sent: ${alerts}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error('quota-collect:', error instanceof Error ? error.message : 'Run failed');
    process.exitCode = 1;
  });
}
