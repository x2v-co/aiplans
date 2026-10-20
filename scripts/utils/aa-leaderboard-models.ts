/**
 * Locate the scored model rows in the Artificial Analysis model leaderboard
 * (https://artificialanalysis.ai/leaderboards/models) RSC flight payload.
 *
 * AA renames the prop that carries the rows from time to time: it was
 * `"models":[...]` until 2026-10-18 and became `"initialModels":[...]` on
 * 2026-10-19, while a slug/name-only `"models"` array (no scores) stayed on the
 * page. So instead of trusting one key we try the known keys first, then every
 * other `"<key>":[{"slug":...` array, and keep whichever has the most rows with
 * at least one selected benchmark score.
 */
import { extractBalancedArray, parseNextFlight } from './artificial-analysis';

export interface AaModel {
  name: string;
  shortName?: string;
  slug: string;
  releaseDate?: string | null;
  deprecated?: boolean;
  intelligenceIndex?: number | null;
  gpqa?: number | null;
  hle?: number | null;
  scicode?: number | null;
  terminalbenchHard?: number | null;
  ifbench?: number | null;
  mmmuPro?: number | null;
  price1mInputTokens?: number | null;
  price1mOutputTokens?: number | null;
  cacheHitPrice?: number | null;
  cacheWritePrice?: number | null;
}

/** Benchmark fields imported from AA rows; a row counts as scored if any is numeric. */
export const AA_SCORE_FIELDS = ['gpqa', 'hle', 'scicode', 'terminalbenchHard', 'ifbench', 'mmmuPro'] as const;

/** Keys AA has used for the scored rows, newest first. Tried before the generic scan. */
export const AA_KNOWN_MODEL_KEYS = ['initialModels', 'models'] as const;

export const AA_MIN_MODELS = 50;

interface CandidateReport {
  key: string;
  offset: number;
  rows: number;
  scored: number;
  error?: string;
}

function scoredCount(rows: unknown[], scoreFields: readonly string[]): number {
  return rows.filter((row) =>
    row !== null && typeof row === 'object' && typeof (row as { slug?: unknown }).slug === 'string'
      && scoreFields.some((field) => typeof (row as Record<string, unknown>)[field] === 'number'),
  ).length;
}

/**
 * Pick the best scored-model array from a flight string. Throws with every
 * key/offset tried (rows and scored counts) when nothing usable is found.
 */
export function extractScoredModelsFromFlight(
  flight: string,
  { minModels = AA_MIN_MODELS, scoreFields = AA_SCORE_FIELDS as readonly string[] } = {},
): { models: AaModel[]; key: string } {
  const reports: CandidateReport[] = [];
  const seen = new Set<number>();
  let best: { models: AaModel[]; key: string; scored: number } | undefined;

  const consider = (key: string, arrayStart: number) => {
    if (seen.has(arrayStart)) return;
    seen.add(arrayStart);
    const report: CandidateReport = { key, offset: arrayStart, rows: 0, scored: 0 };
    reports.push(report);
    try {
      const parsed: unknown = JSON.parse(extractBalancedArray(flight, arrayStart));
      if (!Array.isArray(parsed)) return;
      report.rows = parsed.length;
      report.scored = scoredCount(parsed, scoreFields);
      if (report.scored > 0 && (!best || report.scored > best.scored)) {
        best = { models: parsed as AaModel[], key, scored: report.scored };
      }
    } catch (error) {
      report.error = error instanceof Error ? error.message : String(error);
    }
  };

  // 1) Known keys (any value shape that starts an array).
  for (const key of AA_KNOWN_MODEL_KEYS) {
    const marker = `"${key}":[`;
    for (let index = flight.indexOf(marker); index !== -1; index = flight.indexOf(marker, index + 1)) {
      consider(key, index + marker.length - 1);
    }
  }
  // 2) Generic scan: any array of objects whose first field is a slug.
  for (const match of flight.matchAll(/"([A-Za-z0-9_$]+)":\[\{"slug":/g)) {
    consider(match[1], match.index + match[0].indexOf('['));
  }

  const tried = reports.length
    ? reports.map((r) => `${r.key}@${r.offset}(rows=${r.rows}, scored=${r.scored}${r.error ? `, error=${r.error}` : ''})`).join('; ')
    : 'none';
  if (!best) {
    throw new Error(
      `Could not find scored models payload in Artificial Analysis page; tried keys ${AA_KNOWN_MODEL_KEYS.join(', ')} `
      + `and generic "<key>":[{"slug" scan. Candidates: ${tried}`,
    );
  }
  if (best.models.length < minModels) {
    throw new Error(
      `Only ${best.models.length} models parsed from "${best.key}"; refusing a partial import. Candidates: ${tried}`,
    );
  }
  return { models: best.models, key: best.key };
}

export function parseScoredModelsFromHtml(
  html: string,
  options?: Parameters<typeof extractScoredModelsFromFlight>[1],
): { models: AaModel[]; key: string } {
  return extractScoredModelsFromFlight(parseNextFlight(html), options);
}
