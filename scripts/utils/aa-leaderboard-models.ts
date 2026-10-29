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
 *
 * Around 2026-10-21 AA also moved the per-benchmark scores off the row into a
 * nested `"scores":{"gpqa-diamond":0.83,...}` object keyed by eval slug (same
 * 0–1 scale). `normalizeAaRow` lifts those back onto the flat camelCase fields
 * the importer reads; flat fields still win when both are present.
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
  /** Nested eval-slug → score map used by the leaderboard since ~2026-10-21. */
  scores?: Record<string, number | null> | null;
}

/** Benchmark fields imported from AA rows; a row counts as scored if any is numeric. */
export const AA_SCORE_FIELDS = ['gpqa', 'hle', 'scicode', 'terminalbenchHard', 'ifbench', 'mmmuPro'] as const;

/** Keys AA has used for the scored rows, newest first. Tried before the generic scan. */
export const AA_KNOWN_MODEL_KEYS = ['initialModels', 'models'] as const;

export const AA_MIN_MODELS = 50;

/**
 * Eval slugs AA uses in the nested `scores` object for each flat field, in
 * preference order. Note `hle-diamond` is a different eval from HLE text-only.
 */
export const AA_NESTED_SCORE_KEYS: Readonly<Record<string, readonly string[]>> = {
  gpqa: ['gpqa-diamond', 'gpqa'],
  hle: ['humanitys-last-exam', 'hle'],
  scicode: ['scicode'],
  terminalbenchHard: ['terminalbench-hard', 'terminal-bench-hard', 'terminalbenchHard'],
  ifbench: ['ifbench'],
  mmmuPro: ['mmmu-pro', 'mmmuPro'],
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Copy nested `scores[evalSlug]` values onto missing flat score fields. Non-objects pass through. */
export function normalizeAaRow<T>(row: T): T {
  if (row === null || typeof row !== 'object') return row;
  const nested = (row as { scores?: unknown }).scores;
  if (nested === null || typeof nested !== 'object' || Array.isArray(nested)) return row;
  const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const [field, keys] of Object.entries(AA_NESTED_SCORE_KEYS)) {
    if (isFiniteNumber(out[field])) continue;
    const key = keys.find((candidate) => isFiniteNumber((nested as Record<string, unknown>)[candidate]));
    if (key) out[field] = (nested as Record<string, unknown>)[key];
  }
  return out as T;
}

/** "slug,name,…; nested scores{gpqa-diamond,…}" for the error message when nothing is scored. */
export function describeRowShape(row: unknown): string {
  if (row === null || typeof row !== 'object') return `non-object row (${row === null ? 'null' : typeof row})`;
  const entries = Object.entries(row as Record<string, unknown>);
  const nested = entries
    .filter(([, value]) => value !== null && typeof value === 'object' && !Array.isArray(value))
    .map(([key, value]) => {
      const keys = Object.keys(value as object);
      return `${key}{${keys.slice(0, 15).join(',')}${keys.length > 15 ? `,…+${keys.length - 15}` : ''}}`;
    });
  return `keys=${entries.map(([key]) => key).join(',')}${nested.length ? `; nested ${nested.join(' ')}` : ''}`;
}

interface CandidateReport {
  key: string;
  offset: number;
  rows: number;
  scored: number;
  error?: string;
  sample?: unknown;
}

function scoredCount(rows: unknown[], scoreFields: readonly string[]): number {
  return rows.filter((row) =>
    row !== null && typeof row === 'object' && typeof (row as { slug?: unknown }).slug === 'string'
      && scoreFields.some((field) => isFiniteNumber((row as Record<string, unknown>)[field])),
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
      const raw: unknown = JSON.parse(extractBalancedArray(flight, arrayStart));
      if (!Array.isArray(raw)) return;
      const parsed = raw.map((row) => normalizeAaRow(row));
      report.rows = parsed.length;
      report.sample = raw[0];
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
    // Show the shape of the largest candidate so a renamed/moved score field is
    // obvious from the log alone (no need to re-fetch the page to debug).
    const withRows = reports.filter((r) => r.rows > 0);
    const sampled = withRows.find((r) => (AA_KNOWN_MODEL_KEYS as readonly string[]).includes(r.key))
      ?? [...withRows].sort((a, b) => b.rows - a.rows)[0];
    const shape = sampled ? ` Sample row ${sampled.key}[0]: ${describeRowShape(sampled.sample)}.` : '';
    throw new Error(
      `Could not find scored models payload in Artificial Analysis page; tried keys ${AA_KNOWN_MODEL_KEYS.join(', ')} `
      + `and generic "<key>":[{"slug" scan. Looked for numeric ${scoreFields.join('/')} on the row or in a nested `
      + `"scores" object (${Object.values(AA_NESTED_SCORE_KEYS).map((k) => k[0]).join('/')}). Candidates: ${tried}.${shape}`,
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
