import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';
import { VEO_SLUGS, veoItem } from './catalog-2026-11-03-p1';

/**
 * Follow-up to #301 (SRE report 2026-11-03). Optional manual seed, never part of deploy.
 * Default dry-run runs in a READ ONLY transaction; --apply writes in one serializable
 * transaction. Diff-only updates, no inserts, no deletes; a second apply writes nothing.
 *
 * Veo 3.1 / Fast / Lite still carry the pre-Vertex Gemini API usage rows (for example
 * usage_prices#62: video_second 0.4, plan_id NULL). That channel (veo-3.1-*-generate-preview)
 * was shut down on 2026-10-22, so the rows are marked unavailable and labelled with the
 * retired channel. A row is "legacy" when it belongs to provider google and one of the three
 * models, and its price_kind is not one of the audited Vertex AI rates (usageRates) — the
 * Vertex rows written by seed:catalog-2026-11-03-p1 / seed:vertical-pricing are never touched.
 * Prices, units, plans and source URLs of the legacy rows are kept for history.
 */
export const GEMINI_API_CHANNEL = {
  channel: 'Gemini API',
  channel_status: 'shutdown',
  channel_shutdown_date: '2026-10-22',
  channel_replacement_model: 'gemini-omni-1.1-flash',
  channel_source_url: 'https://ai.google.dev/gemini-api/docs/deprecations',
} as const;

type Row = Record<string, unknown> & { id: number };
export interface FixStep { table: 'usage_prices'; target: string; id: number; action: 'update'; changes: ReturnType<typeof seedChanges> }

export function catalog20261103FixSeedOptions(args: string[]) {
  const known = new Set(['--apply', '--dry-run']);
  const unknown = args.filter(arg => !known.has(arg));
  if (unknown.length || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: tsx scripts/seed-catalog-2026-11-03-fix.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

function constraintsObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try { return JSON.parse(value) as Record<string, unknown>; } catch { /* fall through */ }
  }
  return value == null ? {} : { previous_constraints: value };
}

export function isLegacyVeoUsageRow(slug: string, row: Row): boolean {
  const vertexKinds = new Set(veoItem(slug).usageRates!.map(rate => rate.priceKind));
  return !vertexKinds.has(String(row.price_kind));
}

export async function seedCatalog20261103Fix(tx: Sql, apply = false): Promise<FixStep[]> {
  // ---- Validate everything before any write.
  const [google, ...extraGoogle] = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx(['google'])}`;
  if (!google || extraGoogle.length) throw new Error('Expected exactly one providers/google; nothing written.');
  const models = await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx([...VEO_SLUGS])}`;
  const steps: FixStep[] = [];
  const pending: { row: Row; payload: Record<string, unknown> }[] = [];
  for (const slug of VEO_SLUGS) {
    const matches = models.filter(m => m.slug === slug);
    if (matches.length !== 1) throw new Error(`Expected exactly one models/${slug}, found ${matches.length}; nothing written.`);
    const model = matches[0];
    const rows = await tx<Row[]>`SELECT * FROM usage_prices WHERE model_id = ${model.id} AND provider_id = ${google.id}`;
    for (const row of rows.filter(r => isLegacyVeoUsageRow(slug, r)).sort((a, b) => a.id - b.id)) {
      const desired = {
        is_available: false,
        constraints_json: { ...constraintsObject(row.constraints_json), ...GEMINI_API_CHANNEL },
      };
      const changes = seedChanges(row, desired);
      if (!Object.keys(changes).length) continue;
      steps.push({ table: 'usage_prices', target: `${slug}/${String(row.price_kind)}/${String(row.unit)}${row.plan_id == null ? '' : ` plan ${String(row.plan_id)}`}`, id: row.id, action: 'update', changes });
      pending.push({ row, payload: desired });
    }
  }
  if (!apply) return steps;
  for (const { row, payload } of pending) {
    const values = { ...payload, updated_at: new Date() };
    await tx`UPDATE ${tx('usage_prices')} SET ${tx(values, ...Object.keys(values))} WHERE id = ${row.id}`;
  }
  return steps;
}
