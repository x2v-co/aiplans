#!/usr/bin/env tsx
/**
 * Import the Artificial Analysis Coding Agent Index snapshot
 * (https://artificialanalysis.ai/agents/coding-agents) into
 * coding_agent_scores.
 *
 * Rows are agent-harness x host-model combinations (Claude Code + Fable 5.1,
 * Codex + GPT-6 Astra, ...) carrying the composite index, its three pass@1
 * components (DeepSWE v1.1, Terminal-Bench 4.0, SWE-Atlas-QnA) and pooled
 * efficiency metrics (USD cost and agent wall time per task).
 *
 * Like the other AA leaderboard the data rides in the page's RSC flight
 * payload; there is no separate JSON endpoint. The English and Chinese pages
 * emit identical records, so the English URL is canonical.
 *
 * Usage:
 *   npm run ingest:coding-agents -- --dry-run
 *   npm run ingest:coding-agents
 */
import { databaseSql } from './db/postgres-admin';
import {
  AA_USER_AGENT,
  extractBalancedObject,
  parseNextFlight,
} from './utils/artificial-analysis';
import { deriveHostModelSlug, resolveHostModel } from './utils/coding-agent-host';

const DRY_RUN = process.argv.includes('--dry-run');
const SOURCE_URL = 'https://artificialanalysis.ai/agents/coding-agents';
const MIN_RECORDS = 10;

interface AaEval {
  datasetIndexName: string;
  mean?: { reward?: number | null } | null;
}

interface AaCodingRecord {
  id: string;
  isDefault: boolean;
  isHighlighted: boolean;
  isUnavailable: boolean;
  agentName: string;
  provider: string;
  /** Dropped by AA in the 2026-10-16 snapshot; see deriveHostModelSlug. */
  hostModelSlug?: string;
  display?: { agent?: string; model?: string } | null;
  modelCreators?: Array<{ slug?: string }> | null;
  displayLabel: string;
  variantOf: string | null;
  indexVersion?: string;
  indexScore: number;
  evals: AaEval[];
  mean?: {
    costUsd?: number | null;
    agentWallTimeSec?: number | null;
    steps?: number | null;
    totalTokens?: number | null;
  } | null;
  safety?: { rate?: number | null } | null;
}

interface CodingScoreRow {
  source_record_id: string;
  agent_name: string;
  agent_display_label: string;
  variant_of: string | null;
  host_model_slug: string;
  model_id: number | null;
  provider_slug: string;
  index_version: string;
  index_score: number;
  deepswe_score: number | null;
  terminalbench_score: number | null;
  sweatlas_score: number | null;
  cost_per_task_usd: number | null;
  wall_time_per_task_sec: number | null;
  steps_per_task: number | null;
  total_tokens_per_task: number | null;
  refusal_rate: number | null;
  is_default: boolean;
  is_highlighted: boolean;
  is_unavailable: boolean;
  raw: unknown;
  source_materialized_at: string | null;
  observed_date: string;
}

function parseRecords(flight: string): AaCodingRecord[] {
  const records = new Map<string, AaCodingRecord>();
  const recordStart = /\{"id":"[0-9a-f]{32}","isDefault"/g;
  for (const match of flight.matchAll(recordStart)) {
    const candidate = JSON.parse(extractBalancedObject(flight, match.index)) as AaCodingRecord;
    if (typeof candidate.indexScore === 'number' && Array.isArray(candidate.evals)) {
      records.set(candidate.id, candidate);
    }
  }
  return [...records.values()];
}

function componentScore(record: AaCodingRecord, dataset: string): number | null {
  const evalRow = record.evals.find((entry) => entry.datasetIndexName === dataset);
  const reward = evalRow?.mean?.reward;
  return typeof reward === 'number' && Number.isFinite(reward) ? reward : null;
}

const INDEX_VERSION_PATTERN = /Coding Agent Index v(\d+(?:\.\d+)+)/;

/**
 * The version label ("Coding Agent Index v1.5") used to live in the Next.js
 * flight payload. Since early Oct 2026 AA renders it only in the server HTML
 * (chart caption + JSON-LD description), so fall back to the raw page.
 */
function extractIndexVersion(flight: string, html: string): string {
  const match = flight.match(INDEX_VERSION_PATTERN) ?? html.match(INDEX_VERSION_PATTERN);
  if (!match) throw new Error('Could not locate Coding Agent Index version label in payload');
  return `v${match[1]}`;
}

async function fetchSnapshot(): Promise<{ records: AaCodingRecord[]; indexVersion: string; materializedAt: string | null }> {
  const response = await fetch(SOURCE_URL, {
    headers: { 'user-agent': AA_USER_AGENT },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Artificial Analysis returned HTTP ${response.status}`);
  const html = await response.text();
  const flight = parseNextFlight(html);

  const records = parseRecords(flight);
  if (records.length < MIN_RECORDS) {
    throw new Error(`Only ${records.length} coding-agent records parsed; refusing a partial import`);
  }
  const complete = records.filter(
    (record) => record.evals.length >= 3 && typeof record.indexScore === 'number' && Number.isFinite(record.indexScore),
  );
  if (complete.length < MIN_RECORDS) {
    throw new Error(`Only ${complete.length}/${records.length} records have the full 3-eval index; source format changed?`);
  }

  const indexVersion = extractIndexVersion(flight, html);

  const materializedAt = [...flight.matchAll(/"materializedAt":"([^"]+)"/g)].map((m) => m[1]).sort().at(-1) ?? null;
  return { records: complete, indexVersion, materializedAt };
}

async function main() {
  console.log(`\nArtificial Analysis coding-agent import ${DRY_RUN ? '[DRY RUN]' : '[APPLY]'}\n`);
  const { records, indexVersion, materializedAt } = await fetchSnapshot();
  console.log(`Parsed ${records.length} records, Coding Agent Index ${indexVersion}, snapshot ${materializedAt ?? 'unknown'}.`);

  const localModels = await databaseSql<Array<{ id: number; slug: string }>>`SELECT id, slug FROM models WHERE type ILIKE '%llm%'`;
  const bySlug = new Map(localModels.map((model) => [model.slug, model]));
  const observedDate = new Date().toISOString().slice(0, 10);

  const rows: CodingScoreRow[] = [];
  const matchedSlugs = new Map<string, string>();
  const unmatched = new Set<string>();
  const skippedIds: string[] = [];
  for (const record of records) {
    const hostModelSlug = deriveHostModelSlug(record);
    if (!hostModelSlug) {
      skippedIds.push(record.id);
      console.warn(`⚠️ Skipping coding-agent record ${record.id} (${record.displayLabel ?? record.agentName ?? 'unknown'}): no host model slug`);
      continue;
    }
    const local = resolveHostModel(hostModelSlug, bySlug);
    if (local) matchedSlugs.set(record.id, local.slug);
    else unmatched.add(hostModelSlug);
    rows.push({
      source_record_id: record.id,
      agent_name: record.agentName,
      agent_display_label: record.displayLabel,
      variant_of: record.variantOf,
      host_model_slug: hostModelSlug,
      model_id: local?.id ?? null,
      provider_slug: record.provider,
      index_version: indexVersion,
      index_score: record.indexScore,
      deepswe_score: componentScore(record, 'deep-swe-v1.1'),
      terminalbench_score: componentScore(record, 'terminal-bench-v4'),
      sweatlas_score: componentScore(record, 'swe-atlas-qna'),
      cost_per_task_usd: record.mean?.costUsd ?? null,
      wall_time_per_task_sec: record.mean?.agentWallTimeSec ?? null,
      steps_per_task: record.mean?.steps ?? null,
      total_tokens_per_task: record.mean?.totalTokens ?? null,
      refusal_rate: record.safety?.rate ?? null,
      is_default: record.isDefault,
      is_highlighted: record.isHighlighted,
      is_unavailable: record.isUnavailable,
      raw: record,
      source_materialized_at: materializedAt,
      observed_date: observedDate,
    });
  }

  rows.sort((a, b) => b.index_score - a.index_score);
  for (const row of rows) {
    const mappedTo = matchedSlugs.get(row.source_record_id);
    const status = mappedTo ? `→ ${mappedTo}` : 'unmapped';
    console.log(
      `  ${(row.index_score * 100).toFixed(1).padStart(5)}  $${(row.cost_per_task_usd ?? 0).toFixed(2).padStart(7)}  ` +
      `${row.agent_name} — ${row.host_model_slug} ${status}${row.is_default ? '' : ' (non-default)'}`,
    );
  }
  console.log(`\nMapped: ${matchedSlugs.size}/${rows.length} rows; unmatched hosts: ${[...unmatched].join(', ') || 'none'}`);
  if (skippedIds.length) console.warn(`⚠️ Skipped ${skippedIds.length} record(s) without host model info; their existing rows are kept.`);
  if (rows.length < MIN_RECORDS) {
    throw new Error(`Only ${rows.length} importable coding-agent records after skipping; refusing a partial import`);
  }

  if (DRY_RUN) {
    console.log('\nDry-run only. Re-run without --dry-run to write.');
    return;
  }

  await databaseSql.begin(async (transaction) => {
    // postgres@3 types TransactionSql as Omit<Sql, …>, which drops the
    // tagged-template call signature. Cast it back.
    const tx = transaction as unknown as typeof databaseSql;
    const insertRows = rows.map((row) => ({ ...row, raw: databaseSql.json(row.raw as unknown as Record<string, unknown>) }));
    await tx`
      INSERT INTO coding_agent_scores ${
        tx(insertRows,
          'source_record_id', 'agent_name', 'agent_display_label', 'variant_of', 'host_model_slug',
          'model_id', 'provider_slug', 'index_version', 'index_score',
          'deepswe_score', 'terminalbench_score', 'sweatlas_score',
          'cost_per_task_usd', 'wall_time_per_task_sec', 'steps_per_task', 'total_tokens_per_task',
          'refusal_rate', 'is_default', 'is_highlighted', 'is_unavailable',
          'raw', 'source_materialized_at', 'observed_date')
      }
      ON CONFLICT (source_record_id) DO UPDATE SET
        agent_name = EXCLUDED.agent_name,
        agent_display_label = EXCLUDED.agent_display_label,
        variant_of = EXCLUDED.variant_of,
        host_model_slug = EXCLUDED.host_model_slug,
        model_id = EXCLUDED.model_id,
        provider_slug = EXCLUDED.provider_slug,
        index_version = EXCLUDED.index_version,
        index_score = EXCLUDED.index_score,
        deepswe_score = EXCLUDED.deepswe_score,
        terminalbench_score = EXCLUDED.terminalbench_score,
        sweatlas_score = EXCLUDED.sweatlas_score,
        cost_per_task_usd = EXCLUDED.cost_per_task_usd,
        wall_time_per_task_sec = EXCLUDED.wall_time_per_task_sec,
        steps_per_task = EXCLUDED.steps_per_task,
        total_tokens_per_task = EXCLUDED.total_tokens_per_task,
        refusal_rate = EXCLUDED.refusal_rate,
        is_default = EXCLUDED.is_default,
        is_highlighted = EXCLUDED.is_highlighted,
        is_unavailable = EXCLUDED.is_unavailable,
        raw = EXCLUDED.raw,
        source_materialized_at = EXCLUDED.source_materialized_at,
        observed_date = EXCLUDED.observed_date,
        updated_at = now()
    `;
    // Retire rows that disappeared from the current index version (delisted
    // agent variants or an index-version bump with non-overlapping ids).
    // Skipped records are not delisted, so keep their last-known-good rows.
    const ids = [...rows.map((row) => row.source_record_id), ...skippedIds];
    await tx`
      DELETE FROM coding_agent_scores
      WHERE index_version = ${indexVersion}
        AND source_record_id NOT IN ${tx(ids)}
    `;
  });
  console.log(`\nUpserted ${rows.length} coding_agent_scores rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => databaseSql.end());
