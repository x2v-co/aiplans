import { sql } from '@/lib/db';
import type { CodingAgentLeaderboard, CodingAgentRow } from '@/lib/coding-agents-format';

export type { CodingAgentLeaderboard, CodingAgentRow };

const ROW_SELECT = `
  SELECT s.agent_name, s.agent_display_label, s.host_model_slug, s.provider_slug,
         s.index_version, s.index_score, s.deepswe_score, s.terminalbench_score,
         s.sweatlas_score, s.cost_per_task_usd, s.wall_time_per_task_sec,
         s.steps_per_task, s.refusal_rate, s.is_default, s.is_highlighted,
         s.source_materialized_at::text AS source_materialized_at,
         m.slug AS model_slug, m.name AS model_name,
         (SELECT logo_url FROM providers p WHERE p.id = m.provider_ids[1]) AS model_logo_url
    FROM coding_agent_scores s
    LEFT JOIN models m ON m.id = s.model_id
   WHERE s.is_unavailable IS NOT TRUE
`;

interface ScoreQueryRow {
  agent_name: string;
  agent_display_label: string;
  host_model_slug: string;
  provider_slug: string | null;
  index_version: string;
  index_score: number;
  deepswe_score: number | null;
  terminalbench_score: number | null;
  sweatlas_score: number | null;
  cost_per_task_usd: number | null;
  wall_time_per_task_sec: number | null;
  steps_per_task: number | null;
  refusal_rate: number | null;
  is_default: boolean;
  is_highlighted: boolean;
  source_materialized_at: string | null;
  model_slug: string | null;
  model_name: string | null;
  model_logo_url: string | null;
}

function toRow(r: ScoreQueryRow): CodingAgentRow {
  return {
    agentName: r.agent_name,
    agentDisplayLabel: r.agent_display_label,
    hostModelSlug: r.host_model_slug,
    providerSlug: r.provider_slug,
    indexVersion: r.index_version,
    indexScore: r.index_score,
    deepsweScore: r.deepswe_score,
    terminalbenchScore: r.terminalbench_score,
    sweatlasScore: r.sweatlas_score,
    costPerTaskUsd: r.cost_per_task_usd,
    wallTimePerTaskSec: r.wall_time_per_task_sec,
    stepsPerTask: r.steps_per_task,
    refusalRate: r.refusal_rate,
    isDefault: r.is_default,
    isHighlighted: r.is_highlighted,
    sourceMaterializedAt: r.source_materialized_at,
    modelSlug: r.model_slug,
    modelName: r.model_name,
    modelLogoUrl: r.model_logo_url,
  };
}

/** Default (non-variant) leaderboard rows, highest index first. */
export async function getCodingAgentLeaderboard(): Promise<CodingAgentLeaderboard> {
  try {
    const result = await sql.unsafe(
      `${ROW_SELECT} AND s.is_default = true ORDER BY s.index_score DESC`,
    ) as ScoreQueryRow[];
    const rows = result.map(toRow);
    return {
      rows,
      indexVersion: rows[0]?.indexVersion ?? null,
      sourceMaterializedAt: rows[0]?.sourceMaterializedAt ?? null,
    };
  } catch {
    // Pre-migration / fresh databases: render the empty state, never a 500.
    return { rows: [], indexVersion: null, sourceMaterializedAt: null };
  }
}

/** Coding-agent harness rows evaluated on one local model (any harness, ranked). */
export async function getCodingAgentRowsForModel(modelId: number): Promise<CodingAgentRow[]> {
  try {
    const result = await sql.unsafe(
      `${ROW_SELECT} AND s.is_default IS NOT FALSE AND s.model_id = $1 ORDER BY s.index_score DESC`,
      [modelId],
    ) as ScoreQueryRow[];
    return result.map(toRow);
  } catch {
    return [];
  }
}
