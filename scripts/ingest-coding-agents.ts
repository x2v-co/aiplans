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
  aaSlugCandidates,
  extractBalancedObject,
  parseNextFlight,
} from './utils/artificial-analysis';

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
  hostModelSlug: string;
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

/**
 * Explicit host-slug aliases for codenames and provider-prefixed slugs no
 * generic normalization can recover. Keep this curated; generic candidates
 * cover new hosts that follow the `provider_model` convention.
 */
const HOST_SLUG_ALIASES: Record<string, string> = {
  'anthropic_claude-fable-5-1': 'claude-fable-5.1',
  'anthropic_claude-opus-5': 'claude-opus-5',
  'openai_vega-alpha': 'gpt-6-astra',
  'openai_gpt-5-6-sol': 'gpt-5.6-sol',
  'deepseek_deepseek-v4-pro-0813': 'deepseek-v4-pro',
  'deepseek_deepseek-v4-flash-0731': 'deepseek-v4-flash',
  'xai_grok-4-6-xhigh': 'grok-4.6',
  'alibaba_cloud_qwen3-8-max-public': 'qwen3.8-max',
  'google_skimaki_ai-studio': 'gemini-3.8-flash',
  'cognition_fusion-claude-fable-5-1-xhigh-sidekick-penguin-medium': 'claude-fable-5.1',
  'cognition_fusion-gpt-6-astra-xhigh-sidekick-penguin-medium': 'gpt-6-astra',
};

/** Generic fallback: drop the AA provider prefix, then reuse model-slug rules. */
function hostSlugCandidates(hostModelSlug: string): string[] {
  const withoutProvider = hostModelSlug
    .replace(/^[a-z0-9]+_(?:aa_|cloud_)?/, '')
    .replace(/-public$/, '')
    .replace(/-\d{4}$/, '') // dated model snapshots, e.g. deepseek-v4-pro-0813
    .replace(/-(?:xhigh|high|medium|low|max)$/, '');
  return aaSlugCandidates(withoutProvider);
}

function resolveHostModel(
  hostModelSlug: string,
  bySlug: ReadonlyMap<string, { id: number }>,
): { id: number; slug: string } | undefined {
  const alias = HOST_SLUG_ALIASES[hostModelSlug];
  const candidates = alias ? [alias, ...hostSlugCandidates(hostModelSlug)] : hostSlugCandidates(hostModelSlug);
  for (const candidate of candidates) {
    const model = bySlug.get(candidate);
    if (model) return { id: model.id, slug: candidate };
  }
  return undefined;
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

async function fetchSnapshot(): Promise<{ records: AaCodingRecord[]; indexVersion: string; materializedAt: string | null }> {
  const response = await fetch(SOURCE_URL, {
    headers: { 'user-agent': AA_USER_AGENT },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Artificial Analysis returned HTTP ${response.status}`);
  const flight = parseNextFlight(await response.text());

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

  const versionMatch = flight.match(/Coding Agent Index v(\d+(?:\.\d+)+)/);
  if (!versionMatch) throw new Error('Could not locate Coding Agent Index version label in payload');
  const indexVersion = `v${versionMatch[1]}`;

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
  for (const record of records) {
    const local = resolveHostModel(record.hostModelSlug, bySlug);
    if (local) matchedSlugs.set(record.id, local.slug);
    else unmatched.add(record.hostModelSlug);
    rows.push({
      source_record_id: record.id,
      agent_name: record.agentName,
      agent_display_label: record.displayLabel,
      variant_of: record.variantOf,
      host_model_slug: record.hostModelSlug,
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
    const ids = rows.map((row) => row.source_record_id);
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
